const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");
const requireAdminAuth = require("../middleware/requireAdminAuth");

router.use(requireAdminAuth);

// GET /api/incomes
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("incomes")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error("GET /incomes error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/incomes
router.post("/", async (req, res) => {
  try {
    const { date, category, description, amount } = req.body;

    if (!category || !description || amount === undefined) {
      return res
        .status(400)
        .json({ success: false, error: "Category, description, and amount are required" });
    }

    const { data, error } = await supabase
      .from("incomes")
      .insert({
        date: date || new Date().toISOString().split("T")[0],
        category,
        description,
        amount: parseInt(amount),
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) {
    console.error("POST /incomes error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/incomes/:id
router.delete("/:id", async (req, res) => {
  try {
    const { error } = await supabase
      .from("incomes")
      .delete()
      .eq("id", req.params.id);

    if (error) throw error;
    res.json({ success: true, message: "Pemasukan berhasil dihapus" });
  } catch (err) {
    console.error("DELETE /incomes/:id error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
