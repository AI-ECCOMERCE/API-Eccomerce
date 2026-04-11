-- ==============================================
-- DesignAI Store — Supabase Database Schema
-- Jalankan SQL ini di Supabase SQL Editor
-- Dashboard → SQL Editor → New Query → Paste & Run
-- ==============================================

-- 1. Tabel Kategori
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT DEFAULT 'ph-tag',
  color TEXT DEFAULT 'from-brand-400 to-brand-600',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabel Produk
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price INTEGER NOT NULL DEFAULT 0,
  original_price INTEGER DEFAULT 0,
  category_slug TEXT REFERENCES categories(slug) ON DELETE SET NULL,
  stock INTEGER DEFAULT 0,
  sold INTEGER DEFAULT 0,
  rating NUMERIC(2,1) DEFAULT 5.0,
  reviews_count INTEGER DEFAULT 0,
  badge_text TEXT DEFAULT NULL,
  badge_color TEXT DEFAULT NULL,
  icon TEXT DEFAULT 'ph-package',
  gradient TEXT DEFAULT 'from-brand-400 to-brand-600',
  shadow TEXT DEFAULT 'shadow-brand-500/20',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'draft', 'out_of_stock')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabel Pesanan
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_notes TEXT DEFAULT '',
  total_price INTEGER NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'processing', 'completed', 'cancelled')),
  payment_gateway TEXT DEFAULT 'pakasir',
  payment_method TEXT DEFAULT 'qris',
  payment_ref TEXT DEFAULT NULL,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'canceled', 'expired')),
  payment_number TEXT DEFAULT NULL,
  payment_url TEXT DEFAULT NULL,
  payment_fee INTEGER NOT NULL DEFAULT 0,
  payment_total INTEGER NOT NULL DEFAULT 0,
  payment_expires_at TIMESTAMPTZ DEFAULT NULL,
  payment_completed_at TIMESTAMPTZ DEFAULT NULL,
  payment_last_checked_at TIMESTAMPTZ DEFAULT NULL,
  payment_payload JSONB DEFAULT NULL,
  fulfillment_status TEXT DEFAULT 'pending' CHECK (fulfillment_status IN ('pending', 'processing', 'fulfilled', 'manual_review', 'failed')),
  fulfillment_started_at TIMESTAMPTZ DEFAULT NULL,
  fulfillment_completed_at TIMESTAMPTZ DEFAULT NULL,
  fulfillment_email_status TEXT DEFAULT 'pending' CHECK (fulfillment_email_status IN ('pending', 'sent', 'failed')),
  fulfillment_email_id TEXT DEFAULT NULL,
  fulfillment_email_sent_at TIMESTAMPTZ DEFAULT NULL,
  fulfillment_error TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabel Item Pesanan
CREATE TABLE IF NOT EXISTS order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  price INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabel Inventori Akun Produk
CREATE TABLE IF NOT EXISTS product_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  account_name TEXT DEFAULT '',
  login_email TEXT NOT NULL,
  login_password TEXT NOT NULL,
  account_notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'delivered', 'disabled')),
  assigned_order_id UUID DEFAULT NULL REFERENCES orders(id) ON DELETE SET NULL,
  assigned_order_item_id UUID DEFAULT NULL REFERENCES order_items(id) ON DELETE SET NULL,
  sales_applied_at TIMESTAMPTZ DEFAULT NULL,
  reserved_at TIMESTAMPTZ DEFAULT NULL,
  delivered_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tabel Bundle
CREATE TABLE IF NOT EXISTS bundles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  original_price INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'draft')),
  sold INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Tabel Bundle Items (many-to-many)
CREATE TABLE IF NOT EXISTS bundle_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bundle_id UUID REFERENCES bundles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE
);

-- 7. Tabel Admin Users
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'owner')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- INDEXES untuk performa query
-- ==============================================
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_slug);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_product_accounts_product_status ON product_accounts(product_id, status);
CREATE INDEX IF NOT EXISTS idx_product_accounts_order ON product_accounts(assigned_order_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(is_active);

-- ==============================================
-- ROW LEVEL SECURITY (RLS) — opsional tapi recommended
-- ==============================================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role full access (backend API)
DROP POLICY IF EXISTS "Service role full access" ON categories;
DROP POLICY IF EXISTS "Service role full access" ON products;
DROP POLICY IF EXISTS "Service role full access" ON orders;
DROP POLICY IF EXISTS "Service role full access" ON order_items;
DROP POLICY IF EXISTS "Service role full access" ON product_accounts;
DROP POLICY IF EXISTS "Service role full access" ON bundles;
DROP POLICY IF EXISTS "Service role full access" ON bundle_items;
DROP POLICY IF EXISTS "Service role full access" ON admin_users;

CREATE POLICY "Service role full access" ON categories FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON products FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON orders FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON order_items FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON product_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON bundles FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON bundle_items FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON admin_users FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Policy: Allow anon read-only on products & categories (frontend)
DROP POLICY IF EXISTS "Anon read products" ON products;
DROP POLICY IF EXISTS "Anon read categories" ON categories;

CREATE POLICY "Anon read products" ON products FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read categories" ON categories FOR SELECT TO anon USING (true);

-- ==============================================
-- FUNCTIONS untuk fulfillment
-- ==============================================
CREATE OR REPLACE FUNCTION claim_product_account(
  p_product_id UUID,
  p_order_id UUID,
  p_order_item_id UUID
)
RETURNS product_accounts
LANGUAGE plpgsql
AS $$
DECLARE
  claimed_account product_accounts;
BEGIN
  UPDATE product_accounts
  SET
    status = 'reserved',
    assigned_order_id = p_order_id,
    assigned_order_item_id = p_order_item_id,
    reserved_at = NOW(),
    updated_at = NOW()
  WHERE id = (
    SELECT id
    FROM product_accounts
    WHERE product_id = p_product_id
      AND status = 'available'
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING * INTO claimed_account;

  RETURN claimed_account;
END;
$$;

CREATE OR REPLACE FUNCTION apply_product_sales(
  p_product_id UUID,
  p_quantity INTEGER
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE products
  SET
    sold = COALESCE(sold, 0) + GREATEST(p_quantity, 0),
    stock = GREATEST(COALESCE(stock, 0) - GREATEST(p_quantity, 0), 0),
    updated_at = NOW()
  WHERE id = p_product_id;
END;
$$;

CREATE OR REPLACE FUNCTION apply_order_item_sales(
  p_order_item_id UUID,
  p_product_id UUID,
  p_quantity INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  applied_count INTEGER;
BEGIN
  WITH target_accounts AS (
    SELECT id
    FROM product_accounts
    WHERE assigned_order_item_id = p_order_item_id
      AND product_id = p_product_id
      AND sales_applied_at IS NULL
    ORDER BY created_at ASC
    FOR UPDATE
    LIMIT GREATEST(p_quantity, 0)
  ), updated_accounts AS (
    UPDATE product_accounts
    SET
      sales_applied_at = NOW(),
      updated_at = NOW()
    WHERE id IN (SELECT id FROM target_accounts)
    RETURNING id
  )
  SELECT COUNT(*) INTO applied_count
  FROM updated_accounts;

  IF applied_count = 0 THEN
    RETURN FALSE;
  END IF;

  UPDATE products
  SET
    sold = COALESCE(sold, 0) + applied_count,
    stock = GREATEST(COALESCE(stock, 0) - applied_count, 0),
    updated_at = NOW()
  WHERE id = p_product_id;

  RETURN TRUE;
END;
$$;
