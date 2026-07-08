-- Добавляем колонку markup_profit в таблицу orders для отслеживания прибыли от наценки
ALTER TABLE orders ADD COLUMN IF NOT EXISTS markup_profit NUMERIC(12, 2) DEFAULT 0;

-- Добавляем комментарий к колонке
COMMENT ON COLUMN orders.markup_profit IS 'Прибыль от наценки (разница между ценой с наценкой и базовой ценой)';

-- Обновляем существующие заказы, устанавливая 0 для markup_profit если NULL
UPDATE orders SET markup_profit = 0 WHERE markup_profit IS NULL;
