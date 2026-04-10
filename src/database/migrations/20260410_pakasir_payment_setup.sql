-- ==============================================
-- Pakasir payment integration setup
-- Jalankan sekali pada database yang sudah ada
-- ==============================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_gateway TEXT DEFAULT 'pakasir',
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_number TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_fee INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_total INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_expires_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_completed_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_last_checked_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_payload JSONB DEFAULT NULL;

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_payment_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('pending', 'completed', 'canceled', 'expired'));

CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
