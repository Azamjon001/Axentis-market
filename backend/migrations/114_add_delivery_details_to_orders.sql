-- Добавляем колонки для информации о доставке
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS delivery_type VARCHAR(20) DEFAULT 'pickup',
ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS delivery_address TEXT,
ADD COLUMN IF NOT EXISTS delivery_coordinates VARCHAR(50);

-- Комментарии
COMMENT ON COLUMN orders.delivery_type IS 'Тип доставки: pickup (самовывоз) или delivery (доставка)';
COMMENT ON COLUMN orders.recipient_name IS 'Имя получателя заказа';
COMMENT ON COLUMN orders.delivery_address IS 'Адрес доставки';
COMMENT ON COLUMN orders.delivery_coordinates IS 'Координаты точки доставки (lat,lng)';
