const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");
const requireAdminAuth = require("../middleware/requireAdminAuth");

// GET /api/categories
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("categories")
      .select("*, products(count)")
      .order("name");

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error("GET /categories error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/categories
router.post("/", requireAdminAuth, async (req, res) => {
  try {
    const { name, slug, icon, color } = req.body;
    if (!name || !slug) {
      return res.status(400).json({ success: false, error: "Nama dan slug wajib diisi" });
    }

    const { data, error } = await supabase
      .from("categories")
      .insert({ name, slug, icon: icon || "ph-tag", color: color || "from-brand-400 to-brand-600" })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) {
    console.error("POST /categories error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/categories/:id
router.delete("/:id", requireAdminAuth, async (req, res) => {
  try {
    const { error } = await supabase.from("categories").delete().eq("id", req.params.id);
    if (error) throw error;
    res.json({ success: true, message: "Kategori berhasil dihapus" });
  } catch (err) {
    console.error("DELETE /categories/:id error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
