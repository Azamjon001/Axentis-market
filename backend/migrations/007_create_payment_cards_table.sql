-- Создаем таблицу для хранения банковских карт пользователей
CREATE TABLE IF NOT EXISTS payment_cards (
    id SERIAL PRIMARY KEY,
    user_phone VARCHAR(20) NOT NULL,
    card_number_last4 VARCHAR(4) NOT NULL, -- Последние 4 цифры карты для безопасности
    card_holder_name VARCHAR(100) NOT NULL, -- Имя держателя карты
    card_type VARCHAR(20), -- Тип карты: uzcard, humo, visa, mastercard
    is_default BOOLEAN DEFAULT false, -- Главная карта по умолчанию
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индекс для быстрого поиска карт пользователя
CREATE INDEX IF NOT EXISTS idx_payment_cards_user_phone ON payment_cards(user_phone);

-- Комментарии к таблице
COMMENT ON TABLE payment_cards IS 'Сохраненные банковские карты пользователей';
COMMENT ON COLUMN payment_cards.card_number_last4 IS 'Последние 4 цифры номера карты (для безопасности)';
COMMENT ON COLUMN payment_cards.card_holder_name IS 'Имя и фамилия на карте';
COMMENT ON COLUMN payment_cards.is_default IS 'Установлена ли эта карта как основная';
