package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// CreateReturn lets a customer open a return/refund request for an order.
func CreateReturn(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			OrderID       *int64                   `json:"orderId"`
			CompanyID     *int64                   `json:"companyId"`
			CustomerPhone string                   `json:"customerPhone"`
			Reason        string                   `json:"reason"`
			Items         []map[string]interface{} `json:"items"`
			RefundAmount  float64                  `json:"refundAmount"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if req.CustomerPhone == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "customerPhone is required"})
			return
		}
		// Заявку на возврат создаёт только сам покупатель (или админ).
		if !requirePhoneMatch(c, req.CustomerPhone) {
			return
		}

		// If companyId wasn't supplied (or came through as 0 — old clients that
		// didn't have company_id in the order detail), derive it from the order.
		// Inserting company_id = 0 would violate the companies FK and 500.
		if (req.CompanyID == nil || *req.CompanyID <= 0) && req.OrderID != nil {
			var cid int64
			if err := db.QueryRow(`SELECT company_id FROM orders WHERE id = $1`, *req.OrderID).Scan(&cid); err == nil && cid > 0 {
				req.CompanyID = &cid
			} else {
				req.CompanyID = nil
			}
		}
		if req.CompanyID != nil && *req.CompanyID <= 0 {
			req.CompanyID = nil
		}

		// Enforce the company's own return policy (enabled + time window).
		if req.OrderID != nil && req.CompanyID != nil {
			var (
				retEnabled   bool
				windowHours  int
				orderCreated time.Time
			)
			policyErr := db.QueryRow(`
				SELECT COALESCE(return_enabled, true), COALESCE(return_window_hours, 24)
				FROM companies WHERE id = $1`, *req.CompanyID).Scan(&retEnabled, &windowHours)
			if policyErr == nil {
				if !retEnabled {
					c.JSON(http.StatusForbidden, gin.H{"error": "Эта компания не принимает возвраты"})
					return
				}
				if err := db.QueryRow(`SELECT created_at FROM orders WHERE id = $1`, *req.OrderID).Scan(&orderCreated); err == nil {
					if windowHours > 0 && time.Since(orderCreated) > time.Duration(windowHours)*time.Hour {
						c.JSON(http.StatusForbidden, gin.H{
							"error": fmt.Sprintf("Срок возврата истёк (возврат возможен в течение %d ч после заказа)", windowHours),
						})
						return
					}
				}
				// Prevent duplicate open requests for the same order.
				var existing int
				_ = db.QueryRow(`SELECT COUNT(*) FROM order_returns WHERE order_id = $1 AND status IN ('requested','approved')`, *req.OrderID).Scan(&existing)
				if existing > 0 {
					c.JSON(http.StatusConflict, gin.H{"error": "Заявка на возврат по этому заказу уже существует"})
					return
				}
			}
		}

		itemsJSON, _ := json.Marshal(req.Items)
		if len(req.Items) == 0 {
			itemsJSON = []byte("[]")
		}

		var id int64
		err := db.QueryRow(`
			INSERT INTO order_returns (order_id, company_id, customer_phone, reason, items, refund_amount, status)
			VALUES ($1, $2, $3, $4, $5::jsonb, $6, 'requested')
			RETURNING id
		`, req.OrderID, req.CompanyID, req.CustomerPhone, req.Reason, itemsJSON, req.RefundAmount).Scan(&id)
		if err != nil {
			log.Printf("❌ CreateReturn: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create return request"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "id": id, "status": "requested"})
	}
}

// GetReturns lists return requests filtered by ?companyId= or ?customerPhone=.
func GetReturns(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID := c.Query("companyId")
		customerPhone := c.Query("customerPhone")

		// Скоупинг: компания видит только свои возвраты, покупатель — только
		// свои, админ — любые.
		switch ctxRole(c) {
		case "admin":
			// ok
		case "company":
			companyID = strconv.FormatInt(ctxCompanyID(c), 10)
			customerPhone = ""
		case "user":
			customerPhone = ctxPhone(c)
			companyID = ""
		default:
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			return
		}

		var rows *sql.Rows
		var err error
		switch {
		case companyID != "":
			rows, err = db.Query(`
				SELECT id, order_id, company_id, customer_phone, COALESCE(reason, ''), items,
				       refund_amount, status, COALESCE(comment, ''), created_at, updated_at, resolved_at
				FROM order_returns WHERE company_id = $1 ORDER BY created_at DESC
			`, companyID)
		case customerPhone != "":
			rows, err = db.Query(`
				SELECT id, order_id, company_id, customer_phone, COALESCE(reason, ''), items,
				       refund_amount, status, COALESCE(comment, ''), created_at, updated_at, resolved_at
				FROM order_returns WHERE customer_phone = $1 ORDER BY created_at DESC
			`, customerPhone)
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "companyId or customerPhone is required"})
			return
		}
		if err != nil {
			log.Printf("❌ GetReturns: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch returns"})
			return
		}
		defer rows.Close()
		c.JSON(http.StatusOK, scanReturns(rows))
	}
}

// GetReturn returns a single return request by id.
func GetReturn(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`
			SELECT id, order_id, company_id, customer_phone, COALESCE(reason, ''), items,
			       refund_amount, status, COALESCE(comment, ''), created_at, updated_at, resolved_at
			FROM order_returns WHERE id = $1
		`, c.Param("id"))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch return"})
			return
		}
		defer rows.Close()
		list := scanReturns(rows)
		if len(list) == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Return not found"})
			return
		}
		c.JSON(http.StatusOK, list[0])
	}
}

// UpdateReturnStatus lets a company/admin move a return through its lifecycle.
func UpdateReturnStatus(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var req struct {
			Status  string `json:"status"`
			Comment string `json:"comment"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		valid := map[string]bool{"requested": true, "approved": true, "rejected": true, "refunded": true}
		if !valid[req.Status] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status"})
			return
		}

		// Статус возврата меняет только компания, которой он адресован (или админ).
		var returnCompanyID sql.NullInt64
		if err := db.QueryRow(`SELECT company_id FROM order_returns WHERE id = $1`, id).Scan(&returnCompanyID); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Return not found"})
			return
		}
		if !requireCompanyMatch(c, returnCompanyID.Int64) {
			return
		}

		resolved := req.Status == "approved" || req.Status == "rejected" || req.Status == "refunded"
		res, err := db.Exec(`
			UPDATE order_returns
			SET status = $1,
			    comment = COALESCE(NULLIF($2, ''), comment),
			    resolved_at = CASE WHEN $3 THEN NOW() ELSE resolved_at END,
			    updated_at = NOW()
			WHERE id = $4
		`, req.Status, req.Comment, resolved, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update return"})
			return
		}
		if affected, _ := res.RowsAffected(); affected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Return not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "status": req.Status})
	}
}

