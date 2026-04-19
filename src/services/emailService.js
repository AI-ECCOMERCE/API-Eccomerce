const { getResendClient, getResendConfig } = require("../config/resend");

const STORE_NAME = "Poinstore";
const STORE_URL = "https://www.poinstore.my.id";
const DEFAULT_SUPPORT_EMAIL = "support@poinstore.my.id";
const ADMIN_WHATSAPP_DISPLAY = "085656252426";
const ADMIN_WHATSAPP_URL = "https://wa.me/6285656252426";

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatCurrency = (amount) =>
  `Rp ${Number(amount || 0).toLocaleString("id-ID")}`;

const extractEmailAddress = (value) => {
  const raw = String(value || "").trim();
  const match = raw.match(/<([^>]+)>/);

  return String(match?.[1] || raw).trim().toLowerCase();
};

const extractEmailDomain = (value) => {
  const address = extractEmailAddress(value);
  const [, domain = ""] = address.split("@");
  return domain;
};

const getSupportEmail = ({ fromEmail, replyToEmail }) =>
  extractEmailAddress(replyToEmail) ||
  extractEmailAddress(fromEmail) ||
  DEFAULT_SUPPORT_EMAIL;

const getEmailPreheader = (order) =>
  `Pembayaran untuk pesanan ${order.order_id} sudah berhasil. Admin ${STORE_NAME} akan segera menghubungi Anda via WhatsApp.`;

const buildCustomerPhoneRow = (order) =>
  order.customer_phone
    ? `<p style="margin:8px 0 0;font-size:15px;color:#0f172a;"><strong>Nomor WhatsApp:</strong> ${escapeHtml(
        order.customer_phone
      )}</p>`
    : "";

const buildEmailHtml = ({ order, supportEmail }) => `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:32px 16px;color:#0f172a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${escapeHtml(getEmailPreheader(order))}
    </div>
    <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:24px;border:1px solid #e2e8f0;overflow:hidden;">
      <div style="padding:28px 28px 20px;background:linear-gradient(135deg,#0f172a,#1e293b);">
        <p style="margin:0 0 8px;color:#93c5fd;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">${STORE_NAME}</p>
        <h1 style="margin:0;color:#ffffff;font-size:28px;line-height:1.2;">Pembayaran Anda berhasil kami terima</h1>
        <p style="margin:12px 0 0;color:#cbd5e1;font-size:15px;line-height:1.6;">
          Halo ${escapeHtml(order.customer_name)}, terima kasih. Pembayaran untuk pesanan <strong>${escapeHtml(
            order.order_id
          )}</strong> sudah berhasil kami verifikasi.
        </p>
      </div>

      <div style="padding:28px;">
        <div style="border:1px solid #e2e8f0;border-radius:18px;padding:18px;background:#f8fafc;">
          <p style="margin:0 0 6px;color:#64748b;font-size:13px;">Ringkasan pesanan</p>
          <p style="margin:0;font-size:15px;color:#0f172a;"><strong>Order ID:</strong> ${escapeHtml(
            order.order_id
          )}</p>
          <p style="margin:8px 0 0;font-size:15px;color:#0f172a;"><strong>Total dibayar:</strong> ${formatCurrency(
            order.payment_total || order.total_price
          )}</p>
          ${buildCustomerPhoneRow(order)}
          <p style="margin:8px 0 0;font-size:14px;color:#475569;">Anda menerima email ini karena melakukan pembelian di ${escapeHtml(
            STORE_URL
          )}.</p>
        </div>

        <div style="margin-top:24px;padding:22px;border-radius:18px;background:#ecfdf5;border:1px solid #bbf7d0;">
          <p style="margin:0 0 10px;font-size:15px;font-weight:700;color:#047857;">Langkah berikutnya</p>
          <p style="margin:0;color:#064e3b;font-size:15px;line-height:1.7;">
            Admin kami akan segera menghubungi Anda melalui WhatsApp sesuai nomor yang sudah Anda isi saat checkout. Mohon pastikan nomor WhatsApp tersebut aktif agar proses pesanan dapat kami lanjutkan dengan cepat.
          </p>
          <p style="margin:14px 0 0;color:#064e3b;font-size:15px;line-height:1.7;">
            Jika ingin menghubungi kami lebih dulu, silakan klik tombol di bawah atau kirim pesan WhatsApp ke <strong>${ADMIN_WHATSAPP_DISPLAY}</strong>.
          </p>
          <a href="${ADMIN_WHATSAPP_URL}" style="display:inline-block;margin-top:18px;padding:12px 18px;border-radius:10px;background:#16a34a;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">
            Hubungi Admin via WhatsApp
          </a>
        </div>

        <p style="margin:24px 0 0;color:#64748b;font-size:14px;line-height:1.7;">
          Apabila Anda belum menerima pesan WhatsApp dari admin, Anda juga dapat membalas email ini atau menghubungi <a href="mailto:${escapeHtml(
            supportEmail
          )}" style="color:#1d4ed8;text-decoration:none;">${escapeHtml(
            supportEmail
          )}</a>.
        </p>
        <p style="margin:16px 0 0;color:#94a3b8;font-size:12px;line-height:1.7;">
          Email transaksi ini dikirim otomatis oleh ${STORE_NAME}. Mohon jangan tandai email ini sebagai spam agar informasi pesanan berikutnya masuk ke inbox utama.
        </p>
      </div>
    </div>
  </div>
`;

