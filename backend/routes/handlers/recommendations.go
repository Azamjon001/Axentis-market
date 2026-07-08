package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// productCardSelect — единый набор колонок карточки товара (как в каталоге),
// чтобы «Недавно смотрели» и «Рекомендуем вам» рендерились теми же карточками.
// Требует алиасы p (products) и c (companies) в запросе.
const productCardSelect = `
	p.id, p.company_id, p.name, p.quantity, p.price, p.markup_percent,
	COALESCE(
		NULLIF((SELECT MIN(pv.selling_price) FROM product_variants pv WHERE pv.product_id = p.id AND pv.selling_price > 0), 0),
		NULLIF(p.selling_price, 0),
		p.price * (1.0 + COALESCE(p.markup_percent, 0) / 100.0)
	) AS selling_price,
	p.markup_amount, p.barcode, p.barid, p.category, p.images,
	p.description, p.brand, p.has_color_options, p.available_for_customers,
	COALESCE(p.sold_count, 0) AS sold_count, p.created_at, p.updated_at,
	COALESCE(c.name, '') AS company_name,
	COALESCE((SELECT AVG(cr.rating) FROM company_ratings cr WHERE cr.company_id = c.id), 0) AS company_rating
`

// scanProductCards разбирает строки запроса с productCardSelect в карточки (camelCase).
func scanProductCards(rows *sql.Rows) []map[string]interface{} {
	out := make([]map[string]interface{}, 0)
	if rows == nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var (
			id, companyID                                 int64
			name, companyName                             string
			quantity                                      int
			soldCount                                     int64
			price, markupPercent, sellingPrice, markupAmt float64
			companyRating                                 float64
			barcode, barid, cat, images, desc, brand      sql.NullString
			hasColorOptions, available                    bool
			createdAt, updatedAt                          time.Time
		)
		if err := rows.Scan(&id, &companyID, &name, &quantity, &price, &markupPercent,
			&sellingPrice, &markupAmt, &barcode, &barid, &cat, &images,
			&desc, &brand, &hasColorOptions, &available,
			&soldCount, &createdAt, &updatedAt, &companyName, &companyRating); err != nil {
			continue
		}
		m := map[string]interface{}{
			"id":                    id,
			"companyId":             companyID,
			"companyName":           companyName,
			"name":                  name,
			"quantity":              quantity,
			"price":                 price,
			"markupPercent":         markupPercent,
			"sellingPrice":          sellingPrice,
			"markupAmount":          markupAmt,
			"hasColorOptions":       hasColorOptions,
			"availableForCustomers": available,
			"soldCount":             soldCount,
			"companyRating":         companyRating,
			"createdAt":             createdAt,
			"updatedAt":             updatedAt,
		}
		if brand.Valid {
			m["brand"] = brand.String
		}
		if barcode.Valid {
			m["barcode"] = barcode.String
		}
		if barid.Valid {
			m["barid"] = barid.String
		}
		if cat.Valid {
			m["category"] = cat.String
		}
		if desc.Valid {
			m["description"] = desc.String
		}
		if images.Valid {
			var arr []string
			if json.Unmarshal([]byte(images.String), &arr) == nil {
				m["images"] = arr
			} else {
				m["images"] = []string{}
			}
		} else {
			m["images"] = []string{}
		}
		out = append(out, m)
	}
	return out
}

// GetRecentlyViewed — GET /users/:phone/recently-viewed?limit=
// Товары, которые пользователь недавно открывал (по таблице product_views).
func GetRecentlyViewed(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		phone := c.Param("phone")
		limit := 12
		if v, err := strconv.Atoi(c.Query("limit")); err == nil && v > 0 && v <= 50 {
			limit = v
		}
		rows, err := db.Query(`
			SELECT `+productCardSelect+`
			FROM product_views vv
			JOIN products p ON p.id = vv.product_id
			LEFT JOIN companies c ON c.id = p.company_id
			WHERE vv.user_phone = $1 AND p.available_for_customers = true
			ORDER BY vv.last_viewed_at DESC
			LIMIT $2
		`, phone, limit)
		if err != nil {
			c.JSON(http.StatusOK, []interface{}{})
			return
		}
		c.JSON(http.StatusOK, scanProductCards(rows))
	}
}

// GetRecommendations — GET /users/:phone/recommendations?limit=
// «Рекомендуем вам»: товары из категорий/брендов, которые пользователь смотрел
// или добавлял в избранное, исключая уже просмотренные, по популярности.
func GetRecommendations(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		phone := c.Param("phone")
		limit := 12
		if v, err := strconv.Atoi(c.Query("limit")); err == nil && v > 0 && v <= 50 {
			limit = v
		}
		rows, err := db.Query(`
			WITH interests AS (
				SELECT DISTINCT COALESCE(p.category,'') AS cat, COALESCE(p.brand,'') AS brand
				FROM products p
				WHERE p.id IN (
					SELECT product_id FROM product_views WHERE user_phone = $1
					UNION
					SELECT product_id FROM user_favorites WHERE user_phone = $1
				)
			)
			SELECT `+productCardSelect+`
			FROM products p
			LEFT JOIN companies c ON c.id = p.company_id
			WHERE p.available_for_customers = true
			  AND (c.mode = 'public' OR c.mode IS NULL)
			  AND (
			      p.category IN (SELECT cat FROM interests WHERE cat <> '')
			      OR COALESCE(p.brand,'') IN (SELECT brand FROM interests WHERE brand <> '')
			  )
			  AND p.id NOT IN (SELECT product_id FROM product_views WHERE user_phone = $1)
			ORDER BY COALESCE(p.sold_count,0) DESC, p.created_at DESC
			LIMIT $2
		`, phone, limit)
		if err != nil {
			c.JSON(http.StatusOK, []interface{}{})
			return
		}
		c.JSON(http.StatusOK, scanProductCards(rows))
	}
}
