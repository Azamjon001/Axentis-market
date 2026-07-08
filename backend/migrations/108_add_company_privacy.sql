-- Добавляем поле для кода доступа к приватной компании (5-6 цифр)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS private_code VARCHAR(6) UNIQUE;

-- Создаем индекс для быстрого поиска по коду
CREATE INDEX IF NOT EXISTS idx_companies_private_code ON companies(private_code);

-- Добавляем поля в таблицу users для хранения режима и связи с приватной компанией
ALTER TABLE users ADD COLUMN IF NOT EXISTS mode VARCHAR(10) DEFAULT 'public' CHECK (mode IN ('public', 'private'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS private_company_id BIGINT REFERENCES companies(id) ON DELETE SET NULL;

-- Создаем индекс для быстрого поиска пользователей по компании
CREATE INDEX IF NOT EXISTS idx_users_private_company ON users(private_company_id);
CREATE INDEX IF NOT EXISTS idx_users_mode ON users(mode);
