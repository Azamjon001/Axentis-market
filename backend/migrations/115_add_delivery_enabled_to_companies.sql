-- Add delivery_enabled column to companies table
-- This allows per-company control over delivery availability
-- When FALSE, customers can only do pickup (самовывоз)

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'companies' AND column_name = 'delivery_enabled'
    ) THEN
        ALTER TABLE companies ADD COLUMN delivery_enabled BOOLEAN NOT NULL DEFAULT TRUE;
    END IF;
END $$;
