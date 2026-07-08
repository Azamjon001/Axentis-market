package handlers

import (
	"azaton-backend/models"
	"database/sql"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// CreateAggressiveDiscount - создание агрессивной скидки компанией
func CreateAggressiveDiscount(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var discount models.AggressiveDiscount
		if err := c.ShouldBindJSON(&discount); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Компания создаёт скидки только от своего имени.
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

		// Агрессивные скидки создаются сразу одобренными (без модерации)
		discount.Status = "approved"
		discount.AdminReviewed = true
		discount.CreatedAt = time.Now()
		discount.UpdatedAt = time.Now()

		query := `
			INSERT INTO aggressive_discounts (company_id, product_id, variant_id, discount_percent, title, description, status, admin_reviewed, start_date, end_date, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
			ON CONFLICT (company_id, product_id, COALESCE(variant_id, 0))
			DO UPDATE SET
				discount_percent = EXCLUDED.discount_percent,
				title = EXCLUDED.title,
				description = EXCLUDED.description,
				status = 'approved',
				admin_reviewed = TRUE,
				start_date = EXCLUDED.start_date,
				end_date = EXCLUDED.end_date,
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
			discount.StartDate,
			discount.EndDate,
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

// GetCompanyAggressiveDiscounts - получение всех агрессивных скидок компании
func GetCompanyAggressiveDiscounts(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID, err := strconv.ParseInt(c.Param("companyId"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный ID компании"})
			return
		}

		query := `
			SELECT 
				d.id, d.company_id, d.product_id, d.discount_percent, d.title, d.description, 
				d.status, d.admin_reviewed, d.start_date, d.end_date, d.created_at, d.updated_at,
				p.name as product_name, p.images as product_images, p.selling_price as product_price,
				p.price as product_base_price, p.markup_percent,
				c.name as company_name, c.logo_url as company_logo
			FROM aggressive_discounts d
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

		discounts := make([]models.AggressiveDiscountWithDetails, 0)
		for rows.Next() {
			var d models.AggressiveDiscountWithDetails
			err := rows.Scan(
				&d.ID, &d.CompanyID, &d.ProductID, &d.DiscountPercent, &d.Title, &d.Description,
				&d.Status, &d.AdminReviewed, &d.StartDate, &d.EndDate, &d.CreatedAt, &d.UpdatedAt,
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

// GetApprovedAggressiveDiscounts - получение одобренных агрессивных скидок (для клиентов)
func GetApprovedAggressiveDiscounts(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		query := `
			SELECT 
				d.id, d.company_id, d.product_id, d.discount_percent, d.title, d.description, 
				d.status, d.admin_reviewed, d.start_date, d.end_date, d.created_at, d.updated_at,
				p.name as product_name, p.images as product_images, p.selling_price as product_price,
				p.price as product_base_price, p.markup_percent,
				c.name as company_name, c.logo_url as company_logo
			FROM aggressive_discounts d
			JOIN products p ON d.product_id = p.id
			JOIN companies c ON d.company_id = c.id
			WHERE d.status = 'approved'
			ORDER BY d.created_at DESC
		`

		rows, err := db.Query(query)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		discounts := make([]models.AggressiveDiscountWithDetails, 0)
		for rows.Next() {
			var d models.AggressiveDiscountWithDetails
			err := rows.Scan(
				&d.ID, &d.CompanyID, &d.ProductID, &d.DiscountPercent, &d.Title, &d.Description,
				&d.Status, &d.AdminReviewed, &d.StartDate, &d.EndDate, &d.CreatedAt, &d.UpdatedAt,
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

// DeleteAggressiveDiscount - удаление агрессивной скидки
func DeleteAggressiveDiscount(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		discountID, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный ID скидки"})
			return
		}

		result, err := db.Exec("DELETE FROM aggressive_discounts WHERE id = $1", discountID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Скидка не найдена"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Агрессивная скидка успешно удалена"})
	}
}

// GetProductAggressiveDiscount - получение агрессивной скидки для конкретного продукта
func GetProductAggressiveDiscount(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		productID, err := strconv.ParseInt(c.Param("productId"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный ID продукта"})
			return
		}

		query := `
			SELECT 
				d.id, d.company_id, d.product_id, d.discount_percent, d.title, d.description, 
				d.status, d.admin_reviewed, d.start_date, d.end_date, d.created_at, d.updated_at
			FROM aggressive_discounts d
			WHERE d.product_id = $1 AND d.status = 'approved'
		`

		var d models.AggressiveDiscount
		err = db.QueryRow(query, productID).Scan(
			&d.ID, &d.CompanyID, &d.ProductID, &d.DiscountPercent, &d.Title, &d.Description,
			&d.Status, &d.AdminReviewed, &d.StartDate, &d.EndDate, &d.CreatedAt, &d.UpdatedAt,
		)

		if err == sql.ErrNoRows {
			c.JSON(http.StatusOK, gin.H{"aggressive_discount": nil})
			return
		}

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"aggressive_discount": d})
	}
}
