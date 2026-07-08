-- 🔔 Подписка «сообщить о поступлении»: покупатель хочет узнать, когда
-- закончившийся товар снова появится на складе. Фоновый воркер шлёт push,
-- когда quantity станет > 0, и проставляет notified_at.
CREATE TABLE IF NOT EXISTS stock_notifications (
    id             BIGSERIAL PRIMARY KEY,
    product_id     BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    customer_phone VARCHAR(20) NOT NULL,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    notified_at    TIMESTAMPTZ,                 -- NULL = ещё ждёт поступления
    UNIQUE (product_id, customer_phone)
);

CREATE INDEX IF NOT EXISTS idx_stock_notif_pending
    ON stock_notifications(product_id) WHERE notified_at IS NULL;
