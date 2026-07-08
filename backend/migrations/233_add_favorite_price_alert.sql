-- 💸 Уведомление «цена снизилась» на избранное: помним, о какой скидке уже
-- сообщили покупателю, чтобы не слать повтор по той же акции.
ALTER TABLE user_favorites ADD COLUMN IF NOT EXISTS notified_discount_id BIGINT;
