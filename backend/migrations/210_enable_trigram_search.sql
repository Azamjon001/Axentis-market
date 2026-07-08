-- Typo-tolerant product search via the pg_trgm extension. Additive — only
-- creates an extension and an index, no data or schema columns change.
-- Wrapped in DO blocks so the migration is non-fatal when the DB user lacks
-- SUPERUSER privilege (common on managed/hosted PostgreSQL services).

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pg_trgm extension could not be created (need superuser): %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Trigram index on products.name skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_products_category_trgm ON products USING gin (category gin_trgm_ops);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Trigram index on products.category skipped: %', SQLERRM;
END $$;
