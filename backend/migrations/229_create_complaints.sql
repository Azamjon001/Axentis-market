-- 🚩 Жалобы покупателей на товар или магазин. Покупатель сообщает о проблеме
-- (подделка, обман, недопустимый контент), админ разбирает очередь.
CREATE TABLE IF NOT EXISTS complaints (
    id             BIGSERIAL PRIMARY KEY,
    target_type    VARCHAR(16) NOT NULL CHECK (target_type IN ('product','company')),
    target_id      BIGINT NOT NULL,
    company_id     BIGINT,                      -- магазин, к которому относится жалоба (для удобства)
    customer_phone VARCHAR(20),
    reason         VARCHAR(64) NOT NULL,        -- краткая причина (категория)
    message        TEXT,                        -- подробности
    status         VARCHAR(16) NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
    admin_note     TEXT,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    resolved_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_target ON complaints(target_type, target_id);
