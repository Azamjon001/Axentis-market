-- 🤖 Telegram-оповещения для магазинов: критические остатки + дневной отчёт.
-- Компания привязывает свой Telegram-чат к боту (по одноразовому коду через
-- /start <код>), после чего получает:
--   • оповещение, когда остаток товара падает до 50% критического порога
--     (дешёвые товары: порог 20 → сигнал при 10; дорогие: порог 10 → при 5);
--   • дневной отчёт одним сообщением в 21:00.

ALTER TABLE companies ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS telegram_connect_code VARCHAR(24);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS telegram_last_report_date DATE;

-- Флаг «о низком остатке уже сообщили» — чтобы не спамить одним и тем же
-- товаром; сбрасывается автоматически, когда склад пополнили выше порога.
ALTER TABLE products ADD COLUMN IF NOT EXISTS tg_low_stock_notified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_companies_tg_chat ON companies(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_tg_code ON companies(telegram_connect_code) WHERE telegram_connect_code IS NOT NULL;

COMMENT ON COLUMN companies.telegram_chat_id IS 'Chat ID Telegram, куда бот шлёт оповещения магазину';
COMMENT ON COLUMN companies.telegram_connect_code IS 'Одноразовый код привязки: t.me/<бот>?start=<код>';
COMMENT ON COLUMN companies.telegram_last_report_date IS 'Дата последнего отправленного дневного отчёта (Ташкент)';
COMMENT ON COLUMN products.tg_low_stock_notified_at IS 'Когда отправлено Telegram-оповещение о низком остатке (NULL = ещё не слали)';
