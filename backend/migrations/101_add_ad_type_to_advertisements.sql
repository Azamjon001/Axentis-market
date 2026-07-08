-- Добавляем поле типа рекламы и product_id для рекламы товаров
ALTER TABLE advertisements 
ADD COLUMN IF NOT EXISTS ad_type VARCHAR(20) DEFAULT 'company' CHECK (ad_type IN ('company', 'product'));

ALTER TABLE advertisements
ADD COLUMN IF NOT EXISTS product_id INTEGER;

-- Добавляем внешний ключ для product_id (только если не существует)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_advertisements_product'
    ) THEN
        ALTER TABLE advertisements
        ADD CONSTRAINT fk_advertisements_product
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Индекс для быстрого поиска рекламы товаров
CREATE INDEX IF NOT EXISTS idx_ads_type ON advertisements(ad_type);
CREATE INDEX IF NOT EXISTS idx_ads_product ON advertisements(product_id);

-- Комментарии
COMMENT ON COLUMN advertisements.ad_type IS 'Тип рекламы: company (реклама компании) или product (реклама товара)';
COMMENT ON COLUMN advertisements.product_id IS 'ID товара для рекламы типа product';
