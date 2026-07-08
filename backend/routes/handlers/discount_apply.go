package handlers

import "database/sql"

// SQL-фрагменты подзапросов, которые достают активный процент скидки для товара.
// Используются в выборках каталога. Алиас таблицы товаров должен быть "p".
//
//   regular   — обычная скидка (только на наценку)
//   aggressive — жёсткая скидка (на всю цену, может уйти ниже себестоимости)
//
// variant_id IS NULL → скидка на весь товар (любой вариант). Берём именно
// общие (не вариантные) скидки для отображения цены в списке/детали товара.
const productLevelDiscountSubqueries = `
  (SELECT dd.discount_percent FROM discounts dd
     WHERE dd.product_id = p.id AND dd.variant_id IS NULL AND dd.status = 'approved'
       AND (dd.start_date IS NULL OR dd.start_date <= NOW())
       AND (dd.end_date   IS NULL OR dd.end_date   >= NOW())
     ORDER BY dd.updated_at DESC LIMIT 1) AS reg_pct,
  (SELECT ad.discount_percent FROM aggressive_discounts ad
     WHERE ad.product_id = p.id AND ad.variant_id IS NULL AND ad.status = 'approved'
       AND (ad.start_date IS NULL OR ad.start_date <= NOW())
       AND (ad.end_date   IS NULL OR ad.end_date   >= NOW())
     ORDER BY ad.updated_at DESC LIMIT 1) AS agg_pct`

// applyBestDiscount считает итоговую цену с учётом обычной и жёсткой скидок.
//   base    — себестоимость (price)
//   selling — цена с наценкой (selling_price)
// Возвращает (итоговая цена, процент, тип: "" | "regular" | "aggressive").
// Если действуют обе скидки — выбираем ту, что даёт меньшую цену.
func applyBestDiscount(base, selling float64, regPct, aggPct sql.NullFloat64) (float64, float64, string) {
	final := selling
	pct := 0.0
	dtype := ""

	if regPct.Valid && regPct.Float64 > 0 {
		markup := selling - base
		if markup < 0 {
			markup = 0
		}
		rFinal := selling - markup*(regPct.Float64/100.0)
		if rFinal < final {
			final, pct, dtype = rFinal, regPct.Float64, "regular"
		}
	}
	if aggPct.Valid && aggPct.Float64 > 0 {
		aFinal := selling * (1 - aggPct.Float64/100.0)
		if aFinal < final {
			final, pct, dtype = aFinal, aggPct.Float64, "aggressive"
		}
	}
	if final < 0 {
		final = 0
	}
	return final, pct, dtype
}
