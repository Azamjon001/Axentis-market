-- Delivery regions: the admin draws region boundaries (GeoJSON polygons) and
-- each company picks the region it serves. Additive — a new table plus a
-- nullable region_id on companies.

DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS regions (
    id         BIGSERIAL PRIMARY KEY,
    name       VARCHAR(150) NOT NULL,
    name_uz    VARCHAR(150) NOT NULL DEFAULT '',
    parent_id  BIGINT REFERENCES regions(id) ON DELETE SET NULL,
    geojson    JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'regions table skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS region_id BIGINT REFERENCES regions(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'companies.region_id skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_companies_region_id ON companies(region_id);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'idx_companies_region_id skipped: %', SQLERRM;
END $$;
