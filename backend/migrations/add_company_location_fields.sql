-- Migration: Add location and region fields to companies table
-- This allows companies to specify their exact location for pickup/delivery points

ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS region VARCHAR(100),
ADD COLUMN IF NOT EXISTS district VARCHAR(100),
ADD COLUMN IF NOT EXISTS location_lat DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS location_lng DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS location_address TEXT;

-- Create index for faster region/district based searches
CREATE INDEX IF NOT EXISTS idx_companies_region ON companies(region);
CREATE INDEX IF NOT EXISTS idx_companies_district ON companies(district);
CREATE INDEX IF NOT EXISTS idx_companies_location ON companies(location_lat, location_lng);

COMMENT ON COLUMN companies.region IS 'Регион/Область (например: Андижан, Ташкент)';
COMMENT ON COLUMN companies.district IS 'Район (например: Кургантепа, Джалакудук)';
COMMENT ON COLUMN companies.location_lat IS 'Широта компании';
COMMENT ON COLUMN companies.location_lng IS 'Долгота компании';
COMMENT ON COLUMN companies.location_address IS 'Адрес из карты Google Maps';
