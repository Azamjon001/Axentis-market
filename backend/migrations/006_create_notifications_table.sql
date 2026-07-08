-- Создание таблицы уведомлений (notifications)
CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    user_phone VARCHAR(20) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'new_product',
    title VARCHAR(255) NOT NULL,
    message TEXT,
    company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
    product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для быстрого поиска уведомлений
CREATE INDEX IF NOT EXISTS idx_notifications_user_phone ON notifications(user_phone);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- Комментарии к таблице
COMMENT ON TABLE notifications IS 'Уведомления для пользователей';
COMMENT ON COLUMN notifications.type IS 'Тип уведомления: new_product, order_status, promo и т.д.';
COMMENT ON COLUMN notifications.is_read IS 'Прочитано ли уведомление';
