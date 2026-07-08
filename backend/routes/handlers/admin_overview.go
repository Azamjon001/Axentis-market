package handlers

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
)

// GetAdminOverview — GET /analytics/admin/overview (админ).
// Единая картина платформы: оборот, заказы, пользователи, топ-магазины,
// доход от рекламы. Только чтение, агрегирует существующие таблицы.
func GetAdminOverview(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		out := gin.H{}

		// Оборот (GMV) и заказы: всего и за сегодня (не считаем отменённые).
		var gmvTotal, gmvToday float64
		var ordersTotal, ordersToday, ordersPending int
		db.QueryRow(`
			SELECT
				COALESCE(SUM(total_amount) FILTER (WHERE status <> 'cancelled'), 0),
				COALESCE(SUM(total_amount) FILTER (WHERE status <> 'cancelled' AND created_at::date = CURRENT_DATE), 0),
				COUNT(*) FILTER (WHERE status <> 'cancelled'),
				COUNT(*) FILTER (WHERE status <> 'cancelled' AND created_at::date = CURRENT_DATE),
				COUNT(*) FILTER (WHERE status = 'pending')
			FROM orders
		`).Scan(&gmvTotal, &gmvToday, &ordersTotal, &ordersToday, &ordersPending)

		// Пользователи и компании.
		var users, companies, companiesPending int
		db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&users)
		db.QueryRow(`SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'pending') FROM companies`).Scan(&companies, &companiesPending)

		// Доход платформы от внутренней рекламы (что уже собрано).
		var adRevenue float64
		db.QueryRow(`SELECT COALESCE(SUM(amount),0) FROM promotions WHERE status IN ('active','expired','cancelled')`).Scan(&adRevenue)

		// Товары.
		var products int
		db.QueryRow(`SELECT COUNT(*) FROM products WHERE name NOT LIKE '__CATEGORY_MARKER__%'`).Scan(&products)

		// Топ-магазины по обороту (последние 30 дней).
		topShops := make([]gin.H, 0)
		if rows, err := db.Query(`
			SELECT c.id, c.name,
			       COALESCE(SUM(o.total_amount) FILTER (WHERE o.status <> 'cancelled'), 0) AS revenue,
			       COUNT(o.id) FILTER (WHERE o.status <> 'cancelled') AS orders
			FROM companies c
			LEFT JOIN orders o ON o.company_id = c.id AND o.created_at > NOW() - INTERVAL '30 days'
			GROUP BY c.id, c.name
			ORDER BY revenue DESC
			LIMIT 8
		`); err == nil {
			defer rows.Close()
			for rows.Next() {
				var id int64
				var name string
				var revenue float64
				var orders int
				if err := rows.Scan(&id, &name, &revenue, &orders); err == nil {
					topShops = append(topShops, gin.H{"id": id, "name": name, "revenue": revenue, "orders": orders})
				}
			}
		}

		// Выручка по дням за 14 дней — для графика.
		revChart := make([]gin.H, 0)
		if rows, err := db.Query(`
			SELECT created_at::date AS d, COALESCE(SUM(total_amount),0)
			FROM orders WHERE status <> 'cancelled' AND created_at > NOW() - INTERVAL '14 days'
			GROUP BY d ORDER BY d
		`); err == nil {
			defer rows.Close()
			for rows.Next() {
				var d string
				var v float64
				if err := rows.Scan(&d, &v); err == nil {
					revChart = append(revChart, gin.H{"date": d, "revenue": v})
				}
			}
		}

		out["gmvTotal"] = gmvTotal
		out["gmvToday"] = gmvToday
		out["ordersTotal"] = ordersTotal
		out["ordersToday"] = ordersToday
		out["ordersPending"] = ordersPending
		out["users"] = users
		out["companies"] = companies
		out["companiesPending"] = companiesPending
		out["products"] = products
		out["adRevenue"] = adRevenue
		out["topShops"] = topShops
		out["revenueChart"] = revChart
		c.JSON(http.StatusOK, out)
	}
}

// GetModerationFeed — GET /admin/moderation-feed (админ).
// Сколько всего ждёт решения по каждому разделу — чтобы админ сразу видел,
// где нужно вмешаться, и переходил туда.
func GetModerationFeed(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		count := func(q string) int {
			var n int
			db.QueryRow(q).Scan(&n)
			return n
		}
		c.JSON(http.StatusOK, gin.H{
			"pendingCompanies":  count(`SELECT COUNT(*) FROM companies WHERE status = 'pending'`),
			"pendingPromotions": count(`SELECT COUNT(*) FROM promotions WHERE status = 'pending'`),
			"pendingDiscounts":  count(`SELECT COUNT(*) FROM discounts WHERE status = 'pending'`),
			"pendingAds":        count(`SELECT COUNT(*) FROM advertisements WHERE status = 'pending'`),
			"openReturns":       count(`SELECT COUNT(*) FROM order_returns WHERE status = 'requested'`),
			"openComplaints":    count(`SELECT COUNT(*) FROM complaints WHERE status = 'open'`),
		})
	}
}
