package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// GetProducts - возвращает список товаров с учетом приватности
func GetProducts(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID := c.Param("companyId")
		if companyID == "" {
			companyID = c.Query("companyId")
		}

		// Параметры приватности
		userMode := c.Query("mode")
		privateCompanyID := c.Query("privateCompanyId")

		if userMode == "" {
			userMode = "public"
		}

		// Пагинация
		limit := 50
		offset := 0
		if l := c.Query("limit"); l != "" {
			if v, err := strconv.Atoi(l); err == nil && v > 0 {
				limit = v
			}
		}
		if o := c.Query("offset"); o != "" {
			if v, err := strconv.Atoi(o); err == nil && v >= 0 {
				offset = v
			}
		}

		var rows *sql.Rows
		var err error

		if companyID == "" {
			// 🎯 Персональная лента: если передан phone, товары ранжируются по
			// интересам покупателя (как у Instagram/YouTube). Сигналы:
			//   • просмотры товаров (product_views) с затуханием по времени
			//     (просмотр месячной давности весит в e раз меньше свежего);
			//   • покупки (заказы) — самый сильный сигнал, вес 5.
			// Интерес агрегируется по категории (×2) и бренду (×1), затем
			// каждая карточка получает personal-score в ORDER BY. Состав
			// выдачи не меняется — меняется только порядок, поэтому пагинация
			// и карточки работают как раньше.
			phone := strings.TrimSpace(c.Query("phone"))
			args := []interface{}{}
			prefix := ""
			personalOrder := ""
			if phone != "" {
				args = append(args, phone)
				prefix = `WITH prefs AS (
					SELECT COALESCE(p2.category,'') AS cat, COALESCE(p2.brand,'') AS brand, SUM(s.w) AS weight
					FROM (
						SELECT pv.product_id AS pid,
						       pv.view_count * EXP(-EXTRACT(EPOCH FROM (NOW() - pv.last_viewed_at)) / 2592000.0) AS w
						FROM product_views pv
						WHERE pv.user_phone = $1
						UNION ALL
						SELECT (COALESCE(e->>'productId', e->>'product_id'))::bigint AS pid, 5.0 AS w
						FROM orders o, jsonb_array_elements(o.items) AS e
						WHERE o.customer_phone = $1
						  AND o.status <> 'cancelled'
						  AND jsonb_typeof(o.items) = 'array'
						  AND COALESCE(e->>'productId', e->>'product_id') ~ '^[0-9]+$'
					) s
					JOIN products p2 ON p2.id = s.pid
					GROUP BY 1, 2
				) `
				personalOrder = `(
					COALESCE((SELECT SUM(pr.weight) * 2 FROM prefs pr WHERE pr.cat <> '' AND pr.cat = COALESCE(p.category,'')), 0)
					+ COALESCE((SELECT SUM(pr.weight) FROM prefs pr WHERE pr.brand <> '' AND pr.brand = COALESCE(p.brand,'')), 0)
				) DESC, `
			}

			query := prefix + `
				SELECT p.id, p.company_id, p.name, p.quantity, p.price, p.markup_percent,
				       COALESCE(
				           NULLIF((SELECT MIN(pv.selling_price) FROM product_variants pv WHERE pv.product_id = p.id AND pv.selling_price > 0), 0),
				           NULLIF(p.selling_price, 0),
				           p.price * (1.0 + COALESCE(p.markup_percent, 0) / 100.0)
				       ) as selling_price,
				       p.markup_amount, p.barcode, p.barid, p.category, p.images,
				       p.description, p.color, p.size, p.brand, p.has_color_options, p.available_for_customers, p.sold_count, p.created_at, p.updated_at,
				       c.name as company_name,
				       COALESCE((SELECT AVG(cr.rating) FROM company_ratings cr WHERE cr.company_id = c.id), 0) as company_rating,
				       ` + productLevelDiscountSubqueries + `,
				       ` + promotedExpr + ` AS is_promoted
				FROM products p
				LEFT JOIN companies c ON p.company_id = c.id
				WHERE p.available_for_customers = true`

			if userMode == "private" && privateCompanyID != "" {
				// 🔒 Закрытая компания: покупатель видит ТОЛЬКО её товары.
				log.Printf("🔒 GetProducts: Private mode for company %s", privateCompanyID)
				args = append(args, privateCompanyID)
				query += fmt.Sprintf(" AND c.id = $%d AND c.mode = 'private'", len(args))
			} else {
				// 🗺️ Региональная фильтрация: если передан region, показываем только
				// товары компаний, которые обслуживают этот регион (основной регион
				// компании ИЛИ регион из списка доставки service_regions). Если ни одна
				// компания не выбрала регион покупателя — товаров не будет (как и задумано).
				region := strings.TrimSpace(c.Query("region"))
				log.Printf("🌐 GetProducts: Public mode, limit=%d offset=%d region=%q personalized=%v", limit, offset, region, phone != "")
				query += " AND (c.mode = 'public' OR c.mode IS NULL)"
				if region != "" {
					args = append(args, region)
					query += fmt.Sprintf(" AND (c.region = $%d OR c.service_regions @> to_jsonb($%d::text))", len(args), len(args))
				}
			}

			// Продвинутые товары (внутренняя реклама) — вверху выдачи, затем
			// персональный интерес, затем новизна.
			query += fmt.Sprintf(" ORDER BY is_promoted DESC, %s p.created_at DESC LIMIT $%d OFFSET $%d", personalOrder, len(args)+1, len(args)+2)
			args = append(args, limit, offset)
			rows, err = db.Query(query, args...)
		} else {
			// Товары конкретной компании (для админ-панели компании)
			rows, err = db.Query(`
				SELECT id, company_id, name, quantity, price, markup_percent,
				       COALESCE(
				           NULLIF((SELECT MIN(pv.selling_price) FROM product_variants pv WHERE pv.product_id = products.id AND pv.selling_price > 0), 0),
				           NULLIF(selling_price, 0),
				           price * (1.0 + COALESCE(markup_percent, 0) / 100.0)
				       ) as selling_price,
				       markup_amount, barcode, barid, category, images,
				       description, color, size, brand, has_color_options, available_for_customers, sold_count, created_at, updated_at,
				       COALESCE(
				           NULLIF((SELECT SUM(pv.price * pv.stock_quantity) FROM product_variants pv WHERE pv.product_id = products.id), 0),
				           price * quantity
				       ) as inventory_cost,
				       -- 📦 Фактический остаток: сумма по SKU-вариантам, если они есть,
				       -- иначе — остаток основного товара. Нужно для аналитики
				       -- (низкий остаток / лидеры) и корректного отображения склада.
				       COALESCE(
				           (SELECT SUM(pv.stock_quantity) FROM product_variants pv WHERE pv.product_id = products.id),
				           quantity
				       ) as total_stock,
				       (SELECT COUNT(*) FROM product_variants pv WHERE pv.product_id = products.id) as variant_count
				FROM products
				WHERE company_id = $1
				ORDER BY created_at DESC
				LIMIT $2 OFFSET $3
			`, companyID, limit, offset)
		}

		if err != nil {
			log.Printf("❌ GetProducts error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch products"})
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
				CompanyRating         sql.NullFloat64
				InventoryCost         sql.NullFloat64
				TotalStock            sql.NullInt64
				VariantCount          sql.NullInt64
				RegPct                sql.NullFloat64
				AggPct                sql.NullFloat64
				IsPromoted            sql.NullBool
			}

			var err error
			if companyID == "" {
				// С company_name + проценты активных скидок + флаг продвижения
				err = rows.Scan(&p.ID, &p.CompanyID, &p.Name, &p.Quantity, &p.Price,
					&p.MarkupPercent, &p.SellingPrice, &p.MarkupAmount, &p.Barcode, &p.Barid,
					&p.Category, &p.Images, &p.Description, &p.Color, &p.Size, &p.Brand,
					&p.HasColorOptions, &p.AvailableForCustomers,
					&p.SoldCount, &p.CreatedAt, &p.UpdatedAt, &p.CompanyName, &p.CompanyRating,
					&p.RegPct, &p.AggPct, &p.IsPromoted)
			} else {
				// Без company_name, но с inventory_cost + фактический остаток по вариантам
				err = rows.Scan(&p.ID, &p.CompanyID, &p.Name, &p.Quantity, &p.Price,
					&p.MarkupPercent, &p.SellingPrice, &p.MarkupAmount, &p.Barcode, &p.Barid,
					&p.Category, &p.Images, &p.Description, &p.Color, &p.Size, &p.Brand,
					&p.HasColorOptions, &p.AvailableForCustomers,
					&p.SoldCount, &p.CreatedAt, &p.UpdatedAt, &p.InventoryCost,
					&p.TotalStock, &p.VariantCount)
			}

			if err != nil {
				log.Printf("⚠️ Error scanning product: %v", err)
				continue
			}

			product := map[string]interface{}{
				"id":        p.ID,
				"article":   fmt.Sprintf("%09d", 100000000+p.ID), // 🔖 уникальный артикул
				"companyId": p.CompanyID,
				"name":      p.Name,
				"quantity":  p.Quantity,
				"price":     p.Price,
			}

			if p.CompanyName.Valid {
				product["companyName"] = p.CompanyName.String
			}
			if p.CompanyRating.Valid {
				product["companyRating"] = p.CompanyRating.Float64
			}
			if p.IsPromoted.Valid && p.IsPromoted.Bool {
				product["isPromoted"] = true // внутренняя реклама: выше в выдаче
			}
			if p.MarkupPercent.Valid {
				product["markupPercent"] = p.MarkupPercent.Float64
			} else {
				product["markupPercent"] = 0
			}
			baseSelling := p.Price
			if p.SellingPrice.Valid {
				baseSelling = p.SellingPrice.Float64
			}
			// 🏷️ Применяем активную скидку (обычную/жёсткую), если она есть.
			finalSelling, discPct, discType := applyBestDiscount(p.Price, baseSelling, p.RegPct, p.AggPct)
			product["sellingPrice"] = finalSelling
			if discType != "" {
				product["originalPrice"] = baseSelling
				product["discountPercent"] = discPct
				product["discountType"] = discType
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
			if p.HasColorOptions.Valid {
				product["hasColorOptions"] = p.HasColorOptions.Bool
			} else {
				product["hasColorOptions"] = false
			}
			if p.AvailableForCustomers.Valid {
				product["availableForCustomers"] = p.AvailableForCustomers.Bool
			} else {
				product["availableForCustomers"] = true
			}
			if p.SoldCount.Valid {
				product["soldCount"] = p.SoldCount.Int64
			} else {
				product["soldCount"] = 0
			}
			product["createdAt"] = p.CreatedAt // 🆕 для подборки «Новинки» на главной
			if p.InventoryCost.Valid {
				product["inventoryCost"] = p.InventoryCost.Float64
			} else {
				product["inventoryCost"] = p.Price * float64(p.Quantity)
			}
			// 📦 Фактический остаток с учётом SKU-вариантов + число вариантов.
			// Аналитика (низкий остаток, лидеры) и склад должны видеть варианты
			// как часть товара, а не только основной quantity.
			if p.TotalStock.Valid {
				product["totalStock"] = p.TotalStock.Int64
			} else {
				product["totalStock"] = p.Quantity
			}
			if p.VariantCount.Valid {
				product["variantCount"] = p.VariantCount.Int64
				product["hasVariants"] = p.VariantCount.Int64 > 0
			} else {
				product["variantCount"] = 0
				product["hasVariants"] = false
			}

			// Парсим images
			if p.Images.Valid && p.Images.String != "" {
				var images []string
				if err := json.Unmarshal([]byte(p.Images.String), &images); err != nil {
					log.Printf("⚠️ Failed to parse images for product %d: %v", p.ID, err)
					product["images"] = []string{}
				} else {
					product["images"] = images
				}
			} else {
				product["images"] = []string{}
			}

			products = append(products, product)
		}

		c.JSON(http.StatusOK, products)
	}
}

