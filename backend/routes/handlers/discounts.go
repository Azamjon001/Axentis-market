package handlers

import (
	"azaton-backend/models"
	"database/sql"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// CreateDiscount - создание новой скидки компанией
func CreateDiscount(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var discount models.Discount
		if err := c.ShouldBindJSON(&discount); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Компания создаёт скидки только на свои товары от своего имени.
		if !isAdmin(c) {
			discount.CompanyID = ctxCompanyID(c)
		}

		// Валидация процента скидки
		if discount.DiscountPercent < 0 || discount.DiscountPercent > 100 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Процент скидки должен быть от 0 до 100"})
			return
		}

		// Проверка существования продукта
		var productExists bool
		err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM products WHERE id = $1 AND company_id = $2)", 
			discount.ProductID, discount.CompanyID).Scan(&productExists)
		if err != nil || !productExists {
			c.JSON(http.StatusNotFound, gin.H{"error": "Продукт не найден или не принадлежит вашей компании"})
			return
		}

		// Скидки создаются сразу одобренными (без модерации)
		discount.Status = "approved"
		discount.AdminReviewed = true
		discount.CreatedAt = time.Now()
		discount.UpdatedAt = time.Now()

		query := `
			INSERT INTO discounts (company_id, product_id, variant_id, discount_percent, title, description, status, admin_reviewed, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
			ON CONFLICT (company_id, product_id, COALESCE(variant_id, 0))
			DO UPDATE SET
				discount_percent = EXCLUDED.discount_percent,
				title = EXCLUDED.title,
				description = EXCLUDED.description,
				status = 'approved',
				admin_reviewed = TRUE,
				updated_at = EXCLUDED.updated_at
			RETURNING id
		`

		err = db.QueryRow(query,
			discount.CompanyID,
			discount.ProductID,
			discount.VariantID,
			discount.DiscountPercent,
			discount.Title,
			discount.Description,
			discount.Status,
			discount.AdminReviewed,
			discount.CreatedAt,
			discount.UpdatedAt,
		).Scan(&discount.ID)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, discount)
	}
}

// GetCompanyDiscounts - получение всех скидок компании
func GetCompanyDiscounts(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID, err := strconv.ParseInt(c.Param("companyId"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный ID компании"})
			return
		}

		query := `
			SELECT 
				d.id, d.company_id, d.product_id, d.discount_percent, d.title, d.description, 
				d.status, d.admin_reviewed, d.created_at, d.updated_at,
				p.name as product_name, p.images as product_images, p.selling_price as product_price,
				p.price as product_base_price, p.markup_percent,
				c.name as company_name, c.logo_url as company_logo
			FROM discounts d
			JOIN products p ON d.product_id = p.id
			JOIN companies c ON d.company_id = c.id
			WHERE d.company_id = $1
			ORDER BY d.created_at DESC
		`

		rows, err := db.Query(query, companyID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		discounts := make([]models.DiscountWithDetails, 0)
		for rows.Next() {
			var d models.DiscountWithDetails
			err := rows.Scan(
				&d.ID, &d.CompanyID, &d.ProductID, &d.DiscountPercent, &d.Title, &d.Description,
				&d.Status, &d.AdminReviewed, &d.CreatedAt, &d.UpdatedAt,
				&d.ProductName, &d.ProductImages, &d.ProductPrice,
				&d.ProductBasePrice, &d.MarkupPercent,
				&d.CompanyName, &d.CompanyLogo,
			)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			discounts = append(discounts, d)
		}

		c.JSON(http.StatusOK, discounts)
	}
}

// GetAllDiscounts - получение всех скидок (для админа)
func GetAllDiscounts(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		status := c.Query("status") // pending, approved, rejected, all

		query := `
			SELECT 
				d.id, d.company_id, d.product_id, d.discount_percent, d.title, d.description, 
				d.status, d.admin_reviewed, d.created_at, d.updated_at,
				p.name as product_name, p.images as product_images, p.selling_price as product_price,
				p.price as product_base_price, p.markup_percent,
				c.name as company_name, c.logo_url as company_logo
			FROM discounts d
			JOIN products p ON d.product_id = p.id
			JOIN companies c ON d.company_id = c.id
		`

		if status != "" && status != "all" {
			query += " WHERE d.status = $1"
		}

		query += " ORDER BY d.created_at DESC"

		var rows *sql.Rows
		var err error

		if status != "" && status != "all" {
			rows, err = db.Query(query, status)
		} else {
			rows, err = db.Query(query)
		}

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		discounts := make([]models.DiscountWithDetails, 0)
		for rows.Next() {
			var d models.DiscountWithDetails
			err := rows.Scan(
				&d.ID, &d.CompanyID, &d.ProductID, &d.DiscountPercent, &d.Title, &d.Description,
				&d.Status, &d.AdminReviewed, &d.CreatedAt, &d.UpdatedAt,
				&d.ProductName, &d.ProductImages, &d.ProductPrice,
				&d.ProductBasePrice, &d.MarkupPercent,
				&d.CompanyName, &d.CompanyLogo,
			)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			discounts = append(discounts, d)
		}

		c.JSON(http.StatusOK, discounts)
	}
}

