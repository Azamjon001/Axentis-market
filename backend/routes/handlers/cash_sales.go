package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// CreateCashSale - создаёт кассовую продажу, уменьшает товары со склада и записывает в аналитику
// Это прямой endpoint для панели штрих-кода, работает как единая транзакция
func CreateCashSale(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req map[string]interface{}
		if err := c.ShouldBindJSON(&req); err != nil {
			log.Printf("❌ CreateCashSale: Invalid JSON: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		log.Printf("💵 [CASH SALE] Received request: %+v", req)

		// Кассовая продажа записывается только на компанию из токена.
		if !isAdmin(c) {
			req["companyId"] = float64(ctxCompanyID(c))
		}

		// 💳 Парсинг способа оплаты
		paymentMethod := "cash" // По умолчанию наличные
		if pm, ok := req["paymentMethod"].(string); ok && pm != "" {
			paymentMethod = pm
		}
		log.Printf("💳 [CASH SALE] Payment method: %s", paymentMethod)

		// 💳 Парсинг подтипа карты (если есть)
		var cardSubtype *string
		if cs, ok := req["cardSubtype"].(string); ok && cs != "" {
			cardSubtype = &cs
			log.Printf("💳 [CASH SALE] Card subtype: %s", cs)
		}

		// Парсинг companyId
		var companyID int64
		switch v := req["companyId"].(type) {
		case float64:
			companyID = int64(v)
		case string:
			parsed, err := strconv.ParseInt(v, 10, 64)
			if err != nil {
				log.Printf("❌ CreateCashSale: Invalid companyId: %v", err)
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid companyId"})
				return
			}
			companyID = parsed
		case int:
			companyID = int64(v)
		case int64:
			companyID = v
		default:
			log.Printf("❌ CreateCashSale: Unsupported companyId type: %T", v)
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid companyId type"})
			return
		}

		// Парсинг items
		var itemsArray []map[string]interface{}
		if req["items"] != nil {
			switch v := req["items"].(type) {
			case []interface{}:
				itemsBytes, _ := json.Marshal(v)
				if err := json.Unmarshal(itemsBytes, &itemsArray); err != nil {
					log.Printf("❌ CreateCashSale: Failed to parse items: %v", err)
					c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid items format"})
					return
				}
			case string:
				if err := json.Unmarshal([]byte(v), &itemsArray); err != nil {
					log.Printf("❌ CreateCashSale: Failed to parse items string: %v", err)
					c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid items format"})
					return
				}
			default:
				log.Printf("❌ CreateCashSale: Unsupported items type: %T", v)
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid items type"})
				return
			}
		} else {
			itemsArray = []map[string]interface{}{}
		}

		log.Printf("✅ [CASH SALE] Parsed %d items", len(itemsArray))

		// Валидация: проверяем что есть товары
		if len(itemsArray) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No items in sale"})
			return
		}

		// Начинаем транзакцию
		tx, err := db.Begin()
		if err != nil {
			log.Printf("❌ CreateCashSale: Failed to begin transaction: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}
		defer tx.Rollback()

		// Проверяем наличие товаров на складе И уменьшаем количество
		var totalAmount float64
		var totalMarkup float64
		var totalCost float64
		enrichedItems := make([]map[string]interface{}, 0, len(itemsArray))

		for _, item := range itemsArray {
			// Извлекаем данные товара
			var productID int64
			if id, ok := item["id"].(float64); ok {
				productID = int64(id)
			} else if id, ok := item["product_id"].(float64); ok {
				productID = int64(id)
			}

			var quantity int
			if qty, ok := item["quantity"].(float64); ok {
				quantity = int(qty)
			}

			var basePrice float64
			if price, ok := item["price"].(float64); ok {
				basePrice = price
			}

			var priceWithMarkup float64
			if pwm, ok := item["price_with_markup"].(float64); ok {
				priceWithMarkup = pwm
			} else if pwm, ok := item["priceWithMarkup"].(float64); ok {
				priceWithMarkup = pwm
			}

			// Читаем variant_id если есть
			var variantID int64
			if vid, ok := item["variant_id"].(float64); ok {
				variantID = int64(vid)
			}

			// Валидация
			if productID == 0 {
				log.Printf("⚠️ CreateCashSale: Item missing productID: %+v", item)
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID"})
				return
			}

			if quantity <= 0 {
				log.Printf("⚠️ CreateCashSale: Invalid quantity for product %d: %d", productID, quantity)
				c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Invalid quantity for product %d", productID)})
				return
			}

			if basePrice < 0 || priceWithMarkup < 0 {
				log.Printf("⚠️ CreateCashSale: Invalid price for product %d", productID)
				c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Invalid price for product %d", productID)})
				return
			}

			// Если нет цены с наценкой, считаем что нет наценки
			if priceWithMarkup == 0 {
				priceWithMarkup = basePrice
			}

			log.Printf("📦 [CASH SALE] Product %d (variant %d): qty=%d, base=%.2f, selling=%.2f",
				productID, variantID, quantity, basePrice, priceWithMarkup)

			if variantID > 0 {
				// Уменьшаем stock_quantity конкретного варианта
				result, err := tx.Exec(`
					UPDATE product_variants
					SET stock_quantity = GREATEST(0, stock_quantity - $1), updated_at = NOW()
					WHERE id = $2 AND product_id = $3 AND stock_quantity >= $1
				`, quantity, variantID, productID)

				if err != nil {
					log.Printf("❌ CreateCashSale: Failed to update variant %d: %v", variantID, err)
					c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to update variant %d", variantID)})
					return
				}

				rowsAffected, _ := result.RowsAffected()
				if rowsAffected == 0 {
					log.Printf("❌ CreateCashSale: Insufficient stock for variant %d", variantID)
					c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Insufficient stock for variant %d of product %d", variantID, productID)})
					return
				}

				// Синхронизируем quantity родительского продукта
				_, err = tx.Exec(`
					UPDATE products
					SET quantity = (
						SELECT COALESCE(SUM(stock_quantity), 0)
						FROM product_variants
						WHERE product_id = $1
					), updated_at = NOW()
					WHERE id = $1
				`, productID)
				if err != nil {
					log.Printf("⚠️ CreateCashSale: Failed to sync product quantity for %d: %v", productID, err)
				}

				log.Printf("✅ [CASH SALE] Variant %d of product %d: stock decreased by %d", variantID, productID, quantity)
			} else {
				// Fallback: уменьшаем напрямую у основного товара
				result, err := tx.Exec(`
					UPDATE products
					SET quantity = quantity - $1, updated_at = NOW()
					WHERE id = $2 AND company_id = $3 AND quantity >= $1
				`, quantity, productID, companyID)

				if err != nil {
					log.Printf("❌ CreateCashSale: Failed to update product %d: %v", productID, err)
					c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to update product %d", productID)})
					return
				}

				rowsAffected, _ := result.RowsAffected()
				if rowsAffected == 0 {
					log.Printf("❌ CreateCashSale: Insufficient stock for product %d", productID)
					c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Insufficient stock for product %d", productID)})
					return
				}

				log.Printf("✅ [CASH SALE] Product %d: stock decreased by %d", productID, quantity)
			}

			// Рассчитываем суммы
			markupAmount := priceWithMarkup - basePrice
			itemTotal := priceWithMarkup * float64(quantity)
			itemCost := basePrice * float64(quantity)
			itemMarkup := markupAmount * float64(quantity)

			totalAmount += itemTotal
			totalCost += itemCost
			totalMarkup += itemMarkup

			// Обогащаем данные товара для записи в sales
			enrichedItem := map[string]interface{}{
				"productId":       productID,
				"quantity":        quantity,
				"price":           basePrice,
				"priceWithMarkup": priceWithMarkup,
				"markupAmount":    markupAmount,
				"total":           itemTotal,
			}

			// Копируем дополнительные поля если есть
			if name, ok := item["name"]; ok {
				enrichedItem["name"] = name
			} else if name, ok := item["productName"]; ok {
				enrichedItem["name"] = name
			}

			if img, ok := item["image_url"]; ok {
				enrichedItem["image_url"] = img
			}

			enrichedItems = append(enrichedItems, enrichedItem)

			log.Printf("💰 [CASH SALE] Item totals: cost=%.2f, revenue=%.2f, markup=%.2f", 
				itemCost, itemTotal, itemMarkup)
		}

		log.Printf("💵 [CASH SALE] Sale totals:")
		log.Printf("   - Total Cost (закупка): %.2f сум", totalCost)
		log.Printf("   - Total Amount (выручка): %.2f сум", totalAmount)
		log.Printf("   - Total Markup (прибыль): %.2f сум", totalMarkup)

		// 🔍 Детальная проверка расчетов для каждого товара
		for i, item := range enrichedItems {
			if qty, ok := item["quantity"].(int); ok {
				if markup, ok := item["markupAmount"].(float64); ok {
					expectedMarkup := markup * float64(qty)
					log.Printf("   📦 Item %d: qty=%d, markup_per_item=%.2f, total_markup=%.2f", 
						i+1, qty, markup, expectedMarkup)
				}
			}
		}

		// Создаём запись о кассовой продаже с прибылью
		enrichedItemsBytes, _ := json.Marshal(enrichedItems)
		var saleID int64
		
		// 🐞 DEBUG: Log values before INSERT
		log.Printf("🔍 [DEBUG] INSERT values: companyID=%d, totalAmount=%.2f, totalMarkup=%.2f, paymentMethod=%s, cardSubtype=%v", 
			companyID, totalAmount, totalMarkup, paymentMethod, cardSubtype)
		
		err = tx.QueryRow(`
			INSERT INTO sales (company_id, items, total_amount, markup_profit, payment_method, card_subtype, created_at)
			VALUES ($1, $2::jsonb, $3, $4, $5, $6, NOW())
			RETURNING id
		`, companyID, enrichedItemsBytes, totalAmount, totalMarkup, paymentMethod, cardSubtype).Scan(&saleID)

		if err != nil {
			log.Printf("❌ CreateCashSale: Failed to create sale record: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create sale record"})
			return
		}

		log.Printf("✅ [CASH SALE] Sale record created: ID=%d", saleID)

		// Коммитим транзакцию
		if err := tx.Commit(); err != nil {
			log.Printf("❌ CreateCashSale: Failed to commit transaction: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to complete sale"})
			return
		}

		log.Printf("🎉 [CASH SALE] Transaction completed successfully!")
		log.Printf("   Sale ID: %d", saleID)
		log.Printf("   Company ID: %d", companyID)
		log.Printf("   Items: %d", len(enrichedItems))
		log.Printf("   Revenue: %.2f сум", totalAmount)
		log.Printf("   Profit: %.2f сум", totalMarkup)

		c.JSON(http.StatusOK, gin.H{
			"success":     true,
			"saleId":      saleID,
			"totalAmount": totalAmount,
			"totalMarkup": totalMarkup,
			"totalCost":   totalCost,
			"itemsCount":  len(enrichedItems),
		})
	}
}

