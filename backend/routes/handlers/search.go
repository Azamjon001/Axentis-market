package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

// SearchProducts is a typo-tolerant, relevance-ranked product search across all
// public products. It combines a substring match (ILIKE) with trigram
// similarity (pg_trgm) so small typos still find the right product, and ranks
// exact/substring matches above fuzzy ones, then by popularity (sold_count).
//
// Filters (all optional): minPrice, maxPrice, category, brand.
// Sort (optional): sort=relevance (default) | price_asc | price_desc | popular | new.
func SearchProducts(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		q := strings.TrimSpace(c.Query("q"))
		if q == "" {
			c.JSON(http.StatusOK, []interface{}{})
			return
		}
		limit := 30
		if l := c.Query("limit"); l != "" {
			if v, err := strconv.Atoi(l); err == nil && v > 0 && v <= 100 {
				limit = v
			}
		}

		// Дополнительные фильтры — как у больших маркетплейсов: цена/бренд/
		// категория прямо в поисковой выдаче.
		filters := ""
		args := []interface{}{q}
		// 🔐 Изоляция режимов: публичный поиск — только публичные компании;
		// закрытое приложение ищет строго среди товаров своей компании.
		modeCond := modeCondition(c, "c", &args)
		arg := len(args) + 1
		addF := func(cond string, val interface{}) {
			filters += " AND " + strings.Replace(cond, "?", "$"+strconv.Itoa(arg), 1)
			args = append(args, val)
			arg++
		}
		if v, err := strconv.ParseFloat(c.Query("minPrice"), 64); err == nil && v > 0 {
			addF(`COALESCE(
			           NULLIF((SELECT MIN(pv.selling_price) FROM product_variants pv WHERE pv.product_id = p.id AND pv.selling_price > 0), 0),
			           NULLIF(p.selling_price, 0),
			           p.price * (1.0 + COALESCE(p.markup_percent, 0) / 100.0)
			       ) >= ?`, v)
		}
		if v, err := strconv.ParseFloat(c.Query("maxPrice"), 64); err == nil && v > 0 {
			addF(`COALESCE(
			           NULLIF((SELECT MIN(pv.selling_price) FROM product_variants pv WHERE pv.product_id = p.id AND pv.selling_price > 0), 0),
			           NULLIF(p.selling_price, 0),
			           p.price * (1.0 + COALESCE(p.markup_percent, 0) / 100.0)
			       ) <= ?`, v)
		}
		if v := strings.TrimSpace(c.Query("category")); v != "" {
			addF(`COALESCE(p.category, '') ILIKE ?`, v)
		}
		if v := strings.TrimSpace(c.Query("brand")); v != "" {
			addF(`COALESCE(p.brand, '') ILIKE ?`, v)
		}

		// Область видимости: публичный покупатель видит только публичные
		// компании; покупатель закрытой компании — только её товары.
		visibility := visibilityCond(c, "c", &args, &arg)

		orderBy := "rank DESC, sold_count DESC"
		switch c.Query("sort") {
		case "price_asc":
			orderBy = "selling_price ASC NULLS LAST, rank DESC"
		case "price_desc":
			orderBy = "selling_price DESC NULLS LAST, rank DESC"
		case "popular":
			orderBy = "sold_count DESC, rank DESC"
		case "new":
			orderBy = "p.created_at DESC, rank DESC"
		}

		args = append(args, limit)
		rows, err := db.Query(`
			SELECT p.id, p.company_id, p.name, p.quantity,
			       COALESCE(
			           NULLIF((SELECT MIN(pv.selling_price) FROM product_variants pv WHERE pv.product_id = p.id AND pv.selling_price > 0), 0),
			           NULLIF(p.selling_price, 0),
			           p.price * (1.0 + COALESCE(p.markup_percent, 0) / 100.0)
			       ) AS selling_price,
			       p.images, p.category, p.brand, COALESCE(p.sold_count, 0), p.created_at,
			       c.name AS company_name,
			       GREATEST(
			           word_similarity($1, p.name),
			           CASE WHEN p.article = $1 THEN 1.0 ELSE 0 END,
			           CASE WHEN p.name ILIKE '%' || $1 || '%' THEN 0.95 ELSE 0 END,
			           CASE WHEN COALESCE(p.category, '') ILIKE '%' || $1 || '%' THEN 0.6 ELSE 0 END,
			           CASE WHEN COALESCE(p.brand, '') ILIKE '%' || $1 || '%' THEN 0.6 ELSE 0 END
			       ) AS rank
			FROM products p
			LEFT JOIN companies c ON p.company_id = c.id
			WHERE p.available_for_customers = TRUE
			  AND `+modeCond+`
			  AND p.name NOT LIKE '__CATEGORY_MARKER__%'
			  AND (
			        p.article = $1
			     OR p.name ILIKE '%' || $1 || '%'
			     OR word_similarity($1, p.name) > 0.3
			     OR COALESCE(p.category, '') ILIKE '%' || $1 || '%'
			     OR COALESCE(p.brand, '') ILIKE '%' || $1 || '%'
			  )`+filters+`
			ORDER BY `+orderBy+`
			LIMIT $`+strconv.Itoa(arg), args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Search failed"})
			return
		}
		defer rows.Close()

		results := make([]gin.H, 0)
		for rows.Next() {
			var (
				id, companyID int64
				name          string
				quantity      int
				selling       sql.NullFloat64
				images        sql.NullString
				category      sql.NullString
				brand         sql.NullString
				soldCount     int
				createdAt     string
				companyName   sql.NullString
				rank          float64
			)
			if err := rows.Scan(&id, &companyID, &name, &quantity, &selling, &images,
				&category, &brand, &soldCount, &createdAt, &companyName, &rank); err != nil {
				continue
			}
			results = append(results, gin.H{
				"id":          id,
				"company_id":  companyID,
				"name":        name,
				"quantity":    quantity,
				"price":       selling.Float64,
				"images":      images.String,
				"category":    category.String,
				"brand":       brand.String,
				"sold_count":  soldCount,
				"created_at":  createdAt,
				"companyName": companyName.String,
			})
		}
		c.JSON(http.StatusOK, results)
	}
}