// GetProductByID - возвращает один товар по ID
func GetProductByID(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID"})
			return
		}

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
			RegPct                sql.NullFloat64
			AggPct                sql.NullFloat64
		}

		err = db.QueryRow(`
			SELECT p.id, p.company_id, p.name, p.quantity, p.price, p.markup_percent,
			       p.selling_price, p.markup_amount, p.barcode, p.barid, p.category, p.images,
			       p.description, p.color, p.size, p.brand, p.has_color_options,
			       p.available_for_customers, p.sold_count, p.created_at, p.updated_at,
			       c.name as company_name,
			       `+productLevelDiscountSubqueries+`
			FROM products p
			LEFT JOIN companies c ON p.company_id = c.id
			WHERE p.id = $1
		`, id).Scan(
			&p.ID, &p.CompanyID, &p.Name, &p.Quantity, &p.Price,
			&p.MarkupPercent, &p.SellingPrice, &p.MarkupAmount, &p.Barcode, &p.Barid,
			&p.Category, &p.Images, &p.Description, &p.Color, &p.Size, &p.Brand,
			&p.HasColorOptions, &p.AvailableForCustomers,
			&p.SoldCount, &p.CreatedAt, &p.UpdatedAt, &p.CompanyName,
			&p.RegPct, &p.AggPct,
		)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
			return
		}
		if err != nil {
			log.Printf("❌ GetProductByID error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch product"})
			return
		}

		product := map[string]interface{}{
			"id":        p.ID,
			"article":   fmt.Sprintf("%09d", 100000000+p.ID), // 🔖 уникальный артикул
			"companyId": p.CompanyID,
			"name":      p.Name,
			"quantity":  p.Quantity,
			"price":     p.Price,
			"createdAt": p.CreatedAt,
			"updatedAt": p.UpdatedAt,
		}
		if p.CompanyName.Valid {
			product["companyName"] = p.CompanyName.String
		}
		if p.MarkupPercent.Valid {
			product["markupPercent"] = p.MarkupPercent.Float64
		} else {
			product["markupPercent"] = 0
		}
		detailBaseSelling := p.Price
		if p.SellingPrice.Valid {
			detailBaseSelling = p.SellingPrice.Float64
		}
		// 🏷️ Применяем активную скидку (обычную/жёсткую), если она есть.
		detailFinal, detailPct, detailType := applyBestDiscount(p.Price, detailBaseSelling, p.RegPct, p.AggPct)
		product["sellingPrice"] = detailFinal
		if detailType != "" {
			product["originalPrice"] = detailBaseSelling
			product["discountPercent"] = detailPct
			product["discountType"] = detailType
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
		if p.HasColorOptions.Valid {
			product["hasColorOptions"] = p.HasColorOptions.Bool
		} else {
			product["hasColorOptions"] = false
		}
		if p.AvailableForCustomers.Valid {
			product["availableForCustomers"] = p.AvailableForCustomers.Bool
		} else {
			product["availableForCustomers"] = true
		}
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

		c.JSON(http.StatusOK, product)
	}
}

