package handlers

import (
	"database/sql"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// computeDiscount returns the discount amount for a promo code given an order
// total, respecting the discount type and the optional percent cap.
func computeDiscount(discountType string, value, orderAmount float64, maxDiscount sql.NullFloat64) float64 {
	var discount float64
	if discountType == "fixed" {
		discount = value
	} else { // percent
		discount = orderAmount * value / 100.0
		if maxDiscount.Valid && maxDiscount.Float64 > 0 && discount > maxDiscount.Float64 {
			discount = maxDiscount.Float64
		}
	}
	if discount > orderAmount {
		discount = orderAmount
	}
	if discount < 0 {
		discount = 0
	}
	return discount
}

// CreatePromoCode creates a coupon. company_id may be null for platform-wide
// codes (admin). Code is stored upper-cased for case-insensitive matching.
func CreatePromoCode(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			CompanyID      *int64   `json:"companyId"`
			Code           string   `json:"code"`
			Description    string   `json:"description"`
			DiscountType   string   `json:"discountType"`
			DiscountValue  float64  `json:"discountValue"`
			MinOrderAmount float64  `json:"minOrderAmount"`
			MaxDiscount    *float64 `json:"maxDiscount"`
			UsageLimit     *int     `json:"usageLimit"`
			PerUserLimit   int      `json:"perUserLimit"`
			StartsAt       *string  `json:"startsAt"`
			ExpiresAt      *string  `json:"expiresAt"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		req.Code = strings.ToUpper(strings.TrimSpace(req.Code))
		if req.Code == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Code is required"})
			return
		}
		if req.DiscountType != "fixed" {
			req.DiscountType = "percent"
		}

		var id int64
		err := db.QueryRow(`
			INSERT INTO promo_codes (
				company_id, code, description, discount_type, discount_value,
				min_order_amount, max_discount, usage_limit, per_user_limit,
				starts_at, expires_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			RETURNING id
		`, req.CompanyID, req.Code, req.Description, req.DiscountType, req.DiscountValue,
			req.MinOrderAmount, req.MaxDiscount, req.UsageLimit, req.PerUserLimit,
			req.StartsAt, req.ExpiresAt).Scan(&id)
		if err != nil {
			if strings.Contains(err.Error(), "duplicate") {
				c.JSON(http.StatusConflict, gin.H{"error": "Promo code already exists"})
				return
			}
			log.Printf("❌ CreatePromoCode: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create promo code"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "id": id, "code": req.Code})
	}
}

// DeleteCompanyPromoCode — DELETE /promo-codes/company/:companyId/:id (продавец).
// Удаляет только код, принадлежащий этой компании.
func DeleteCompanyPromoCode(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		res, err := db.Exec(`DELETE FROM promo_codes WHERE id = $1 AND company_id = $2`,
			c.Param("id"), c.Param("companyId"))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete"})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Промокод не найден"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"deleted": true})
	}
}

// CreateCompanyPromoCode — POST /promo-codes/company/:companyId (продавец).
// Компания создаёт свой промокод. company_id жёстко берётся из URL (нельзя
// создать платформенный или чужой код). Тип percent/fixed + минимальный заказ.
func CreateCompanyPromoCode(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID, err := strconv.ParseInt(c.Param("companyId"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid company id"})
			return
		}
		// Промокоды доступны только закрытым (private) магазинам: у публичного
		// магазина товары видны всем, поэтому механика кодов для него отключена.
		var mode sql.NullString
		if err := db.QueryRow(`SELECT mode FROM companies WHERE id = $1`, companyID).Scan(&mode); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "company not found"})
			return
		}
		if !mode.Valid || mode.String != "private" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Промокоды доступны только закрытым магазинам"})
			return
		}
		var req struct {
			Code           string   `json:"code"`
			Description    string   `json:"description"`
			DiscountType   string   `json:"discountType"`
			DiscountValue  float64  `json:"discountValue"`
			MinOrderAmount float64  `json:"minOrderAmount"`
			MaxDiscount    *float64 `json:"maxDiscount"`
			UsageLimit     *int     `json:"usageLimit"`
			ExpiresAt      *string  `json:"expiresAt"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		req.Code = strings.ToUpper(strings.TrimSpace(req.Code))
		if req.Code == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Code is required"})
			return
		}
		if req.DiscountType != "fixed" {
			req.DiscountType = "percent"
		}
		if req.DiscountValue <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "discountValue must be positive"})
			return
		}

		var id int64
		err = db.QueryRow(`
			INSERT INTO promo_codes (
				company_id, code, description, discount_type, discount_value,
				min_order_amount, max_discount, usage_limit, per_user_limit, expires_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9)
			RETURNING id
		`, companyID, req.Code, req.Description, req.DiscountType, req.DiscountValue,
			req.MinOrderAmount, req.MaxDiscount, req.UsageLimit, req.ExpiresAt).Scan(&id)
		if err != nil {
			if strings.Contains(err.Error(), "duplicate") {
				c.JSON(http.StatusConflict, gin.H{"error": "Такой промокод уже существует"})
				return
			}
			log.Printf("❌ CreateCompanyPromoCode: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create promo code"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "id": id, "code": req.Code})
	}
}

