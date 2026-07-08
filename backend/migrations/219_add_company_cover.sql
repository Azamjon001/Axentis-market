-- Фоновое (обложка) фото магазина — отображается на странице компании за логотипом.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS cover_url TEXT;
