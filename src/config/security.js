const crypto = require("crypto");

const DEFAULT_PAYMENT_ACCESS_TTL_MS = 1000 * 60 * 60 * 24;

const parsePositiveInteger = (value, fallbackValue) => {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallbackValue;
  }

  return Math.floor(parsedValue);
};

const getPaymentAccessTtlMs = () =>
  parsePositiveInteger(
    process.env.PAYMENT_ACCESS_TTL_MS,
    DEFAULT_PAYMENT_ACCESS_TTL_MS
  );

const getPaymentAccessSecret = () => {
  const secret = String(process.env.PAYMENT_ACCESS_SECRET || "").trim();

  if (!secret) {
    throw new Error(
      "PAYMENT_ACCESS_SECRET wajib diisi untuk mengamankan akses pembayaran."
    );
  }

  return secret;
};

const createSignature = (value) =>
  crypto
    .createHmac("sha256", getPaymentAccessSecret())
    .update(value)
    .digest("base64url");

const createPaymentAccessError = (message, statusCode = 401) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.expose = true;
  return error;
};

const timingSafeCompare = (left, right) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const createPaymentAccessToken = ({ orderId, ttlMs = getPaymentAccessTtlMs() }) => {
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  const payload = Buffer.from(
    JSON.stringify({
      purpose: "payment_access",
      orderId,
      expiresAt,
    })
  ).toString("base64url");
  const signature = createSignature(payload);

  return {
    token: `${payload}.${signature}`,
    expiresAt,
  };
};

const verifyPaymentAccessToken = (token, expectedOrderId) => {
  if (!token) {
    throw createPaymentAccessError(
      "Sesi pembayaran tidak valid. Silakan ulangi checkout."
    );
  }

  const [encodedPayload, signature] = String(token).split(".");

  if (!encodedPayload || !signature) {
    throw createPaymentAccessError("Token pembayaran tidak valid.");
  }

  const expectedSignature = createSignature(encodedPayload);

  if (!timingSafeCompare(signature, expectedSignature)) {
    throw createPaymentAccessError("Token pembayaran tidak valid.");
  }

  let parsedPayload;

  try {
    parsedPayload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    );
  } catch (error) {
    throw createPaymentAccessError("Token pembayaran tidak dapat dibaca.");
  }

  if (
    parsedPayload?.purpose !== "payment_access" ||
    parsedPayload?.orderId !== expectedOrderId
  ) {
    throw createPaymentAccessError("Token pembayaran tidak cocok.");
  }

  const expiresAt = new Date(parsedPayload.expiresAt);

  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    throw createPaymentAccessError(
      "Sesi pembayaran sudah kedaluwarsa. Silakan ulangi checkout."
    );
  }

  return parsedPayload;
};

module.exports = {
  createPaymentAccessToken,
  getPaymentAccessSecret,
  getPaymentAccessTtlMs,
  verifyPaymentAccessToken,
};
