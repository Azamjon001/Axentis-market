-- +goose Up
-- Product variants: one product card can have multiple SKUs (color/size/price/stock)
-- Existing products without variants continue to work normally (backward compatible)
CREATE TABLE IF NOT EXISTS product_variants (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    color VARCHAR(100),
    size VARCHAR(100),
    price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
    markup_percent NUMERIC(5, 2) DEFAULT 0 CHECK (markup_percent >= 0),
    selling_price NUMERIC(12, 2) GENERATED ALWAYS AS (price + (price * markup_percent / 100)) STORED,
    stock_quantity INTEGER DEFAULT 0 CHECK (stock_quantity >= 0),
    barcode VARCHAR(100),
    sku VARCHAR(100),
    barid VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_barcode ON product_variants(barcode);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(sku);

-- +goose Down
DROP TABLE IF EXISTS product_variants;
