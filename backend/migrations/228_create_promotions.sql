-- 📢 Внутренняя реклама (промо-размещение): продавец подаёт заявку на
-- продвижение всего магазина или отдельного товара, админ подтверждает
-- оплату (пока офлайн) и задаёт срок. Пока продвижение активно, товары
-- поднимаются вверх витрины; по истечении срока — автоматически возвращаются.
CREATE TABLE IF NOT EXISTS promotions (
    id            BIGSERIAL PRIMARY KEY,
    company_id    BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    product_id    BIGINT REFERENCES products(id) ON DELETE CASCADE, -- NULL = весь магазин
    scope         VARCHAR(16) NOT NULL DEFAULT 'company' CHECK (scope IN ('company','product')),
    days          INT NOT NULL DEFAULT 1,
    amount        NUMERIC(14,2) NOT NULL DEFAULT 0,   -- сумма оплаты (заполняет админ)
    status        VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','rejected','expired','cancelled')),
    starts_at     TIMESTAMPTZ,
    ends_at       TIMESTAMPTZ,
    note          TEXT,                               -- комментарий продавца/админа
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promotions_status ON promotions(status);
CREATE INDEX IF NOT EXISTS idx_promotions_company ON promotions(company_id);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(status, starts_at, ends_at);