// GetCashSales - получает список кассовых продаж для компании
func GetCashSales(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID := c.Query("companyId")

		if companyID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "companyId is required"})
			return
		}

		log.Printf("📊 [GET CASH SALES] Fetching for company %s", companyID)

		rows, err := db.Query(`
			SELECT id, items, total_amount, payment_method, card_subtype, created_at
			FROM sales 
			WHERE company_id = $1 AND payment_method = 'cash'
			ORDER BY created_at DESC
		`, companyID)

		if err != nil {
			log.Printf("❌ GetCashSales: Database error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch sales"})
			return
		}
		defer rows.Close()

		sales := make([]map[string]interface{}, 0)

		for rows.Next() {
			var s struct {
				ID            int64
				Items         []byte
				TotalAmount   float64
				PaymentMethod string
				CardSubtype   *string
				CreatedAt     string
			}

			if err := rows.Scan(&s.ID, &s.Items, &s.TotalAmount, &s.PaymentMethod, &s.CardSubtype, &s.CreatedAt); err != nil {
				log.Printf("⚠️ GetCashSales: Failed to scan row: %v", err)
				continue
			}

			// Парсим items
			var itemsArray []map[string]interface{}
			if err := json.Unmarshal(s.Items, &itemsArray); err != nil {
				log.Printf("⚠️ GetCashSales: Failed to parse items for sale %d: %v", s.ID, err)
				itemsArray = []map[string]interface{}{}
			}

			// Рассчитываем markup из items
			var totalMarkup float64
			for _, item := range itemsArray {
				if markup, ok := item["markupAmount"].(float64); ok {
					if qty, ok := item["quantity"].(float64); ok {
						totalMarkup += markup * qty
					}
				}
			}

			sales = append(sales, map[string]interface{}{
				"id":            s.ID,
				"items":         itemsArray,
				"totalAmount":   s.TotalAmount,
				"totalMarkup":   totalMarkup,
				"paymentMethod": s.PaymentMethod,
				"cardSubtype":   s.CardSubtype,
				"createdAt":     s.CreatedAt,
				"type":          "cash", // Маркер для фронтенда
			})
		}

		log.Printf("✅ [GET CASH SALES] Found %d sales", len(sales))
		c.JSON(http.StatusOK, sales)
	}
}
