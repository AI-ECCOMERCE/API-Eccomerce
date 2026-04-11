const express = require("express");

const supabase = require("../config/supabase");
const requireAdminAuth = require("../middleware/requireAdminAuth");
const { createHttpError, respondWithError } = require("../utils/respondWithError");

const router = express.Router();

router.use(requireAdminAuth);

const sanitizeText = (value) => String(value || "").trim();

const sanitizeSearch = (value) =>
  sanitizeText(value).replace(/[,%]/g, " ").replace(/\s+/g, " ").trim();

const normalizeProductAccountError = (error) => {
  if (error?.code === "PGRST205") {
    throw createHttpError(
      "Tabel inventori akun belum tersedia. Jalankan migration fulfillment Resend di database terlebih dahulu.",
      503,
      { expose: true }
    );
  }

  throw error;
};

const validateProductAccountPayload = (payload) => {
  const productId = sanitizeText(payload.product_id);
  const loginEmail = sanitizeText(payload.login_email).toLowerCase();
  const loginPassword = sanitizeText(payload.login_password);
  const accountName = sanitizeText(payload.account_name);
  const accountNotes = sanitizeText(payload.account_notes);
  const status = sanitizeText(payload.status) || "available";

  const validStatuses = ["available", "reserved", "delivered", "disabled"];

  if (!productId) {
    throw createHttpError("Produk wajib dipilih.");
  }

  if (!loginEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail)) {
    throw createHttpError("Email login akun tidak valid.");
  }

  if (!loginPassword) {
    throw createHttpError("Password akun wajib diisi.");
  }

  if (!validStatuses.includes(status)) {
    throw createHttpError("Status akun tidak valid.");
  }

  return {
    product_id: productId,
    account_name: accountName,
    login_email: loginEmail,
    login_password: loginPassword,
    account_notes: accountNotes,
    status,
  };
};

router.get("/", async (req, res) => {
  try {
    const { product_id, status, search } = req.query;
    const sanitizedSearch = sanitizeSearch(search);

    let query = supabase
      .from("product_accounts")
      .select(
        "*, products(id, name, icon, gradient), assigned_order:orders(id, order_id)"
      )
      .order("created_at", { ascending: false });

    if (product_id && product_id !== "all") {
      query = query.eq("product_id", product_id);
    }

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (sanitizedSearch) {
      query = query.or(
        `login_email.ilike.%${sanitizedSearch}%,account_name.ilike.%${sanitizedSearch}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      normalizeProductAccountError(error);
    }

    res.json({ success: true, data: data || [] });
  } catch (error) {
    respondWithError(res, error, {
      context: "GET /product-accounts",
      defaultMessage: "Gagal mengambil inventori akun.",
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const payload = validateProductAccountPayload(req.body);

    const { data, error } = await supabase
      .from("product_accounts")
      .insert(payload)
      .select(
        "*, products(id, name, icon, gradient), assigned_order:orders(id, order_id)"
      )
      .single();

    if (error) {
      normalizeProductAccountError(error);
    }

    res.status(201).json({ success: true, data });
  } catch (error) {
    respondWithError(res, error, {
      context: "POST /product-accounts",
      defaultMessage: "Gagal menambahkan akun produk.",
    });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const payload = validateProductAccountPayload(req.body);

    const { data: currentAccount, error: currentError } = await supabase
      .from("product_accounts")
      .select("status")
      .eq("id", req.params.id)
      .single();

    if (currentError) {
      normalizeProductAccountError(currentError);
    }

    if (
      currentAccount.status !== "available" &&
      currentAccount.status !== "disabled"
    ) {
      throw createHttpError(
        "Akun yang sudah dipakai pesanan tidak bisa diedit sembarangan.",
        409
      );
    }

    const { data, error } = await supabase
      .from("product_accounts")
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", req.params.id)
      .select(
        "*, products(id, name, icon, gradient), assigned_order:orders(id, order_id)"
      )
      .single();

    if (error) {
      normalizeProductAccountError(error);
    }

    res.json({ success: true, data });
  } catch (error) {
    respondWithError(res, error, {
      context: "PUT /product-accounts/:id",
      defaultMessage: "Gagal memperbarui akun produk.",
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { data: currentAccount, error: currentError } = await supabase
      .from("product_accounts")
      .select("status")
      .eq("id", req.params.id)
      .single();

    if (currentError) {
      normalizeProductAccountError(currentError);
    }

    if (
      currentAccount.status !== "available" &&
      currentAccount.status !== "disabled"
    ) {
      throw createHttpError(
        "Akun yang sudah dipakai pesanan tidak bisa dihapus.",
        409
      );
    }

    const { error } = await supabase
      .from("product_accounts")
      .delete()
      .eq("id", req.params.id);

    if (error) {
      normalizeProductAccountError(error);
    }

    res.json({ success: true, message: "Akun produk berhasil dihapus." });
  } catch (error) {
    respondWithError(res, error, {
      context: "DELETE /product-accounts/:id",
      defaultMessage: "Gagal menghapus akun produk.",
    });
  }
});

module.exports = router;
