const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");
const requireAdminAuth = require("../middleware/requireAdminAuth");

router.use(requireAdminAuth);

// GET /api/sellers
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("sellers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error("GET /sellers error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/sellers
router.post("/", async (req, res) => {
  try {
    const { name, wa, telegram, website, products, notes } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, error: "Nama seller wajib diisi" });
    }

    const { data, error } = await supabase
      .from("sellers")
      .insert({ 
        name, 
        wa: wa || null, 
        telegram: telegram || null, 
        website: website || null, 
        products: Array.isArray(products) ? products : [], 
        notes: notes || null 
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) {
    console.error("POST /sellers error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/sellers/:id
router.put("/:id", async (req, res) => {
  try {
    const { name, wa, telegram, website, products, notes } = req.body;
    
    const { data, error } = await supabase
      .from("sellers")
      .update({ 
        name, 
        wa: wa || null, 
        telegram: telegram || null, 
        website: website || null, 
        products: Array.isArray(products) ? products : [], 
        notes: notes || null 
      })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error("PUT /sellers/:id error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/sellers/:id
router.delete("/:id", async (req, res) => {
  try {
    const { error } = await supabase
      .from("sellers")
      .delete()
      .eq("id", req.params.id);

    if (error) throw error;
    res.json({ success: true, message: "Seller berhasil dihapus" });
  } catch (err) {
    console.error("DELETE /sellers/:id error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
