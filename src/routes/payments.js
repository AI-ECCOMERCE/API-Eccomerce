const express = require("express");

const { handlePakasirWebhook } = require("../services/orderService");
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

module.exports = router;
