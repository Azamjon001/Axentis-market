-- Product questions & answers (❓ вопросы к товару). Additive — new table only.

CREATE TABLE IF NOT EXISTS product_questions (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
    user_phone VARCHAR(20) NOT NULL,
    user_name VARCHAR(255),
    question TEXT NOT NULL,
    answer TEXT,
    answered_by VARCHAR(255),
    is_answered BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    answered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_product_questions_product ON product_questions(product_id);
CREATE INDEX IF NOT EXISTS idx_product_questions_company ON product_questions(company_id);