// SuggestProducts is a lightweight autocomplete endpoint for the search box:
// returns up to 8 name/brand/category suggestions for a prefix, ranked by
// popularity. Designed to be called on every keystroke (small payload, one
// indexed query).
func SuggestProducts(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		q := strings.TrimSpace(c.Query("q"))
		if len([]rune(q)) < 2 {
			c.JSON(http.StatusOK, []interface{}{})
			return
		}

		// 🔐 Изоляция режимов во всех ветках подсказок: раньше бренды и категории
		// не фильтровались по режиму — названия брендов/категорий закрытых
		// компаний утекали в публичное автодополнение.
		args := []interface{}{q}
		modeCond := modeCondition(c, "c", &args)
		rows, err := db.Query(`
			SELECT s.label, s.kind, SUM(s.weight) AS w
			FROM (
				SELECT p.name AS label, 'product' AS kind, COALESCE(p.sold_count, 0) + 1 AS weight
				FROM products p
				LEFT JOIN companies c ON p.company_id = c.id
				WHERE p.available_for_customers = TRUE
				  AND `+modeCond+`
				  AND p.name NOT LIKE '__CATEGORY_MARKER__%'
				  AND (p.name ILIKE $1 || '%' OR p.name ILIKE '% ' || $1 || '%' OR word_similarity($1, p.name) > 0.4)
				UNION ALL
				SELECT p.brand AS label, 'brand' AS kind, COALESCE(p.sold_count, 0) + 1 AS weight
				FROM products p
				LEFT JOIN companies c ON p.company_id = c.id
				WHERE COALESCE(p.brand, '') <> '' AND p.available_for_customers = TRUE
				  AND `+modeCond+`
				  AND p.brand ILIKE $1 || '%'
				UNION ALL
				SELECT p.category AS label, 'category' AS kind, COALESCE(p.sold_count, 0) + 1 AS weight
				FROM products p
				LEFT JOIN companies c ON p.company_id = c.id
				WHERE COALESCE(p.category, '') <> '' AND p.available_for_customers = TRUE
				  AND `+modeCond+`
				  AND p.category ILIKE $1 || '%'
			) s
			GROUP BY s.label, s.kind
			ORDER BY w DESC
			LIMIT 8
		`, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Suggest failed"})
			return
		}
		defer rows.Close()

		suggestions := make([]gin.H, 0, 8)
		for rows.Next() {
			var label, kind string
			var w float64
			if err := rows.Scan(&label, &kind, &w); err != nil {
				continue
			}
			suggestions = append(suggestions, gin.H{"label": label, "type": kind})
		}
		c.JSON(http.StatusOK, suggestions)
	}
}

// GetCompanyQuestions lists product questions for a whole company (for the
// seller's "answer questions" panel). ?unanswered=true filters to open ones.
func GetCompanyQuestions(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID := c.Param("companyId")
		onlyUnanswered := c.Query("unanswered") == "true"

		query := `
			SELECT q.id, q.product_id, p.name, COALESCE(q.user_name, ''), q.question,
			       COALESCE(q.answer, ''), q.is_answered, q.created_at
			FROM product_questions q
			LEFT JOIN products p ON q.product_id = p.id
			WHERE q.company_id = $1`
		if onlyUnanswered {
			query += ` AND q.is_answered = FALSE`
		}
		query += ` ORDER BY q.created_at DESC LIMIT 200`

		rows, err := db.Query(query, companyID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch questions"})
			return
		}
		defer rows.Close()

		list := make([]gin.H, 0)
		for rows.Next() {
			var (
				id, productID int64
				productName   sql.NullString
				userName      string
				question      string
				answer        string
				isAnswered    bool
				createdAt     string
			)
			if err := rows.Scan(&id, &productID, &productName, &userName, &question, &answer, &isAnswered, &createdAt); err != nil {
				continue
			}
			list = append(list, gin.H{
				"id": id, "productId": productID, "productName": productName.String,
				"userName": userName, "question": question, "answer": answer,
				"isAnswered": isAnswered, "createdAt": createdAt,
			})
		}
		c.JSON(http.StatusOK, list)
	}
}
