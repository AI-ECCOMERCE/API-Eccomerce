-- ==============================================
-- Resend Account Fulfillment Setup
-- Jalankan file ini setelah migration payment Pakasir
-- ==============================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS fulfillment_status TEXT DEFAULT 'pending';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS fulfillment_started_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS fulfillment_completed_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS fulfillment_email_status TEXT DEFAULT 'pending';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS fulfillment_email_id TEXT DEFAULT NULL;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS fulfillment_email_sent_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS fulfillment_error TEXT DEFAULT NULL;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS fulfillment_email_provider_status TEXT DEFAULT NULL;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS fulfillment_email_delivered_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS fulfillment_email_last_event_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_fulfillment_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_fulfillment_status_check
  CHECK (fulfillment_status IN ('pending', 'processing', 'fulfilled', 'manual_review', 'failed'));

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_fulfillment_email_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_fulfillment_email_status_check
  CHECK (fulfillment_email_status IN ('pending', 'sent', 'failed'));

UPDATE orders
SET
  fulfillment_status = COALESCE(fulfillment_status, 'pending'),
  fulfillment_email_status = COALESCE(fulfillment_email_status, 'pending')
WHERE fulfillment_status IS NULL OR fulfillment_email_status IS NULL;

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

ALTER TABLE product_accounts
  ADD COLUMN IF NOT EXISTS sales_applied_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_product_accounts_product_status
  ON product_accounts(product_id, status);

CREATE INDEX IF NOT EXISTS idx_product_accounts_order
  ON product_accounts(assigned_order_id);

CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_email_id
  ON orders(fulfillment_email_id);

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

ALTER TABLE product_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON product_accounts;
CREATE POLICY "Service role full access" ON product_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Contoh insert inventori akun:
-- INSERT INTO product_accounts (product_id, account_name, login_email, login_password, account_notes)
-- VALUES
--   ('PRODUCT_UUID_HERE', 'ChatGPT Plus 1 Bulan', 'email1@example.com', 'password-aman-1', 'Login pertama wajib ganti password'),
--   ('PRODUCT_UUID_HERE', 'ChatGPT Plus 1 Bulan', 'email2@example.com', 'password-aman-2', 'Gunakan profile default');
