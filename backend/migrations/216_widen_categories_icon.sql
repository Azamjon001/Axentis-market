-- Иконка категории теперь может хранить URL загруженной картинки (PNG/SVG),
-- а не только emoji — расширяем поле до TEXT.
ALTER TABLE categories ALTER COLUMN icon TYPE TEXT;
