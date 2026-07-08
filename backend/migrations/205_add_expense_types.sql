-- +goose Up
-- Add expense type support: monthly recurring, percentage-based, one-time
ALTER TABLE custom_expenses ADD COLUMN IF NOT EXISTS expense_type VARCHAR(20) DEFAULT 'monthly';
ALTER TABLE custom_expenses ADD COLUMN IF NOT EXISTS percentage_value NUMERIC(8, 4) DEFAULT 0;

-- expense_type values:
--   'monthly'    - fixed monthly amount, prorated daily
--   'percentage' - percentage of period revenue (taxes, partner commissions)
--   'one_time'   - single occurrence on expense_date, shown with that date in history

-- +goose Down
ALTER TABLE custom_expenses DROP COLUMN IF EXISTS expense_type;
ALTER TABLE custom_expenses DROP COLUMN IF EXISTS percentage_value;
