-- ============================================================================
-- ИСПРАВЛЕНИЕ: Генерация access_key для компаний у которых его нет
-- ============================================================================
-- Эта миграция автоматически создает 30-значные ключи доступа для всех
-- компаний, у которых поле access_key = NULL

DO $$
DECLARE
    company_record RECORD;
    new_access_key VARCHAR(30);
    counter INTEGER := 0;
    digit_char CHAR(1);
    i INTEGER;
BEGIN
    -- Цикл по всем компаниям без access_key
    FOR company_record IN 
        SELECT id, name FROM companies WHERE access_key IS NULL OR access_key = ''
    LOOP
        -- Генерируем уникальный 30-значный ключ из цифр
        LOOP
            new_access_key := '';
            -- Генерируем 30 случайных цифр
            FOR i IN 1..30 LOOP
                new_access_key := new_access_key || FLOOR(RANDOM() * 10)::TEXT;
            END LOOP;
            
            -- Проверяем уникальность
            EXIT WHEN NOT EXISTS (SELECT 1 FROM companies WHERE access_key = new_access_key);
        END LOOP;
        
        -- Обновляем компанию
        UPDATE companies 
        SET access_key = new_access_key 
        WHERE id = company_record.id;
        
        counter := counter + 1;
        
        RAISE NOTICE '✅ Generated access_key for company ID=% (%) : %', 
            company_record.id, company_record.name, new_access_key;
    END LOOP;
    
    RAISE NOTICE '🎉 Generated access keys for % companies', counter;
END $$;


