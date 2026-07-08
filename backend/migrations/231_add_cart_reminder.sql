-- 🛒 Напоминание о брошенной корзине. Помечаем, когда покупателю уже
-- отправили push-напоминание, чтобы не слать повторно по одной корзине.
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_cart_items_reminder
    ON cart_items(user_phone) WHERE reminder_sent_at IS NULL;
