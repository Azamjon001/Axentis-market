package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// SEO: robots.txt + динамический sitemap.xml. Теперь витрина публичная,
// поэтому Google может индексировать каждый товар и магазин → бесплатный
// поток покупателей из поиска. Ссылки ведут на /product/:id и /company/:id,
// где боты получают OG-страницу с названием, ценой и фото (share.go).

// RobotsTxt — GET /robots.txt
func RobotsTxt(c *gin.Context) {
	base := shareBaseURL(c)
	body := "User-agent: *\n" +
		"Allow: /\n" +
		// Панель бизнеса и внутренние пути индексировать не нужно.
		"Disallow: /business\n" +
		"Disallow: /api\n" +
		"Sitemap: " + base + "/sitemap.xml\n"
	c.Data(http.StatusOK, "text/plain; charset=utf-8", []byte(body))
}

// Sitemap — GET /sitemap.xml
// Перечисляет главную, все доступные товары и публичные магазины.
func Sitemap(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		base := shareBaseURL(c)
		var b strings.Builder
		b.WriteString(`<?xml version="1.0" encoding="UTF-8"?>` + "\n")
		b.WriteString(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` + "\n")

		add := func(loc, lastmod string, priority string) {
			b.WriteString("  <url><loc>")
			b.WriteString(loc)
			b.WriteString("</loc>")
			if lastmod != "" {
				b.WriteString("<lastmod>" + lastmod + "</lastmod>")
			}
			b.WriteString("<priority>" + priority + "</priority></url>\n")
		}

		// Главная
		add(base+"/", time.Now().Format("2006-01-02"), "1.0")

		// Товары, доступные покупателям (публичные магазины).
		if rows, err := db.Query(`
			SELECT p.id, p.updated_at
			FROM products p
			LEFT JOIN companies c ON c.id = p.company_id
			WHERE p.available_for_customers = TRUE
			  AND (c.mode = 'public' OR c.mode IS NULL)
			  AND p.name NOT LIKE '__CATEGORY_MARKER__%'
			ORDER BY p.updated_at DESC NULLS LAST
			LIMIT 50000
		`); err == nil {
			defer rows.Close()
			for rows.Next() {
				var id int64
				var updated sql.NullTime
				if err := rows.Scan(&id, &updated); err != nil {
					continue
				}
				lm := ""
				if updated.Valid {
					lm = updated.Time.Format("2006-01-02")
				}
				add(fmt.Sprintf("%s/product/%d", base, id), lm, "0.8")
			}
		}

		// Публичные одобренные магазины.
		if rows, err := db.Query(`
			SELECT id, updated_at FROM companies
			WHERE status = 'approved' AND (mode = 'public' OR mode IS NULL)
			  AND COALESCE(is_enabled, TRUE) = TRUE
			ORDER BY updated_at DESC NULLS LAST
			LIMIT 50000
		`); err == nil {
			defer rows.Close()
			for rows.Next() {
				var id int64
				var updated sql.NullTime
				if err := rows.Scan(&id, &updated); err != nil {
					continue
				}
				lm := ""
				if updated.Valid {
					lm = updated.Time.Format("2006-01-02")
				}
				add(fmt.Sprintf("%s/company/%d", base, id), lm, "0.6")
			}
		}

		b.WriteString(`</urlset>`)
		c.Data(http.StatusOK, "application/xml; charset=utf-8", []byte(b.String()))
	}
}