// CreateProduct - создаёт новый товар
func CreateProduct(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input struct {
			CompanyID             int64   `json:"companyId"`
			Name                  string  `json:"name"`
			Quantity              int     `json:"quantity"`
			Price                 float64 `json:"price"`
			MarkupPercent         float64 `json:"markupPercent"`
			Barcode               string  `json:"barcode"`
			Barid                 string  `json:"barid"`
			Category              string  `json:"category"`
			Description           string  `json:"description"`
			Color                 string  `json:"color"`
			Size                  string  `json:"size"`
			Brand                 string  `json:"brand"`
			HasColorOptions       bool    `json:"hasColorOptions"`
			AvailableForCustomers bool    `json:"availableForCustomers"`
		}

		if err := c.BindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// SECURITY: bind the product to the authenticated company, not whatever
		// companyId the client put in the body — prevents creating products in
		// another shop. (companyId is set by RequireCompany from the JWT.)
		if tokenCompanyID := c.GetInt64("companyId"); tokenCompanyID != 0 {
			input.CompanyID = tokenCompanyID
		}

		// 🔍 DEBUG: Логируем входящие данные
		log.Printf("🔍 CreateProduct request - CompanyID: %d, Name: %s, Price: %.2f, Category: %s, Brand: %s, Color: %s, Size: %s", 
			input.CompanyID, input.Name, input.Price, input.Category, input.Brand, input.Color, input.Size)

		if input.Name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Product name is required"})
			return
		}
		if input.Price < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Price cannot be negative"})
			return
		}
		
		// 🔍 Проверяем существует ли компания
		var companyExists bool
		err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM companies WHERE id = $1)", input.CompanyID).Scan(&companyExists)
		if err != nil {
			log.Printf("❌ Error checking company existence: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}
		if !companyExists {
			log.Printf("❌ Company ID %d does not exist in database!", input.CompanyID)
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Company with ID %d does not exist", input.CompanyID)})
			return
		}

		// Вставляем товар в БД
		// selling_price и markup_amount генерируются автоматически (GENERATED ALWAYS)
		var productID int64
	err = db.QueryRow(`
		INSERT INTO products (
			company_id, name, quantity, price, markup_percent, 
			barcode, barid, category,
			description, color, size, brand, has_color_options, available_for_customers, images
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, '[]')
		RETURNING id
	`, input.CompanyID, input.Name, input.Quantity, input.Price, input.MarkupPercent,
		input.Barcode, input.Barid, input.Category,
		input.Description, input.Color, input.Size, input.Brand, input.HasColorOptions, input.AvailableForCustomers).Scan(&productID)

	if err != nil {
		log.Printf("❌ CreateProduct DB error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create product"})
		return
	}

	log.Printf("✅ Product created: ID=%d, Name=%s, CompanyID=%d", productID, input.Name, input.CompanyID)

	// Create notifications for all subscribers of this company
	if input.AvailableForCustomers {
		go func(companyID, productID int64, productName string) {
			// Get company name for notification
			var companyName string
			err := db.QueryRow("SELECT name FROM companies WHERE id = $1", companyID).Scan(&companyName)
			if err != nil {
				log.Printf("⚠️ Failed to get company name for notifications: %v", err)
				return
			}
			
			// Send notifications to all subscribers
			if err := CreateNotificationForSubscribers(db, companyID, productID, productName, companyName); err != nil {
				log.Printf("⚠️ Failed to send notifications: %v", err)
			}
		}(input.CompanyID, productID, input.Name)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"id":      productID,
		"message": "Product created successfully",
	})
	}
}

