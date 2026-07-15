-- 💸 Вывод средств компаний: онлайн-оплаты покупателей поступают на счёт
-- платформы; компания выводит заработанное за вычетом комиссии платформы.
--
-- Денежная логика:
--   доступно = SUM(онлайн-заказы delivered/completed) × (1 − комиссия%)
--              − SUM(выплаты в статусах pending/processing/completed)
-- Статусы failed/cancelled деньги НЕ удерживают — сумма возвращается в баланс.
-- Все суммы NUMERIC — без ошибок плавающей точки.

DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS payouts (
    id                 BIGSERIAL PRIMARY KEY,
    company_id         BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    amount             NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    -- Реквизиты получателя. Полный номер карты нужен для фактического
    -- перевода (merchant API / ручная обработка админом); компании в ответах
    -- отдаётся только маска.
    card_number        VARCHAR(32) NOT NULL,
    card_holder        VARCHAR(150) NOT NULL DEFAULT '',
    -- pending → processing → completed | failed; pending может быть cancelled компанией
    status             VARCHAR(20) NOT NULL DEFAULT 'pending',
    provider_ref       VARCHAR(120),
    failure_reason     TEXT,
    -- Ставка комиссии на момент запроса — для истории/споров
    commission_percent NUMERIC(6,2) NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at       TIMESTAMPTZ
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'payouts table skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_payouts_company_status ON payouts(company_id, status);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'idx_payouts_company_status skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status, created_at DESC);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'idx_payouts_status skipped: %', SQLERRM;
END $$;
