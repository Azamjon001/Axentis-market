-- Добавляем колонки color и size для характеристик товара
ALTER TABLE products ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS size TEXT;

-- Комментарии к колонкам
COMMENT ON COLUMN products.color IS 'Цвет товара (например: красный, синий, #FF0000)';
COMMENT ON COLUMN products.size IS 'Размер товара (например: XL, XXL, 40, 41)';
