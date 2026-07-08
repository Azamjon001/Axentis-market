-- Добавляем статус 'cancelled' для удаленных реклам
-- Рекламы с этим статусом видны только в админ-панели

-- Изменяем CHECK constraint для поддержки нового статуса
ALTER TABLE advertisements 
DROP CONSTRAINT IF EXISTS advertisements_status_check;

ALTER TABLE advertisements
ADD CONSTRAINT advertisements_status_check 
CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'deleted'));

-- Комментарий
COMMENT ON COLUMN advertisements.status IS 'Статус рекламы: pending (на модерации), approved (одобрена), rejected (отклонена), cancelled (удалена компанией), deleted (удалена компанией)';
