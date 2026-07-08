-- 🎉 Именованные скидочные кампании (как «Летняя распродажа» у Яндекса).
-- Кампания охватывает весь магазин / категорию / бренд на период и
-- порождает обычные скидки (таблица discounts) на подходящие товары —
-- поэтому цена пересчитывается уже существующим механизмом.
CREATE TABLE IF NOT EXISTS discount_campaigns (
    id               BIGSERIAL PRIMARY KEY,
    company_id       BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name             VARCHAR(120) NOT NULL,
    emoji            VARCHAR(16) DEFAULT '🎉',
    discount_percent NUMERIC(5,2) NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 90),
    scope            VARCHAR(16) NOT NULL DEFAULT 'shop' CHECK (scope IN ('shop','category','brand')),
    scope_value      TEXT,                       -- категория/бренд (для scope != 'shop')
    starts_at        TIMESTAMPTZ DEFAULT NOW(),
    ends_at          TIMESTAMPTZ NOT NULL,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_active ON discount_campaigns(company_id, ends_at);

-- Связь скидки с кампанией — чтобы аккуратно снять их при удалении кампании.
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS campaign_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_discounts_campaign ON discounts(campaign_id);
