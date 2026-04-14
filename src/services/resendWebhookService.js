const { createHttpError } = require("../utils/respondWithError");
const supabase = require("../config/supabase");
const {
  getResendClient,
  getResendConfig,
  isResendWebhookConfigured,
} = require("../config/resend");
const { invalidateOrderDerivedCaches } = require("../lib/cache/adminCache");

const normalizeHeaderValue = (value) => {
  if (Array.isArray(value)) {
    return String(value[0] || "").trim();
  }

  return String(value || "").trim();
};

const getWebhookHeaders = (headers = {}) => ({
  id: normalizeHeaderValue(headers["svix-id"]),
  timestamp: normalizeHeaderValue(headers["svix-timestamp"]),
  signature: normalizeHeaderValue(headers["svix-signature"]),
});

const verifyResendWebhookPayload = ({ payload, headers }) => {
  if (!isResendWebhookConfigured()) {
    throw createHttpError(
      "RESEND_WEBHOOK_SECRET belum dikonfigurasi pada backend.",
      503,
      { expose: true }
    );
  }

  const { webhookSecret } = getResendConfig();
  const resend = getResendClient();
  const normalizedHeaders = getWebhookHeaders(headers);

  if (
    !normalizedHeaders.id ||
    !normalizedHeaders.timestamp ||
    !normalizedHeaders.signature
  ) {
    throw createHttpError("Header signature webhook Resend tidak lengkap.", 400);
  }

  try {
    return resend.webhooks.verify({
      payload,
      webhookSecret,
      headers: normalizedHeaders,
    });
  } catch (error) {
    throw createHttpError("Signature webhook Resend tidak valid.", 400);
  }
};

const buildResendEventUpdate = (event) => {
  const eventType = String(event?.type || "").trim();
  const eventAt = event?.created_at || new Date().toISOString();
  const updates = {
    fulfillment_email_provider_status: eventType.replace(/^email\./, "") || null,
    fulfillment_email_last_event_at: eventAt,
    updated_at: new Date().toISOString(),
  };

  switch (eventType) {
    case "email.delivered":
      updates.fulfillment_email_status = "sent";
      updates.fulfillment_email_delivered_at = eventAt;
      updates.fulfillment_error = null;
      break;
    case "email.delivery_delayed":
      updates.fulfillment_error =
        "Pengiriman email tertunda di provider email. Coba cek log Resend.";
      break;
    case "email.bounced":
      updates.fulfillment_status = "manual_review";
      updates.fulfillment_email_status = "failed";
      updates.fulfillment_error =
        event?.data?.bounce?.message ||
        "Email ditolak oleh server tujuan (bounce).";
      break;
    case "email.failed":
      updates.fulfillment_status = "manual_review";
      updates.fulfillment_email_status = "failed";
      updates.fulfillment_error =
        event?.data?.failed?.reason || "Pengiriman email gagal diproses.";
      break;
    case "email.suppressed":
      updates.fulfillment_status = "manual_review";
      updates.fulfillment_email_status = "failed";
      updates.fulfillment_error =
        event?.data?.suppressed?.message ||
        "Email diblokir oleh suppression list provider.";
      break;
    case "email.complained":
      updates.fulfillment_status = "manual_review";
      updates.fulfillment_email_status = "failed";
      updates.fulfillment_error =
        "Penerima menandai email sebagai komplain. Tindak lanjuti manual.";
      break;
    default:
      break;
  }

  return updates;
};

const processResendWebhook = async ({ payload, headers }) => {
  const event = verifyResendWebhookPayload({ payload, headers });
  const emailId = String(event?.data?.email_id || "").trim();

  if (!emailId) {
    return {
      processed: false,
      reason: "missing_email_id",
      eventType: event?.type || null,
    };
  }

  const updates = buildResendEventUpdate(event);
  const { data, error } = await supabase
    .from("orders")
    .update(updates)
    .eq("fulfillment_email_id", emailId)
    .select("id, order_id, fulfillment_email_id, fulfillment_email_provider_status")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return {
      processed: false,
      reason: "order_not_found",
      eventType: event.type,
      emailId,
    };
  }

  invalidateOrderDerivedCaches();

  return {
    processed: true,
    eventType: event.type,
    emailId,
    orderId: data.id,
    orderPublicId: data.order_id,
  };
};

module.exports = {
  processResendWebhook,
};
