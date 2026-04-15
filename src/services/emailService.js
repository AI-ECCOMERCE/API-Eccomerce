const { getResendClient, getResendConfig } = require("../config/resend");

const STORE_NAME = "Poinstore";
const STORE_URL = "https://www.poinstore.my.id";
const DEFAULT_SUPPORT_EMAIL = "support@poinstore.my.id";

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
  `Detail pesanan ${order.order_id} dan akses akun dari ${STORE_NAME}.`;

const buildSecurityNote = () =>
  "Untuk keamanan, jangan teruskan email ini ke orang lain.";

const buildCredentialsSection = (deliveryGroups) =>
  deliveryGroups
    .map((group) => {
      const accountsHtml = group.accounts
        .map(
          (account, index) => `
            <div style="border:1px solid #e2e8f0;border-radius:14px;padding:16px;background:#ffffff;margin-top:12px;">
              <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#475569;letter-spacing:0.04em;text-transform:uppercase;">
                Akun ${index + 1}
              </p>
              <table style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="padding:6px 0;color:#64748b;font-size:14px;width:140px;">Email Login</td>
                  <td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;">${escapeHtml(
                    account.login_email
                  )}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#64748b;font-size:14px;">Password</td>
                  <td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;">${escapeHtml(
                    account.login_password
                  )}</td>
                </tr>
                ${
                  account.account_name
                    ? `<tr>
                  <td style="padding:6px 0;color:#64748b;font-size:14px;">Label</td>
                  <td style="padding:6px 0;color:#0f172a;font-size:14px;">${escapeHtml(
                    account.account_name
                  )}</td>
                </tr>`
                    : ""
                }
                ${
                  account.account_notes
                    ? `<tr>
                  <td style="padding:6px 0;color:#64748b;font-size:14px;vertical-align:top;">Catatan</td>
                  <td style="padding:6px 0;color:#0f172a;font-size:14px;white-space:pre-line;">${escapeHtml(
                    account.account_notes
                  )}</td>
                </tr>`
                    : ""
                }
              </table>
            </div>
          `
        )
        .join("");

      return `
        <div style="margin-top:24px;padding:20px;border-radius:18px;background:#f8fafc;border:1px solid #e2e8f0;">
          <h2 style="margin:0 0 8px;font-size:18px;color:#0f172a;">${escapeHtml(
            group.productName
          )}</h2>
          <p style="margin:0;color:#64748b;font-size:14px;">Jumlah akun: ${group.accounts.length}</p>
          ${accountsHtml}
        </div>
      `;
    })
    .join("");

const buildEmailHtml = ({ order, deliveryGroups, supportEmail }) => `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:32px 16px;color:#0f172a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${escapeHtml(getEmailPreheader(order))}
    </div>
    <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:24px;border:1px solid #e2e8f0;overflow:hidden;">
      <div style="padding:28px 28px 20px;background:linear-gradient(135deg,#0f172a,#1e293b);">
        <p style="margin:0 0 8px;color:#93c5fd;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">${STORE_NAME}</p>
        <h1 style="margin:0;color:#ffffff;font-size:28px;line-height:1.2;">Detail akun untuk pesanan kamu sudah siap</h1>
        <p style="margin:12px 0 0;color:#cbd5e1;font-size:15px;line-height:1.6;">
          Halo ${escapeHtml(order.customer_name)}, pembayaran untuk order <strong>${escapeHtml(
            order.order_id
          )}</strong> sudah berhasil kami verifikasi.
        </p>
      </div>

      <div style="padding:28px;">
        <div style="border:1px solid #e2e8f0;border-radius:18px;padding:18px;background:#f8fafc;">
          <p style="margin:0 0 6px;color:#64748b;font-size:13px;">Ringkasan order</p>
          <p style="margin:0;font-size:15px;color:#0f172a;"><strong>Order ID:</strong> ${escapeHtml(
            order.order_id
          )}</p>
          <p style="margin:8px 0 0;font-size:15px;color:#0f172a;"><strong>Total dibayar:</strong> ${formatCurrency(
            order.payment_total || order.total_price
          )}</p>
          <p style="margin:8px 0 0;font-size:14px;color:#475569;">Anda menerima email ini karena melakukan pembelian di ${escapeHtml(
            STORE_URL
          )}.</p>
        </div>

        ${buildCredentialsSection(deliveryGroups)}

        <div style="margin-top:24px;padding:20px;border-radius:18px;background:#eff6ff;border:1px solid #bfdbfe;">
          <p style="margin:0 0 10px;font-size:15px;font-weight:700;color:#1d4ed8;">Tips keamanan</p>
          <ul style="margin:0;padding-left:20px;color:#1e3a8a;font-size:14px;line-height:1.7;">
            <li>Simpan email ini di tempat yang aman.</li>
            <li>Segera ganti password jika produk mengizinkan perubahan sandi.</li>
            <li>Jangan membagikan kredensial ke pihak lain tanpa izin.</li>
            <li>${buildSecurityNote()}</li>
          </ul>
        </div>

        <p style="margin:24px 0 0;color:#64748b;font-size:14px;line-height:1.7;">
          Jika ada kendala login atau akun tidak sesuai, balas email ini atau hubungi <a href="mailto:${escapeHtml(
            supportEmail
          )}" style="color:#1d4ed8;text-decoration:none;">${escapeHtml(
            supportEmail
          )}</a> agar tim kami bisa membantu lebih cepat.
        </p>
        <p style="margin:16px 0 0;color:#94a3b8;font-size:12px;line-height:1.7;">
          Email transaksi ini dikirim otomatis oleh ${STORE_NAME}. Mohon jangan tandai email ini sebagai spam agar detail pesanan berikutnya masuk ke inbox utama.
        </p>
      </div>
    </div>
  </div>
`;

const buildEmailText = ({ order, deliveryGroups, supportEmail }) => {
  const sections = deliveryGroups
    .map((group) => {
      const accountsText = group.accounts
        .map(
          (account, index) =>
            [
              `Akun ${index + 1}`,
              `Email Login: ${account.login_email}`,
              `Password: ${account.login_password}`,
              account.account_name ? `Label: ${account.account_name}` : null,
              account.account_notes ? `Catatan: ${account.account_notes}` : null,
            ]
              .filter(Boolean)
              .join("\n")
        )
        .join("\n\n");

      return `${group.productName}\nJumlah akun: ${group.accounts.length}\n\n${accountsText}`;
    })
    .join("\n\n====================\n\n");

  return [
    `Halo ${order.customer_name},`,
    "",
    `Pembayaran untuk order ${order.order_id} sudah berhasil diverifikasi.`,
    `Total dibayar: ${formatCurrency(order.payment_total || order.total_price)}`,
    `Website: ${STORE_URL}`,
    "",
    "Berikut detail akun untuk pesanan kamu:",
    "",
    sections,
    "",
    "Tips keamanan:",
    "- Simpan email ini di tempat yang aman.",
    "- Segera ganti password jika produk mengizinkan perubahan sandi.",
    `- ${buildSecurityNote()}`,
    `- Hubungi ${supportEmail} jika ada kendala login.`,
  ].join("\n");
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
    subject: `${STORE_NAME} | Detail akun untuk pesanan ${order.order_id}`,
    html: buildEmailHtml({ order, deliveryGroups, supportEmail }),
    text: buildEmailText({ order, deliveryGroups, supportEmail }),
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
