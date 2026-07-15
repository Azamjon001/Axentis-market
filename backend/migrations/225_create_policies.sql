-- Политика конфиденциальности платформы: отдельные тексты для покупателей
-- (audience = 'customer') и компаний-продавцов (audience = 'company').
-- Тексты редактируются в админ-панели; version растёт при каждом изменении,
-- чтобы фиксировать, какую редакцию принял пользователь.

DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS policies (
    audience   VARCHAR(20) PRIMARY KEY,
    content_ru TEXT NOT NULL,
    content_uz TEXT NOT NULL DEFAULT '',
    version    INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'policies table skipped: %', SQLERRM;
END $$;

-- Журнал принятий: кто (телефон покупателя / id компании), какую редакцию
-- и когда принял. Документальное подтверждение согласия с условиями.
DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS policy_acceptances (
    id          BIGSERIAL PRIMARY KEY,
    audience    VARCHAR(20) NOT NULL,
    subject     VARCHAR(150) NOT NULL,
    version     INT NOT NULL,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'policy_acceptances table skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_policy_acceptances_subject ON policy_acceptances(audience, subject);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'idx_policy_acceptances_subject skipped: %', SQLERRM;
END $$;
