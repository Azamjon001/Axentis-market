-- Добавляем колонку password для хранения пароля в открытом виде
-- (только для показа реферальному агенту)
ALTER TABLE referral_agents 
ADD COLUMN IF NOT EXISTS password TEXT;

-- Изменяем значение по умолчанию для is_active на false
-- Агент становится активным только после регистрации первой компании
ALTER TABLE referral_agents 
ALTER COLUMN is_active SET DEFAULT false;

COMMENT ON COLUMN referral_agents.password IS 'Пароль в открытом виде (для показа агенту при создании)';
COMMENT ON COLUMN referral_agents.is_active IS 'Активируется автоматически когда компания регистрируется с этим агентом';
