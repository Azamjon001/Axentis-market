package handlers

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
)

// CreateCampaign — POST /companies/:id/campaigns (продавец).
// Создаёт именованную акцию и порождает обычные скидки (discounts) на
// подходящие товары. Товары с уже существующей скидкой не трогаем.
func CreateCampaign(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID := c.Param("id")
		var req struct {
			Name            string  `json:"name"`
			Emoji           string  `json:"emoji"`
			DiscountPercent float64 `json:"discountPercent"`
			Scope           string  `json:"scope"`       // shop | category | brand
			ScopeValue      string  `json:"scopeValue"`  // категория/бренд
			EndsAt          string  `json:"endsAt"`      // ISO-дата окончания
		}
		if err := c.ShouldBindJSON(&req); err != nil || req.Name == "" || req.DiscountPercent <= 0 || req.EndsAt == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "name, discountPercent, endsAt required"})
			return
		}
		if req.Scope != "category" && req.Scope != "brand" {
			req.Scope = "shop"
		}
		if req.Emoji == "" {
			req.Emoji = "🎉"
		}

		var campaignID int64
		err := db.QueryRow(`
			INSERT INTO discount_campaigns (company_id, name, emoji, discount_percent, scope, scope_value, ends_at)
			VALUES ($1, $2, $3, $4, $5, NULLIF($6,''), $7) RETURNING id
		`, companyID, req.Name, req.Emoji, req.DiscountPercent, req.Scope, req.ScopeValue, req.EndsAt).Scan(&campaignID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create campaign"})
			return
		}

		// Порождаем скидки на подходящие товары. Товары, у которых скидка уже
		// есть, пропускаем (ON CONFLICT DO NOTHING) — они и так со скидкой.
		filter := ""
		args := []interface{}{campaignID, req.DiscountPercent, req.EndsAt, companyID}
		switch req.Scope {
		case "category":
			filter = " AND category = $5"
			args = append(args, req.ScopeValue)
		case "brand":
			filter = " AND brand = $5"
			args = append(args, req.ScopeValue)
		}
		res, err := db.Exec(`
			INSERT INTO discounts (company_id, product_id, discount_percent, title, status, start_date, end_date, campaign_id)
			SELECT company_id, id, $2, $8, 'approved', NOW(), $3, $1
			FROM products
			WHERE company_id = $4 AND name NOT LIKE '__CATEGORY_MARKER__%'`+filter+`
			ON CONFLICT (company_id, product_id) DO NOTHING
		`, append(args, req.Name)...)
		affected := int64(0)
		if err == nil {
			affected, _ = res.RowsAffected()
		}
		c.JSON(http.StatusOK, gin.H{"id": campaignID, "productsDiscounted": affected})
	}
}

// GetCompanyCampaigns — GET /companies/:id/campaigns (продавец).
func GetCompanyCampaigns(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`
			SELECT id, name, emoji, discount_percent, scope, COALESCE(scope_value,''),
			       starts_at, ends_at, (ends_at > NOW() AND is_active) AS active
			FROM discount_campaigns WHERE company_id = $1
			ORDER BY created_at DESC LIMIT 50
		`, c.Param("id"))
		if err != nil {
			c.JSON(http.StatusOK, []gin.H{})
			return
		}
		defer rows.Close()
		out := make([]gin.H, 0)
		for rows.Next() {
			var id int64
			var name, emoji, scope, scopeValue, startsAt, endsAt string
			var pct float64
			var active bool
			if rows.Scan(&id, &name, &emoji, &pct, &scope, &scopeValue, &startsAt, &endsAt, &active) == nil {
				out = append(out, gin.H{"id": id, "name": name, "emoji": emoji, "discountPercent": pct,
					"scope": scope, "scopeValue": scopeValue, "startsAt": startsAt, "endsAt": endsAt, "active": active})
			}
		}
		c.JSON(http.StatusOK, out)
	}
}

// DeleteCampaign — DELETE /companies/:id/campaigns/:campaignId (продавец).
// Снимает порождённые скидки и удаляет кампанию.
func DeleteCampaign(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID := c.Param("id")
		campaignID := c.Param("campaignId")
		db.Exec(`DELETE FROM discounts WHERE campaign_id = $1`, campaignID)
		db.Exec(`DELETE FROM discount_campaigns WHERE id = $1 AND company_id = $2`, campaignID, companyID)
		c.JSON(http.StatusOK, gin.H{"deleted": true})
	}
}

// GetActiveCampaigns — GET /campaigns?region=... (публично).
// Активные кампании с товарами — для именованных рядов на главной.
func GetActiveCampaigns(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`
			SELECT dc.id, dc.name, dc.emoji, dc.company_id
			FROM discount_campaigns dc
			WHERE dc.is_active AND dc.ends_at > NOW() AND dc.starts_at <= NOW()
			ORDER BY dc.created_at DESC LIMIT 8
		`)
		if err != nil {
			c.JSON(http.StatusOK, []gin.H{})
			return
		}
		defer rows.Close()

		out := make([]gin.H, 0)
		for rows.Next() {
			var id, companyID int64
			var name, emoji string
			if rows.Scan(&id, &name, &emoji, &companyID) != nil {
				continue
			}
			// Товары кампании (те, которым она проставила скидку).
			products := make([]gin.H, 0)
			prows, perr := db.Query(`
				SELECT p.id, p.name,
				       COALESCE(NULLIF(p.selling_price,0), p.price*(1.0+COALESCE(p.markup_percent,0)/100.0)) AS selling_price,
				       p.images, COALESCE(p.brand,''), COALESCE(p.category,'')
				FROM products p
				JOIN discounts d ON d.product_id = p.id AND d.campaign_id = $1
				WHERE p.available_for_customers = TRUE AND p.quantity > 0
				LIMIT 12
			`, id)
			if perr == nil {
				for prows.Next() {
					var pid int64
					var pname, images, brand, category string
					var price float64
					if prows.Scan(&pid, &pname, &price, &images, &brand, &category) == nil {
						products = append(products, gin.H{
							"id": pid, "name": pname, "sellingPrice": price,
							"images": parseImagesJSON(images), "brand": brand, "category": category,
						})
					}
				}
				prows.Close()
			}
			if len(products) > 0 {
				out = append(out, gin.H{"id": id, "name": name, "emoji": emoji, "companyId": companyID, "products": products})
			}
		}
		c.JSON(http.StatusOK, out)
	}
}
