-- Добавление реферальных полей в таблицу компаний
ALTER TABLE companies ADD COLUMN IF NOT EXISTS referral_code VARCHAR(7);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS referral_agent_id BIGINT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMP;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT true;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP;

-- Внешний ключ на реферального агента
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_referral_agent'
    ) THEN
        ALTER TABLE companies ADD CONSTRAINT fk_referral_agent 
            FOREIGN KEY (referral_agent_id) REFERENCES referral_agents(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Индексы
CREATE INDEX IF NOT EXISTS idx_companies_referral_code ON companies(referral_code);
CREATE INDEX IF NOT EXISTS idx_companies_referral_agent_id ON companies(referral_agent_id);
CREATE INDEX IF NOT EXISTS idx_companies_is_enabled ON companies(is_enabled);

-- Комментарии
COMMENT ON COLUMN companies.referral_code IS 'Реферальный код, использованный при регистрации';
COMMENT ON COLUMN companies.referral_agent_id IS 'ID реферального агента';
COMMENT ON COLUMN companies.trial_end_date IS 'Дата окончания пробного периода (1 месяц)';
COMMENT ON COLUMN companies.is_enabled IS 'Включена ли компания (может работать или заблокирована)';
COMMENT ON COLUMN companies.trial_started_at IS 'Дата начала пробного периода';
