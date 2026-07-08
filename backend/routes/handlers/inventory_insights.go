package handlers

import (
	"database/sql"
	"math"
	"net/http"
	"sort"

	"github.com/gin-gonic/gin"
)

// GetInventoryInsights — GET /analytics/company/:companyId/inventory-insights
//
// Аналитика склада уровня «взрослых» маркетплейсов, которой нет у WB-кабинета:
//   - stockForecast: скорость продаж каждого товара за 30 дней и прогноз,
//     через сколько дней закончится остаток (товары в зоне риска — первыми);
//   - abcAnalysis: классический ABC-анализ ассортимента по выручке за 90 дней
//     (A — товары, дающие 80% выручки; B — следующие 15%; C — остальное).
//
// Только чтение: агрегирует существующие orders/sales/products.
func GetInventoryInsights(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID := c.Param("companyId")

		// Продажи по товарам из заказов и POS-продаж. items хранится как jsonb
		// массив объектов; ключ товара исторически записывался по-разному
		// (productId / product_id / id), количество — quantity. Строки без
		// числового id безопасно отбрасываются.
		const salesSQL = `
			WITH item_rows AS (
				SELECT item, o.created_at
				FROM orders o, jsonb_array_elements(o.items) item
				WHERE o.company_id = $1
				  AND jsonb_typeof(o.items) = 'array'
				  AND o.status NOT IN ('cancelled')
				  AND o.created_at > NOW() - ($2 || ' days')::interval
				UNION ALL
				SELECT item, s.created_at
				FROM sales s, jsonb_array_elements(s.items) item
				WHERE s.company_id = $1
				  AND jsonb_typeof(s.items) = 'array'
				  AND s.created_at > NOW() - ($2 || ' days')::interval
			),
			parsed AS (
				SELECT
					CASE
						WHEN item->>'productId'  ~ '^\d+$' THEN (item->>'productId')::bigint
						WHEN item->>'product_id' ~ '^\d+$' THEN (item->>'product_id')::bigint
						WHEN item->>'id'         ~ '^\d+$' THEN (item->>'id')::bigint
					END AS pid,
					CASE WHEN item->>'quantity' ~ '^\d+$' THEN (item->>'quantity')::int ELSE 1 END AS qty,
					CASE
						WHEN item->>'price_with_markup' ~ '^\d+(\.\d+)?$' THEN (item->>'price_with_markup')::numeric
						WHEN item->>'priceWithMarkup'   ~ '^\d+(\.\d+)?$' THEN (item->>'priceWithMarkup')::numeric
						WHEN item->>'price'             ~ '^\d+(\.\d+)?$' THEN (item->>'price')::numeric
						ELSE 0
					END AS price
				FROM item_rows
			)
			SELECT pid, SUM(qty) AS units, SUM(qty * price) AS revenue
			FROM parsed WHERE pid IS NOT NULL
			GROUP BY pid`

		type prodSales struct {
			Units   int
			Revenue float64
		}

		loadSales := func(days string) map[int64]prodSales {
			m := map[int64]prodSales{}
			rows, err := db.Query(salesSQL, companyID, days)
			if err != nil {
				return m
			}
			defer rows.Close()
			for rows.Next() {
				var pid int64
				var units int
				var revenue float64
				if err := rows.Scan(&pid, &units, &revenue); err == nil {
					m[pid] = prodSales{Units: units, Revenue: revenue}
				}
			}
			return m
		}

		sales30 := loadSales("30")
		sales90 := loadSales("90")

		// Текущие остатки (сумма по вариантам, если они есть, иначе quantity).
		type prodInfo struct {
			ID    int64
			Name  string
			Stock int
		}
		products := []prodInfo{}
		rows, err := db.Query(`
			SELECT p.id, p.name,
			       COALESCE(NULLIF((SELECT SUM(pv.stock_quantity) FROM product_variants pv WHERE pv.product_id = p.id), 0), p.quantity, 0)
			FROM products p
			WHERE p.company_id = $1 AND p.name NOT LIKE '__CATEGORY_MARKER__%'
		`, companyID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load products"})
			return
		}
		defer rows.Close()
		for rows.Next() {
			var p prodInfo
			if err := rows.Scan(&p.ID, &p.Name, &p.Stock); err == nil {
				products = append(products, p)
			}
		}

		// ── Прогноз остатков ────────────────────────────────────────────────
		type forecastRow struct {
			ProductID   int64   `json:"productId"`
			Name        string  `json:"name"`
			Stock       int     `json:"stock"`
			SoldPerDay  float64 `json:"soldPerDay"`
			DaysLeft    float64 `json:"daysLeft"` // -1 = продаж нет, прогноз невозможен
			OutOfStock  bool    `json:"outOfStock"`
		}
		forecast := []forecastRow{}
		for _, p := range products {
			s := sales30[p.ID]
			perDay := float64(s.Units) / 30.0
			row := forecastRow{ProductID: p.ID, Name: p.Name, Stock: p.Stock, SoldPerDay: math.Round(perDay*100) / 100}
			if p.Stock <= 0 {
				row.OutOfStock = true
				row.DaysLeft = 0
			} else if perDay > 0 {
				row.DaysLeft = math.Round(float64(p.Stock) / perDay)
			} else {
				row.DaysLeft = -1
			}
			// В прогноз попадают только товары, которые продаются или уже кончились.
			if s.Units > 0 || row.OutOfStock {
				forecast = append(forecast, row)
			}
		}
		sort.Slice(forecast, func(i, j int) bool {
			di, dj := forecast[i].DaysLeft, forecast[j].DaysLeft
			if di < 0 {
				di = math.MaxFloat64
			}
			if dj < 0 {
				dj = math.MaxFloat64
			}
			return di < dj
		})
		if len(forecast) > 30 {
			forecast = forecast[:30]
		}

		// ── ABC-анализ по выручке за 90 дней ───────────────────────────────
		type abcRow struct {
			ProductID    int64   `json:"productId"`
			Name         string  `json:"name"`
			Revenue      float64 `json:"revenue"`
			RevenueShare float64 `json:"revenueShare"` // % от общей выручки
			Class        string  `json:"class"`        // A / B / C
		}
		abc := []abcRow{}
		var totalRevenue float64
		nameByID := map[int64]string{}
		for _, p := range products {
			nameByID[p.ID] = p.Name
		}
		for pid, s := range sales90 {
			if s.Revenue <= 0 {
				continue
			}
			name, ok := nameByID[pid]
			if !ok {
				continue // товар удалён
			}
			abc = append(abc, abcRow{ProductID: pid, Name: name, Revenue: math.Round(s.Revenue)})
			totalRevenue += s.Revenue
		}
		sort.Slice(abc, func(i, j int) bool { return abc[i].Revenue > abc[j].Revenue })
		cumulative := 0.0
		for i := range abc {
			share := abc[i].Revenue / math.Max(totalRevenue, 1) * 100
			cumulative += share
			abc[i].RevenueShare = math.Round(share*10) / 10
			switch {
			case cumulative <= 80:
				abc[i].Class = "A"
			case cumulative <= 95:
				abc[i].Class = "B"
			default:
				abc[i].Class = "C"
			}
		}
		if len(abc) > 50 {
			abc = abc[:50]
		}

		c.JSON(http.StatusOK, gin.H{
			"stockForecast":  forecast,
			"abcAnalysis":    abc,
			"totalRevenue90": math.Round(totalRevenue),
		})
	}
}
