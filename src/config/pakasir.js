const { Pakasir } = require("pakasir-sdk");

const getPrimaryCorsOrigin = () => {
  const firstOrigin = process.env.CORS_ORIGIN?.split(",")
    .map((origin) => origin.trim())
    .find(Boolean);

  return firstOrigin || "http://localhost:3000";
};

const getFrontendUrl = () => {
  const baseUrl = process.env.FRONTEND_URL || getPrimaryCorsOrigin();
  return baseUrl.replace(/\/+$/, "");
};

const isPaymentGatewayConfigured = () =>
  Boolean(process.env.PAKASIR_SLUG && process.env.PAKASIR_API_KEY);

const isSandboxModeEnabled = () =>
  String(process.env.PAKASIR_SANDBOX_MODE || "").toLowerCase() === "true";

let pakasirClient = null;

const getPakasirClient = () => {
  if (!isPaymentGatewayConfigured()) {
    throw new Error(
      "PAKASIR_SLUG dan PAKASIR_API_KEY wajib diisi untuk mengaktifkan pembayaran Pakasir."
    );
  }

  if (!pakasirClient) {
    pakasirClient = new Pakasir({
      slug: process.env.PAKASIR_SLUG,
      apikey: process.env.PAKASIR_API_KEY,
    });
  }

  return pakasirClient;
};

module.exports = {
  getFrontendUrl,
  getPakasirClient,
  isPaymentGatewayConfigured,
  isSandboxModeEnabled,
};
