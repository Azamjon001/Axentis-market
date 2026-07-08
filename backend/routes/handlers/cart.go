package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// CartItem - структура товара в корзине
type CartItem struct {
	ID            int       `json:"id"`
	UserPhone     string    `json:"user_phone"`
	ProductID     int64     `json:"product_id"`
	CompanyID     int64     `json:"company_id"`
	Quantity      int       `json:"quantity"`
	SelectedColor string    `json:"selected_color,omitempty"`
	SelectedSize  string    `json:"selected_size,omitempty"`
	StockQuantity int       `json:"stock_quantity,omitempty"`
	AddedAt       time.Time `json:"added_at"`
	UpdatedAt     time.Time `json:"updated_at"`

	// Дополнительная информация о товаре (для удобства фронтенда)
	ProductName      string   `json:"product_name,omitempty"`
	ProductPrice     float64  `json:"product_price,omitempty"`
	ProductBasePrice float64  `json:"product_base_price,omitempty"`
	MarkupPercent    float64  `json:"markup_percent,omitempty"`
	ProductImages    []string `json:"product_images,omitempty"`
}

// GetUserCart - получить корзину пользователя
func GetUserCart(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		phone := c.Param("phone")
		if phone == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Phone is required"})
			return
		}

		rows, err := db.Query(`
			SELECT
				ci.id, ci.user_phone, ci.product_id, ci.quantity,
				COALESCE(ci.selected_color, '') as selected_color,
				COALESCE(ci.selected_size, '') as selected_size,
				ci.added_at, ci.updated_at,
				p.name,
				-- base_price: purchase/cost price
				COALESCE(
					(SELECT pv.price FROM product_variants pv
					 WHERE pv.product_id = ci.product_id
					   AND (ci.selected_color = '' OR pv.color = ci.selected_color)
					   AND (ci.selected_size  = '' OR pv.size  = ci.selected_size)
					 ORDER BY pv.id LIMIT 1),
					p.price
				) as base_price,
				-- product_price: selling price with markup
				COALESCE(
					(SELECT pv.selling_price FROM product_variants pv
					 WHERE pv.product_id = ci.product_id
					   AND (ci.selected_color = '' OR pv.color = ci.selected_color)
					   AND (ci.selected_size  = '' OR pv.size  = ci.selected_size)
					   AND pv.selling_price > 0
					 ORDER BY pv.id LIMIT 1),
					NULLIF(p.selling_price, 0),
					p.price * (1.0 + COALESCE(p.markup_percent, 0) / 100.0)
				) as product_price,
				COALESCE(p.images::text, '[]') as images,
				p.company_id,
				p.markup_percent,
				-- stock_quantity: variant stock or product-level quantity
				COALESCE(
					(SELECT pv.stock_quantity FROM product_variants pv
					 WHERE pv.product_id = ci.product_id
					   AND (ci.selected_color = '' OR pv.color = ci.selected_color)
					   AND (ci.selected_size  = '' OR pv.size  = ci.selected_size)
					 ORDER BY pv.id LIMIT 1),
					p.quantity
				) as stock_quantity
			FROM cart_items ci
			JOIN products p ON ci.product_id = p.id
			WHERE ci.user_phone = $1
			ORDER BY ci.added_at DESC
		`, phone)

		if err != nil {
			log.Printf("❌ Error fetching cart: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch cart"})
			return
		}
		defer rows.Close()

		items := make([]CartItem, 0)
		for rows.Next() {
			var item CartItem
			var imagesJSON string
			err := rows.Scan(
				&item.ID, &item.UserPhone, &item.ProductID, &item.Quantity,
				&item.SelectedColor, &item.SelectedSize,
				&item.AddedAt, &item.UpdatedAt,
				&item.ProductName, &item.ProductBasePrice, &item.ProductPrice, &imagesJSON,
				&item.CompanyID, &item.MarkupPercent, &item.StockQuantity,
			)
			if err != nil {
				continue
			}
			// Парсим JSON массив изображений товара.
			// В БД images хранятся либо как массив строк ["/uploads/.."],
			// либо как массив объектов [{"url":"/uploads/.."}]. Поддерживаем оба.
			item.ProductImages = parseProductImages(imagesJSON)
			items = append(items, item)
		}

		log.Printf("🛒 Cart loaded for %s: %d items", phone, len(items))
		c.JSON(http.StatusOK, items)
	}
}

