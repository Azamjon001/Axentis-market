package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/lib/pq"
)

// 🧩 Комплекты «вместе дешевле».
//
// Механика (как просил владелец): компания продаёт масло, яблоки, молоко и
// плиту; делает комплект «масло + яблоки + плита −10%». Покупатель, который
// открыл ЛЮБОЙ товар комплекта, видит блок «Вместе дешевле»; тем, кто уже
// ПОКУПАЛ товар из комплекта у этой компании, при создании комплекта уходит
// push «докупите остальное — получите скидку». Скидка применяется в
// оформлении заказа автоматически, когда все товары комплекта в корзине.

type bundleItem struct {
	ID    int64   `json:"id"`
	Name  string  `json:"name"`
	Price float64 `json:"price"`
	Image string  `json:"image"`
}

// loadBundleItems возвращает краткие карточки товаров комплекта.
func loadBundleItems(db *sql.DB, ids []int64) []bundleItem {
	items := []bundleItem{}
	rows, err := db.Query(`
		SELECT id, name,
		       COALESCE(NULLIF(selling_price, 0), price * (1.0 + COALESCE(markup_percent, 0) / 100.0)),
		       images::text
		FROM products WHERE id = ANY($1)
	`, pq.Array(ids))
	if err != nil {
		return items
	}
	defer rows.Close()
	for rows.Next() {
		var it bundleItem
		var imagesJSON sql.NullString
		if rows.Scan(&it.ID, &it.Name, &it.Price, &imagesJSON) != nil {
			continue
		}
		if imagesJSON.Valid {
			var imgs []string
			if json.Unmarshal([]byte(imagesJSON.String), &imgs) == nil && len(imgs) > 0 {
				it.Image = imgs[0]
			}
		}
		items = append(items, it)
	}
	return items
}