// UpdateProduct - обновляет товар
func UpdateProduct(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		productID := c.Param("id")
		
		var input struct {
			Name                  *string  `json:"name"`
			Quantity              *int     `json:"quantity"`
			Price                 *float64 `json:"price"`
			MarkupPercent         *float64 `json:"markupPercent"`
			Barcode               *string  `json:"barcode"`
			Barid                 *string  `json:"barid"`
			Category              *string  `json:"category"`
			Description           *string  `json:"description"`
			Color                 *string  `json:"color"`
			Size                  *string  `json:"size"`
			Brand                 *string  `json:"brand"`
			HasColorOptions       *bool    `json:"hasColorOptions"`
			AvailableForCustomers *bool    `json:"availableForCustomers"`
		}

		if err := c.BindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		var current struct {
			Name                  string
			Quantity              int
			Price                 float64
			MarkupPercent         float64
			Barcode               sql.NullString
			Barid                 sql.NullString
			Category              sql.NullString
			Description           sql.NullString
			Color                 sql.NullString
			Size                  sql.NullString
			Brand                 sql.NullString
			HasColorOptions       bool
			AvailableForCustomers bool
		}

		err := db.QueryRow(`
			SELECT name, quantity, price, markup_percent, barcode, barid, category, 
		       description, color, size, brand, has_color_options, available_for_customers
		FROM products WHERE id = $1
	`, productID).Scan(
		&current.Name, &current.Quantity, &current.Price, &current.MarkupPercent,
		&current.Barcode, &current.Barid, &current.Category, &current.Description,
		&current.Color, &current.Size, &current.Brand,
		&current.HasColorOptions, &current.AvailableForCustomers)

	if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
			return
		}
		if err != nil {
			log.Printf("❌ UpdateProduct: Failed to get current product: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get product"})
			return
		}

		// Применяем изменения только для заданных полей
		name := current.Name
		if input.Name != nil {
			name = *input.Name
		}
		quantity := current.Quantity
		if input.Quantity != nil {
			quantity = *input.Quantity
		}
		price := current.Price
		if input.Price != nil {
			price = *input.Price
		}
		markupPercent := current.MarkupPercent
		if input.MarkupPercent != nil {
			markupPercent = *input.MarkupPercent
		}
		barcode := current.Barcode.String
		if input.Barcode != nil {
			barcode = *input.Barcode
		}
		barid := current.Barid.String
		if input.Barid != nil {
			barid = *input.Barid
		}
		category := current.Category.String
		if input.Category != nil {
			category = *input.Category
		}
		description := current.Description.String
		if input.Description != nil {
			description = *input.Description
		}
		color := current.Color.String
		if input.Color != nil {
			color = *input.Color
		}
		size := current.Size.String
		if input.Size != nil {
			size = *input.Size
		}
		brand := current.Brand.String
		if input.Brand != nil {
			brand = *input.Brand
		}
		hasColorOptions := current.HasColorOptions
		if input.HasColorOptions != nil {
			hasColorOptions = *input.HasColorOptions
		}
		availableForCustomers := current.AvailableForCustomers
		if input.AvailableForCustomers != nil {
			availableForCustomers = *input.AvailableForCustomers
		}

		// Обновляем товар
		_, err = db.Exec(`
			UPDATE products
			SET name = $1, quantity = $2, price = $3, markup_percent = $4,
			    barcode = $5, barid = $6, category = $7, description = $8,
			    color = $9, size = $10, brand = $11,
			    has_color_options = $12, available_for_customers = $13, updated_at = NOW()
			WHERE id = $14
		`, name, quantity, price, markupPercent,
		barcode, barid, category, description,
		color, size, brand,
		hasColorOptions, availableForCustomers, productID)

	if err != nil {
		log.Printf("❌ UpdateProduct DB error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update product"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Product updated successfully",
	})
	}
}

