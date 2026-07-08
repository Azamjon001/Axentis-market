-- Loyalty / cashback points (⭐ баллы и кэшбэк). Additive — new tables only.

CREATE TABLE IF NOT EXISTS loyalty_accounts (
    user_phone VARCHAR(20) PRIMARY KEY,
    points_balance INTEGER NOT NULL DEFAULT 0,
    total_earned INTEGER NOT NULL DEFAULT 0,
    total_spent INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id BIGSERIAL PRIMARY KEY,
    user_phone VARCHAR(20) NOT NULL,
    points INTEGER NOT NULL,                 -- always positive; direction is in `type`
    type VARCHAR(10) NOT NULL CHECK (type IN ('earn', 'redeem', 'adjust')),
    order_id BIGINT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_tx_user ON loyalty_transactions(user_phone);
