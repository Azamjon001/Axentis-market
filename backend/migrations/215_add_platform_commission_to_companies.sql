-- Процент комиссии платформы для каждой компании (от общей выручки).
-- По умолчанию 3%. Админ задаёт при создании и может менять позже.
-- Первый месяц — бесплатный тест (см. trial_end_date).
ALTER TABLE companies ADD COLUMN IF NOT EXISTS platform_commission_percent NUMERIC(5,2) DEFAULT 3;

COMMENT ON COLUMN companies.platform_commission_percent IS 'Процент комиссии платформы от выручки компании (по умолчанию 3%)';
