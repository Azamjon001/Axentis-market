-- Таблица для хранения оценок компаний пользователями
CREATE TABLE IF NOT EXISTS company_ratings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_phone VARCHAR(50) NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (company_id, user_phone)
);

CREATE INDEX IF NOT EXISTS idx_company_ratings_company_id ON company_ratings(company_id);
CREATE INDEX IF NOT EXISTS idx_company_ratings_user_phone ON company_ratings(user_phone);
