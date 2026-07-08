-- Fix company_messages table
-- Run this on the server: docker-compose exec -T db psql -U postgres -d azaton -f fix-company-messages-table.sql

-- Create table if not exists
CREATE TABLE IF NOT EXISTS company_messages (
    id SERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    sender_name VARCHAR(100) DEFAULT 'Axis',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_read BOOLEAN DEFAULT FALSE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_company_messages_company_id ON company_messages(company_id);
CREATE INDEX IF NOT EXISTS idx_company_messages_created_at ON company_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_messages_is_read ON company_messages(is_read);

-- Verify table exists
SELECT 'company_messages table ready!' AS status;
SELECT COUNT(*) AS total_messages FROM company_messages;
