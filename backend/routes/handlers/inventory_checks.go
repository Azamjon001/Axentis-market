package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// 📊 История инвентаризаций — каждый акт ревизии сохраняется в базу.
// Продавец видит динамику недостач по месяцам и понимает, «куда деваются
// товары». Общий API для веб-панели и мобильного приложения.
// ============================================================================

func MigrateInventoryChecks(db *sql.DB) {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS inventory_checks (
			id BIGSERIAL PRIMARY KEY,
			company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
			scanned_count INT NOT NULL DEFAULT 0,
			match_count INT NOT NULL DEFAULT 0,
			shortage_count INT NOT NULL DEFAULT 0,
			surplus_count INT NOT NULL DEFAULT 0,
			shortage_value NUMERIC NOT NULL DEFAULT 0,
			items JSONB DEFAULT '[]',
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_inventory_checks_company ON inventory_checks(company_id)`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			log.Printf("⚠️ MigrateInventoryChecks: %v", err)
		}
	}
}

// CreateInventoryCheck — POST /inventory-checks (сохранение акта ревизии)
func CreateInventoryCheck(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			CompanyID     int64           `json:"companyId"`
			ScannedCount  int             `json:"scannedCount"`
			MatchCount    int             `json:"matchCount"`
			ShortageCount int             `json:"shortageCount"`
			SurplusCount  int             `json:"surplusCount"`
			ShortageValue float64         `json:"shortageValue"`
			Items         json.RawMessage `json:"items"` // [{name, expected, actual}]
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if !requireCompanyMatch(c, req.CompanyID) {
			return
		}
		items := req.Items
		if len(items) == 0 {
			items = json.RawMessage("[]")
		}
		var id int64
		err := db.QueryRow(`
			INSERT INTO inventory_checks (company_id, scanned_count, match_count, shortage_count, surplus_count, shortage_value, items)
			VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
		`, req.CompanyID, req.ScannedCount, req.MatchCount, req.ShortageCount, req.SurplusCount, req.ShortageValue, items).Scan(&id)
		if err != nil {
			log.Printf("⚠️ CreateInventoryCheck: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save inventory check"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "id": id})
	}
}

// ListInventoryChecks — GET /inventory-checks?companyId= (история актов)
func ListInventoryChecks(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID, err := strconv.ParseInt(c.Query("companyId"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "companyId is required"})
			return
		}
		if !requireCompanyMatch(c, companyID) {
			return
		}
		rows, err := db.Query(`
			SELECT id, scanned_count, match_count, shortage_count, surplus_count, shortage_value, created_at
			FROM inventory_checks WHERE company_id = $1
			ORDER BY created_at DESC LIMIT 100
		`, companyID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load history"})
			return
		}
		defer rows.Close()
		result := []gin.H{}
		for rows.Next() {
			var id int64
			var scanned, match, shortage, surplus int
			var shortageValue float64
			var createdAt time.Time
			if rows.Scan(&id, &scanned, &match, &shortage, &surplus, &shortageValue, &createdAt) == nil {
				result = append(result, gin.H{
					"id": id, "scannedCount": scanned, "matchCount": match,
					"shortageCount": shortage, "surplusCount": surplus,
					"shortageValue": shortageValue,
					"createdAt":     createdAt.Format(time.RFC3339),
				})
			}
		}
		c.JSON(http.StatusOK, result)
	}
}
