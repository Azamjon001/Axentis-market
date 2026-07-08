package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
)

// CreateShopStory — POST /companies/:id/stories (продавец).
// Загружает картинку сторис (multipart "file") + необязательные caption/productId.
// Сторис живёт 24 часа.
func CreateShopStory(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID := c.Param("id")

		file, err := c.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No file provided"})
			return
		}
		ext := filepath.Ext(file.Filename)
		newFilename := fmt.Sprintf("story_%s_%d%s", companyID, time.Now().UnixNano(), ext)
		uploadPath := filepath.Join("uploads", "stories", newFilename)
		if err := os.MkdirAll(filepath.Dir(uploadPath), 0755); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory"})
			return
		}
		if err := c.SaveUploadedFile(file, uploadPath); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
			return
		}
		optimizeImage(uploadPath)
		imageURL := fmt.Sprintf("/uploads/stories/%s", newFilename)

		caption := c.PostForm("caption")
		var productID interface{}
		if pid := c.PostForm("productId"); pid != "" {
			productID = pid
		} else {
			productID = nil
		}

		var id int64
		err = db.QueryRow(`
			INSERT INTO shop_stories (company_id, image_url, caption, product_id)
			VALUES ($1, $2, $3, $4) RETURNING id
		`, companyID, imageURL, caption, productID).Scan(&id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save story"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"id": id, "imageUrl": imageURL})
	}
}

// GetActiveStories — GET /stories?phone=... (витрина).
// Сторис показываем ТОЛЬКО от магазинов, на которые покупатель подписан.
// Без телефона (гость) или без подписок — лента пустая.
func GetActiveStories(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		phone := c.Query("phone")
		if phone == "" {
			c.JSON(http.StatusOK, []gin.H{})
			return
		}
		rows, err := db.Query(`
			SELECT s.id, s.company_id, c.name, COALESCE(c.logo_url, ''),
			       s.image_url, COALESCE(s.caption, ''), s.product_id, s.created_at,
			       COALESCE(c.is_verified, FALSE)
			FROM shop_stories s
			JOIN companies c ON c.id = s.company_id
			JOIN company_subscribers cs ON cs.company_id = s.company_id AND cs.user_phone = $1
			WHERE s.expires_at > NOW()
			ORDER BY s.company_id, s.created_at
		`, phone)
		if err != nil {
			c.JSON(http.StatusOK, []gin.H{})
			return
		}
		defer rows.Close()

		// group by company preserving order
		order := make([]int64, 0)
		groups := make(map[int64]gin.H)
		for rows.Next() {
			var id, companyID int64
			var name, logo, img, caption, createdAt string
			var productID sql.NullInt64
			var verified bool
			if rows.Scan(&id, &companyID, &name, &logo, &img, &caption, &productID, &createdAt, &verified) != nil {
				continue
			}
			g, ok := groups[companyID]
			if !ok {
				g = gin.H{"companyId": companyID, "companyName": name, "companyLogo": logo, "verified": verified, "stories": []gin.H{}}
				groups[companyID] = g
				order = append(order, companyID)
			}
			story := gin.H{"id": id, "imageUrl": img, "caption": caption, "createdAt": createdAt}
			if productID.Valid {
				story["productId"] = productID.Int64
			}
			g["stories"] = append(g["stories"].([]gin.H), story)
		}

		out := make([]gin.H, 0, len(order))
		for _, cid := range order {
			out = append(out, groups[cid])
		}
		c.JSON(http.StatusOK, out)
	}
}

// GetCompanyStories — GET /companies/:id/stories (продавец видит свои).
func GetCompanyStories(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID := c.Param("id")
		rows, err := db.Query(`
			SELECT id, image_url, COALESCE(caption, ''), views, created_at, expires_at,
			       (expires_at > NOW()) AS active
			FROM shop_stories WHERE company_id = $1
			ORDER BY created_at DESC LIMIT 50
		`, companyID)
		if err != nil {
			c.JSON(http.StatusOK, []gin.H{})
			return
		}
		defer rows.Close()
		out := make([]gin.H, 0)
		for rows.Next() {
			var id, views int64
			var img, caption, createdAt, expiresAt string
			var active bool
			if rows.Scan(&id, &img, &caption, &views, &createdAt, &expiresAt, &active) == nil {
				out = append(out, gin.H{"id": id, "imageUrl": img, "caption": caption,
					"views": views, "createdAt": createdAt, "expiresAt": expiresAt, "active": active})
			}
		}
		c.JSON(http.StatusOK, out)
	}
}

// DeleteShopStory — DELETE /companies/:id/stories/:storyId (продавец).
func DeleteShopStory(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID := c.Param("id")
		storyID := c.Param("storyId")
		_, err := db.Exec(`DELETE FROM shop_stories WHERE id = $1 AND company_id = $2`, storyID, companyID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"deleted": true})
	}
}

// ViewShopStory — POST /stories/:id/view (публично): счётчик просмотров.
func ViewShopStory(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		db.Exec(`UPDATE shop_stories SET views = views + 1 WHERE id = $1`, c.Param("id"))
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}
