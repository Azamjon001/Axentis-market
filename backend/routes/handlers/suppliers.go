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

// ============================================================================
// 🚚 Поставщики — справочник для «автозаказа поставщику».
//
// Компания ведёт список поставщиков (имя + телефон/Telegram) и привязывает
// к ним товары. «Умный план закупки» группирует рекомендации по поставщикам,
// и каждому можно отправить готовый заказ одной кнопкой.
// Привязка хранится в products.supplier_id, но управляется ТОЛЬКО через
// endpoints этого модуля — существующие обработчики товаров не тронуты.
// ============================================================================

func MigrateSuppliers(db *sql.DB) {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS company_suppliers (
			id BIGSERIAL PRIMARY KEY,
			company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			phone TEXT DEFAULT '',
			telegram TEXT DEFAULT '',
			note TEXT DEFAULT '',
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_company_suppliers_company ON company_suppliers(company_id)`,
		`ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_id BIGINT`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			log.Printf("⚠️ MigrateSuppliers: %v", err)
		}
	}
}

// ListSuppliers — GET /suppliers?companyId=
func ListSuppliers(db *sql.DB) gin.HandlerFunc {
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
			SELECT id, name, phone, telegram, note, created_at
			FROM company_suppliers WHERE company_id = $1 ORDER BY name
		`, companyID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load suppliers"})
			return
		}
		defer rows.Close()
		result := []gin.H{}
		for rows.Next() {
			var id int64
			var name, phone, telegram, note string
			var createdAt time.Time
			if rows.Scan(&id, &name, &phone, &telegram, &note, &createdAt) == nil {
				result = append(result, gin.H{
					"id": id, "name": name, "phone": phone, "telegram": telegram,
					"note": note, "createdAt": createdAt.Format(time.RFC3339),
				})
			}
		}
		c.JSON(http.StatusOK, result)
	}
}

// CreateSupplier — POST /suppliers
func CreateSupplier(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			CompanyID int64  `json:"companyId"`
			Name      string `json:"name"`
			Phone     string `json:"phone"`
			Telegram  string `json:"telegram"`
			Note      string `json:"note"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if !requireCompanyMatch(c, req.CompanyID) {
			return
		}
		if strings.TrimSpace(req.Name) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
			return
		}
		var id int64
		err := db.QueryRow(`
			INSERT INTO company_suppliers (company_id, name, phone, telegram, note)
			VALUES ($1, $2, $3, $4, $5) RETURNING id
		`, req.CompanyID, strings.TrimSpace(req.Name), strings.TrimSpace(req.Phone),
			strings.TrimPrefix(strings.TrimSpace(req.Telegram), "@"), strings.TrimSpace(req.Note)).Scan(&id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create supplier"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "id": id})
	}
}

// DeleteSupplier — DELETE /suppliers/:id (отвязывает его товары)
func DeleteSupplier(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		supplierID := c.Param("id")
		var companyID int64
		if err := db.QueryRow(`SELECT company_id FROM company_suppliers WHERE id = $1`, supplierID).Scan(&companyID); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Supplier not found"})
			return
		}
		if !requireCompanyMatch(c, companyID) {
			return
		}
		db.Exec(`UPDATE products SET supplier_id = NULL WHERE supplier_id = $1`, supplierID)
		if _, err := db.Exec(`DELETE FROM company_suppliers WHERE id = $1`, supplierID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete supplier"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// AssignSupplier — PUT /suppliers/assign { companyId, productId, supplierId|null }
func AssignSupplier(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			CompanyID  int64  `json:"companyId"`
			ProductID  int64  `json:"productId"`
			SupplierID *int64 `json:"supplierId"` // null = отвязать
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if !requireCompanyMatch(c, req.CompanyID) {
			return
		}
		// Товар должен принадлежать компании; поставщик (если задан) — тоже
		var ok bool
		db.QueryRow(`SELECT TRUE FROM products WHERE id = $1 AND company_id = $2`, req.ProductID, req.CompanyID).Scan(&ok)
		if !ok {
			c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
			return
		}
		if req.SupplierID != nil {
			ok = false
			db.QueryRow(`SELECT TRUE FROM company_suppliers WHERE id = $1 AND company_id = $2`, *req.SupplierID, req.CompanyID).Scan(&ok)
			if !ok {
				c.JSON(http.StatusNotFound, gin.H{"error": "Supplier not found"})
				return
			}
		}
		if _, err := db.Exec(`UPDATE products SET supplier_id = $1 WHERE id = $2`, req.SupplierID, req.ProductID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to assign supplier"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// SupplierAssignments — GET /suppliers/assignments?companyId= → [{productId, supplierId}]
func SupplierAssignments(db *sql.DB) gin.HandlerFunc {
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
			SELECT id, supplier_id FROM products
			WHERE company_id = $1 AND supplier_id IS NOT NULL
		`, companyID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load assignments"})
			return
		}
		defer rows.Close()
		result := []gin.H{}
		for rows.Next() {
			var productID, supplierID int64
			if rows.Scan(&productID, &supplierID) == nil {
				result = append(result, gin.H{"productId": productID, "supplierId": supplierID})
			}
		}
		c.JSON(http.StatusOK, result)
	}
}
