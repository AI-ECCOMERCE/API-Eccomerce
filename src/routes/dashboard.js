const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");
const requireAdminAuth = require("../middleware/requireAdminAuth");

router.use(requireAdminAuth);

// GET /api/dashboard — Summary stats untuk admin dashboard
router.get("/", async (req, res) => {
  try {
    // Total revenue (completed orders)
    const { data: revenueData } = await supabase
      .from("orders")
      .select("total_price")
      .in("status", ["paid", "completed"]);

    const totalRevenue = (revenueData || []).reduce((sum, o) => sum + o.total_price, 0);

    // Total orders
    const { count: totalOrders } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true });

    // Unique customers
    const { data: customerEmails } = await supabase
      .from("orders")
      .select("customer_email");

    const uniqueCustomers = new Set((customerEmails || []).map((c) => c.customer_email)).size;

    // Active products
    const { count: activeProducts } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    // Pending orders (need attention)
    const { count: pendingOrders } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .in("status", ["pending", "paid"]);

    // Recent orders (last 5)
    const { data: recentOrders } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    // Top products by sold count
    const { data: topProducts } = await supabase
      .from("products")
      .select("name, sold, icon, gradient")
      .order("sold", { ascending: false })
      .limit(5);

    res.json({
      success: true,
      data: {
        stats: {
          total_revenue: totalRevenue,
          total_orders: totalOrders || 0,
          unique_customers: uniqueCustomers,
          active_products: activeProducts || 0,
          pending_orders: pendingOrders || 0,
        },
        recent_orders: recentOrders || [],
        top_products: topProducts || [],
      },
    });
  } catch (err) {
    console.error("GET /dashboard error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
