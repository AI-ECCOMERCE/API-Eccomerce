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
  `Pembayaran untuk pesanan ${order.order_id} sudah berhasil. Admin ${STORE_NAME} akan segera menghubungi Anda.`;

// ─── Deteksi produk AI premium ───────────────────────────────────────────────
// Menggunakan deliveryGroups (dari fulfillmentService) sebagai sumber utama
// karena order_items di database tidak selalu memiliki product_name.
const detectPremiumAiProducts = (deliveryGroups) => {
  const groups = Array.isArray(deliveryGroups) ? deliveryGroups : [];
  const matched = groups.filter((g) => {
    const name = String(g.productName || "").toLowerCase();
    return (
      name.includes("chatgpt") ||
      name.includes("chat gpt") ||
      name.includes("gemini")
    );
  });
  return matched.map((g) => g.productName);
};

// ─── Steps block: khusus untuk produk AI (ChatGPT / Gemini) ──────────────────
const buildAiStepsBlock = (productName) => `
  <div style="margin-top:24px;padding:24px;border-radius:18px;background:#eff6ff;border:1px solid #bfdbfe;">
    <h2 style="margin:0 0 12px;font-size:18px;font-weight:700;color:#1e3a8a;">⚠️ Langkah Berikutnya (Penting)</h2>
    <p style="margin:0 0 14px;color:#1e3a8a;font-size:15px;line-height:1.6;">
      Karena Anda memesan <strong>${escapeHtml(productName)}</strong>, pesanan ini diproses langsung ke akun Anda sendiri. Silakan ikuti langkah berikut:
    </p>
    <ol style="margin:0;padding-left:22px;color:#1e3a8a;font-size:15px;line-height:1.9;font-weight:500;">
      <li style="margin-bottom:8px;">Kirimkan <strong>alamat email</strong> yang ingin di-upgrade melalui WhatsApp atau balas email ini.</li>
      <li style="margin-bottom:8px;">Admin akan <strong>login</strong> ke akun tersebut dan meminta <strong>kode OTP</strong> dari Anda via WhatsApp.</li>
      <li style="margin-bottom:8px;">Setelah berhasil login, admin akan <strong>memproses upgrade</strong> ke versi Plus / Pro.</li>
      <li>Setelah sukses, admin akan langsung <strong>logout</strong> dari akun Anda demi privasi &amp; keamanan.</li>
    </ol>
    <a href="${ADMIN_WHATSAPP_URL}" style="display:inline-block;margin-top:20px;padding:14px 22px;border-radius:12px;background:#2563eb;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">
      Chat Admin via WhatsApp
    </a>
  </div>
`;

// ─── Steps block: untuk produk non-AI ────────────────────────────────────────
const buildDefaultStepsBlock = () => `
  <div style="margin-top:24px;padding:24px;border-radius:18px;background:#ecfdf5;border:1px solid #bbf7d0;">
    <h2 style="margin:0 0 12px;font-size:18px;font-weight:700;color:#047857;">Langkah Selanjutnya</h2>
    <p style="margin:0;color:#064e3b;font-size:15px;line-height:1.7;">
      Admin kami akan segera menghubungi Anda melalui WhatsApp sesuai nomor yang telah diisi. Mohon pastikan nomor WhatsApp tersebut aktif agar proses pesanan dapat dilanjutkan dengan cepat.
    </p>
    <p style="margin:14px 0 0;color:#064e3b;font-size:15px;line-height:1.7;">
      Jika ingin memproses lebih cepat, silakan langsung hubungi kami:
    </p>
    <a href="${ADMIN_WHATSAPP_URL}" style="display:inline-block;margin-top:20px;padding:14px 22px;border-radius:12px;background:#10b981;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">
      Hubungi Admin via WhatsApp
    </a>
  </div>
`;

