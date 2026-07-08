-- Платная доставка за км и политика возвратов на уровне компании.
-- Каждая компания сама задаёт бесплатный радиус, тариф за км и условия возврата.

-- Доставка: цена за каждый км сверх бесплатного радиуса (delivery_radius_km).
ALTER TABLE companies ADD COLUMN IF NOT EXISTS delivery_cost_per_km NUMERIC(12,2) DEFAULT 1500;

-- Возвраты: включены ли и в течение скольких часов после оформления заказа
-- покупатель может оформить возврат. Управляется самой компанией.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS return_enabled BOOLEAN DEFAULT true;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS return_window_hours INT DEFAULT 24;

COMMENT ON COLUMN companies.delivery_cost_per_km IS 'Цена доставки за 1 км сверх бесплатного радиуса (сум)';
COMMENT ON COLUMN companies.return_enabled IS 'Принимает ли компания возвраты';
COMMENT ON COLUMN companies.return_window_hours IS 'Окно возврата в часах с момента заказа';
