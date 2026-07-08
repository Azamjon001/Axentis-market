-- Добавляем колонку products_description для общего описания товаров компании
ALTER TABLE companies ADD COLUMN IF NOT EXISTS products_description TEXT;

-- Обновляем существующие компании с пустым описанием
UPDATE companies SET products_description = '' WHERE products_description IS NULL;

-- Добавляем комментарий к колонке
COMMENT ON COLUMN companies.products_description IS 'Общее описание товаров компании, отображается в профиле компании';