// scanReturns converts return rows into JSON-friendly maps.
func scanReturns(rows *sql.Rows) []gin.H {
	list := make([]gin.H, 0)
	for rows.Next() {
		var (
			id                   int64
			orderID, companyID   sql.NullInt64
			phone, reason        string
			items                []byte
			refund               float64
			status, comment      string
			createdAt, updatedAt time.Time
			resolvedAt           sql.NullTime
		)
		if err := rows.Scan(&id, &orderID, &companyID, &phone, &reason, &items,
			&refund, &status, &comment, &createdAt, &updatedAt, &resolvedAt); err != nil {
			continue
		}
		var itemsArr []map[string]interface{}
		if len(items) > 0 {
			json.Unmarshal(items, &itemsArr)
		}
		item := gin.H{
			"id": id, "customerPhone": phone, "reason": reason, "items": itemsArr,
			"refundAmount": refund, "status": status, "comment": comment,
			"createdAt": createdAt, "updatedAt": updatedAt,
		}
		if orderID.Valid {
			item["orderId"] = orderID.Int64
		}
		if companyID.Valid {
			item["companyId"] = companyID.Int64
		}
		if resolvedAt.Valid {
			item["resolvedAt"] = resolvedAt.Time
		}
		list = append(list, item)
	}
	return list
}
