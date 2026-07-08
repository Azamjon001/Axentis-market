-- Catalog filtering & sorting performance indexes.
-- Keeps the public catalog (category + brand + price + in-stock filters, and
-- popular/new/price sorting) fast even with tens of thousands of products.
-- Additive: only adds indexes, no schema or data changes. Each statement is
-- wrapped in a DO block so a single failure never blocks the rest, and every
-- index uses IF NOT EXISTS so the migration is idempotent.

-- Effective product-level price (the same immutable expression used by the
-- catalog query for price filtering and ASC/DESC price sorting). Partial on
-- visible products so the index stays small.
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_products_eff_price
    ON products ((COALESCE(NULLIF(selling_price,0), price * (1.0 + COALESCE(markup_percent,0)/100.0))))
    WHERE available_for_customers = true;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'idx_products_eff_price skipped: %', SQLERRM;
END $$;

-- Category + recency: serves "category filter + new sort" and the default order.
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_products_cat_created
    ON products (category, created_at DESC)
    WHERE available_for_customers = true;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'idx_products_cat_created skipped: %', SQLERRM;
END $$;

-- Category + popularity: serves "category filter + popular sort".
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_products_cat_sold
    ON products (category, sold_count DESC)
    WHERE available_for_customers = true;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'idx_products_cat_sold skipped: %', SQLERRM;
END $$;

-- Recency / popularity across the whole catalog (no category filter).
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_products_avail_created
    ON products (created_at DESC)
    WHERE available_for_customers = true;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'idx_products_avail_created skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_products_avail_sold
    ON products (sold_count DESC)
    WHERE available_for_customers = true;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'idx_products_avail_sold skipped: %', SQLERRM;
END $$;

-- Brand filter (case-insensitive equality).
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_products_brand_lower
    ON products (lower(brand))
    WHERE available_for_customers = true;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'idx_products_brand_lower skipped: %', SQLERRM;
END $$;

-- Make the per-row variant subqueries (display min price, in-stock EXISTS) index-only.
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_pv_product_sellprice
    ON product_variants (product_id, selling_price);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'idx_pv_product_sellprice skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_pv_product_stock
    ON product_variants (product_id, stock_quantity);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'idx_pv_product_stock skipped: %', SQLERRM;
END $$;
