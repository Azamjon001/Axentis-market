-- Добавляем поле view_count к таблице companies
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- Создаем таблицу для подписок на компании
CREATE TABLE IF NOT EXISTS company_subscribers (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_phone VARCHAR(50) NOT NULL,
    subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, user_phone)
);

-- Индекс для быстрого поиска подписчиков компании
CREATE INDEX IF NOT EXISTS idx_company_subscribers_company 
ON company_subscribers(company_id);

-- Индекс для быстрого поиска подписок пользователя
CREATE INDEX IF NOT EXISTS idx_company_subscribers_user 
ON company_subscribers(user_phone);
