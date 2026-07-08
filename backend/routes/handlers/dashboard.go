package handlers

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
)

// GetCompanyDashboard returns a single aggregated snapshot for a seller:
// today's orders/revenue, things needing attention (pending orders, pending
// returns, low stock, unanswered questions) and the most recent orders.
// Read-only — joins existing tables, changes nothing.
func GetCompanyDashboard(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID := c.Param("companyId")

		out := gin.H{}

		// Orders: today's count/revenue, pending count, all-time revenue.
		// Выручка (todayRevenue/totalRevenue) считается ТОЛЬКО по доставленным
		// заказам — деньги начисляются после подтверждения доставки курьером,
		// а не в момент оформления/отправки.
		var todayOrders, pendingOrders int
		var todayRevenue, totalRevenue float64
		db.QueryRow(`
			SELECT
				COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE),
				COALESCE(SUM(total_amount) FILTER (WHERE created_at::date = CURRENT_DATE AND status IN ('delivered','completed')), 0),
				COUNT(*) FILTER (WHERE status = 'pending'),
				COALESCE(SUM(total_amount) FILTER (WHERE status IN ('delivered','completed')), 0)
			FROM orders WHERE company_id = $1
		`, companyID).Scan(&todayOrders, &todayRevenue, &pendingOrders, &totalRevenue)

		// Pending returns.
		var pendingReturns int
		db.QueryRow(`SELECT COUNT(*) FROM order_returns WHERE company_id = $1 AND status = 'requested'`, companyID).Scan(&pendingReturns)

		// Low stock (available products with quantity at or below 5).
		var lowStock int
		db.QueryRow(`SELECT COUNT(*) FROM products WHERE company_id = $1 AND available_for_customers = TRUE AND quantity <= 5`, companyID).Scan(&lowStock)

		// Unanswered product questions.
		var unansweredQuestions int
		db.QueryRow(`SELECT COUNT(*) FROM product_questions WHERE company_id = $1 AND is_answered = FALSE`, companyID).Scan(&unansweredQuestions)

		// Product / inventory snapshot.
		var totalProducts, soldUnits int
		db.QueryRow(`SELECT COUNT(*), COALESCE(SUM(sold_count), 0) FROM products WHERE company_id = $1`, companyID).Scan(&totalProducts, &soldUnits)

		// Recent orders (last 5).
		recent := make([]gin.H, 0)
		rows, err := db.Query(`
			SELECT id, customer_name, total_amount, status, order_code, created_at
			FROM orders WHERE company_id = $1
			ORDER BY created_at DESC LIMIT 5
		`, companyID)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var (
					oid          int64
					name         sql.NullString
					amount       float64
					status       string
					code         sql.NullString
					createdAt    string
				)
				if err := rows.Scan(&oid, &name, &amount, &status, &code, &createdAt); err != nil {
					continue
				}
				recent = append(recent, gin.H{
					"id": oid, "customerName": name.String, "totalAmount": amount,
					"status": status, "orderCode": code.String, "createdAt": createdAt,
				})
			}
		}

		out["todayOrders"] = todayOrders
		out["todayRevenue"] = todayRevenue
		out["pendingOrders"] = pendingOrders
		out["totalRevenue"] = totalRevenue
		out["pendingReturns"] = pendingReturns
		out["lowStock"] = lowStock
		out["unansweredQuestions"] = unansweredQuestions
		out["totalProducts"] = totalProducts
		out["soldUnits"] = soldUnits
		out["recentOrders"] = recent

		c.JSON(http.StatusOK, out)
	}
}