// AddToCart - добавить товар в корзину
func AddToCart(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input struct {
			UserPhone     string `json:"user_phone"`
			ProductID     int64  `json:"product_id"`
			Quantity      int    `json:"quantity"`
			SelectedColor string `json:"selected_color"`
			SelectedSize  string `json:"selected_size"`
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
		if input.Quantity <= 0 {
			input.Quantity = 1
		}

		// Проверяем существование товара
		var productExists bool
		err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM products WHERE id = $1)", input.ProductID).Scan(&productExists)
		if err != nil || !productExists {
			c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
			return
		}

		colorVal := input.SelectedColor
		sizeVal := input.SelectedSize

		// Check available stock for this variant
		var availableStock int
		stockErr := db.QueryRow(`
			SELECT COALESCE(
				(SELECT pv.stock_quantity FROM product_variants pv
				 WHERE pv.product_id = $1
				   AND ($2 = '' OR pv.color = $2)
				   AND ($3 = '' OR pv.size  = $3)
				 ORDER BY pv.id LIMIT 1),
				(SELECT quantity FROM products WHERE id = $1)
			)
		`, input.ProductID, colorVal, sizeVal).Scan(&availableStock)
		if stockErr == nil && availableStock >= 0 {
			// Find how many already in cart for this variant
			var inCartQty int
			db.QueryRow(`
				SELECT COALESCE(SUM(quantity), 0) FROM cart_items
				WHERE user_phone = $1 AND product_id = $2
				AND COALESCE(selected_color, '') = $3
				AND COALESCE(selected_size, '') = $4
			`, input.UserPhone, input.ProductID, colorVal, sizeVal).Scan(&inCartQty)
			if inCartQty+input.Quantity > availableStock {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Недостаточно товара на складе", "available": availableStock - inCartQty})
				return
			}
		}

		// Проверяем — есть ли уже такой товар в корзине
		var existingID int
		checkErr := db.QueryRow(`
			SELECT id FROM cart_items
			WHERE user_phone = $1 AND product_id = $2
			AND COALESCE(selected_color, '') = $3
			AND COALESCE(selected_size, '') = $4
		`, input.UserPhone, input.ProductID, colorVal, sizeVal).Scan(&existingID)

		var itemID int
		if checkErr == sql.ErrNoRows {
			// Вставляем новый товар
			err = db.QueryRow(`
				INSERT INTO cart_items (user_phone, product_id, quantity, selected_color, selected_size)
				VALUES ($1, $2, $3, $4, $5)
				RETURNING id
			`, input.UserPhone, input.ProductID, input.Quantity, colorVal, sizeVal).Scan(&itemID)
		} else if checkErr == nil {
			// Обновляем количество существующего
			err = db.QueryRow(`
				UPDATE cart_items SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP
				WHERE id = $2 RETURNING id
			`, input.Quantity, existingID).Scan(&itemID)
		} else {
			err = checkErr
		}

		if err != nil {
			log.Printf("❌ Error adding to cart: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add to cart"})
			return
		}

		log.Printf("✅ Added to cart: user=%s, product=%d, qty=%d", input.UserPhone, input.ProductID, input.Quantity)
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"id":      itemID,
			"message": "Added to cart successfully",
		})
	}
}

// UpdateCartItem - обновить количество товара в корзине
func UpdateCartItem(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		itemID := c.Param("id")

		var input struct {
			Quantity int `json:"quantity"`
		}

		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data"})
			return
		}

		if input.Quantity <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Quantity must be greater than 0"})
			return
		}

		if !requireCartItemOwner(c, db, itemID) {
			return
		}

		result, err := db.Exec(`
			UPDATE cart_items
			SET quantity = $1, updated_at = CURRENT_TIMESTAMP
			WHERE id = $2
		`, input.Quantity, itemID)

		if err != nil {
			log.Printf("❌ Error updating cart item: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update cart item"})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Cart item not found"})
			return
		}

		log.Printf("✅ Updated cart item %s: quantity=%d", itemID, input.Quantity)
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// RemoveFromCart - удалить товар из корзины
func RemoveFromCart(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		itemID := c.Param("id")

		if !requireCartItemOwner(c, db, itemID) {
			return
		}

		result, err := db.Exec("DELETE FROM cart_items WHERE id = $1", itemID)
		if err != nil {
			log.Printf("❌ Error removing from cart: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove from cart"})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Cart item not found"})
			return
		}

		log.Printf("✅ Removed cart item %s", itemID)
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// SetCartItemQuantity - установить точное количество товара (upsert). Если quantity=0 — удаляет.
// Тело: { user_phone, product_id, quantity, selected_color?, selected_size? }
func SetCartItemQuantity(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input struct {
			UserPhone     string `json:"user_phone"`
			ProductID     int64  `json:"product_id"`
			Quantity      int    `json:"quantity"`
			SelectedColor string `json:"selected_color"`
			SelectedSize  string `json:"selected_size"`
		}
		if err := c.ShouldBindJSON(&input); err != nil || input.UserPhone == "" || input.ProductID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "user_phone, product_id and quantity are required"})
			return
		}
		if !requirePhoneMatch(c, input.UserPhone) {
			return
		}

		color := input.SelectedColor
		size := input.SelectedSize
		if color == "Любой" || color == "любой" {
			color = ""
		}

		if input.Quantity <= 0 {
			// quantity=0 → удаляем конкретный вариант (или все, если color/size пустые)
			var err error
			if color != "" || size != "" {
				_, err = db.Exec(
					"DELETE FROM cart_items WHERE user_phone = $1 AND product_id = $2 AND selected_color = $3 AND selected_size = $4",
					input.UserPhone, input.ProductID, color, size,
				)
			} else {
				_, err = db.Exec(
					"DELETE FROM cart_items WHERE user_phone = $1 AND product_id = $2",
					input.UserPhone, input.ProductID,
				)
			}
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove cart item"})
				return
			}
			log.Printf("✅ SetCartItemQty=0 (DELETE) user=%s product=%d color=%s size=%s", input.UserPhone, input.ProductID, color, size)
			c.JSON(http.StatusOK, gin.H{"success": true, "action": "deleted"})
			return
		}

		// Validate against available stock
		var availableStock int
		stockErr := db.QueryRow(`
			SELECT COALESCE(
				(SELECT pv.stock_quantity FROM product_variants pv
				 WHERE pv.product_id = $1
				   AND ($2 = '' OR pv.color = $2)
				   AND ($3 = '' OR pv.size  = $3)
				 ORDER BY pv.id LIMIT 1),
				(SELECT quantity FROM products WHERE id = $1)
			)
		`, input.ProductID, color, size).Scan(&availableStock)
		if stockErr == nil && availableStock >= 0 && input.Quantity > availableStock {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Недостаточно товара на складе", "available": availableStock})
			return
		}

		// Upsert с учётом UNIQUE(user_phone, product_id, selected_color, selected_size)
		_, err := db.Exec(`
			INSERT INTO cart_items (user_phone, product_id, quantity, selected_color, selected_size)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (user_phone, product_id, selected_color, selected_size)
			DO UPDATE SET quantity = $3, updated_at = CURRENT_TIMESTAMP
		`, input.UserPhone, input.ProductID, input.Quantity, color, size)

		if err != nil {
			log.Printf("❌ SetCartItemQty error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to set cart item quantity"})
			return
		}

		log.Printf("✅ SetCartItemQty user=%s product=%d qty=%d color=%s size=%s", input.UserPhone, input.ProductID, input.Quantity, color, size)
		c.JSON(http.StatusOK, gin.H{"success": true, "action": "upserted", "quantity": input.Quantity})
	}
}

