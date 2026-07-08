-- Create aggressive_discounts table for special liquidation discounts
-- These discounts are separate from regular discounts and can go below base price
-- Used to sell slow-moving inventory (products that haven't sold in months/years)

CREATE TABLE IF NOT EXISTS aggressive_discounts (
    id SERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    discount_percent DECIMAL(5,2) NOT NULL CHECK (discount_percent >= 0 AND discount_percent <= 100),
    title TEXT,
    description TEXT,
    status VARCHAR(20) DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_reviewed BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, product_id),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_aggressive_discounts_company_id ON aggressive_discounts(company_id);
CREATE INDEX IF NOT EXISTS idx_aggressive_discounts_product_id ON aggressive_discounts(product_id);
CREATE INDEX IF NOT EXISTS idx_aggressive_discounts_status ON aggressive_discounts(status);

-- Comment
COMMENT ON TABLE aggressive_discounts IS '🔥 Агрессивные скидки для распродажи залежавшихся товаров (могут быть ниже базовой цены)';
COMMENT ON COLUMN aggressive_discounts.discount_percent IS 'Процент скидки от (цена + наценка), может привести к цене ниже базовой';
