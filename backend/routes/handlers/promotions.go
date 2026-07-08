package handlers

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// 📢 Внутренняя реклама. Поток: продавец создаёт заявку (pending) → админ
// одобряет с суммой и сроком (active, задаются starts_at/ends_at) → по
// истечении ends_at продвижение перестаёт влиять на выдачу автоматически
// (фильтр по времени в запросах витрины, без крона).

// activePromoWhere — SQL-условие «продвижение сейчас активно».
const activePromoWhere = `status = 'active' AND starts_at <= NOW() AND ends_at > NOW()`

// promotedExpr — булев столбец «товар сейчас продвигается» (сам товар или весь
// его магазин). Подставляется в выдачу витрины для подъёма таких товаров вверх.
// Требует алиас таблицы товаров `p`.
const promotedExpr = `EXISTS (
	SELECT 1 FROM promotions pr
	WHERE pr.status = 'active' AND pr.starts_at <= NOW() AND pr.ends_at > NOW()
	  AND ( (pr.scope = 'product' AND pr.product_id = p.id)
	     OR (pr.scope = 'company' AND pr.company_id = p.company_id) )
)`

// CreatePromotionRequest — POST /promotions  (продавец)
// Body: { companyId, productId?, scope, days, note? }
func CreatePromotionRequest(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			CompanyID int64  `json:"companyId"`
			ProductID *int64 `json:"productId"`
			Scope     string `json:"scope"`
			Days      int    `json:"days"`
			Note      string `json:"note"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		// Компания создаёт заявку только от своего имени.
		if !isAdmin(c) {
			req.CompanyID = ctxCompanyID(c)
		}
		if req.CompanyID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "companyId required"})
			return
		}
		if req.Scope != "product" {
			req.Scope = "company"
			req.ProductID = nil
		}
		if req.Scope == "product" && (req.ProductID == nil || *req.ProductID == 0) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "productId required for product scope"})
			return
		}
		if req.Days <= 0 {
			req.Days = 1
		}

		var id int64
		err := db.QueryRow(`
			INSERT INTO promotions (company_id, product_id, scope, days, note, status)
			VALUES ($1, $2, $3, $4, $5, 'pending')
			RETURNING id
		`, req.CompanyID, req.ProductID, req.Scope, req.Days, req.Note).Scan(&id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create promotion request"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "id": id, "status": "pending"})
	}
}

// scanPromotions превращает строки в JSON-объекты с человекочитаемыми полями.
func scanPromotions(rows *sql.Rows) []gin.H {
	list := make([]gin.H, 0)
	for rows.Next() {
		var (
			id, companyID int64
			productID     sql.NullInt64
			scope, status string
			days          int
			amount        float64
			startsAt      sql.NullTime
			endsAt        sql.NullTime
			note          sql.NullString
			createdAt     time.Time
			companyName   sql.NullString
			productName   sql.NullString
		)
		if err := rows.Scan(&id, &companyID, &productID, &scope, &days, &amount,
			&status, &startsAt, &endsAt, &note, &createdAt, &companyName, &productName); err != nil {
			continue
		}
		item := gin.H{
			"id": id, "companyId": companyID, "scope": scope, "days": days,
			"amount": amount, "status": status, "createdAt": createdAt,
			"companyName": companyName.String, "note": note.String,
		}
		if productID.Valid {
			item["productId"] = productID.Int64
			item["productName"] = productName.String
		}
		if startsAt.Valid {
			item["startsAt"] = startsAt.Time
		}
		if endsAt.Valid {
			item["endsAt"] = endsAt.Time
			item["active"] = status == "active" && endsAt.Time.After(time.Now())
		}
		list = append(list, item)
	}
	return list
}

const promoSelect = `
	SELECT pr.id, pr.company_id, pr.product_id, pr.scope, pr.days, pr.amount,
	       pr.status, pr.starts_at, pr.ends_at, pr.note, pr.created_at,
	       c.name, p.name
	FROM promotions pr
	LEFT JOIN companies c ON c.id = pr.company_id
	LEFT JOIN products p ON p.id = pr.product_id`

// GetCompanyPromotions — GET /promotions/company/:companyId  (продавец/админ)
func GetCompanyPromotions(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(promoSelect+`
			WHERE pr.company_id = $1 ORDER BY pr.created_at DESC`, c.Param("companyId"))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch"})
			return
		}
		defer rows.Close()
		c.JSON(http.StatusOK, scanPromotions(rows))
	}
}

// GetAllPromotions — GET /promotions  (админ). ?status=pending для очереди модерации.
func GetAllPromotions(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		status := c.Query("status")
		q := promoSelect
		args := []interface{}{}
		if status != "" {
			q += ` WHERE pr.status = $1`
			args = append(args, status)
		}
		q += ` ORDER BY pr.created_at DESC LIMIT 500`
		rows, err := db.Query(q, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch"})
			return
		}
		defer rows.Close()
		c.JSON(http.StatusOK, scanPromotions(rows))
	}
}

// ApprovePromotion — PUT /promotions/:id/approve  (админ)
// Body: { amount, days? } — фиксирует оплату и запускает продвижение сейчас.
func ApprovePromotion(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Amount float64 `json:"amount"`
			Days   int     `json:"days"`
		}
		_ = c.ShouldBindJSON(&req)

		// Берём срок из заявки, если админ не переопределил.
		var days int
		if err := db.QueryRow(`SELECT days FROM promotions WHERE id = $1`, c.Param("id")).Scan(&days); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		if req.Days > 0 {
			days = req.Days
		}
		ends := time.Now().AddDate(0, 0, days)

		res, err := db.Exec(`
			UPDATE promotions
			SET status = 'active', amount = $1, days = $2,
			    starts_at = NOW(), ends_at = $3, updated_at = NOW()
			WHERE id = $4 AND status IN ('pending','rejected')
		`, req.Amount, days, ends, c.Param("id"))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to approve"})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Promotion not in a state to approve"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "status": "active", "endsAt": ends})
	}
}

// RejectPromotion — PUT /promotions/:id/reject  (админ)
func RejectPromotion(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, err := db.Exec(`UPDATE promotions SET status='rejected', updated_at=NOW() WHERE id=$1 AND status='pending'`, c.Param("id"))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reject"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "status": "rejected"})
	}
}

// CancelPromotion — DELETE /promotions/:id  (админ/владелец): досрочная остановка.
func CancelPromotion(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var companyID int64
		if err := db.QueryRow(`SELECT company_id FROM promotions WHERE id=$1`, c.Param("id")).Scan(&companyID); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		if !requireCompanyMatch(c, companyID) {
			return
		}
		_, err := db.Exec(`UPDATE promotions SET status='cancelled', updated_at=NOW() WHERE id=$1`, c.Param("id"))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cancel"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// GetPromotionRevenue — GET /promotions/revenue  (админ): сколько собрано.
func GetPromotionRevenue(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var total, active float64
		var activeCount int
		db.QueryRow(`SELECT COALESCE(SUM(amount),0) FROM promotions WHERE status IN ('active','expired','cancelled')`).Scan(&total)
		db.QueryRow(`SELECT COALESCE(SUM(amount),0), COUNT(*) FROM promotions WHERE `+activePromoWhere).Scan(&active, &activeCount)
		c.JSON(http.StatusOK, gin.H{"totalRevenue": total, "activeRevenue": active, "activeCount": activeCount})
	}
}
