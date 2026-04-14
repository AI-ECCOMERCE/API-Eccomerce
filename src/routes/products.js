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
      .is("parent_id", null)
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

    const { data: parentProducts, error } = await query;
    if (error) throw error;

    let finalData = parentProducts || [];
    if (finalData.length > 0) {
      const parentIds = finalData.map(p => p.id);
      const { data: variantsData } = await supabase
        .from("products")
        .select("*")
        .in("parent_id", parentIds);
      
      finalData = finalData.map(p => ({
        ...p,
        variants: variantsData?.filter(v => v.parent_id === p.id) || []
      }));
    }

    res.json({ success: true, data: finalData });
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

    const { data: variantsData } = await supabase
      .from("products")
      .select("*")
      .eq("parent_id", data.id);

    data.variants = variantsData || [];

    res.json({ success: true, data });
  } catch (err) {
    console.error("GET /products/:id error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/products — Tambah produk baru
router.post("/", requireAdminAuth, async (req, res) => {
  try {
    const { name, description, price, original_price, category_slug, stock, icon, gradient, shadow, status, variants } = req.body;
    const normalizedDescription = typeof description === "string" ? description.trim() : "";

    if (!name || (price === undefined)) {
      return res.status(400).json({ success: false, error: "Nama dan harga wajib diisi" });
    }

    const { data, error } = await supabase
      .from("products")
      .insert({
        name,
        description: normalizedDescription,
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

    let createdVariants = [];
    if (variants && Array.isArray(variants) && variants.length > 0) {
      const variantsToInsert = variants.map(v => ({
        name: v.name,
        parent_id: data.id,
        price: v.price || 0,
        original_price: v.original_price || 0,
        stock: v.stock || 0,
        category_slug: category_slug || "ai-chat",
        status: status || "active",
      }));
      const { data: vData, error: vError } = await supabase
        .from("products")
        .insert(variantsToInsert)
        .select();
      if (!vError) createdVariants = vData;
    }

    res.status(201).json({ success: true, data: { ...data, variants: createdVariants } });
  } catch (err) {
    console.error("POST /products error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/products/:id — Update produk
router.put("/:id", requireAdminAuth, async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      original_price,
      category_slug,
      stock,
      icon,
      gradient,
      shadow,
      status,
      variants,
    } = req.body;

    const updates = {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined
        ? { description: typeof description === "string" ? description.trim() : "" }
        : {}),
      ...(price !== undefined ? { price } : {}),
      ...(original_price !== undefined ? { original_price } : {}),
      ...(category_slug !== undefined ? { category_slug } : {}),
      ...(stock !== undefined ? { stock } : {}),
      ...(icon !== undefined ? { icon } : {}),
      ...(gradient !== undefined ? { gradient } : {}),
      ...(shadow !== undefined ? { shadow } : {}),
      ...(status !== undefined ? { status } : {}),
    };

    updates.updated_at = new Date().toISOString();

    const { data: parentData, error } = await supabase
      .from("products")
      .update(updates)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Handle variants Upsert
    if (variants && Array.isArray(variants)) {
       const variantsToUpsert = variants.map(v => ({
         ...(v.id ? { id: v.id } : {}),
         name: v.name,
         parent_id: req.params.id,
         price: v.price || 0,
         original_price: v.original_price || 0,
         stock: v.stock || 0,
         category_slug: updates.category_slug || parentData.category_slug,
         status: updates.status || parentData.status,
       }));
       if (variantsToUpsert.length > 0) {
          await supabase.from("products").upsert(variantsToUpsert);
       }
    }

    res.json({ success: true, data: parentData });
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
