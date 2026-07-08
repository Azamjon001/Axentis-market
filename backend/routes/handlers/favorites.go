package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

// GetUserFavorites - получить избранные товары пользователя (возвращает полные объекты Product)
func GetUserFavorites(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		phone := c.Param("phone")
		if phone == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Phone is required"})
			return
		}

		rows, err := db.Query(`
			SELECT p.id, p.company_id, p.name, p.quantity, p.price, p.markup_percent,
			       p.selling_price, p.markup_amount, p.barcode, p.barid, p.category, p.images,
			       p.description, p.color, p.size, p.brand, p.has_color_options,
			       p.available_for_customers, p.sold_count, p.created_at, p.updated_at,
			       c.name as company_name
			FROM user_favorites f
			JOIN products p ON f.product_id = p.id
			LEFT JOIN companies c ON p.company_id = c.id
			WHERE f.user_phone = $1
			ORDER BY f.added_at DESC
		`, phone)

		if err != nil {
			log.Printf("❌ Error fetching favorites: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch favorites"})
			return
		}
		defer rows.Close()

		products := make([]map[string]interface{}, 0)
		for rows.Next() {
			var p struct {
				ID                    int64
				CompanyID             int64
				Name                  string
				Quantity              int
				Price                 float64
				MarkupPercent         sql.NullFloat64
				SellingPrice          sql.NullFloat64
				MarkupAmount          sql.NullFloat64
				Barcode               sql.NullString
				Barid                 sql.NullString
				Category              sql.NullString
				Images                sql.NullString
				Description           sql.NullString
				Color                 sql.NullString
				Size                  sql.NullString
				Brand                 sql.NullString
				HasColorOptions       sql.NullBool
				AvailableForCustomers sql.NullBool
				SoldCount             sql.NullInt64
				CreatedAt             string
				UpdatedAt             string
				CompanyName           sql.NullString
			}
			err := rows.Scan(
				&p.ID, &p.CompanyID, &p.Name, &p.Quantity, &p.Price,
				&p.MarkupPercent, &p.SellingPrice, &p.MarkupAmount,
				&p.Barcode, &p.Barid, &p.Category, &p.Images,
				&p.Description, &p.Color, &p.Size, &p.Brand,
				&p.HasColorOptions, &p.AvailableForCustomers,
				&p.SoldCount, &p.CreatedAt, &p.UpdatedAt, &p.CompanyName,
			)
			if err != nil {
				log.Printf("⚠️ Scan error in GetUserFavorites: %v", err)
				continue
			}

			product := map[string]interface{}{
				"id":        p.ID,
				"companyId": p.CompanyID,
				"name":      p.Name,
				"quantity":  p.Quantity,
				"price":     p.Price,
			}
			if p.CompanyName.Valid {
				product["companyName"] = p.CompanyName.String
			}
			if p.MarkupPercent.Valid {
				product["markupPercent"] = p.MarkupPercent.Float64
			} else {
				product["markupPercent"] = 0
			}
			if p.SellingPrice.Valid {
				product["sellingPrice"] = p.SellingPrice.Float64
			} else {
				product["sellingPrice"] = p.Price
			}
			if p.MarkupAmount.Valid {
				product["markupAmount"] = p.MarkupAmount.Float64
			} else {
				product["markupAmount"] = 0
			}
			if p.Barcode.Valid {
				product["barcode"] = p.Barcode.String
			}
			if p.Barid.Valid {
				product["barid"] = p.Barid.String
			}
			if p.Category.Valid {
				product["category"] = p.Category.String
			}
			if p.Description.Valid {
				product["description"] = p.Description.String
			}
			if p.Color.Valid {
				product["color"] = p.Color.String
			}
			if p.Size.Valid {
				product["size"] = p.Size.String
			}
			if p.Brand.Valid {
				product["brand"] = p.Brand.String
			}
			product["hasColorOptions"] = p.HasColorOptions.Bool
			product["availableForCustomers"] = p.AvailableForCustomers.Bool
			if p.SoldCount.Valid {
				product["soldCount"] = p.SoldCount.Int64
			} else {
				product["soldCount"] = 0
			}
			if p.Images.Valid && p.Images.String != "" {
				var images []string
				if err := json.Unmarshal([]byte(p.Images.String), &images); err != nil {
					product["images"] = []string{}
				} else {
					product["images"] = images
				}
			} else {
				product["images"] = []string{}
			}
			products = append(products, product)
		}

		log.Printf("❤️ Favorites loaded for %s: %d items", phone, len(products))
		c.JSON(http.StatusOK, products)
	}
}

