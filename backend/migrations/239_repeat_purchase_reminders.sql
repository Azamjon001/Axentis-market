-- 🔁 Напоминание о повторной покупке (Amazon-классика для расходников).
-- Алгоритм: если покупатель брал товар 2+ раза, считаем его средний цикл
-- покупки (дней между покупками). Когда с последней покупки прошло больше
-- цикла — шлём push «Пора обновить запас?». Таблица хранит отметку, когда
-- по паре (покупатель, товар) уже напоминали, чтобы не спамить.

CREATE TABLE IF NOT EXISTS repeat_reminders (
    user_phone VARCHAR(20) NOT NULL,
    product_id BIGINT NOT NULL,
    last_notified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_phone, product_id)
);

COMMENT ON TABLE repeat_reminders IS 'Отметки отправленных напоминаний «пора обновить запас» (покупатель × товар)';
