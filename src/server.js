require("dotenv").config();

const express = require("express");
const cors = require("cors");

const productRoutes = require("./routes/products");
const orderRoutes = require("./routes/orders");
const customerRoutes = require("./routes/customers");
const categoryRoutes = require("./routes/categories");
const dashboardRoutes = require("./routes/dashboard");
const paymentRoutes = require("./routes/payments");
const productAccountRoutes = require("./routes/productAccounts");
const { isPaymentGatewayConfigured } = require("./config/pakasir");
const { getPaymentAccessSecret } = require("./config/security");
const { isEmailDeliveryConfigured } = require("./config/resend");

const app = express();
const PORT = process.env.PORT || 4000;
const allowedHeaders = ["Content-Type", "Authorization"];

// ============================================
// MIDDLEWARE
// ============================================

// CORS — izinkan frontend & admin panel
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
  : ["http://localhost:3000", "http://localhost:3001"];

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
    allowedHeaders,
  })
);

// Parse JSON body
app.use(express.json());

// Request logger (development only)
if (process.env.NODE_ENV === "development") {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} | ${req.method} ${req.path}`);
    next();
  });
}

// ============================================
// ROUTES
// ============================================

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "DesignAI Store API",
    payment_gateway: {
      provider: "pakasir",
      configured: isPaymentGatewayConfigured(),
    },
    payment_security: {
      access_token_ready: Boolean(process.env.PAYMENT_ACCESS_SECRET),
    },
    email_delivery: {
      provider: "resend",
      configured: isEmailDeliveryConfigured(),
    },
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/product-accounts", productAccountRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint tidak ditemukan" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});

// ============================================
// START SERVER
// ============================================

try {
  getPaymentAccessSecret();
} catch (error) {
  console.error("❌ Payment security error:", error.message);
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║   🚀 DesignAI Store API                  ║
║   Running on: http://localhost:${PORT}       ║
║   Environment: ${process.env.NODE_ENV || "development"}          ║
╚══════════════════════════════════════════╝
  `);
});
