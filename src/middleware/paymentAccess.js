const { verifyPaymentAccessToken } = require("../config/security");
const { respondWithError } = require("../utils/respondWithError");

const PAYMENT_ACCESS_HEADER = "x-payment-access-token";

const getRequestPaymentToken = (req) => {
  const headerToken = req.get(PAYMENT_ACCESS_HEADER);

  if (headerToken) {
    return headerToken.trim();
  }

  if (typeof req.query?.token === "string" && req.query.token.trim()) {
    return req.query.token.trim();
  }

  if (typeof req.body?.token === "string" && req.body.token.trim()) {
    return req.body.token.trim();
  }

  return "";
};

const requirePaymentAccess = (req, res, next) => {
  try {
    const token = getRequestPaymentToken(req);
    const payload = verifyPaymentAccessToken(token, req.params.id);

    req.paymentAccess = payload;
    req.paymentAccessToken = token;
    next();
  } catch (error) {
    respondWithError(res, error, {
      context: `${req.method} ${req.path}`,
      defaultMessage: "Akses pembayaran ditolak.",
    });
  }
};

module.exports = {
  PAYMENT_ACCESS_HEADER,
  getRequestPaymentToken,
  requirePaymentAccess,
};
