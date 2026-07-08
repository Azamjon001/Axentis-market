package handlers

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// 🚩 Жалобы: покупатель создаёт (публично), админ разбирает.

// CreateComplaint — POST /complaints (покупатель)
func CreateComplaint(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			TargetType    string `json:"targetType"` // 'product' | 'company'
			TargetID      int64  `json:"targetId"`
			CustomerPhone string `json:"customerPhone"`
			Reason        string `json:"reason"`
			Message       string `json:"message"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if (req.TargetType != "product" && req.TargetType != "company") || req.TargetID == 0 || req.Reason == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "targetType, targetId and reason are required"})
			return
		}
		// Определяем магазин жалобы для удобства админа.
		var companyID sql.NullInt64
		if req.TargetType == "product" {
			db.QueryRow(`SELECT company_id FROM products WHERE id = $1`, req.TargetID).Scan(&companyID)
		} else {
			companyID = sql.NullInt64{Int64: req.TargetID, Valid: true}
		}

		var id int64
		err := db.QueryRow(`
			INSERT INTO complaints (target_type, target_id, company_id, customer_phone, reason, message, status)
			VALUES ($1, $2, $3, $4, $5, $6, 'open')
			RETURNING id
		`, req.TargetType, req.TargetID, companyID, req.CustomerPhone, req.Reason, req.Message).Scan(&id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create complaint"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "id": id})
	}
}

// GetComplaints — GET /complaints?status=open (админ)
func GetComplaints(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		status := c.Query("status")
		q := `
			SELECT cm.id, cm.target_type, cm.target_id, cm.company_id, cm.customer_phone,
			       cm.reason, COALESCE(cm.message,''), cm.status, COALESCE(cm.admin_note,''),
			       cm.created_at, cm.resolved_at,
			       COALESCE(co.name,''), COALESCE(p.name,'')
			FROM complaints cm
			LEFT JOIN companies co ON co.id = cm.company_id
			LEFT JOIN products p ON p.id = cm.target_id AND cm.target_type = 'product'`
		args := []interface{}{}
		if status != "" {
			q += ` WHERE cm.status = $1`
			args = append(args, status)
		}
		q += ` ORDER BY cm.created_at DESC LIMIT 500`
		rows, err := db.Query(q, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch"})
			return
		}
		defer rows.Close()

		list := make([]gin.H, 0)
		for rows.Next() {
			var (
				id, targetID          int64
				companyID             sql.NullInt64
				targetType, reason    string
				phone, message        string
				status, adminNote     string
				createdAt             time.Time
				resolvedAt            sql.NullTime
				companyName, prodName string
			)
			if err := rows.Scan(&id, &targetType, &targetID, &companyID, &phone,
				&reason, &message, &status, &adminNote, &createdAt, &resolvedAt,
				&companyName, &prodName); err != nil {
				continue
			}
			item := gin.H{
				"id": id, "targetType": targetType, "targetId": targetID,
				"customerPhone": phone, "reason": reason, "message": message,
				"status": status, "adminNote": adminNote, "createdAt": createdAt,
				"companyName": companyName, "productName": prodName,
			}
			if companyID.Valid {
				item["companyId"] = companyID.Int64
			}
			list = append(list, item)
		}
		c.JSON(http.StatusOK, list)
	}
}

// ResolveComplaint — PUT /complaints/:id/resolve (админ). Body: { status, note }
func ResolveComplaint(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Status string `json:"status"` // 'resolved' | 'dismissed'
			Note   string `json:"note"`
		}
		_ = c.ShouldBindJSON(&req)
		if req.Status != "resolved" && req.Status != "dismissed" {
			req.Status = "resolved"
		}
		res, err := db.Exec(`
			UPDATE complaints SET status = $1, admin_note = NULLIF($2,''), resolved_at = NOW()
			WHERE id = $3 AND status = 'open'
		`, req.Status, req.Note, c.Param("id"))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update"})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Not found or already resolved"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "status": req.Status})
	}
}