// DeleteProduct - удаляет товар
func DeleteProduct(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		productID := c.Param("id")

		result, err := db.Exec("DELETE FROM products WHERE id = $1", productID)
		if err != nil {
			log.Printf("❌ DeleteProduct DB error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete product"})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
			return
		}

		log.Printf("✅ Product deleted: ID=%s", productID)

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Product deleted successfully",
		})
	}
}

// UploadProductImages - загружает изображения товара
func UploadProductImages(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		productID := c.Param("id")
		
		// Получаем multipart form
		form, err := c.MultipartForm()
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid form data"})
			return
		}
		
		files := form.File["files"]
		if len(files) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No files provided"})
			return
		}
		
		// Создаем директорию uploads если её нет
		uploadsDir := "./uploads"
		if err := os.MkdirAll(uploadsDir, 0755); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create uploads directory"})
			return
		}
		
		// Получаем текущие изображения товара
		var currentImagesJSON sql.NullString
		err = db.QueryRow("SELECT images FROM products WHERE id = $1", productID).Scan(&currentImagesJSON)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
			return
		}
		
		var currentImages []string
		if currentImagesJSON.Valid && currentImagesJSON.String != "" {
			json.Unmarshal([]byte(currentImagesJSON.String), &currentImages)
		}
		
		// Загружаем новые файлы
		var uploadedPaths []string
		for _, file := range files {
			// Генерируем уникальное имя файла
			ext := filepath.Ext(file.Filename)
			filename := fmt.Sprintf("product_%s_%d%s", productID, time.Now().UnixNano(), ext)
			filePath := fmt.Sprintf("uploads/%s", filename)
			
			// Сохраняем файл
			dst := fmt.Sprintf("./uploads/%s", filename)
			if err := c.SaveUploadedFile(file, dst); err != nil {
				log.Printf("Failed to save file %s: %v", filename, err)
				continue
			}
			// 🖼️ Сжимаем и уменьшаем — витрина грузится быстрее, трафика меньше.
			optimizeImage(dst)

			uploadedPaths = append(uploadedPaths, filePath)
		}
		
		// Объединяем старые и новые изображения
		allImages := append(currentImages, uploadedPaths...)
		
		// Ограничиваем до 6 изображений
		if len(allImages) > 6 {
			allImages = allImages[:6]
		}
		
		// Сохраняем в базу
		imagesJSON, _ := json.Marshal(allImages)
		_, err = db.Exec("UPDATE products SET images = $1 WHERE id = $2", string(imagesJSON), productID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update product images"})
			return
		}
		
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": fmt.Sprintf("Uploaded %d images", len(uploadedPaths)),
			"images":  allImages,
		})
	}
}

