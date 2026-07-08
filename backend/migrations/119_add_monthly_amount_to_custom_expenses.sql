-- Создаём таблицу custom_expenses если её ещё нет
CREATE TABLE IF NOT EXISTS custom_expenses (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    expense_name VARCHAR(255) NOT NULL,
    amount NUMERIC(12, 2) DEFAULT 0,
    monthly_amount NUMERIC(12, 2) DEFAULT 0,
    description TEXT,
    expense_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_expenses_company_id ON custom_expenses(company_id);

-- Добавляет поле monthly_amount если таблица уже существовала без него
ALTER TABLE custom_expenses ADD COLUMN IF NOT EXISTS monthly_amount NUMERIC(12, 2) DEFAULT 0;

-- Установим monthly_amount равным текущему amount для существующих записей
UPDATE custom_expenses SET monthly_amount = amount WHERE monthly_amount = 0 AND amount > 0;
