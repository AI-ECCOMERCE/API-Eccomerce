const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");
const requireAdminAuth = require("../middleware/requireAdminAuth");

// GET /api/products — Ambil semua produk (dengan filter opsional)
router.get("/", async (req, res) => {
  try {
    const { category, status, search } = req.query;

    let query = supabase
      .from("products")
      .select("*, categories(name, slug)")
      .order("created_at", { ascending: false });

    if (category && category !== "all") {
      query = query.eq("category_slug", category);
    }
    if (status) {
      query = query.eq("status", status);
    }
    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error("GET /products error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/products/:id — Ambil detail produk
router.get("/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*, categories(name, slug)")
      .eq("id", req.params.id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: "Produk tidak ditemukan" });

    res.json({ success: true, data });
  } catch (err) {
    console.error("GET /products/:id error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/products — Tambah produk baru
router.post("/", requireAdminAuth, async (req, res) => {
  try {
    const { name, description, price, original_price, category_slug, stock, icon, gradient, shadow, status } = req.body;

    if (!name || !price) {
      return res.status(400).json({ success: false, error: "Nama dan harga wajib diisi" });
    }

    const { data, error } = await supabase
      .from("products")
      .insert({
        name,
        description,
        price,
        original_price: original_price || 0,
        category_slug: category_slug || "ai-chat",
        stock: stock || 0,
        icon: icon || "ph-package",
        gradient: gradient || "from-brand-400 to-brand-600",
        shadow: shadow || "shadow-brand-500/20",
        status: status || "active",
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) {
    console.error("POST /products error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/products/:id — Update produk
router.put("/:id", requireAdminAuth, async (req, res) => {
  try {
    const updates = { ...req.body };
    delete updates.categories; // Hapus relasi sebelum update ke table utama
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("products")
      .update(updates)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error("PUT /products/:id error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/products/:id — Hapus produk
router.delete("/:id", requireAdminAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", req.params.id);

    if (error) throw error;
    res.json({ success: true, message: "Produk berhasil dihapus" });
  } catch (err) {
    console.error("DELETE /products/:id error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
