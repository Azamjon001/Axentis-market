-- ============================================================================
-- 📦 ИСТОРИЯ ЗАКУПОК ТОВАРОВ
-- Таблица для отслеживания добавления товаров компанией
-- Хранит информацию о том, когда и какие товары были закуплены/добавлены
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_purchases (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL,
    product_id BIGINT,  -- NULL если товар был удален
    product_name VARCHAR(255) NOT NULL,  -- Сохраняем название товара
    quantity INT NOT NULL DEFAULT 0,  -- Количество закупленных товаров
    purchase_price DECIMAL(10, 2) NOT NULL DEFAULT 0,  -- Цена закупки за единицу
    total_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,  -- Общая стоимость закупки
    supplier VARCHAR(255),  -- Поставщик (опционально)
    notes TEXT,  -- Заметки/комментарии
    purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- Дата закупки
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_product_purchases_company_id ON product_purchases(company_id);
CREATE INDEX IF NOT EXISTS idx_product_purchases_product_id ON product_purchases(product_id);
CREATE INDEX IF NOT EXISTS idx_product_purchases_purchase_date ON product_purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_product_purchases_created_at ON product_purchases(created_at);

-- Комментарии к таблице
COMMENT ON TABLE product_purchases IS 'История закупок товаров компанией';
COMMENT ON COLUMN product_purchases.company_id IS 'ID компании';
COMMENT ON COLUMN product_purchases.product_id IS 'ID товара (может быть NULL если товар удален)';
COMMENT ON COLUMN product_purchases.product_name IS 'Название товара на момент закупки';
COMMENT ON COLUMN product_purchases.quantity IS 'Количество закупленных товаров';
COMMENT ON COLUMN product_purchases.purchase_price IS 'Цена закупки за единицу товара';
COMMENT ON COLUMN product_purchases.total_cost IS 'Общая стоимость закупки (quantity * purchase_price)';
COMMENT ON COLUMN product_purchases.supplier IS 'Название поставщика';
COMMENT ON COLUMN product_purchases.notes IS 'Дополнительные заметки о закупке';
COMMENT ON COLUMN product_purchases.purchase_date IS 'Дата и время закупки';
