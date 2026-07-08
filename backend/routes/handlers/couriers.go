package handlers

import (
	"azaton-backend/config"
	"azaton-backend/middleware"
	"database/sql"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// LoginCourier — POST /couriers/login
// Body: { phone, password }
func LoginCourier(db *sql.DB, cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Phone    string `json:"phone" binding:"required"`
			Password string `json:"password" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "phone and password required"})
			return
		}

		var courier struct {
			ID           int64
			Name         string
			Surname      string
			Phone        string
			PasswordHash string
			PassportID   sql.NullString
			CompanyID    sql.NullInt64
		}
		err := db.QueryRow(`
			SELECT id, name, surname, phone, password_hash, passport_id, company_id
			FROM couriers WHERE phone = $1
		`, req.Phone).Scan(
			&courier.ID, &courier.Name, &courier.Surname, &courier.Phone,
			&courier.PasswordHash, &courier.PassportID, &courier.CompanyID,
		)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Неверный телефон или пароль"})
			return
		}
		if err != nil {
			log.Printf("❌ LoginCourier DB error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(courier.PasswordHash), []byte(req.Password)); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Неверный телефон или пароль"})
			return
		}

		// Выдаём курьеру собственный JWT (роль "courier", в claim companyId —
		// id курьера), чтобы обновление статуса/локации и список заказов были
		// доступны только самому курьеру, его компании или админу.
		token, err := middleware.GenerateToken(cfg, courier.ID, courier.Phone, "courier")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
			return
		}

		log.Printf("✅ Courier login: id=%d phone=%s", courier.ID, courier.Phone)
		c.JSON(http.StatusOK, gin.H{
			"id":          courier.ID,
			"name":        courier.Name,
			"surname":     courier.Surname,
			"phone":       courier.Phone,
			"passport_id": courier.PassportID.String,
			"company_id":  courierCompanyID(courier.CompanyID),
			"token":       token,
		})
	}
}

func courierCompanyID(n sql.NullInt64) interface{} {
	if n.Valid {
		return n.Int64
	}
	return nil
}

// CreateCourier — POST /couriers
// Body: { company_id?, name, surname, phone, password, passport_id? }
func CreateCourier(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			CompanyID  *int64 `json:"company_id"`
			Name       string `json:"name" binding:"required"`
			Surname    string `json:"surname" binding:"required"`
			Phone      string `json:"phone" binding:"required"`
			Password   string `json:"password" binding:"required"`
			PassportID string `json:"passport_id"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "name, surname, phone and password required"})
			return
		}
		if len(req.Password) < 4 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Пароль должен быть не менее 4 символов"})
			return
		}

		// Компания может создавать курьеров только для себя; глобальных
		// (company_id = NULL) курьеров создаёт только админ.
		if !isAdmin(c) {
			if ctxRole(c) != "company" {
				c.JSON(http.StatusForbidden, gin.H{"error": "Доступ запрещён"})
				return
			}
			cid := ctxCompanyID(c)
			req.CompanyID = &cid
		}

		hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
			return
		}

		var id int64
		err = db.QueryRow(`
			INSERT INTO couriers (company_id, name, surname, phone, password_hash, passport_id)
			VALUES ($1, $2, $3, $4, $5, NULLIF($6,''))
			RETURNING id
		`, req.CompanyID, req.Name, req.Surname, req.Phone, string(hash), req.PassportID).Scan(&id)
		if err != nil {
			log.Printf("❌ CreateCourier error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать курьера (телефон уже занят?)"})
			return
		}

		log.Printf("✅ Courier created: id=%d phone=%s company_id=%v", id, req.Phone, req.CompanyID)
		c.JSON(http.StatusCreated, gin.H{"success": true, "id": id})
	}
}

