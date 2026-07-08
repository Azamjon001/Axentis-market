package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// ─── Регионы доставки (границы рисует админ, компании выбирают) ───────────────

// ListRegions — GET /regions. Публичный список регионов с границами (GeoJSON).
func ListRegions(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`
			SELECT id, name, COALESCE(name_uz, ''), parent_id, COALESCE(geojson::text, 'null')
			FROM regions
			ORDER BY parent_id NULLS FIRST, name
		`)
		if err != nil {
			c.JSON(http.StatusOK, []interface{}{})
			return
		}
		defer rows.Close()
		out := make([]map[string]interface{}, 0)
		for rows.Next() {
			var (
				id       int64
				name     string
				nameUz   string
				parentID sql.NullInt64
				geojson  string
			)
			if err := rows.Scan(&id, &name, &nameUz, &parentID, &geojson); err != nil {
				continue
			}
			item := map[string]interface{}{
				"id":      id,
				"name":    name,
				"nameUz":  nameUz,
				"geojson": rawJSON(geojson),
			}
			if parentID.Valid {
				item["parentId"] = parentID.Int64
			}
			out = append(out, item)
		}
		c.JSON(http.StatusOK, out)
	}
}

// rawJSON оборачивает строку JSON, чтобы gin отдал её как объект, а не как строку.
func rawJSON(s string) interface{} {
	if s == "" || s == "null" {
		return nil
	}
	return json.RawMessage(s)
}

// CreateRegion — POST /regions (только админ).
func CreateRegion(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Name     string          `json:"name"`
			NameUz   string          `json:"nameUz"`
			ParentID *int64          `json:"parentId"`
			GeoJSON  json.RawMessage `json:"geojson"`
		}
		if err := c.ShouldBindJSON(&req); err != nil || req.Name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "name required"})
			return
		}
		var geo interface{}
		if len(req.GeoJSON) > 0 && string(req.GeoJSON) != "null" {
			geo = string(req.GeoJSON)
		}
		var id int64
		err := db.QueryRow(`
			INSERT INTO regions (name, name_uz, parent_id, geojson)
			VALUES ($1, $2, $3, $4::jsonb)
			RETURNING id
		`, req.Name, req.NameUz, req.ParentID, geo).Scan(&id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create"})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"id": id})
	}
}

// UpdateRegion — PUT /regions/:id (только админ).
func UpdateRegion(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}
		var req struct {
			Name    string          `json:"name"`
			NameUz  string          `json:"nameUz"`
			GeoJSON json.RawMessage `json:"geojson"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}
		var geo interface{}
		if len(req.GeoJSON) > 0 && string(req.GeoJSON) != "null" {
			geo = string(req.GeoJSON)
		}
		_, err = db.Exec(`
			UPDATE regions SET name = $1, name_uz = $2, geojson = $3::jsonb WHERE id = $4
		`, req.Name, req.NameUz, geo, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// DeleteRegion — DELETE /regions/:id (только админ).
func DeleteRegion(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}
		_, _ = db.Exec(`DELETE FROM regions WHERE id = $1`, id)
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// SetCompanyRegion — PUT /companies/:id/region. Компания выбирает свой регион.
// Используется companyId из токена (а не из пути) — компания меняет только себя.
func SetCompanyRegion(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		cid := c.GetInt64("companyId")
		if cid == 0 {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "auth required"})
			return
		}
		var req struct {
			RegionID *int64 `json:"regionId"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}
		if _, err := db.Exec(`UPDATE companies SET region_id = $1 WHERE id = $2`, req.RegionID, cid); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}