// DeleteProductImage - удаляет изображение товара
func DeleteProductImage(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		productID := c.Param("id")
		
		var req struct {
			Filepath string `json:"filepath"`
		}
		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}
		
		// Получаем текущие изображения
		var imagesJSON sql.NullString
		err := db.QueryRow("SELECT images FROM products WHERE id = $1", productID).Scan(&imagesJSON)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
			return
		}
		
		var images []string
		if imagesJSON.Valid && imagesJSON.String != "" {
			json.Unmarshal([]byte(imagesJSON.String), &images)
		}
		
		// Удаляем указанное изображение из массива
		newImages := []string{}
		for _, img := range images {
			if img != req.Filepath {
				newImages = append(newImages, img)
			}
		}
		
		// Удаляем файл с диска
		if strings.HasPrefix(req.Filepath, "uploads/") {
			filename := strings.TrimPrefix(req.Filepath, "uploads/")
			os.Remove(fmt.Sprintf("./uploads/%s", filename))
		} else if strings.HasPrefix(req.Filepath, "/uploads/") {
			// Поддержка старого формата
			filename := strings.TrimPrefix(req.Filepath, "/uploads/")
			os.Remove(fmt.Sprintf("./uploads/%s", filename))
		}
		
		// Обновляем базу
		updatedJSON, _ := json.Marshal(newImages)
		_, err = db.Exec("UPDATE products SET images = $1 WHERE id = $2", string(updatedJSON), productID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update product"})
			return
		}
		
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Image deleted",
			"images":  newImages,
		})
	}
}

