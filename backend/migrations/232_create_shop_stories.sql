-- 📸 Сторис магазинов: короткие карточки (новинки, акции), которые магазин
-- публикует, а покупатели листают вверху главной. Живут 24 часа.
CREATE TABLE IF NOT EXISTS shop_stories (
    id          BIGSERIAL PRIMARY KEY,
    company_id  BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    image_url   TEXT NOT NULL,
    caption     TEXT,
    product_id  BIGINT REFERENCES products(id) ON DELETE SET NULL,  -- опциональная привязка к товару
    views       INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_shop_stories_active
    ON shop_stories(company_id, expires_at);
