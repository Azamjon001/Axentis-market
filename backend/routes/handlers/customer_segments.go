package handlers

import (
	"database/sql"
	"math"
	"net/http"
	"sort"
	"time"

	"github.com/gin-gonic/gin"
)

// GetCustomerSegments — GET /analytics/company/:companyId/customer-segments
//
// RFM-сегментация клиентов (Recency-Frequency-Monetary) — классика CRM,
// объяснённая «по-человечески». Панель сама раскладывает покупателей на
// группы, чтобы продавец без всякой аналитики знал, с кем работать:
//   vip      — покупают часто и недавно (4+ заказа, был в последние 45 дней);
//   regular  — постоянные (2-3 заказа, был в последние 45 дней);
//   new      — первый заказ в последние 30 дней;
//   sleeping — не покупали 45-90 дней (самое время напомнить о себе);
//   lost     — не покупали 90+ дней.
// Только чтение: агрегирует orders за последние 12 месяцев.
func GetCustomerSegments(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID := c.Param("companyId")

		rows, err := db.Query(`
			SELECT customer_phone,
			       MAX(COALESCE(NULLIF(customer_name, ''), customer_phone)) AS name,
			       COUNT(*) AS orders,
			       COALESCE(SUM(total_amount), 0) AS total,
			       MAX(created_at) AS last_order,
			       MIN(created_at) AS first_order
			FROM orders
			WHERE company_id = $1
			  AND status NOT IN ('cancelled')
			  AND COALESCE(customer_phone, '') <> ''
			  AND created_at > NOW() - INTERVAL '365 days'
			GROUP BY customer_phone
		`, companyID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load customers"})
			return
		}
		defer rows.Close()

		type client struct {
			Phone     string  `json:"phone"`
			Name      string  `json:"name"`
			Orders    int     `json:"orders"`
			Total     float64 `json:"total"`
			DaysSince int     `json:"daysSince"`
		}
		segments := map[string][]client{
			"vip": {}, "regular": {}, "new": {}, "sleeping": {}, "lost": {},
		}

		now := time.Now()
		for rows.Next() {
			var cl client
			var lastOrder, firstOrder time.Time
			if err := rows.Scan(&cl.Phone, &cl.Name, &cl.Orders, &cl.Total, &lastOrder, &firstOrder); err != nil {
				continue
			}
			cl.Total = math.Round(cl.Total)
			cl.DaysSince = int(now.Sub(lastOrder).Hours() / 24)

			var seg string
			switch {
			case cl.DaysSince > 90:
				seg = "lost"
			case cl.DaysSince > 45:
				seg = "sleeping"
			case cl.Orders >= 4:
				seg = "vip"
			case cl.Orders >= 2:
				seg = "regular"
			default:
				seg = "new"
			}
			segments[seg] = append(segments[seg], cl)
		}

		// Внутри сегмента — самые ценные первыми (по сумме покупок).
		for k := range segments {
			s := segments[k]
			sort.Slice(s, func(i, j int) bool { return s[i].Total > s[j].Total })
			if len(s) > 100 {
				segments[k] = s[:100]
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"vip":      segments["vip"],
			"regular":  segments["regular"],
			"new":      segments["new"],
			"sleeping": segments["sleeping"],
			"lost":     segments["lost"],
		})
	}
}
