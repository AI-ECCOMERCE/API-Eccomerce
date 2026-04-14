const express = require("express");

const { handlePakasirWebhook } = require("../services/orderService");
const { processResendWebhook } = require("../services/resendWebhookService");
const { createRateLimiter } = require("../middleware/rateLimit");
const { respondWithError } = require("../utils/respondWithError");

const router = express.Router();
const webhookRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
  keyPrefix: "pakasir-webhook",
  message: "Terlalu banyak request webhook. Coba lagi sebentar.",
});

router.post("/pakasir/webhook", webhookRateLimiter, async (req, res) => {
  try {
    const data = await handlePakasirWebhook(req.body);

    res.json({
      success: true,
      message: "Webhook Pakasir diterima.",
      data,
    });
  } catch (error) {
    respondWithError(res, error, {
      context: "POST /payments/pakasir/webhook",
      defaultMessage: "Webhook Pakasir gagal diproses.",
    });
  }
});

router.post("/resend/webhook", webhookRateLimiter, async (req, res) => {
  try {
    const data = await processResendWebhook({
      payload: req.rawBody || JSON.stringify(req.body || {}),
      headers: req.headers,
    });

    res.json({
      success: true,
      message: "Webhook Resend diterima.",
      data,
    });
  } catch (error) {
    respondWithError(res, error, {
      context: "POST /payments/resend/webhook",
      defaultMessage: "Webhook Resend gagal diproses.",
    });
  }
});

module.exports = router;