// GetSimilarProducts - получение похожих товаров по ключевым словам из названия
func GetSimilarProducts(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		productID, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID"})
			return
		}

		limit := 10 // Ограничиваем количество похожих товаров
		if limitParam := c.Query("limit"); limitParam != "" {
			if parsedLimit, err := strconv.Atoi(limitParam); err == nil && parsedLimit > 0 {
				limit = parsedLimit
			}
		}

		// Получаем текущий товар
		var currentProduct struct {
			ID          int64
			Name        string
			CompanyID   int64
			CategoryStr sql.NullString
		}

		err = db.QueryRow(`
			SELECT id, name, company_id, category
			FROM products
			WHERE id = $1
		`, productID).Scan(&currentProduct.ID, &currentProduct.Name, &currentProduct.CompanyID, &currentProduct.CategoryStr)

		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
			return
		}
		if err != nil {
			log.Printf("❌ GetSimilarProducts: Failed to get current product: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch product"})
			return
		}

		// Извлекаем ключевые слова из названия (разбиваем по пробелам, берем слова длиннее 3 символов)
		words := strings.Fields(strings.ToLower(currentProduct.Name))
		keywords := []string{}
		for _, word := range words {
			// Убираем знаки препинания
			cleanWord := strings.TrimFunc(word, func(r rune) bool {
				return !((r >= 'a' && r <= 'z') || (r >= 'а' && r <= 'я') || (r >= '0' && r <= '9'))
			})
			if len(cleanWord) >= 3 {
				keywords = append(keywords, cleanWord)
			}
		}

		if len(keywords) == 0 {
			c.JSON(http.StatusOK, []map[string]interface{}{})
			return
		}

		// Строим SQL запрос для поиска похожих товаров
		// Используем LIKE для поиска по ключевым словам
		conditions := []string{}
		args := []interface{}{productID}
		argIndex := 2

		for _, keyword := range keywords {
			conditions = append(conditions, fmt.Sprintf("LOWER(p.name) LIKE $%d", argIndex))
			args = append(args, "%"+keyword+"%")
			argIndex++
		}

		whereClause := strings.Join(conditions, " OR ")

		// Видимость: товары закрытых компаний не подмешиваются публичным
		// покупателям (и наоборот — закрытый режим видит только свою компанию).
		visibility := visibilityCond(c, "c", &args, &argIndex)

		query := fmt.Sprintf(`
			SELECT
				p.id, p.company_id, p.name, p.quantity, p.price, p.markup_percent,
				p.selling_price, p.markup_amount, p.barcode, p.barid, p.category, p.images,
				p.description, p.color, p.size, p.brand, p.has_color_options, p.available_for_customers, p.sold_count,
				p.created_at, p.updated_at,
				c.name as company_name
			FROM products p
			LEFT JOIN companies c ON p.company_id = c.id
			WHERE p.id != $1
			  AND p.available_for_customers = true
			  AND %s
			  AND (%s)
			ORDER BY
				CASE WHEN p.category = $%d THEN 1 ELSE 2 END,
				p.sold_count DESC,
				p.created_at DESC
			LIMIT $%d
		`, visibility, whereClause, argIndex, argIndex+1)

		// Добавляем категорию и лимит в аргументы
		categoryValue := ""
		if currentProduct.CategoryStr.Valid {
			categoryValue = currentProduct.CategoryStr.String
		}
		args = append(args, categoryValue, limit)

		rows, err := db.Query(query, args...)
		if err != nil {
			log.Printf("❌ GetSimilarProducts query error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch similar products"})
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

			err := rows.Scan(&p.ID, &p.CompanyID, &p.Name, &p.Quantity, &p.Price,
				&p.MarkupPercent, &p.SellingPrice, &p.MarkupAmount, &p.Barcode, &p.Barid,
				&p.Category, &p.Images, &p.Description, &p.Color, &p.Size, &p.Brand,
				&p.HasColorOptions, &p.AvailableForCustomers,
				&p.SoldCount, &p.CreatedAt, &p.UpdatedAt, &p.CompanyName)
			if err != nil {
				log.Printf("⚠️ Error scanning similar product: %v", err)
				continue
			}

			product := map[string]interface{}{
				"id":        p.ID,
				"article":   fmt.Sprintf("%09d", 100000000+p.ID), // 🔖 уникальный артикул
				"companyId": p.CompanyID,
				"name":      p.Name,
				"quantity":  p.Quantity,
				"price":     p.Price,
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
			if p.HasColorOptions.Valid {
				product["hasColorOptions"] = p.HasColorOptions.Bool
			} else {
				product["hasColorOptions"] = false
			}
			if p.AvailableForCustomers.Valid {
				product["availableForCustomers"] = p.AvailableForCustomers.Bool
			} else {
				product["availableForCustomers"] = true
			}
			if p.SoldCount.Valid {
				product["soldCount"] = p.SoldCount.Int64
			} else {
				product["soldCount"] = 0
			}

			// Парсим images
			if p.Images.Valid && p.Images.String != "" {
				var images []string
				if err := json.Unmarshal([]byte(p.Images.String), &images); err != nil {
					log.Printf("⚠️ Failed to parse images for product %d: %v", p.ID, err)
					product["images"] = []string{}
				} else {
					product["images"] = images
				}
			} else {
				product["images"] = []string{}
			}

			products = append(products, product)
		}

		c.JSON(http.StatusOK, products)
	}
}

