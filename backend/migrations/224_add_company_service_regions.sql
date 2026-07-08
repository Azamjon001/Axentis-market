-- Multi-region delivery: a company can serve many regions (oblasts) at once.
-- Stored as a JSONB array of region names that match utils/uzbekistanRegions.ts
-- (e.g. ["Андижанская область", "город Ташкент"]). The customer app resolves the
-- buyer's geolocation to one of these region names and only shows products from
-- companies whose service_regions contains it.

DO $$
BEGIN
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS service_regions JSONB NOT NULL DEFAULT '[]'::jsonb;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'companies.service_regions skipped: %', SQLERRM;
END $$;

-- Ensure the single-region / district text columns the SMM panel writes exist too.
DO $$
BEGIN
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS region   VARCHAR(150);
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS district VARCHAR(150);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'companies.region/district skipped: %', SQLERRM;
END $$;

-- Decoration video the company picked (admin-provided) to play behind its store cover.
DO $$
BEGIN
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS cover_video_url TEXT;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'companies.cover_video_url skipped: %', SQLERRM;
END $$;

-- Speeds up "which companies serve region X" lookups.
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_companies_service_regions ON companies USING gin (service_regions);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'idx_companies_service_regions skipped: %', SQLERRM;
END $$;
