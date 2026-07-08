-- Добавляем колонку markup_profit в таблицу sales для учета прибыли от кассовых продаж
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS markup_profit NUMERIC(12, 2) DEFAULT 0 CHECK (markup_profit >= 0);

-- Добавляем индекс для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_sales_markup_profit ON sales(markup_profit);

-- Обновляем существующие записи (если есть) - вычисляем прибыль из items
UPDATE sales
SET markup_profit = (
    SELECT COALESCE(SUM(
        (item->>'markupAmount')::numeric * (item->>'quantity')::numeric
    ), 0)
    FROM jsonb_array_elements(items) AS item
)
WHERE markup_profit = 0 OR markup_profit IS NULL;
