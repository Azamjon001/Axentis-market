-- Активация всех существующих реферальных агентов
-- До этого агенты создавались с is_active = false, что не позволяло им войти в систему
UPDATE referral_agents 
SET is_active = true
WHERE is_active = false;

COMMENT ON TABLE referral_agents IS 'Реферальные агенты активируются автоматически при создании';
