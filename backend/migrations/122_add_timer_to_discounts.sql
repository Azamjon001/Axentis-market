-- Add timer fields to discounts tables
-- Allows setting time period for discount validity
-- Minimum 1 hour, maximum unlimited

-- Add timer fields to discounts table
ALTER TABLE discounts 
ADD COLUMN IF NOT EXISTS start_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS end_date TIMESTAMP;

-- Add timer fields to aggressive_discounts table  
ALTER TABLE aggressive_discounts
ADD COLUMN IF NOT EXISTS start_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS end_date TIMESTAMP;

-- Add check to ensure end_date is after start_date (if constraint doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_discounts_date_range'
    ) THEN
        ALTER TABLE discounts 
        ADD CONSTRAINT check_discounts_date_range 
        CHECK (end_date IS NULL OR start_date IS NULL OR end_date > start_date);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_aggressive_discounts_date_range'
    ) THEN
        ALTER TABLE aggressive_discounts
        ADD CONSTRAINT check_aggressive_discounts_date_range
        CHECK (end_date IS NULL OR start_date IS NULL OR end_date > start_date);
    END IF;
END $$;

-- Create indexes for date-based queries
CREATE INDEX IF NOT EXISTS idx_discounts_dates ON discounts(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_aggressive_discounts_dates ON aggressive_discounts(start_date, end_date);

-- Comments
COMMENT ON COLUMN discounts.start_date IS 'Дата начала действия скидки (необязательно)';
COMMENT ON COLUMN discounts.end_date IS 'Дата окончания действия скидки (необязательно)';
COMMENT ON COLUMN aggressive_discounts.start_date IS 'Дата начала действия агрессивной скидки (необязательно)';
COMMENT ON COLUMN aggressive_discounts.end_date IS 'Дата окончания действия агрессивной скидки (необязательно)';
