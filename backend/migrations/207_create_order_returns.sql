-- Order returns / refunds (↩️ возвраты). Additive — new table only.

CREATE TABLE IF NOT EXISTS order_returns (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
    company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
    customer_phone VARCHAR(20) NOT NULL,
    reason TEXT,
    items JSONB DEFAULT '[]'::jsonb,
    refund_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'requested'
        CHECK (status IN ('requested', 'approved', 'rejected', 'refunded')),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_order_returns_company ON order_returns(company_id);
CREATE INDEX IF NOT EXISTS idx_order_returns_customer ON order_returns(customer_phone);
CREATE INDEX IF NOT EXISTS idx_order_returns_order ON order_returns(order_id);
