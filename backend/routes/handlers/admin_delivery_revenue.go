package handlers

import (
	"database/sql"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// GetAdminDeliveryRevenue - получение доходов админа от доставки
func GetAdminDeliveryRevenue(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Можно фильтровать по датам
		startDate := c.Query("startDate")
		endDate := c.Query("endDate")

		query := `
			SELECT 
				adr.id,
				adr.order_id,
				adr.company_id,
				adr.delivery_cost,
				adr.customer_phone,
				adr.delivery_type,
				adr.delivery_address,
				adr.delivery_coordinates,
				adr.created_at,
				c.name as company_name,
				o.order_code
			FROM admin_delivery_revenue adr
			LEFT JOIN companies c ON adr.company_id = c.id
			LEFT JOIN orders o ON adr.order_id = o.id
		`

		args := []interface{}{}
		whereClause := ""

		if startDate != "" && endDate != "" {
			whereClause = " WHERE adr.created_at >= $1 AND adr.created_at <= $2"
			args = append(args, startDate, endDate)
		}

		query += whereClause + " ORDER BY adr.created_at DESC"

		rows, err := db.Query(query, args...)
		if err != nil {
			log.Printf("❌ GetAdminDeliveryRevenue: Query error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch admin delivery revenue"})
			return
		}
		defer rows.Close()

		revenues := make([]map[string]interface{}, 0)
		totalRevenue := 0.0

		for rows.Next() {
			var r struct {
				ID                  int64
				OrderID             int64
				CompanyID           int64
				DeliveryCost        float64
				CustomerPhone       string
				DeliveryType        string
				DeliveryAddress     sql.NullString
				DeliveryCoordinates sql.NullString
				CreatedAt           time.Time
				CompanyName         sql.NullString
				OrderCode           sql.NullString
			}

			err := rows.Scan(
				&r.ID, &r.OrderID, &r.CompanyID, &r.DeliveryCost, &r.CustomerPhone,
				&r.DeliveryType, &r.DeliveryAddress, &r.DeliveryCoordinates, &r.CreatedAt,
				&r.CompanyName, &r.OrderCode,
			)

			if err != nil {
				log.Printf("⚠️ Error scanning admin delivery revenue: %v", err)
				continue
			}

			revenue := map[string]interface{}{
				"id":            r.ID,
				"orderId":       r.OrderID,
				"companyId":     r.CompanyID,
				"deliveryCost":  r.DeliveryCost,
				"customerPhone": r.CustomerPhone,
				"deliveryType":  r.DeliveryType,
				"createdAt":     r.CreatedAt.Format(time.RFC3339),
			}

			if r.DeliveryAddress.Valid {
				revenue["deliveryAddress"] = r.DeliveryAddress.String
			}

			if r.DeliveryCoordinates.Valid {
				revenue["deliveryCoordinates"] = r.DeliveryCoordinates.String
			}

			if r.CompanyName.Valid {
				revenue["companyName"] = r.CompanyName.String
			}

			if r.OrderCode.Valid {
				revenue["orderCode"] = r.OrderCode.String
			}

			totalRevenue += r.DeliveryCost
			revenues = append(revenues, revenue)
		}

		log.Printf("💰 GetAdminDeliveryRevenue: Found %d records, total: %.2f", len(revenues), totalRevenue)

		c.JSON(http.StatusOK, gin.H{
			"revenues":     revenues,
			"totalRevenue": totalRevenue,
			"count":        len(revenues),
		})
	}
}

// GetAdminDeliveryStats - статистика доходов админа от доставки
func GetAdminDeliveryStats(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Статистика за сегодня, неделю, месяц, всё время
		stats := make(map[string]interface{})

		// Сегодня
		var todayRevenue float64
		var todayCount int
		err := db.QueryRow(`
			SELECT COALESCE(SUM(delivery_cost), 0), COUNT(*)
			FROM admin_delivery_revenue
			WHERE DATE(created_at) = CURRENT_DATE
		`).Scan(&todayRevenue, &todayCount)

		if err != nil {
			log.Printf("⚠️ Error getting today stats: %v", err)
		}

		stats["today"] = map[string]interface{}{
			"revenue": todayRevenue,
			"count":   todayCount,
		}

		// За последние 7 дней
		var weekRevenue float64
		var weekCount int
		err = db.QueryRow(`
			SELECT COALESCE(SUM(delivery_cost), 0), COUNT(*)
			FROM admin_delivery_revenue
			WHERE created_at >= NOW() - INTERVAL '7 days'
		`).Scan(&weekRevenue, &weekCount)

		if err != nil {
			log.Printf("⚠️ Error getting week stats: %v", err)
		}

		stats["week"] = map[string]interface{}{
			"revenue": weekRevenue,
			"count":   weekCount,
		}

		// За последние 30 дней
		var monthRevenue float64
		var monthCount int
		err = db.QueryRow(`
			SELECT COALESCE(SUM(delivery_cost), 0), COUNT(*)
			FROM admin_delivery_revenue
			WHERE created_at >= NOW() - INTERVAL '30 days'
		`).Scan(&monthRevenue, &monthCount)

		if err != nil {
			log.Printf("⚠️ Error getting month stats: %v", err)
		}

		stats["month"] = map[string]interface{}{
			"revenue": monthRevenue,
			"count":   monthCount,
		}

		// Всего
		var totalRevenue float64
		var totalCount int
		err = db.QueryRow(`
			SELECT COALESCE(SUM(delivery_cost), 0), COUNT(*)
			FROM admin_delivery_revenue
		`).Scan(&totalRevenue, &totalCount)

		if err != nil {
			log.Printf("⚠️ Error getting total stats: %v", err)
		}

		stats["total"] = map[string]interface{}{
			"revenue": totalRevenue,
			"count":   totalCount,
		}

		log.Printf("💰 GetAdminDeliveryStats: Total revenue: %.2f from %d deliveries", totalRevenue, totalCount)

		c.JSON(http.StatusOK, stats)
	}
}