// FindProductByBarcode searches products and variants by barcode/sku/barid for a company
func FindProductByBarcode(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID := c.Query("companyId")
		query := strings.ToLower(strings.TrimSpace(c.Query("q")))
		if query == "" || companyID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "companyId and q are required"})
			return
		}

		var productID int64
		// Search product-level barcode/barid first
		err := db.QueryRow(`
			SELECT id FROM products
			WHERE company_id = $1 AND (LOWER(barcode) = $2 OR LOWER(barid) = $2)
			LIMIT 1
		`, companyID, query).Scan(&productID)

		if err == sql.ErrNoRows {
			// Search product_variants barcode/sku/barid — also return variant pricing
			var variantID int64
			var variantPrice float64
			var variantSellingPrice sql.NullFloat64
			var variantMarkupPercent sql.NullFloat64
			err = db.QueryRow(`
				SELECT pv.product_id, pv.id, pv.price,
				       pv.selling_price,
				       pv.markup_percent
				FROM product_variants pv
				JOIN products p ON p.id = pv.product_id
				WHERE p.company_id = $1
				  AND (LOWER(pv.barcode) = $2 OR LOWER(pv.sku) = $2 OR LOWER(pv.barid) = $2)
				LIMIT 1
			`, companyID, query).Scan(&productID, &variantID, &variantPrice, &variantSellingPrice, &variantMarkupPercent)

			if err == sql.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{"found": false})
				return
			}
			if err != nil {
				log.Printf("❌ FindProductByBarcode variant error: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Search failed"})
				return
			}

			// Calculate selling price if not stored explicitly
			sellingPrice := variantPrice
			if variantSellingPrice.Valid && variantSellingPrice.Float64 > 0 {
				sellingPrice = variantSellingPrice.Float64
			} else if variantMarkupPercent.Valid && variantMarkupPercent.Float64 > 0 {
				sellingPrice = variantPrice * (1 + variantMarkupPercent.Float64/100.0)
			}

			c.JSON(http.StatusOK, gin.H{
				"found":               true,
				"productId":           productID,
				"variantId":           variantID,
				"variantPrice":        variantPrice,
				"variantSellingPrice": sellingPrice,
			})
			return
		}

		if err != nil {
			log.Printf("❌ FindProductByBarcode error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Search failed"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"found": true, "productId": productID})
	}
}