// GetCouriers — GET /couriers?company_id=X
// company_id=0 or missing → return all (admin)
func GetCouriers(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyIDStr := c.Query("company_id")
		// Не-админ всегда видит только курьеров своей компании, независимо от
		// параметров запроса.
		if !isAdmin(c) {
			companyIDStr = strconv.FormatInt(ctxCompanyID(c), 10)
		}

		var rows *sql.Rows
		var err error
		if companyIDStr != "" && companyIDStr != "0" {
			cid, _ := strconv.ParseInt(companyIDStr, 10, 64)
			rows, err = db.Query(`
				SELECT c.id, c.name, c.surname, c.phone, COALESCE(c.passport_id,''),
				       c.company_id, c.is_online,
				       COALESCE(c.last_lat, 0), COALESCE(c.last_lng, 0),
				       c.location_updated_at, c.current_order_id, c.created_at,
				       COALESCE(co.name,'') as company_name
				FROM couriers c
				LEFT JOIN companies co ON co.id = c.company_id
				WHERE c.company_id = $1
				ORDER BY c.created_at DESC
			`, cid)
		} else {
			rows, err = db.Query(`
				SELECT c.id, c.name, c.surname, c.phone, COALESCE(c.passport_id,''),
				       c.company_id, c.is_online,
				       COALESCE(c.last_lat, 0), COALESCE(c.last_lng, 0),
				       c.location_updated_at, c.current_order_id, c.created_at,
				       COALESCE(co.name,'') as company_name
				FROM couriers c
				LEFT JOIN companies co ON co.id = c.company_id
				ORDER BY c.created_at DESC
			`)
		}
		if err != nil {
			log.Printf("❌ GetCouriers error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch couriers"})
			return
		}
		defer rows.Close()

		type courierRow struct {
			ID                int64       `json:"id"`
			Name              string      `json:"name"`
			Surname           string      `json:"surname"`
			Phone             string      `json:"phone"`
			PassportID        string      `json:"passport_id"`
			CompanyID         interface{} `json:"company_id"`
			IsOnline          bool        `json:"is_online"`
			LastLat           float64     `json:"last_lat"`
			LastLng           float64     `json:"last_lng"`
			LocationUpdatedAt interface{} `json:"location_updated_at"`
			CurrentOrderID    interface{} `json:"current_order_id"`
			CreatedAt         string      `json:"created_at"`
			CompanyName       string      `json:"company_name"`
		}

		result := make([]courierRow, 0)
		for rows.Next() {
			var r courierRow
			var companyID sql.NullInt64
			var currentOrderID sql.NullInt64
			var locationUpdatedAt sql.NullTime
			var createdAt sql.NullTime
			if err := rows.Scan(
				&r.ID, &r.Name, &r.Surname, &r.Phone, &r.PassportID,
				&companyID, &r.IsOnline, &r.LastLat, &r.LastLng,
				&locationUpdatedAt, &currentOrderID, &createdAt, &r.CompanyName,
			); err != nil {
				log.Printf("❌ GetCouriers scan: %v", err)
				continue
			}
			if companyID.Valid {
				r.CompanyID = companyID.Int64
			}
			if currentOrderID.Valid {
				r.CurrentOrderID = currentOrderID.Int64
			}
			if locationUpdatedAt.Valid {
				r.LocationUpdatedAt = locationUpdatedAt.Time
			}
			if createdAt.Valid {
				r.CreatedAt = createdAt.Time.Format("2006-01-02T15:04:05Z")
			}
			result = append(result, r)
		}
		c.JSON(http.StatusOK, result)
	}
}

// DeleteCourier — DELETE /couriers/:id
func DeleteCourier(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		res, err := db.Exec("DELETE FROM couriers WHERE id = $1", id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete courier"})
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Courier not found"})
			return
		}
		log.Printf("🗑️ Courier deleted: id=%s", id)
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// UpdateCourierStatus — PUT /couriers/:id/status
// Body: { is_online: true/false }
func UpdateCourierStatus(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var req struct {
			IsOnline bool `json:"is_online"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "is_online required"})
			return
		}
		if _, err := db.Exec(`
			UPDATE couriers SET is_online = $1 WHERE id = $2
		`, req.IsOnline, id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update status"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// UpdateCourierLocation — PUT /couriers/:id/location
// Body: { lat, lng }
func UpdateCourierLocation(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var req struct {
			Lat float64 `json:"lat"`
			Lng float64 `json:"lng"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "lat and lng required"})
			return
		}
		if _, err := db.Exec(`
			UPDATE couriers SET last_lat = $1, last_lng = $2, location_updated_at = NOW(), is_online = TRUE
			WHERE id = $3
		`, req.Lat, req.Lng, id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update location"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// GetCourierStats — GET /couriers/:id/stats
// Статистика курьера для его панели: доставлено сегодня (кол-во и сумма)
// и всего за всё время. Мотивация + контроль смены.
func GetCourierStats(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var todayCount, totalCount int
		var todaySum float64
		err := db.QueryRow(`
			SELECT
				COUNT(*) FILTER (WHERE updated_at::date = CURRENT_DATE),
				COALESCE(SUM(total_amount) FILTER (WHERE updated_at::date = CURRENT_DATE), 0),
				COUNT(*)
			FROM orders
			WHERE courier_id = $1 AND status = 'completed'
		`, id).Scan(&todayCount, &todaySum, &totalCount)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load stats"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"todayDelivered": todayCount,
			"todayAmount":    todaySum,
			"totalDelivered": totalCount,
		})
	}
}

