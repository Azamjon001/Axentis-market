-- Реферальные агенты: фамилия и процент комиссии агента.
-- commission_percent — сколько процентов от комиссии платформы получает агент
-- (комиссия платформы = выручка компании × platform_commission_percent).
ALTER TABLE referral_agents ADD COLUMN IF NOT EXISTS surname VARCHAR(255);
ALTER TABLE referral_agents ADD COLUMN IF NOT EXISTS commission_percent NUMERIC(5,2) DEFAULT 10;

COMMENT ON COLUMN referral_agents.surname IS 'Фамилия агента';
COMMENT ON COLUMN referral_agents.commission_percent IS 'Процент агента от комиссии платформы (по умолчанию 10%)';
