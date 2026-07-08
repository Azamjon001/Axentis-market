-- 🔖 Артикул: уникальный номер каждого товара (мин. 9 цифр), не повторяется
-- никогда — даже если тот же товар есть у другой компании (у каждой строки
-- товара свой id). По артикулу поиск выдаёт ровно один товар.
ALTER TABLE products ADD COLUMN IF NOT EXISTS article VARCHAR(16);

-- Заполняем существующие товары: 100000000 + id → всегда уникально и 9-значно.
UPDATE products SET article = LPAD((100000000 + id)::text, 9, '0')
WHERE article IS NULL OR article = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_article ON products(article);

-- Триггер выдаёт артикул автоматически при создании товара (любым путём).
CREATE OR REPLACE FUNCTION set_product_article() RETURNS trigger AS $$
BEGIN
    IF NEW.article IS NULL OR NEW.article = '' THEN
        NEW.article := LPAD((100000000 + NEW.id)::text, 9, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_product_article ON products;
CREATE TRIGGER trg_set_product_article
    BEFORE INSERT ON products
    FOR EACH ROW EXECUTE FUNCTION set_product_article();