// GetApprovedDiscounts - получение одобренных скидок (для клиентов)
func GetApprovedDiscounts(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		query := `
			SELECT 
				d.id, d.company_id, d.product_id, d.discount_percent, d.title, d.description, 
				d.status, d.admin_reviewed, d.created_at, d.updated_at,
				p.name as product_name, p.images as product_images, p.selling_price as product_price,
				p.price as product_base_price, p.markup_percent,
				c.name as company_name, c.logo_url as company_logo
			FROM discounts d
			JOIN products p ON d.product_id = p.id
			JOIN companies c ON d.company_id = c.id
			WHERE d.status = 'approved' AND p.quantity > 0 AND p.available_for_customers = TRUE
			ORDER BY d.created_at DESC
		`

		rows, err := db.Query(query)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		discounts := make([]models.DiscountWithDetails, 0)
		for rows.Next() {
			var d models.DiscountWithDetails
			err := rows.Scan(
				&d.ID, &d.CompanyID, &d.ProductID, &d.DiscountPercent, &d.Title, &d.Description,
				&d.Status, &d.AdminReviewed, &d.CreatedAt, &d.UpdatedAt,
				&d.ProductName, &d.ProductImages, &d.ProductPrice,
				&d.ProductBasePrice, &d.MarkupPercent,
				&d.CompanyName, &d.CompanyLogo,
			)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			discounts = append(discounts, d)
		}

		c.JSON(http.StatusOK, discounts)
	}
}

// UpdateDiscountStatus - обновление статуса скидки (админ)
func UpdateDiscountStatus(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		discountID, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный ID скидки"})
			return
		}

		var payload struct {
			Status string `json:"status"` // approved, rejected
		}

		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if payload.Status != "approved" && payload.Status != "rejected" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Статус должен быть 'approved' или 'rejected'"})
			return
		}

		query := `
			UPDATE discounts 
			SET status = $1, admin_reviewed = TRUE, updated_at = $2
			WHERE id = $3
		`

		_, err = db.Exec(query, payload.Status, time.Now(), discountID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Статус обновлен"})
	}
}

// DeleteDiscount - удаление скидки
func DeleteDiscount(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		discountID, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный ID скидки"})
			return
		}

		// Удалять скидку может только её компания (или админ).
		var ownerID int64
		if err := db.QueryRow("SELECT company_id FROM discounts WHERE id = $1", discountID).Scan(&ownerID); err == nil {
			if !requireCompanyMatch(c, ownerID) {
				return
			}
		}

		_, err = db.Exec("DELETE FROM discounts WHERE id = $1", discountID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Скидка удалена"})
	}
}
