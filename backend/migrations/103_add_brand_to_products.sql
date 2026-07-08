-- Добавление поля brand (производитель/бренд) в таблицу products
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT;
