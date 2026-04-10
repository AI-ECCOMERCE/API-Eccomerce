const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");
const requireAdminAuth = require("../middleware/requireAdminAuth");

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
      query = query.or(`order_id.ilike.%${search}%,customer_name.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error("GET /orders error:", err.message);
    res.status(500).json({ success: false, error: err.message });
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
    const { customer_name, customer_email, customer_phone, customer_notes, items } = req.body;

    if (!customer_name || !customer_email || !customer_phone || !items || items.length === 0) {
      return res.status(400).json({ success: false, error: "Data pelanggan dan item pesanan wajib diisi" });
    }

    // Generate order ID
    const orderId = `DSA-${Date.now().toString(36).toUpperCase()}`;

    // Hitung total
    const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Insert order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        order_id: orderId,
        customer_name,
        customer_email,
        customer_phone,
        customer_notes: customer_notes || "",
        total_price: totalPrice,
        status: "pending",
        payment_method: "qris",
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Insert order items
    const orderItems = items.map((item) => ({
      order_id: order.id,
      product_id: item.product_id || null,
      product_name: item.name,
      quantity: item.quantity,
      price: item.price,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsError) throw itemsError;

    res.status(201).json({
      success: true,
      data: {
        ...order,
        items: orderItems,
      },
    });
  } catch (err) {
    console.error("POST /orders error:", err.message);
    res.status(500).json({ success: false, error: err.message });
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
    res.json({ success: true, data });
  } catch (err) {
    console.error("PATCH /orders/:id/status error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
