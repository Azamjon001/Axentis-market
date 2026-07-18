-- 🧩 Комплекты «вместе дешевле»: продавец объединяет 2–5 своих товаров и
-- назначает скидку за покупку всего комплекта. Покупатель видит комплект на
-- карточке любого товара из него; скидка автоматически применяется при
-- оформлении, когда все товары комплекта лежат в корзине.

CREATE TABLE IF NOT EXISTS product_bundles (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(120),
    discount_percent NUMERIC(5,2) NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 90),
    product_ids BIGINT[] NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bundles_company ON product_bundles(company_id);
CREATE INDEX IF NOT EXISTS idx_bundles_products ON product_bundles USING GIN (product_ids);

COMMENT ON TABLE product_bundles IS 'Комплекты «вместе дешевле» (2-5 товаров одной компании со скидкой за полный набор)';