// AddToFavorites - добавить товар в избранное
func AddToFavorites(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input struct {
			UserPhone string `json:"user_phone"`
			ProductID int64  `json:"product_id"`
		}

		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data"})
			return
		}

		// Валидация
		if input.UserPhone == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "User phone is required"})
			return
		}
		if !requirePhoneMatch(c, input.UserPhone) {
			return
		}
		if input.ProductID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Product ID is required"})
			return
		}

		// Проверяем существование товара
		var productExists bool
		err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM products WHERE id = $1)", input.ProductID).Scan(&productExists)
		if err != nil || !productExists {
			c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
			return
		}

		// Добавляем в избранное (игнорируем если уже есть)
		var itemID int
		err = db.QueryRow(`
			INSERT INTO user_favorites (user_phone, product_id)
			VALUES ($1, $2)
			ON CONFLICT (user_phone, product_id) DO NOTHING
			RETURNING id
		`, input.UserPhone, input.ProductID).Scan(&itemID)

		if err != nil {
			// Если товар уже в избранном, возвращаем успех
			if err == sql.ErrNoRows {
				c.JSON(http.StatusOK, gin.H{
					"success": true,
					"message": "Already in favorites",
				})
				return
			}
			log.Printf("❌ Error adding to favorites: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add to favorites"})
			return
		}

		log.Printf("✅ Added to favorites: user=%s, product=%d", input.UserPhone, input.ProductID)
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"id":      itemID,
			"message": "Added to favorites successfully",
		})
	}
}

// RemoveFromFavorites - удалить товар из избранного
func RemoveFromFavorites(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input struct {
			UserPhone string `json:"user_phone"`
			ProductID int64  `json:"product_id"`
		}

		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data"})
			return
		}

		if input.UserPhone == "" || input.ProductID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "User phone and product ID are required"})
			return
		}
		if !requirePhoneMatch(c, input.UserPhone) {
			return
		}

		result, err := db.Exec(`
			DELETE FROM user_favorites
			WHERE user_phone = $1 AND product_id = $2
		`, input.UserPhone, input.ProductID)

		if err != nil {
			log.Printf("❌ Error removing from favorites: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove from favorites"})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Favorite not found"})
			return
		}

		log.Printf("✅ Removed from favorites: user=%s, product=%d", input.UserPhone, input.ProductID)
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// ToggleFavorite - переключить статус товара в избранном
func ToggleFavorite(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input struct {
			UserPhone string `json:"user_phone"`
			ProductID int64  `json:"product_id"`
		}

		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data"})
			return
		}

		if input.UserPhone == "" || input.ProductID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "User phone and product ID are required"})
			return
		}
		if !requirePhoneMatch(c, input.UserPhone) {
			return
		}

		// Проверяем существует ли в избранном
		var exists bool
		err := db.QueryRow(`
			SELECT EXISTS(
				SELECT 1 FROM user_favorites 
				WHERE user_phone = $1 AND product_id = $2
			)
		`, input.UserPhone, input.ProductID).Scan(&exists)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check favorite status"})
			return
		}

		if exists {
			// Удаляем из избранного
			_, err = db.Exec(`
				DELETE FROM user_favorites 
				WHERE user_phone = $1 AND product_id = $2
			`, input.UserPhone, input.ProductID)
			
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove from favorites"})
				return
			}

			log.Printf("❤️‍🩹 Removed from favorites: user=%s, product=%d", input.UserPhone, input.ProductID)
			c.JSON(http.StatusOK, gin.H{
				"success":    true,
				"is_favorite": false,
				"message":    "Removed from favorites",
			})
		} else {
			// Добавляем в избранное
			_, err = db.Exec(`
				INSERT INTO user_favorites (user_phone, product_id)
				VALUES ($1, $2)
			`, input.UserPhone, input.ProductID)
			
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add to favorites"})
				return
			}

			log.Printf("❤️ Added to favorites: user=%s, product=%d", input.UserPhone, input.ProductID)
			c.JSON(http.StatusOK, gin.H{
				"success":    true,
				"is_favorite": true,
				"message":    "Added to favorites",
			})
		}
	}
}

// CheckFavoriteStatus - проверить статус товара в избранном
func CheckFavoriteStatus(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		phone := c.Query("phone")
		productID := c.Query("product_id")

		if phone == "" || productID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Phone and product_id are required"})
			return
		}

		var isFavorite bool
		err := db.QueryRow(`
			SELECT EXISTS(
				SELECT 1 FROM user_favorites 
				WHERE user_phone = $1 AND product_id = $2
			)
		`, phone, productID).Scan(&isFavorite)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check favorite status"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"is_favorite": isFavorite})
	}
}

// GetFavoritesCount - получить количество избранных товаров
func GetFavoritesCount(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		phone := c.Param("phone")
		if phone == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Phone is required"})
			return
		}

		var count int
		err := db.QueryRow(`
			SELECT COUNT(*) 
			FROM user_favorites 
			WHERE user_phone = $1
		`, phone).Scan(&count)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get favorites count"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"count": count})
	}
}

// ClearFavorites - очистить все избранные товары пользователя
func ClearFavorites(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		phone := c.Param("phone")
		if phone == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Phone is required"})
			return
		}

		result, err := db.Exec("DELETE FROM user_favorites WHERE user_phone = $1", phone)
		if err != nil {
			log.Printf("❌ Error clearing favorites: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clear favorites"})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		log.Printf("🗑️ Cleared favorites for %s: %d items removed", phone, rowsAffected)
		c.JSON(http.StatusOK, gin.H{
			"success":      true,
			"items_removed": rowsAffected,
		})
	}
}
