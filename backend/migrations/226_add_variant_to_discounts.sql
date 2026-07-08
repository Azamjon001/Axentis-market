-- Скидку можно навесить либо на весь товар (любой вариант), либо на конкретный
-- SKU-вариант. Добавляем variant_id (NULL = весь товар) в обе таблицы скидок
-- и заменяем старое ограничение UNIQUE(company_id, product_id) на уникальный
-- индекс, учитывающий вариант, чтобы у товара могла быть одна общая скидка и
-- отдельные скидки на варианты.

DO $$
BEGIN
  ALTER TABLE discounts ADD COLUMN IF NOT EXISTS variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'discounts.variant_id skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  ALTER TABLE aggressive_discounts ADD COLUMN IF NOT EXISTS variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'aggressive_discounts.variant_id skipped: %', SQLERRM;
END $$;

-- Снимаем старые ограничения уникальности (имя по умолчанию у Postgres).
DO $$
BEGIN
  ALTER TABLE discounts DROP CONSTRAINT IF EXISTS discounts_company_id_product_id_key;
  ALTER TABLE aggressive_discounts DROP CONSTRAINT IF EXISTS aggressive_discounts_company_id_product_id_key;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'drop unique constraint skipped: %', SQLERRM;
END $$;

-- Новая уникальность: одна скидка на (компания, товар, вариант). NULL-вариант
-- трактуем как 0, чтобы общий и вариантные дисконты не конфликтовали.
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS uniq_discounts_company_product_variant
    ON discounts (company_id, product_id, COALESCE(variant_id, 0));
  CREATE UNIQUE INDEX IF NOT EXISTS uniq_aggr_discounts_company_product_variant
    ON aggressive_discounts (company_id, product_id, COALESCE(variant_id, 0));
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'unique discount index skipped: %', SQLERRM;
END $$;
