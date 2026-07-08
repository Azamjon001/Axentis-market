-- Promo codes (coupons): platform-wide or per-company discount codes.
-- Fully additive — does not touch existing tables.

CREATE TABLE IF NOT EXISTS promo_codes (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE, -- NULL = platform-wide
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    discount_type VARCHAR(10) NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent', 'fixed')),
    discount_value NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
    min_order_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    max_discount NUMERIC(12, 2),          -- cap for percent discounts; NULL = no cap
    usage_limit INTEGER,                   -- total uses allowed; NULL = unlimited
    used_count INTEGER NOT NULL DEFAULT 0,
    per_user_limit INTEGER NOT NULL DEFAULT 1, -- uses per user; 0 = unlimited
    starts_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_company ON promo_codes(company_id);

CREATE TABLE IF NOT EXISTS promo_code_uses (
    id BIGSERIAL PRIMARY KEY,
    promo_code_id BIGINT NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
    user_phone VARCHAR(20) NOT NULL,
    order_id BIGINT,
    discount_applied NUMERIC(12, 2) NOT NULL DEFAULT 0,
    used_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_uses_code ON promo_code_uses(promo_code_id);
CREATE INDEX IF NOT EXISTS idx_promo_uses_user ON promo_code_uses(user_phone);
