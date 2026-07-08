package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Get Sales
func GetSales(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID := c.Query("companyId")

		log.Printf("📊 [GET SALES] Fetching for company %s", companyID)

		rows, err := db.Query(`
			SELECT id, items, total_amount, COALESCE(markup_profit, 0) as markup_profit, payment_method, card_subtype, created_at
			FROM sales WHERE company_id = $1
			ORDER BY created_at DESC
		`, companyID)

		if err != nil {
			log.Printf("❌ GetSales: Database error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch sales"})
			return
		}
		defer rows.Close()

		var sales []map[string]interface{}
		for rows.Next() {
			var s struct {
				ID            int64
				Items         []byte // JSONB as []byte
				TotalAmount   float64
				MarkupProfit  float64
				PaymentMethod string
				CardSubtype   *string
				CreatedAt     string
			}

			if err := rows.Scan(&s.ID, &s.Items, &s.TotalAmount, &s.MarkupProfit, &s.PaymentMethod, &s.CardSubtype, &s.CreatedAt); err != nil {
				log.Printf("⚠️ GetSales: Failed to scan row: %v", err)
				continue
			}

			// Parse items as array
			var itemsArray []map[string]interface{}
			if err := json.Unmarshal(s.Items, &itemsArray); err != nil {
				log.Printf("⚠️ Failed to parse items for sale %d: %v", s.ID, err)
				itemsArray = []map[string]interface{}{}
			}

			// Если markup_profit не сохранён, попробуем рассчитать из items
			if s.MarkupProfit == 0 {
				for _, item := range itemsArray {
					if markup, ok := item["markupAmount"].(float64); ok {
						if qty, ok := item["quantity"].(float64); ok {
							s.MarkupProfit += markup * qty
						}
					}
				}
			}

			sales = append(sales, map[string]interface{}{
				"id":            s.ID,
				"items":         itemsArray, // Return as array, not string
				"totalAmount":   s.TotalAmount,
				"markupProfit":  s.MarkupProfit,
				"paymentMethod": s.PaymentMethod,
				"cardSubtype":   s.CardSubtype,
				"createdAt":     s.CreatedAt,
			})
		}

		log.Printf("✅ [GET SALES] Found %d sales", len(sales))
		c.JSON(http.StatusOK, sales)
	}
}

// Create Sale
func CreateSale(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req map[string]interface{}
		if err := c.ShouldBindJSON(&req); err != nil {
			log.Printf("❌ CreateSale: Invalid JSON: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Преобразование items в JSON строку
		var itemsJSON string
		if req["items"] != nil {
			itemsBytes, err := json.Marshal(req["items"])
			if err != nil {
				log.Printf("❌ CreateSale: Failed to marshal items: %v", err)
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid items format"})
				return
			}
			itemsJSON = string(itemsBytes)
		} else {
			itemsJSON = "[]"
		}

		// Продажа записывается только на компанию из токена.
		if !isAdmin(c) {
			req["companyId"] = ctxCompanyID(c)
		}

		log.Printf("💰 Creating sale: companyId=%v, totalAmount=%v, items=%s",
			req["companyId"], req["totalAmount"], itemsJSON)

		var saleID int64
		err := db.QueryRow(`
			INSERT INTO sales (company_id, items, total_amount, payment_method)
			VALUES ($1, $2::jsonb, $3, $4)
			RETURNING id
		`, req["companyId"], itemsJSON, req["totalAmount"], req["paymentMethod"]).Scan(&saleID)

		if err != nil {
			log.Printf("❌ CreateSale: Database error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create sale"})
			return
		}

		log.Printf("✅ Sale created: ID=%d", saleID)
		c.JSON(http.StatusOK, gin.H{"success": true, "id": saleID})
	}
}
