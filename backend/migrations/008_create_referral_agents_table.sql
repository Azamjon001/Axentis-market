-- Создание таблицы реферальных агентов
CREATE TABLE IF NOT EXISTS referral_agents (
    id BIGSERIAL PRIMARY KEY,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    unique_code VARCHAR(7) UNIQUE NOT NULL, -- 7-значный уникальный код
    name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_referral_agents_phone ON referral_agents(phone);
CREATE INDEX IF NOT EXISTS idx_referral_agents_unique_code ON referral_agents(unique_code);

-- Комментарии
COMMENT ON TABLE referral_agents IS 'Реферальные агенты, которые привлекают компании';
COMMENT ON COLUMN referral_agents.unique_code IS '7-значный уникальный код для идентификации реферала';
COMMENT ON COLUMN referral_agents.is_active IS 'Активен ли реферальный агент';
