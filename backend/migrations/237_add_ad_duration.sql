-- Срок размещения рекламы: компания выбирает при создании (мин. 2, макс. 7 дней),
-- отсчёт начинается после одобрения админом (expires_at = reviewed_at + duration_days).
ALTER TABLE advertisements ADD COLUMN IF NOT EXISTS duration_days INTEGER DEFAULT 7;
ALTER TABLE advertisements ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Новый статус 'expired' для баннеров с истёкшим сроком
ALTER TABLE advertisements
DROP CONSTRAINT IF EXISTS advertisements_status_check;

ALTER TABLE advertisements
ADD CONSTRAINT advertisements_status_check
CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'deleted', 'expired'));

CREATE INDEX IF NOT EXISTS idx_ads_expires_at ON advertisements(expires_at) WHERE expires_at IS NOT NULL;

COMMENT ON COLUMN advertisements.duration_days IS 'Срок размещения в днях (2–7), выбирает компания при создании';
COMMENT ON COLUMN advertisements.expires_at IS 'Момент окончания показа: reviewed_at + duration_days, ставится при одобрении';
