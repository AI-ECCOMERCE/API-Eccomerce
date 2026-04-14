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

// GET /api/customers — Ambil semua pelanggan unik
router.get("/", async (req, res) => {
  try {
    const customers = await adminCache.getOrSet(
      ADMIN_CACHE_KEYS.customersList,
      ADMIN_CACHE_TTLS.customersList,
      async () => {
        const { data, error } = await supabase
          .from("orders")
          .select("id, customer_name, customer_email, customer_phone, total_price, created_at")
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Group by email & aggregate
        const customerMap = {};
        data.forEach((order) => {
          const key = order.customer_email;
          if (!customerMap[key]) {
            customerMap[key] = {
              name: order.customer_name,
              email: order.customer_email,
              phone: order.customer_phone,
              total_orders: 0,
              total_spent: 0,
              last_order: order.created_at,
              order_ids: [],
            };
          }
          customerMap[key].total_orders += 1;
          customerMap[key].total_spent += order.total_price;
          if (order.id) customerMap[key].order_ids.push(order.id);
        });

        return Object.values(customerMap).sort((a, b) => b.total_spent - a.total_spent);
      }
    );

    res.json({ success: true, data: customers });
  } catch (err) {
    console.error("GET /customers error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
