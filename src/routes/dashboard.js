const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");
const requireAdminAuth = require("../middleware/requireAdminAuth");
const {
  adminCache,
  ADMIN_CACHE_KEYS,
  ADMIN_CACHE_TTLS,
} = require("../lib/cache/adminCache");

router.use(requireAdminAuth);

// GET /api/dashboard — Summary stats untuk admin dashboard
router.get("/", async (req, res) => {
  try {
    const data = await adminCache.getOrSet(
      ADMIN_CACHE_KEYS.dashboardSummary,
      ADMIN_CACHE_TTLS.dashboardSummary,
      async () => {
        const [
          revenueResult,
          totalOrdersResult,
          customerEmailsResult,
          activeProductsResult,
          pendingOrdersResult,
          recentOrdersResult,
          topProductsResult,
        ] = await Promise.all([
          supabase.from("orders").select("total_price").in("status", ["paid", "completed"]),
          supabase.from("orders").select("*", { count: "exact", head: true }),
          supabase.from("orders").select("customer_email"),
          supabase
            .from("products")
            .select("*", { count: "exact", head: true })
            .eq("status", "active"),
          supabase
            .from("orders")
            .select("*", { count: "exact", head: true })
            .in("status", ["pending", "paid"]),
          supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(5),
          supabase
            .from("products")
            .select("name, sold, icon, gradient")
            .order("sold", { ascending: false })
            .limit(5),
        ]);

        const firstError =
          revenueResult.error ||
          totalOrdersResult.error ||
          customerEmailsResult.error ||
          activeProductsResult.error ||
          pendingOrdersResult.error ||
          recentOrdersResult.error ||
          topProductsResult.error;

        if (firstError) {
          throw firstError;
        }

        const totalRevenue = (revenueResult.data || []).reduce(
          (sum, order) => sum + order.total_price,
          0
        );
        const uniqueCustomers = new Set(
          (customerEmailsResult.data || []).map((customer) => customer.customer_email)
        ).size;

        return {
          stats: {
            total_revenue: totalRevenue,
            total_orders: totalOrdersResult.count || 0,
            unique_customers: uniqueCustomers,
            active_products: activeProductsResult.count || 0,
            pending_orders: pendingOrdersResult.count || 0,
          },
          recent_orders: recentOrdersResult.data || [],
          top_products: topProductsResult.data || [],
        };
      }
    );

    res.json({ success: true, data });
  } catch (err) {
    console.error("GET /dashboard error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
