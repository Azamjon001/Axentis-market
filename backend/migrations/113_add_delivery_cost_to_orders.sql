-- Добавляем колонку для стоимости доставки
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS delivery_cost DECIMAL(10, 2) DEFAULT 0;

-- Комментарий
COMMENT ON COLUMN orders.delivery_cost IS 'Стоимость доставки (30000 для доставки, 0 для самовывоза)';
