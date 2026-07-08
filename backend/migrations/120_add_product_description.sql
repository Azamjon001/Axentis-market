-- Добавляем колонку description для подробного описания товара
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;

-- Обновляем существующие товары с пустым описанием
UPDATE products SET description = '' WHERE description IS NULL;

-- Добавляем комментарий к колонке
COMMENT ON COLUMN products.description IS 'Подробное описание товара для отображения покупателям';
