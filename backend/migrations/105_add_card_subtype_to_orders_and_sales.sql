-- Миграция: Добавление поля card_subtype для детализации типа карты
-- Дата: 2026-02-10
-- Описание: Добавляет поле card_subtype в таблицы orders и sales для хранения подтипа карты (UzCard, Humo, Visa, Other)

-- Добавляем поле card_subtype в таблицу orders
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS card_subtype VARCHAR(20);

-- Добавляем комментарий к колонке
COMMENT ON COLUMN orders.card_subtype IS 'Подтип карты при оплате: uzcard, humo, visa, other';

-- Добавляем поле card_subtype в таблицу sales  
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS card_subtype VARCHAR(20);

-- Добавляем комментарий к колонке
COMMENT ON COLUMN sales.card_subtype IS 'Подтип карты при продаже: uzcard, humo, visa, other';

-- Создаем индекс для ускорения фильтрации по подтипу карты
CREATE INDEX IF NOT EXISTS idx_orders_card_subtype ON orders(card_subtype);
CREATE INDEX IF NOT EXISTS idx_sales_card_subtype ON sales(card_subtype);
