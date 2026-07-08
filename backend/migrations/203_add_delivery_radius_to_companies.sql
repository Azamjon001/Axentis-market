-- Add delivery radius fields to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS delivery_radius_km FLOAT DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS delivery_radius_lat FLOAT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS delivery_radius_lng FLOAT;
