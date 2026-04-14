const { Resend } = require("resend");

const getResendConfig = () => ({
  apiKey: String(process.env.RESEND_API_KEY || "").trim(),
  fromEmail: String(process.env.RESEND_FROM_EMAIL || "").trim(),
  replyToEmail: String(process.env.RESEND_REPLY_TO || "").trim(),
  webhookSecret: String(process.env.RESEND_WEBHOOK_SECRET || "").trim(),
});

const isEmailDeliveryConfigured = () => {
  const { apiKey, fromEmail } = getResendConfig();
  return Boolean(apiKey && fromEmail);
};

const isResendWebhookConfigured = () => {
  const { webhookSecret } = getResendConfig();
  return Boolean(webhookSecret);
};

let resendClient = null;

const getResendClient = () => {
  const { apiKey } = getResendConfig();

  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY wajib diisi untuk mengaktifkan pengiriman email otomatis."
    );
  }

  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }

  return resendClient;
};

module.exports = {
  getResendClient,
  getResendConfig,
  isEmailDeliveryConfigured,
  isResendWebhookConfigured,
};