// GetOrderCourierLocation — GET /orders/:id/courier-location
// Позволяет покупателю следить за курьером в реальном времени.
// Возвращает текущие координаты назначенного курьера и точку доставки.
func GetOrderCourierLocation(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		orderID := c.Param("id")

		var courierID sql.NullInt64
		var deliveryCoords sql.NullString
		var deliveryAddress sql.NullString
		var customerPhone string
		var orderCompanyID sql.NullInt64
		err := db.QueryRow(`
			SELECT courier_id, delivery_coordinates, delivery_address, customer_phone, company_id
			FROM orders WHERE id = $1
		`, orderID).Scan(&courierID, &deliveryCoords, &deliveryAddress, &customerPhone, &orderCompanyID)

		// Позицию курьера и адрес доставки видят только участники заказа.
		if err == nil {
			switch ctxRole(c) {
			case "admin", "courier":
				// ok
			case "company":
				if !orderCompanyID.Valid || orderCompanyID.Int64 != ctxCompanyID(c) {
					c.JSON(http.StatusForbidden, gin.H{"error": "Доступ запрещён"})
					return
				}
			case "user":
				if customerPhone != ctxPhone(c) {
					c.JSON(http.StatusForbidden, gin.H{"error": "Доступ запрещён"})
					return
				}
			default:
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
				return
			}
		}
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load order"})
			return
		}

		resp := gin.H{
			"hasCourier":       false,
			"deliveryCoords":   nil,
			"deliveryAddress":  nil,
		}
		if deliveryCoords.Valid {
			resp["deliveryCoords"] = deliveryCoords.String
		}
		if deliveryAddress.Valid {
			resp["deliveryAddress"] = deliveryAddress.String
		}

		if !courierID.Valid {
			c.JSON(http.StatusOK, resp)
			return
		}

		var name, surname, phone sql.NullString
		var lat, lng sql.NullFloat64
		var isOnline sql.NullBool
		var updatedAt sql.NullTime
		err = db.QueryRow(`
			SELECT name, surname, phone, last_lat, last_lng, is_online, location_updated_at
			FROM couriers WHERE id = $1
		`, courierID.Int64).Scan(&name, &surname, &phone, &lat, &lng, &isOnline, &updatedAt)
		if err != nil {
			c.JSON(http.StatusOK, resp)
			return
		}

		courier := gin.H{
			"id":       courierID.Int64,
			"name":     strings.TrimSpace(name.String + " " + surname.String),
			"phone":    phone.String,
			"isOnline": isOnline.Bool,
		}
		if lat.Valid && lng.Valid {
			courier["lat"] = lat.Float64
			courier["lng"] = lng.Float64
		}
		if updatedAt.Valid {
			courier["updatedAt"] = updatedAt.Time
		}
		resp["hasCourier"] = lat.Valid && lng.Valid
		resp["courier"] = courier
		c.JSON(http.StatusOK, resp)
	}
}

// GetCourierShippedOrders — GET /couriers/:id/orders
// Returns shipped delivery orders for this courier's scope
func GetCourierShippedOrders(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		// Get courier's company_id
		var companyID sql.NullInt64
		if err := db.QueryRow("SELECT company_id FROM couriers WHERE id = $1", id).Scan(&companyID); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Courier not found"})
			return
		}

		var rows *sql.Rows
		var err error
		if companyID.Valid {
			// Company courier: only their company's orders
			rows, err = db.Query(`
				SELECT o.id, o.customer_name, o.customer_phone, o.delivery_address,
				       COALESCE(o.delivery_coordinates,''), o.total_amount,
				       COALESCE(o.order_code,''), o.created_at, o.items,
				       COALESCE(o.comment,''), o.company_id
				FROM orders o
				WHERE o.status = 'shipped' AND o.delivery_type = 'delivery'
				AND o.company_id = $1
				ORDER BY o.created_at ASC
			`, companyID.Int64)
		} else {
			// Admin courier: all shipped delivery orders
			rows, err = db.Query(`
				SELECT o.id, o.customer_name, o.customer_phone, o.delivery_address,
				       COALESCE(o.delivery_coordinates,''), o.total_amount,
				       COALESCE(o.order_code,''), o.created_at, o.items,
				       COALESCE(o.comment,''), o.company_id
				FROM orders o
				WHERE o.status = 'shipped' AND o.delivery_type = 'delivery'
				ORDER BY o.created_at ASC
			`)
		}
		if err != nil {
			log.Printf("❌ GetCourierShippedOrders error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch orders"})
			return
		}
		defer rows.Close()

		type orderRow struct {
			ID                  int64       `json:"id"`
			CustomerName        string      `json:"customer_name"`
			CustomerPhone       string      `json:"customer_phone"`
			DeliveryAddress     string      `json:"delivery_address"`
			DeliveryCoordinates string      `json:"delivery_coordinates"`
			TotalAmount         float64     `json:"total_amount"`
			OrderCode           string      `json:"order_code"`
			CreatedAt           string      `json:"created_at"`
			Items               interface{} `json:"items"`
			Comment             string      `json:"comment"`
			CompanyID           int64       `json:"company_id"`
		}

		result := make([]orderRow, 0)
		for rows.Next() {
			var r orderRow
			var itemsJSON []byte
			var createdAt sql.NullTime
			if err := rows.Scan(
				&r.ID, &r.CustomerName, &r.CustomerPhone, &r.DeliveryAddress,
				&r.DeliveryCoordinates, &r.TotalAmount, &r.OrderCode, &createdAt,
				&itemsJSON, &r.Comment, &r.CompanyID,
			); err != nil {
				continue
			}
			if createdAt.Valid {
				r.CreatedAt = createdAt.Time.Format("2006-01-02T15:04:05Z")
			}
			r.Items = string(itemsJSON)
			result = append(result, r)
		}
		c.JSON(http.StatusOK, result)
	}
}
