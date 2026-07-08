-- Photo reviews: let customers attach image URLs to a product review.
-- Additive — a single JSONB column defaulting to an empty array, so existing
-- text-only reviews keep working unchanged.
DO $$
BEGIN
  ALTER TABLE reviews ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'::jsonb;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'reviews.images column skipped: %', SQLERRM;
END $$;