// CreateBundle — POST /companies/:id/bundles  {name?, discountPercent, productIds}
func CreateBundle(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid company id"})
			return
		}
		var req struct {
			Name            string  `json:"name"`
			DiscountPercent float64 `json:"discountPercent"`
			ProductIDs      []int64 `json:"productIds"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}
		if len(req.ProductIDs) < 2 || len(req.ProductIDs) > 5 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "В комплекте должно быть от 2 до 5 товаров"})
			return
		}
		if req.DiscountPercent < 1 || req.DiscountPercent > 90 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Скидка комплекта — от 1 до 90 процентов"})
			return
		}
		// Все товары должны принадлежать этой компании.
		var owned int
		db.QueryRow(`SELECT COUNT(*) FROM products WHERE company_id = $1 AND id = ANY($2)`,
			companyID, pq.Array(req.ProductIDs)).Scan(&owned)
		if owned != len(req.ProductIDs) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Все товары комплекта должны принадлежать вашему магазину"})
			return
		}

		var id int64
		err = db.QueryRow(`
			INSERT INTO product_bundles (company_id, name, discount_percent, product_ids)
			VALUES ($1, NULLIF($2, ''), $3, $4) RETURNING id
		`, companyID, req.Name, req.DiscountPercent, pq.Array(req.ProductIDs)).Scan(&id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create bundle"})
			return
		}

		// 📣 Асинхронно зовём тех, кто уже покупал товар из комплекта у этой
		// компании: «докупите остальное — получите скидку».
		go notifyBundleToPastBuyers(db, companyID, id, req.ProductIDs, req.DiscountPercent)

		c.JSON(http.StatusCreated, gin.H{"id": id})
	}
}

// notifyBundleToPastBuyers шлёт push покупателям, бравшим любой товар
// комплекта у этой компании за последние 90 дней (по одному разу на человека).
func notifyBundleToPastBuyers(db *sql.DB, companyID, bundleID int64, productIDs []int64, percent float64) {
	rows, err := db.Query(`
		WITH buyers AS (
			SELECT DISTINCT o.customer_phone AS phone,
			       CASE
			           WHEN item->>'productId'  ~ '^\d+$' THEN (item->>'productId')::bigint
			           WHEN item->>'product_id' ~ '^\d+$' THEN (item->>'product_id')::bigint
			       END AS pid
			FROM orders o, jsonb_array_elements(o.items) item
			WHERE o.company_id = $1
			  AND o.status NOT IN ('cancelled')
			  AND jsonb_typeof(o.items) = 'array'
			  AND o.created_at > NOW() - INTERVAL '90 days'
			  AND COALESCE(o.customer_phone, '') <> ''
		)
		SELECT DISTINCT b.phone, p.name, COALESCE(u.expo_push_token, '')
		FROM buyers b
		JOIN products p ON p.id = b.pid
		LEFT JOIN users u ON u.phone = b.phone
		WHERE b.pid = ANY($2)
		LIMIT 500
	`, companyID, pq.Array(productIDs))
	if err != nil {
		log.Printf("⚠️ BundleNotify query: %v", err)
		return
	}
	defer rows.Close()

	type hit struct {
		phone, product, token string
	}
	seen := map[string]bool{}
	var hits []hit
	for rows.Next() {
		var h hit
		if rows.Scan(&h.phone, &h.product, &h.token) == nil && !seen[h.phone] {
			seen[h.phone] = true
			hits = append(hits, h)
		}
	}

	pct := strconv.Itoa(int(percent))
	// Ведём покупателя на первый товар комплекта — там виден блок «Вместе дешевле».
	firstProduct := productIDs[0]
	for _, h := range hits {
		title := "🧩 Вместе дешевле −" + pct + "%"
		body := "Вы покупали «" + h.product + "». Добавьте остальные товары комплекта и получите скидку " + pct + "%"
		db.Exec(`INSERT INTO notifications (user_phone, type, title, message, product_id)
			VALUES ($1, 'bundle_offer', $2, $3, $4)`, h.phone, title, body, firstProduct)
		if h.token != "" {
			SendExpoPushNotificationData([]string{h.token}, title, body,
				map[string]interface{}{"type": "product", "productId": firstProduct})
		}
	}
	if len(hits) > 0 {
		log.Printf("🧩 Bundle %d: приглашено %d прошлых покупателей", bundleID, len(hits))
	}
}

// GetCompanyBundles — GET /companies/:id/bundles (панель продавца)
func GetCompanyBundles(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID := c.Param("id")
		rows, err := db.Query(`
			SELECT id, COALESCE(name, ''), discount_percent, product_ids, is_active
			FROM product_bundles WHERE company_id = $1 ORDER BY created_at DESC
		`, companyID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load bundles"})
			return
		}
		defer rows.Close()

		list := []gin.H{}
		for rows.Next() {
			var (
				id       int64
				name     string
				percent  float64
				ids      pq.Int64Array
				isActive bool
			)
			if rows.Scan(&id, &name, &percent, &ids, &isActive) != nil {
				continue
			}
			list = append(list, gin.H{
				"id": id, "name": name, "discountPercent": percent,
				"isActive": isActive, "items": loadBundleItems(db, ids),
			})
		}
		c.JSON(http.StatusOK, list)
	}
}

// DeleteBundle — DELETE /companies/:id/bundles/:bundleId
func DeleteBundle(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		if _, err := db.Exec(`DELETE FROM product_bundles WHERE id = $1 AND company_id = $2`,
			c.Param("bundleId"), c.Param("id")); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete bundle"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// GetProductBundles — GET /products/:id/bundles (публичный, для приложения):
// активные комплекты, в которые входит товар, с карточками всех товаров.
func GetProductBundles(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		productID, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product id"})
			return
		}
		rows, err := db.Query(`
			SELECT id, company_id, COALESCE(name, ''), discount_percent, product_ids
			FROM product_bundles
			WHERE is_active = TRUE AND $1 = ANY(product_ids)
			ORDER BY discount_percent DESC
			LIMIT 5
		`, productID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load bundles"})
			return
		}
		defer rows.Close()

		list := []gin.H{}
		for rows.Next() {
			var (
				id, companyID int64
				name          string
				percent       float64
				ids           pq.Int64Array
			)
			if rows.Scan(&id, &companyID, &name, &percent, &ids) != nil {
				continue
			}
			list = append(list, gin.H{
				"id": id, "companyId": companyID, "name": name,
				"discountPercent": percent, "items": loadBundleItems(db, ids),
			})
		}
		c.JSON(http.StatusOK, list)
	}
}