// GetCompanyPromoCodes lists a company's codes (plus platform-wide codes).
func GetCompanyPromoCodes(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID := c.Param("companyId")
		rows, err := db.Query(`
			SELECT id, company_id, code, COALESCE(description, ''), discount_type, discount_value,
			       min_order_amount, max_discount, usage_limit, used_count, per_user_limit,
			       starts_at, expires_at, is_active, created_at
			FROM promo_codes
			WHERE company_id = $1 OR company_id IS NULL
			ORDER BY created_at DESC
		`, companyID)
		if err != nil {
			log.Printf("❌ GetCompanyPromoCodes: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch promo codes"})
			return
		}
		defer rows.Close()

		list := make([]gin.H, 0)
		for rows.Next() {
			var (
				id                                    int64
				compID                                sql.NullInt64
				code, descr, dType                    string
				dValue, minOrder                      float64
				maxDisc                               sql.NullFloat64
				usageLimit                            sql.NullInt64
				usedCount, perUser                    int
				startsAt, expiresAt                   sql.NullTime
				isActive                              bool
				createdAt                             time.Time
			)
			if err := rows.Scan(&id, &compID, &code, &descr, &dType, &dValue, &minOrder,
				&maxDisc, &usageLimit, &usedCount, &perUser, &startsAt, &expiresAt, &isActive, &createdAt); err != nil {
				continue
			}
			item := gin.H{
				"id": id, "code": code, "description": descr, "discountType": dType,
				"discountValue": dValue, "minOrderAmount": minOrder, "usedCount": usedCount,
				"perUserLimit": perUser, "isActive": isActive, "createdAt": createdAt,
			}
			if compID.Valid {
				item["companyId"] = compID.Int64
			}
			if maxDisc.Valid {
				item["maxDiscount"] = maxDisc.Float64
			}
			if usageLimit.Valid {
				item["usageLimit"] = usageLimit.Int64
			}
			if startsAt.Valid {
				item["startsAt"] = startsAt.Time
			}
			if expiresAt.Valid {
				item["expiresAt"] = expiresAt.Time
			}
			list = append(list, item)
		}
		c.JSON(http.StatusOK, list)
	}
}

// GetAllPromoCodes lists every promo code (admin view).
func GetAllPromoCodes(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`
			SELECT id, company_id, code, COALESCE(description, ''), discount_type, discount_value,
			       min_order_amount, max_discount, usage_limit, used_count, per_user_limit,
			       starts_at, expires_at, is_active, created_at
			FROM promo_codes
			ORDER BY created_at DESC
		`)
		if err != nil {
			log.Printf("❌ GetAllPromoCodes: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch promo codes"})
			return
		}
		defer rows.Close()

		list := make([]gin.H, 0)
		for rows.Next() {
			var (
				id                  int64
				compID              sql.NullInt64
				code, descr, dType  string
				dValue, minOrder    float64
				maxDisc             sql.NullFloat64
				usageLimit          sql.NullInt64
				usedCount, perUser  int
				startsAt, expiresAt sql.NullTime
				isActive            bool
				createdAt           time.Time
			)
			if err := rows.Scan(&id, &compID, &code, &descr, &dType, &dValue, &minOrder,
				&maxDisc, &usageLimit, &usedCount, &perUser, &startsAt, &expiresAt, &isActive, &createdAt); err != nil {
				continue
			}
			item := gin.H{
				"id": id, "code": code, "description": descr, "discountType": dType,
				"discountValue": dValue, "minOrderAmount": minOrder, "usedCount": usedCount,
				"perUserLimit": perUser, "isActive": isActive, "createdAt": createdAt,
			}
			if compID.Valid {
				item["companyId"] = compID.Int64
			}
			if maxDisc.Valid {
				item["maxDiscount"] = maxDisc.Float64
			}
			if usageLimit.Valid {
				item["usageLimit"] = usageLimit.Int64
			}
			list = append(list, item)
		}
		c.JSON(http.StatusOK, list)
	}
}

