const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");
const requireAdminAuth = require("../middleware/requireAdminAuth");
const {
  adminCache,
  ADMIN_CACHE_TTLS,
  getOrdersSummaryCacheKey,
  invalidateOrderDerivedCaches,
} = require("../lib/cache/adminCache");
const {
  createCheckoutOrder,
  getPaymentPageOrder,
  retryOrderFulfillmentById,
  simulateOrderPaymentById,
  syncOrderPaymentById,
} = require("../services/orderService");
const { requirePaymentAccess } = require("../middleware/paymentAccess");
const { createRateLimiter } = require("../middleware/rateLimit");
const { respondWithError } = require("../utils/respondWithError");

const paymentSyncRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
  keyPrefix: "payment-sync",
  message: "Terlalu sering memeriksa status pembayaran. Coba lagi sebentar.",
});
const paymentViewRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 20,
  keyPrefix: "payment-view",
  message: "Terlalu sering membuka data pembayaran. Coba lagi sebentar.",
});

const getOrdersSummaryData = async (sinceDate = null) => {
  const pendingOrdersQuery = supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .in("status", ["pending", "paid"]);

  const unreadOrdersQuery = supabase
    .from("orders")
    .select("*", { count: "exact", head: true });

  if (sinceDate) {
    unreadOrdersQuery.gt("created_at", sinceDate.toISOString());
  }

  const recentPendingOrdersQuery = supabase
    .from("orders")
    .select("id, order_id, customer_name, status, created_at")
    .in("status", ["pending", "paid"])
    .order("created_at", { ascending: false })
    .limit(5);

  const [pendingOrdersResult, unreadOrdersResult, recentPendingOrdersResult] =
    await Promise.all([
      pendingOrdersQuery,
      unreadOrdersQuery,
      recentPendingOrdersQuery,
    ]);

  const firstError =
    pendingOrdersResult.error ||
    unreadOrdersResult.error ||
    recentPendingOrdersResult.error;

  if (firstError) {
    throw firstError;
  }

  return {
    pending_orders: pendingOrdersResult.count || 0,
    unread_orders: unreadOrdersResult.count || 0,
    recent_pending_orders: recentPendingOrdersResult.data || [],
  };
};

// GET /api/orders — Ambil semua pesanan (dengan filter status)
router.get("/", requireAdminAuth, async (req, res) => {
  try {
    const { status, search } = req.query;

    let query = supabase
      .from("orders")
      .select("*, order_items(*, products(name, icon, gradient))")
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    if (search) {
      query = query.or(`order_id.ilike.%${search}%,customer_name.ilike.%${search}%,customer_email.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error("GET /orders error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/orders/summary — Ringkasan singkat untuk badge/sidebar admin
router.get("/summary", requireAdminAuth, async (req, res) => {
  try {
    const sinceParam = Array.isArray(req.query.since) ? req.query.since[0] : req.query.since;
    const normalizedSince = typeof sinceParam === "string" ? sinceParam.trim() : "";
    const sinceDate = normalizedSince ? new Date(normalizedSince) : null;
    const hasValidSince = Boolean(sinceDate && !Number.isNaN(sinceDate.getTime()));

    const data = hasValidSince
      ? await getOrdersSummaryData(sinceDate)
      : await adminCache.getOrSet(
          getOrdersSummaryCacheKey("all"),
          ADMIN_CACHE_TTLS.ordersSummary,
          async () => getOrdersSummaryData()
        );

    res.json({ success: true, data });
  } catch (err) {
    console.error("GET /orders/summary error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/orders/:id/payment — Ambil data order untuk halaman pembayaran user
router.get("/:id/payment", paymentViewRateLimiter, requirePaymentAccess, async (req, res) => {
  try {
    const data = await getPaymentPageOrder(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    respondWithError(res, err, {
      context: "GET /orders/:id/payment",
      defaultMessage: "Gagal mengambil data pembayaran.",
    });
  }
});

// POST /api/orders/:id/payment/sync — Sinkronisasi status pembayaran ke Pakasir
router.post("/:id/payment/sync", paymentSyncRateLimiter, requirePaymentAccess, async (req, res) => {
  try {
    const data = await syncOrderPaymentById(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    respondWithError(res, err, {
      context: "POST /orders/:id/payment/sync",
      defaultMessage: "Gagal menyinkronkan pembayaran.",
    });
  }
});

// POST /api/orders/:id/payment/simulate — Simulasi pembayaran sandbox Pakasir
router.post("/:id/payment/simulate", requirePaymentAccess, async (req, res) => {
  try {
    const data = await simulateOrderPaymentById(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    respondWithError(res, err, {
      context: "POST /orders/:id/payment/simulate",
      defaultMessage: "Gagal mensimulasikan pembayaran.",
    });
  }
});

// POST /api/orders/:id/fulfillment/retry — Coba kirim ulang fulfillment email
router.post("/:id/fulfillment/retry", requireAdminAuth, async (req, res) => {
  try {
    const data = await retryOrderFulfillmentById(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    respondWithError(res, err, {
      context: "POST /orders/:id/fulfillment/retry",
      defaultMessage: "Gagal menjalankan ulang fulfillment order.",
    });
  }
});

// GET /api/orders/:id — Detail pesanan
router.get("/:id", requireAdminAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*, products(name, icon, gradient, price))")
      .eq("id", req.params.id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: "Pesanan tidak ditemukan" });

    res.json({ success: true, data });
  } catch (err) {
    console.error("GET /orders/:id error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/orders — Buat pesanan baru (dari frontend checkout)
router.post("/", async (req, res) => {
  try {
    const data = await createCheckoutOrder(req.body);
    invalidateOrderDerivedCaches();

    res.status(201).json({
      success: true,
      data,
    });
  } catch (err) {
    respondWithError(res, err, {
      context: "POST /orders",
      defaultMessage: "Gagal membuat pesanan.",
    });
  }
});

// PATCH /api/orders/:id/status — Update status pesanan
router.patch("/:id/status", requireAdminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["pending", "paid", "processing", "completed", "cancelled"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: `Status tidak valid. Gunakan: ${validStatuses.join(", ")}` });
    }

    const { data, error } = await supabase
      .from("orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw error;
    invalidateOrderDerivedCaches();
    res.json({ success: true, data });
  } catch (err) {
    console.error("PATCH /orders/:id/status error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
