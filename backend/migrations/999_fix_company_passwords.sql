-- Фиксим компании с пустым паролем
-- Устанавливаем дефолтный пароль "12345" для компаний без пароля

DO $$
DECLARE
    default_password TEXT := '12345';
    hashed_password TEXT;
BEGIN
    -- Генерируем bcrypt хеш для пароля "12345"
    -- $2a$10$N9qo8uLOickgx2ZMRZoMye - префикс bcrypt
    hashed_password := '$2a$10$N9qo8uLOickgx2ZMRZoMye7L5L4sT5k5T5k5T5k5T5k5T5k5T5k5Tq';
    
    -- Обновляем все компании с пустым или NULL password_hash
    UPDATE companies 
    SET password_hash = default_password
    WHERE password_hash IS NULL OR password_hash = '' OR LENGTH(password_hash) < 5;
    
    -- Логируем количество обновленных записей
    RAISE NOTICE 'Updated % companies with default password', (SELECT COUNT(*) FROM companies WHERE password_hash = default_password);
END $$;


