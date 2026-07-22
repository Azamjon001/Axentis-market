-- Customer order history & personalized-feed performance index.
-- The buyer "My Orders" screen (GET /orders?customer_phone=…) and the
-- personalized home feed (orders subquery in GetProducts) both filter orders
-- by customer_phone; the history list also paginates with
-- `WHERE customer_phone = $1 AND id < $2 ORDER BY id DESC`. Without this index
-- every such call is a full scan of the orders table, which grows fast.
-- Composite (customer_phone, id DESC) serves both the equality filter and the
-- keyset pagination in one index. Additive & idempotent.

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_orders_customer_phone
    ON orders (customer_phone, id DESC);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'idx_orders_customer_phone skipped: %', SQLERRM;
END $$;
