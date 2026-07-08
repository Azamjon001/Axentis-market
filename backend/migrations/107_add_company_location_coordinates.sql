-- Добавление координат локации компании
ALTER TABLE companies ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 8);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS longitude NUMERIC(11, 8);

-- Добавляем индекс для быстрого поиска по координатам
CREATE INDEX IF NOT EXISTS idx_companies_location ON companies(latitude, longitude);

-- Комментарии к столбцам
COMMENT ON COLUMN companies.latitude IS 'Широта локации компании (например, 41.2995 для Ташкента)';
COMMENT ON COLUMN companies.longitude IS 'Долгота локации компании (например, 69.2401 для Ташкента)';
