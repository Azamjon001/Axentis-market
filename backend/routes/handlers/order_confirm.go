package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

// ConfirmOrder - переводит заказ в статус "В пути" и рассчитывает прибыль
// Вызывается из панели компании когда заказ передан доставщику
func ConfirmOrder(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		orderID := c.Param("id")

		log.Printf("📦 ConfirmOrder (ship) called for orderID=%s", orderID)

		var order struct {
			ID          int64
			CompanyID   int64
			Items       []byte
			TotalAmount float64
			Status      string
		}

		err := db.QueryRow(`
			SELECT id, company_id, items, total_amount, status
			FROM orders
			WHERE id = $1
		`, orderID).Scan(&order.ID, &order.CompanyID, &order.Items, &order.TotalAmount, &order.Status)

		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
			return
		}
		if err != nil {
			log.Printf("❌ ConfirmOrder: Database error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch order"})
			return
		}

		// Отгрузку подтверждает только компания-продавец (или админ).
		if !requireCompanyMatch(c, order.CompanyID) {
			return
		}

		// Принимаем только заказы со статусом confirmed (принятые)
		if order.Status == "shipped" || order.Status == "delivered" || order.Status == "completed" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Order already shipped"})
			return
		}

		// Парсим items
		var items []map[string]interface{}
		if err := json.Unmarshal(order.Items, &items); err != nil {
			var itemsString string
			if err2 := json.Unmarshal(order.Items, &itemsString); err2 == nil {
				if err3 := json.Unmarshal([]byte(itemsString), &items); err3 != nil {
					log.Printf("❌ ConfirmOrder: Failed to parse items: %v", err3)
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid order items"})
					return
				}
			} else {
				log.Printf("❌ ConfirmOrder: Failed to parse items: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid order items"})
				return
			}
		}

		log.Printf("✅ ConfirmOrder: Parsed %d items from order", len(items))

		tx, err := db.Begin()
		if err != nil {
			log.Printf("❌ ConfirmOrder: Failed to begin transaction: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}
		defer tx.Rollback()

		// Рассчитываем прибыль из items
		var totalRevenue float64
		var totalMarkup float64

		for _, item := range items {
			var productID int64
			for _, key := range []string{"productId", "product_id", "id"} {
				if idVal, ok := item[key]; ok {
					if idFloat, ok := idVal.(float64); ok && idFloat > 0 {
						productID = int64(idFloat)
						break
					}
				}
			}

			log.Printf("🔍 Item raw data: %+v", item)

			if productID == 0 {
				log.Printf("⚠️ ConfirmOrder: Item missing valid ID, skipping: %+v", item)
				continue
			}

			var quantity int
			if qtyVal, ok := item["quantity"]; ok {
				if qtyFloat, ok := qtyVal.(float64); ok {
					quantity = int(qtyFloat)
				}
			}

			if quantity <= 0 {
				log.Printf("⚠️ ConfirmOrder: Item has invalid quantity, skipping: %+v", item)
				continue
			}

			// Retrieve actual variant prices from DB using selling_price as fingerprint.
			// Product-level prices reflect the MIN variant (wrong for orders of higher-priced variants).
			var price float64
			var priceWithMarkup float64

			// Extract item-level prices as hints for variant matching
			var itemSelling float64
			var itemColor, itemSize string
			if pwm, ok := item["price_with_markup"].(float64); ok { itemSelling = pwm }
			if pwm, ok := item["priceWithMarkup"].(float64); ok && itemSelling == 0 { itemSelling = pwm }
			if c, ok := item["color"].(string); ok { itemColor = c }
			if s, ok := item["size"].(string); ok { itemSize = s }

			// Step 1: Find variant by selling_price fingerprint (identifies exact variant)
			if itemSelling > 0 {
				db.QueryRow(`
					SELECT price, selling_price FROM product_variants
					WHERE product_id = $1 AND selling_price > price
					  AND ABS(selling_price - $2) < 1.0
					ORDER BY ABS(selling_price - $2) ASC LIMIT 1
				`, productID, itemSelling).Scan(&price, &priceWithMarkup)
			}

			// Step 2: Find variant by color+size
			if price == 0 && (itemColor != "" || itemSize != "") {
				db.QueryRow(`
					SELECT price, selling_price FROM product_variants
					WHERE product_id = $1 AND selling_price > price
					  AND ($2 = '' OR color = $2)
					  AND ($3 = '' OR size  = $3)
					ORDER BY id ASC LIMIT 1
				`, productID, itemColor, itemSize).Scan(&price, &priceWithMarkup)
			}

			// Step 3: Any variant with markup
			if price == 0 {
				db.QueryRow(`
					SELECT price, selling_price FROM product_variants
					WHERE product_id = $1 AND selling_price > price
					ORDER BY price ASC LIMIT 1
				`, productID).Scan(&price, &priceWithMarkup)
			}

			// Step 4: Product-level fallback (no variants)
			if price == 0 {
				db.QueryRow(`
					SELECT price, COALESCE(NULLIF(selling_price, 0), price * (1.0 + COALESCE(markup_percent,0)/100.0))
					FROM products WHERE id = $1 AND company_id = $2
				`, productID, order.CompanyID).Scan(&price, &priceWithMarkup)
			}

			if priceWithMarkup == 0 { priceWithMarkup = price }
			log.Printf("📊 Product %d variant prices: base=%.2f, selling=%.2f (item hint selling=%.2f)", productID, price, priceWithMarkup, itemSelling)

			markupAmount := priceWithMarkup - price
			totalRevenue += priceWithMarkup * float64(quantity)
			totalMarkup += markupAmount * float64(quantity)

			log.Printf("📦 Item: ID=%d, Qty=%d, Price=%.2f, PriceWithMarkup=%.2f, Markup=%.2f",
				productID, quantity, price, priceWithMarkup, markupAmount)
		}

		if totalRevenue == 0 && order.TotalAmount > 0 {
			totalRevenue = order.TotalAmount
			log.Printf("⚠️ ConfirmOrder: totalRevenue was 0, falling back to order.TotalAmount=%.2f", totalRevenue)
		}

		// Decrement stock only when moving from 'pending' (first confirmation via panel).
		// If status was already 'confirmed', UpdateOrderStatus already decremented stock.
		if order.Status == "pending" {
			for _, item := range items {
				var productID int64
				for _, key := range []string{"productId", "product_id", "id"} {
					if idVal, ok := item[key]; ok {
						if idFloat, ok := idVal.(float64); ok && idFloat > 0 {
							productID = int64(idFloat)
							break
						}
					}
				}
				if productID == 0 {
					continue
				}
				var qty int
				if qtyVal, ok := item["quantity"]; ok {
					if qtyFloat, ok := qtyVal.(float64); ok {
						qty = int(qtyFloat)
					}
				}
				if qty <= 0 {
					continue
				}
				color, _ := item["color"].(string)
				if color == "Любой" || color == "любой" {
					color = ""
				}
				size, _ := item["size"].(string)

				// Lock stock rows and reject if there is not enough to fulfil
				// this line — prevents overselling under concurrent confirmations.
				if available, name := checkStockAvailable(tx, productID, color, size, qty); !available {
					log.Printf("🚫 ConfirmOrder: insufficient stock for product %d (%s), need %d", productID, name, qty)
					c.JSON(http.StatusConflict, gin.H{
						"error":   "Недостаточно товара на складе: " + name,
						"product": name,
					})
					return
				}

				variantDecremented := false
				if color != "" || size != "" {
					res, err2 := tx.Exec(`
						UPDATE product_variants
						SET stock_quantity = GREATEST(0, stock_quantity - $1),
						    updated_at     = NOW()
						WHERE product_id = $2
						  AND ($3 = '' OR color = $3)
						  AND ($4 = '' OR size  = $4)
					`, qty, productID, color, size)
					if err2 == nil {
						if affected, _ := res.RowsAffected(); affected > 0 {
							variantDecremented = true
						}
					}
				}
				if variantDecremented {
					tx.Exec(`
						UPDATE products
						SET quantity   = (SELECT COALESCE(SUM(stock_quantity), 0) FROM product_variants WHERE product_id = $1),
						    sold_count = sold_count + $2,
						    updated_at = NOW()
						WHERE id = $1
					`, productID, qty)
				} else {
					tx.Exec(`
						UPDATE products
						SET quantity   = GREATEST(0, quantity - $1),
						    sold_count = sold_count + $1,
						    updated_at = NOW()
						WHERE id = $2
					`, qty, productID)
				}
				log.Printf("📦 ConfirmOrder: stock decremented product=%d qty=%d", productID, qty)
			}
		}

		// Обновляем markup_profit в orders и меняем статус на 'shipped' (В пути)
		_, err = tx.Exec(`
			UPDATE orders
			SET status = 'shipped', markup_profit = $2, updated_at = NOW()
			WHERE id = $1
		`, orderID, totalMarkup)

		if err != nil {
			log.Printf("❌ ConfirmOrder: Failed to update order: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to update order: %v", err)})
			return
		}

		if err := tx.Commit(); err != nil {
			log.Printf("❌ ConfirmOrder: Failed to commit transaction: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to confirm order"})
			return
		}

		log.Printf("✅ Order %s marked as shipped! Revenue: %.2f, Markup: %.2f", orderID, totalRevenue, totalMarkup)
		c.JSON(http.StatusOK, gin.H{
			"success":      true,
			"orderID":      order.ID,
			"totalRevenue": totalRevenue,
			"totalMarkup":  totalMarkup,
		})
	}
}
