const { getResendClient, getResendConfig } = require("../config/resend");

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatCurrency = (amount) =>
  `Rp ${Number(amount || 0).toLocaleString("id-ID")}`;

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

const buildEmailHtml = ({ order, deliveryGroups }) => `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:32px 16px;color:#0f172a;">
    <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:24px;border:1px solid #e2e8f0;overflow:hidden;">
      <div style="padding:28px 28px 20px;background:linear-gradient(135deg,#0f172a,#1e293b);">
        <p style="margin:0 0 8px;color:#93c5fd;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">DesignAI Store</p>
        <h1 style="margin:0;color:#ffffff;font-size:28px;line-height:1.2;">Akun premium kamu sudah siap</h1>
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
        </div>

        ${buildCredentialsSection(deliveryGroups)}

        <div style="margin-top:24px;padding:20px;border-radius:18px;background:#eff6ff;border:1px solid #bfdbfe;">
          <p style="margin:0 0 10px;font-size:15px;font-weight:700;color:#1d4ed8;">Tips keamanan</p>
          <ul style="margin:0;padding-left:20px;color:#1e3a8a;font-size:14px;line-height:1.7;">
            <li>Simpan email ini di tempat yang aman.</li>
            <li>Segera ganti password jika produk mengizinkan perubahan sandi.</li>
            <li>Jangan membagikan kredensial ke pihak lain tanpa izin.</li>
          </ul>
        </div>

        <p style="margin:24px 0 0;color:#64748b;font-size:14px;line-height:1.7;">
          Jika ada kendala login atau akun tidak sesuai, balas email ini agar tim kami bisa membantu lebih cepat.
        </p>
      </div>
    </div>
  </div>
`;

const buildEmailText = ({ order, deliveryGroups }) => {
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
    "",
    "Berikut akun premium kamu:",
    "",
    sections,
    "",
    "Tips keamanan:",
    "- Simpan email ini di tempat yang aman.",
    "- Segera ganti password jika produk mengizinkan perubahan sandi.",
    "- Balas email ini jika ada kendala login.",
  ].join("\n");
};

const sendOrderDeliveryEmail = async ({ order, deliveryGroups }) => {
  const resend = getResendClient();
  const { fromEmail, replyToEmail } = getResendConfig();

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: [order.customer_email],
    subject: `Akun premium order ${order.order_id} sudah siap`,
    html: buildEmailHtml({ order, deliveryGroups }),
    text: buildEmailText({ order, deliveryGroups }),
    ...(replyToEmail ? { replyTo: replyToEmail } : {}),
  });

  if (error) {
    throw new Error(error.message || "Gagal mengirim email fulfillment.");
  }

  return data;
};

module.exports = {
  sendOrderDeliveryEmail,
};
