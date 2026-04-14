-- ==============================================
-- Resend Delivery Tracking
-- Tambahkan kolom event delivery dari Resend
-- ==============================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS fulfillment_email_provider_status TEXT DEFAULT NULL;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS fulfillment_email_delivered_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS fulfillment_email_last_event_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_email_id
  ON orders(fulfillment_email_id);

