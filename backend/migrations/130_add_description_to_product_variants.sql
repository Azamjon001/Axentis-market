-- +goose Up
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS description TEXT;

-- +goose Down
ALTER TABLE product_variants DROP COLUMN IF EXISTS description;
