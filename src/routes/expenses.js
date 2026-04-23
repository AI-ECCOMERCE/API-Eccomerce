const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");
const requireAdminAuth = require("../middleware/requireAdminAuth");

router.use(requireAdminAuth);

// GET /api/expenses
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error("GET /expenses error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/expenses
router.post("/", async (req, res) => {
  try {
    const { date, category, description, amount } = req.body;
    
    if (!category || !description || amount === undefined) {
      return res.status(400).json({ success: false, error: "Category, description, and amount are required" });
    }

    const { data, error } = await supabase
      .from("expenses")
      .insert({ 
        date: date || new Date().toISOString().split('T')[0], 
        category, 
        description, 
        amount: parseInt(amount) 
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) {
    console.error("POST /expenses error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/expenses/:id
router.delete("/:id", async (req, res) => {
  try {
    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", req.params.id);

    if (error) throw error;
    res.json({ success: true, message: "Pengeluaran berhasil dihapus" });
  } catch (err) {
    console.error("DELETE /expenses/:id error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
