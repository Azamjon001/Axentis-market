-- Add delivery address fields to users table for auto-fill
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_delivery_address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_delivery_coordinates TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_recipient_name VARCHAR(255);

-- Create admin_delivery_revenue table for tracking admin income from delivery
CREATE TABLE IF NOT EXISTS admin_delivery_revenue (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE,
    company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
    delivery_cost NUMERIC(12, 2) NOT NULL CHECK (delivery_cost >= 0),
    customer_phone VARCHAR(20) NOT NULL,
    delivery_type VARCHAR(20) NOT NULL,
    delivery_address TEXT,
    delivery_coordinates TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_delivery_revenue_order ON admin_delivery_revenue(order_id);
CREATE INDEX IF NOT EXISTS idx_admin_delivery_revenue_company ON admin_delivery_revenue(company_id);
CREATE INDEX IF NOT EXISTS idx_admin_delivery_revenue_date ON admin_delivery_revenue(created_at DESC);

-- Comment
COMMENT ON TABLE admin_delivery_revenue IS '💰 Доходы админа от доставки (отдельно от доходов компаний)';
COMMENT ON COLUMN admin_delivery_revenue.delivery_cost IS 'Стоимость доставки, которая идет админу';
