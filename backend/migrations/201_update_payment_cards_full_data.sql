-- Обновление таблицы payment_cards для сохранения полных данных карты
ALTER TABLE payment_cards 
ADD COLUMN IF NOT EXISTS card_number_encrypted TEXT,
ADD COLUMN IF NOT EXISTS card_expiry VARCHAR(5), -- MM/YY
ADD COLUMN IF NOT EXISTS card_holder_first_name VARCHAR(50),
ADD COLUMN IF NOT EXISTS card_holder_last_name VARCHAR(50);

-- Комментарии к новым полям
COMMENT ON COLUMN payment_cards.card_number_encrypted IS 'Зашифрованный полный номер карты (16 цифр)';
COMMENT ON COLUMN payment_cards.card_expiry IS 'Срок действия карты в формате MM/YY';
COMMENT ON COLUMN payment_cards.card_holder_first_name IS 'Имя держателя карты';
COMMENT ON COLUMN payment_cards.card_holder_last_name IS 'Фамилия держателя карты';