// RemoveCartItemByProduct - удалить товар из корзины по user_phone + product_id (без необходимости знать DB row id)
func RemoveCartItemByProduct(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input struct {
			UserPhone string `json:"user_phone"`
			ProductID int64  `json:"product_id"`
		}
		if err := c.ShouldBindJSON(&input); err != nil || input.UserPhone == "" || input.ProductID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "user_phone and product_id are required"})
			return
		}
		if !requirePhoneMatch(c, input.UserPhone) {
			return
		}

		result, err := db.Exec(
			"DELETE FROM cart_items WHERE user_phone = $1 AND product_id = $2",
			input.UserPhone, input.ProductID,
		)
		if err != nil {
			log.Printf("❌ Error removing cart item by product: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove cart item"})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		log.Printf("✅ Removed cart item for %s product %d (%d rows)", input.UserPhone, input.ProductID, rowsAffected)
		c.JSON(http.StatusOK, gin.H{"success": true, "removed": rowsAffected})
	}
}

// ClearCart - очистить всю корзину пользователя
func ClearCart(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		phone := c.Param("phone")
		if phone == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Phone is required"})
			return
		}

		result, err := db.Exec("DELETE FROM cart_items WHERE user_phone = $1", phone)
		if err != nil {
			log.Printf("❌ Error clearing cart: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clear cart"})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		log.Printf("🗑️ Cleared cart for %s: %d items removed", phone, rowsAffected)
		c.JSON(http.StatusOK, gin.H{
			"success":      true,
			"items_removed": rowsAffected,
		})
	}
}

// GetCartCount - получить количество товаров в корзине
func GetCartCount(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		phone := c.Param("phone")
		if phone == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Phone is required"})
			return
		}

		var count int
		err := db.QueryRow(`
			SELECT COALESCE(SUM(quantity), 0) 
			FROM cart_items 
			WHERE user_phone = $1
		`, phone).Scan(&count)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get cart count"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"count": count})
	}
}

// parseProductImages разбирает JSON-поле images товара в массив URL строк.
// Поддерживает два формата хранения: ["url", ...] и [{"url": "..."}, ...].
func parseProductImages(imagesJSON string) []string {
	result := []string{}
	if imagesJSON == "" || imagesJSON == "[]" || imagesJSON == "null" {
		return result
	}
	// 1) Пробуем как массив строк
	var asStrings []string
	if err := json.Unmarshal([]byte(imagesJSON), &asStrings); err == nil {
		for _, s := range asStrings {
			if s != "" {
				result = append(result, s)
			}
		}
		return result
	}
	// 2) Пробуем как массив объектов { url }
	var asObjects []struct {
		URL string `json:"url"`
	}
	if err := json.Unmarshal([]byte(imagesJSON), &asObjects); err == nil {
		for _, o := range asObjects {
			if o.URL != "" {
				result = append(result, o.URL)
			}
		}
	}
	return result
}