// ─── Build HTML email ─────────────────────────────────────────────────────────
const buildEmailHtml = ({ order, supportEmail, deliveryGroups }) => {
  const premiumAiProducts = detectPremiumAiProducts(deliveryGroups);
  const hasPremiumAi = premiumAiProducts.length > 0;

  // Buat satu blok langkah per produk AI yang dipesan
  const stepsHtml = hasPremiumAi
    ? premiumAiProducts.map(buildAiStepsBlock).join("")
    : buildDefaultStepsBlock();

  return `
  <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#f1f5f9;padding:32px 16px;color:#0f172a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${escapeHtml(getEmailPreheader(order))}
    </div>
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:24px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 10px 25px -5px rgba(0,0,0,0.08);">

      <!-- HEADER -->
      <div style="padding:40px 32px 32px;background:linear-gradient(135deg,#0f172a 0%,#312e81 100%);border-bottom:4px solid #6366f1;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
          <tr>
            <td valign="middle" style="width:52px;">
              <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;width:52px;height:52px;line-height:52px;border-radius:16px;text-align:center;font-weight:900;font-size:20px;letter-spacing:-1px;">AI</div>
            </td>
            <td valign="middle" style="padding-left:14px;">
              <p style="margin:0;color:#c7d2fe;font-size:14px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;">${STORE_NAME}</p>
              <p style="margin:2px 0 0;color:#818cf8;font-size:12px;">${STORE_URL}</p>
            </td>
          </tr>
        </table>
        <h1 style="margin:0;color:#ffffff;font-size:30px;line-height:1.2;font-weight:800;">Pembayaran Berhasil! 🎉</h1>
        <p style="margin:14px 0 0;color:#e0e7ff;font-size:16px;line-height:1.6;">
          Halo <strong>${escapeHtml(order.customer_name)}</strong>, terima kasih banyak. Pembayaran untuk pesanan <strong>${escapeHtml(order.order_id)}</strong> Anda sudah kami verifikasi.
        </p>
      </div>

      <!-- BODY -->
      <div style="padding:32px;">

        <!-- Ringkasan Pesanan -->
        <div style="border:1px solid #e2e8f0;border-radius:20px;padding:24px;background:#f8fafc;">
          <p style="margin:0 0 16px;color:#64748b;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">Ringkasan Pesanan</p>
          <div style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid #e2e8f0;">
            <p style="margin:0;font-size:13px;color:#64748b;">Order ID</p>
            <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#0f172a;">${escapeHtml(order.order_id)}</p>
          </div>
          <div style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid #e2e8f0;">
            <p style="margin:0;font-size:13px;color:#64748b;">Total Dibayar</p>
            <p style="margin:4px 0 0;font-size:20px;font-weight:800;color:#10b981;">${formatCurrency(order.payment_total || order.total_price)}</p>
          </div>
          ${order.customer_phone ? `
          <div>
            <p style="margin:0;font-size:13px;color:#64748b;">Nomor WhatsApp</p>
            <p style="margin:4px 0 0;font-size:16px;font-weight:600;color:#0f172a;">${escapeHtml(order.customer_phone)}</p>
          </div>` : ""}
        </div>

        <!-- Langkah Selanjutnya -->
        ${stepsHtml}

        <!-- Footer -->
        <div style="margin-top:32px;padding-top:24px;border-top:1px solid #e2e8f0;">
          <p style="margin:14px 0 0;color:#94a3b8;font-size:13px;line-height:1.7;">
            Email ini dikirim otomatis oleh sistem ${STORE_NAME}. Mohon tambahkan kami ke daftar kontak agar email berikutnya tidak masuk spam.
          </p>
        </div>
      </div>
    </div>
  </div>
  `;
};

// ─── Build plain-text email ───────────────────────────────────────────────────
const buildEmailText = ({ order, supportEmail, deliveryGroups }) => {
  const premiumAiProducts = detectPremiumAiProducts(deliveryGroups);
  const hasPremiumAi = premiumAiProducts.length > 0;

  const aiSteps = premiumAiProducts.flatMap((productName) => [
    `--- Langkah untuk ${productName} ---`,
    "1. Kirimkan alamat email yang ingin di-upgrade ke admin (balas email ini atau WhatsApp).",
    "2. Admin akan login ke akun tersebut dan meminta kode OTP dari Anda via WhatsApp.",
    "3. Setelah berhasil login, admin akan memproses upgrade ke versi Plus / Pro.",
    "4. Setelah sukses, admin akan langsung logout dari akun Anda demi privasi & keamanan.",
    "",
  ]);

  const defaultStep = [
    "LANGKAH SELANJUTNYA:",
    "Admin kami akan segera menghubungi Anda melalui WhatsApp sesuai nomor yang diisi.",
    "Mohon pastikan nomor WhatsApp tersebut aktif.",
  ];

  const stepsText = hasPremiumAi
    ? ["LANGKAH BERIKUTNYA (PENTING):", "", ...aiSteps]
    : defaultStep;

  return [
    `Halo ${order.customer_name},`,
    "",
    "Pembayaran Berhasil!",
    "Terima kasih. Pembayaran Anda sudah berhasil kami terima dan verifikasi.",
    "",
    "RINGKASAN PESANAN:",
    `Order ID: ${order.order_id}`,
    `Total dibayar: ${formatCurrency(order.payment_total || order.total_price)}`,
    order.customer_phone ? `Nomor WhatsApp: ${order.customer_phone}` : null,
    `Website: ${STORE_URL}`,
    "",
    ...stepsText,
    "",
    `Hubungi Admin via WhatsApp: ${ADMIN_WHATSAPP_DISPLAY}`,
    `Link: ${ADMIN_WHATSAPP_URL}`,
    "",
    `Butuh bantuan? Balas email ini atau hubungi ${supportEmail}.`,
    "",
    `Email transaksi otomatis dari ${STORE_NAME}.`,
  ]
    .filter((line) => line !== null)
    .join("\n");
};

// ─── Error normalization ──────────────────────────────────────────────────────
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
      { code: "RESEND_APPLICATION_NOT_FOUND", isProviderConfigError: true }
    );
  }

  if (providerMessage.toLowerCase().includes("invalid api key")) {
    return createResendError(
      "RESEND_API_KEY tidak valid. Gunakan API key aktif dari dashboard Resend.",
      { code: "RESEND_INVALID_API_KEY", isProviderConfigError: true }
    );
  }

  if (providerMessage.toLowerCase().includes("domain is not verified")) {
    return createResendError(
      "Domain pada RESEND_FROM_EMAIL belum terverifikasi di Resend. Verifikasi domain atau sesuaikan sender email dengan domain yang sudah verified.",
      { code: "RESEND_DOMAIN_NOT_VERIFIED", isProviderConfigError: true }
    );
  }

  return createResendError(providerMessage || "Gagal mengirim email fulfillment.");
};

// ─── Send email ───────────────────────────────────────────────────────────────
const sendOrderDeliveryEmail = async ({ order, deliveryGroups }) => {
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
    html: buildEmailHtml({ order, supportEmail, deliveryGroups }),
    text: buildEmailText({ order, supportEmail, deliveryGroups }),
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