const buildEmailText = ({ order, supportEmail }) => {
  return [
    `Halo ${order.customer_name},`,
    "",
    "Terima kasih. Pembayaran Anda sudah berhasil kami terima dan verifikasi.",
    "",
    "Ringkasan pesanan:",
    `Order ID: ${order.order_id}`,
    `Total dibayar: ${formatCurrency(order.payment_total || order.total_price)}`,
    order.customer_phone ? `Nomor WhatsApp: ${order.customer_phone}` : null,
    `Website: ${STORE_URL}`,
    "",
    "Langkah berikutnya:",
    "Admin kami akan segera menghubungi Anda melalui WhatsApp sesuai nomor yang sudah Anda isi saat checkout. Mohon pastikan nomor WhatsApp tersebut aktif agar proses pesanan dapat kami lanjutkan dengan cepat.",
    "",
    `Jika ingin menghubungi kami lebih dulu, silakan WhatsApp ke ${ADMIN_WHATSAPP_DISPLAY}: ${ADMIN_WHATSAPP_URL}`,
    "",
    `Apabila Anda belum menerima pesan WhatsApp dari admin, Anda juga dapat membalas email ini atau menghubungi ${supportEmail}.`,
    "",
    `Email transaksi ini dikirim otomatis oleh ${STORE_NAME}.`,
  ]
    .filter(Boolean)
    .join("\n");
};

const createResendError = (message, options = {}) => {
  const error = new Error(message);
  error.code = options.code || "RESEND_SEND_ERROR";
  error.isProviderConfigError = Boolean(options.isProviderConfigError);
  return error;
};

const normalizeResendSendError = (error) => {
  const providerMessage = String(error?.message || "").trim();

  if (providerMessage === "Application not found") {
    return createResendError(
      "Resend API key tidak terhubung ke aplikasi atau workspace yang aktif. Buat API key baru dari dashboard Resend lalu update RESEND_API_KEY.",
      {
        code: "RESEND_APPLICATION_NOT_FOUND",
        isProviderConfigError: true,
      }
    );
  }

  if (providerMessage.toLowerCase().includes("invalid api key")) {
    return createResendError(
      "RESEND_API_KEY tidak valid. Gunakan API key aktif dari dashboard Resend.",
      {
        code: "RESEND_INVALID_API_KEY",
        isProviderConfigError: true,
      }
    );
  }

  if (providerMessage.toLowerCase().includes("domain is not verified")) {
    return createResendError(
      "Domain pada RESEND_FROM_EMAIL belum terverifikasi di Resend. Verifikasi domain atau sesuaikan sender email dengan domain yang sudah verified.",
      {
        code: "RESEND_DOMAIN_NOT_VERIFIED",
        isProviderConfigError: true,
      }
    );
  }

  return createResendError(
    providerMessage || "Gagal mengirim email fulfillment."
  );
};

const sendOrderDeliveryEmail = async ({ order }) => {
  const resend = getResendClient();
  const { fromEmail, replyToEmail } = getResendConfig();
  const supportEmail = getSupportEmail({ fromEmail, replyToEmail });
  const fromDomain = extractEmailDomain(fromEmail);
  const replyToDomain = extractEmailDomain(replyToEmail);

  if (replyToDomain && fromDomain && replyToDomain !== fromDomain) {
    console.warn(
      `Resend deliverability warning: RESEND_REPLY_TO memakai domain berbeda (${replyToDomain}) dari sender (${fromDomain}). Untuk inbox placement yang lebih baik, gunakan reply-to dengan domain yang sama.`
    );
  }

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: [order.customer_email],
    subject: `${STORE_NAME} | Pembayaran pesanan ${order.order_id} berhasil`,
    html: buildEmailHtml({ order, supportEmail }),
    text: buildEmailText({ order, supportEmail }),
    headers: {
      "X-Entity-Ref-ID": order.order_id,
    },
    ...(replyToEmail ? { replyTo: replyToEmail } : {}),
  });

  if (error) {
    throw normalizeResendSendError(error);
  }

  return data;
};

module.exports = {
  sendOrderDeliveryEmail,
};
