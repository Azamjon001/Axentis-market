-- Добавляем статус 'deleted' для удаленных реклам (вместо 'cancelled')
-- Это позволяет различать рекламы, удаленные компанией (deleted), и отклоненные админом (rejected)

-- Изменяем CHECK constraint для поддержки нового статуса
ALTER TABLE advertisements 
DROP CONSTRAINT IF EXISTS advertisements_status_check;

ALTER TABLE advertisements
ADD CONSTRAINT advertisements_status_check 
CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'deleted'));

-- Обновляем существующие 'cancelled' записи на 'deleted' (опционально, если нужно)
-- UPDATE advertisements SET status = 'deleted' WHERE status = 'cancelled';

-- Комментарий
COMMENT ON COLUMN advertisements.status IS 'Статус рекламы: pending (на модерации), approved (одобрена), rejected (отклонена), cancelled (удалена), deleted (удалена компанией)';
