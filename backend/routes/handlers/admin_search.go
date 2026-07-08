package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

// GlobalSearch — GET /admin/global-search?q=... (админ).
// Единый поиск по платформе: товары, магазины, пользователи и заказы.
// Возвращает сгруппированные результаты, чтобы админ мгновенно находил
// нужную сущность вместо хождения по вкладкам.
func GlobalSearch(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		q := strings.TrimSpace(c.Query("q"))
		if len(q) < 2 {
			c.JSON(http.StatusOK, gin.H{"products": []gin.H{}, "companies": []gin.H{}, "users": []gin.H{}, "orders": []gin.H{}})
			return
		}
		like := "%" + q + "%"

		products := make([]gin.H, 0)
		if rows, err := db.Query(`
			SELECT p.id, p.name, COALESCE(c.name, ''), COALESCE(p.quantity, 0)
			FROM products p
			LEFT JOIN companies c ON c.id = p.company_id
			WHERE p.name NOT LIKE '__CATEGORY_MARKER__%'
			  AND (p.name ILIKE $1 OR p.barcode ILIKE $1 OR p.barid ILIKE $1)
			ORDER BY p.sold_count DESC
			LIMIT 8`, like); err == nil {
			defer rows.Close()
			for rows.Next() {
				var id int64
				var name, company string
				var qty int
				if rows.Scan(&id, &name, &company, &qty) == nil {
					products = append(products, gin.H{"id": id, "name": name, "company": company, "quantity": qty})
				}
			}
		}

		companies := make([]gin.H, 0)
		if rows, err := db.Query(`
			SELECT id, name, COALESCE(phone, ''), COALESCE(status, '')
			FROM companies
			WHERE name ILIKE $1 OR phone ILIKE $1
			ORDER BY name
			LIMIT 8`, like); err == nil {
			defer rows.Close()
			for rows.Next() {
				var id int64
				var name, phone, status string
				if rows.Scan(&id, &name, &phone, &status) == nil {
					companies = append(companies, gin.H{"id": id, "name": name, "phone": phone, "status": status})
				}
			}
		}

		users := make([]gin.H, 0)
		if rows, err := db.Query(`
			SELECT phone, COALESCE(name, ''), COALESCE(surname, '')
			FROM users
			WHERE phone ILIKE $1 OR name ILIKE $1 OR surname ILIKE $1
			ORDER BY name
			LIMIT 8`, like); err == nil {
			defer rows.Close()
			for rows.Next() {
				var phone, name, surname string
				if rows.Scan(&phone, &name, &surname) == nil {
					users = append(users, gin.H{"phone": phone, "name": strings.TrimSpace(name + " " + surname)})
				}
			}
		}

		// Заказ можно искать по номеру или телефону покупателя.
		orders := make([]gin.H, 0)
		orderConds := "customer_phone ILIKE $1 OR customer_name ILIKE $1"
		args := []interface{}{like}
		if idNum, err := strconv.Atoi(q); err == nil {
			orderConds += " OR id = $2"
			args = append(args, idNum)
		}
		if rows, err := db.Query(`
			SELECT id, COALESCE(customer_name, ''), COALESCE(customer_phone, ''),
			       COALESCE(total_amount, 0), COALESCE(status, '')
			FROM orders
			WHERE `+orderConds+`
			ORDER BY created_at DESC
			LIMIT 8`, args...); err == nil {
			defer rows.Close()
			for rows.Next() {
				var id int64
				var name, phone, status string
				var total float64
				if rows.Scan(&id, &name, &phone, &total, &status) == nil {
					orders = append(orders, gin.H{"id": id, "customerName": name, "customerPhone": phone, "total": total, "status": status})
				}
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"products":  products,
			"companies": companies,
			"users":     users,
			"orders":    orders,
		})
	}
}
