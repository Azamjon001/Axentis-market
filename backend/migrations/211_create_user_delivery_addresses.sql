-- User delivery addresses: multiple saved locations per user
CREATE TABLE IF NOT EXISTS user_delivery_addresses (
    id          SERIAL PRIMARY KEY,
    user_phone  VARCHAR(20) NOT NULL REFERENCES users(phone) ON DELETE CASCADE,
    title       VARCHAR(100),
    address     TEXT NOT NULL,
    latitude    DOUBLE PRECISION,
    longitude   DOUBLE PRECISION,
    is_default  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_delivery_addresses_phone ON user_delivery_addresses(user_phone);

-- Unique partial index: only one default per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_delivery_addresses_default
    ON user_delivery_addresses(user_phone)
    WHERE is_default = TRUE;
