const { getPakasirClient } = require("../config/pakasir");

const toIsoString = (value) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const normalizePaymentPayload = (payment) => ({
  project: payment?.project || process.env.PAKASIR_SLUG || null,
  order_id: payment?.order_id || null,
  amount: Number(payment?.amount || 0),
  fee: Number(payment?.fee || 0),
  status: payment?.status || "pending",
  total_payment: Number(payment?.total_payment || payment?.amount || 0),
  payment_method: payment?.payment_method || "qris",
  payment_number: payment?.payment_number || null,
  payment_url: payment?.payment_url || null,
  redirect_url: payment?.redirect_url || null,
  expired_at: toIsoString(payment?.expired_at),
  completed_at: toIsoString(payment?.completed_at),
});

const derivePaymentState = (payment) => {
  const isExpired =
    payment.expired_at &&
    new Date(payment.expired_at).getTime() <= Date.now() &&
    payment.status === "pending";

  if (payment.status === "completed") {
    return {
      orderStatus: "paid",
      paymentStatus: "completed",
    };
  }

  if (payment.status === "canceled") {
    return {
      orderStatus: "cancelled",
      paymentStatus: "canceled",
    };
  }

  if (isExpired) {
    return {
      orderStatus: "cancelled",
      paymentStatus: "expired",
    };
  }

  return {
    orderStatus: "pending",
    paymentStatus: "pending",
  };
};

const createPayment = async ({ orderId, amount, redirectUrl }) => {
  const pakasir = getPakasirClient();
  const payment = await pakasir.createPayment("qris", orderId, amount, redirectUrl);
  return normalizePaymentPayload(payment);
};

const getPaymentDetail = async ({ orderId, amount }) => {
  const pakasir = getPakasirClient();
  const payment = await pakasir.detailPayment(orderId, amount);
  return normalizePaymentPayload(payment);
};

const cancelPayment = async ({ orderId, amount }) => {
  const pakasir = getPakasirClient();
  const payment = await pakasir.cancelPayment(orderId, amount);
  return normalizePaymentPayload(payment);
};

const simulatePayment = async ({ orderId, amount }) => {
  const pakasir = getPakasirClient();
  const payment = await pakasir.simulationPayment(orderId, amount);
  return normalizePaymentPayload(payment);
};

module.exports = {
  cancelPayment,
  createPayment,
  derivePaymentState,
  getPaymentDetail,
  simulatePayment,
};