// ValidatePromoCode checks a code against an order amount/user/company and
// returns the discount it would grant. It does NOT record a use — call
// RedeemPromoCode when the order is actually placed.
func ValidatePromoCode(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Code        string  `json:"code"`
			UserPhone   string  `json:"userPhone"`
			CompanyID   *int64  `json:"companyId"`
			OrderAmount float64 `json:"orderAmount"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		code := strings.ToUpper(strings.TrimSpace(req.Code))

		var (
			id                       int64
			companyID                sql.NullInt64
			dType                    string
			dValue, minOrder         float64
			maxDisc                  sql.NullFloat64
			usageLimit               sql.NullInt64
			usedCount, perUserLimit  int
			startsAt, expiresAt      sql.NullTime
			isActive                 bool
		)
		err := db.QueryRow(`
			SELECT id, company_id, discount_type, discount_value, min_order_amount,
			       max_discount, usage_limit, used_count, per_user_limit,
			       starts_at, expires_at, is_active
			FROM promo_codes WHERE code = $1
		`, code).Scan(&id, &companyID, &dType, &dValue, &minOrder, &maxDisc,
			&usageLimit, &usedCount, &perUserLimit, &startsAt, &expiresAt, &isActive)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusOK, gin.H{"valid": false, "message": "Промокод не найден"})
			return
		}
		if err != nil {
			log.Printf("❌ ValidatePromoCode: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate promo code"})
			return
		}

		now := time.Now()
		switch {
		case !isActive:
			c.JSON(http.StatusOK, gin.H{"valid": false, "message": "Промокод неактивен"})
			return
		case startsAt.Valid && now.Before(startsAt.Time):
			c.JSON(http.StatusOK, gin.H{"valid": false, "message": "Промокод ещё не действует"})
			return
		case expiresAt.Valid && now.After(expiresAt.Time):
			c.JSON(http.StatusOK, gin.H{"valid": false, "message": "Срок действия промокода истёк"})
			return
		case usageLimit.Valid && usedCount >= int(usageLimit.Int64):
			c.JSON(http.StatusOK, gin.H{"valid": false, "message": "Лимит использований исчерпан"})
			return
		case companyID.Valid && req.CompanyID != nil && companyID.Int64 != *req.CompanyID:
			c.JSON(http.StatusOK, gin.H{"valid": false, "message": "Промокод не действует для этого магазина"})
			return
		case req.OrderAmount < minOrder:
			c.JSON(http.StatusOK, gin.H{"valid": false, "message": "Сумма заказа меньше минимальной для этого промокода"})
			return
		}

		if perUserLimit > 0 && req.UserPhone != "" {
			var userUses int
			db.QueryRow(`SELECT COUNT(*) FROM promo_code_uses WHERE promo_code_id = $1 AND user_phone = $2`, id, req.UserPhone).Scan(&userUses)
			if userUses >= perUserLimit {
				c.JSON(http.StatusOK, gin.H{"valid": false, "message": "Вы уже использовали этот промокод"})
				return
			}
		}

		discount := computeDiscount(dType, dValue, req.OrderAmount, maxDisc)
		c.JSON(http.StatusOK, gin.H{
			"valid":       true,
			"promoId":     id,
			"code":        code,
			"discount":    discount,
			"finalAmount": req.OrderAmount - discount,
			"message":     "Промокод применён",
		})
	}
}

// RedeemPromoCode records a use of a promo code (call when an order is placed).
// Increments used_count and inserts a usage row in one transaction.
func RedeemPromoCode(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			PromoID   int64   `json:"promoId"`
			UserPhone string  `json:"userPhone"`
			OrderID   *int64  `json:"orderId"`
			Discount  float64 `json:"discount"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if req.PromoID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "promoId is required"})
			return
		}

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}
		defer tx.Rollback()

		if _, err := tx.Exec(`UPDATE promo_codes SET used_count = used_count + 1, updated_at = NOW() WHERE id = $1`, req.PromoID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record promo use"})
			return
		}
		if _, err := tx.Exec(`
			INSERT INTO promo_code_uses (promo_code_id, user_phone, order_id, discount_applied)
			VALUES ($1, $2, $3, $4)
		`, req.PromoID, req.UserPhone, req.OrderID, req.Discount); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record promo use"})
			return
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record promo use"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// TogglePromoCode enables/disables a code.
func TogglePromoCode(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var req struct {
			IsActive bool `json:"isActive"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if _, err := db.Exec(`UPDATE promo_codes SET is_active = $1, updated_at = NOW() WHERE id = $2`, req.IsActive, id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update promo code"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// DeletePromoCode removes a code.
func DeletePromoCode(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if _, err := db.Exec(`DELETE FROM promo_codes WHERE id = $1`, id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete promo code"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}
