package handlers

import (
	"database/sql"
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

// ─── Декоративные видео (загружает админ, используют все компании) ─────────────

const maxDecorationVideoBytes = 12 * 1024 * 1024 // 12 МБ (с запасом под ~10 МБ ролики)

// ListDecorationVideos — GET /decoration-videos. Публичный список роликов,
// которые компании могут использовать как анимированный фон страницы магазина.
func ListDecorationVideos(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`SELECT id, COALESCE(title, ''), url, created_at FROM decoration_videos ORDER BY created_at DESC`)
		if err != nil {
			c.JSON(http.StatusOK, []interface{}{})
			return
		}
		defer rows.Close()
		out := make([]map[string]interface{}, 0)
		for rows.Next() {
			var (
				id        int64
				title     string
				url       string
				createdAt time.Time
			)
			if err := rows.Scan(&id, &title, &url, &createdAt); err != nil {
				continue
			}
			out = append(out, map[string]interface{}{
				"id":        id,
				"title":     title,
				"url":       url,
				"createdAt": createdAt,
			})
		}
		c.JSON(http.StatusOK, out)
	}
}

// UploadDecorationVideo — POST /decoration-videos (только админ). Принимает
// multipart-файл "file" (короткое видео до 12 МБ) и опциональное поле title.
func UploadDecorationVideo(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		file, err := c.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No file provided"})
			return
		}
		if file.Size > maxDecorationVideoBytes {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Video too large (max 12 MB)"})
			return
		}

		ext := strings.ToLower(filepath.Ext(file.Filename))
		switch ext {
		case ".mp4", ".webm", ".mov", ".m4v":
			// ok
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported video format"})
			return
		}

		newFilename := fmt.Sprintf("decor_%d%s", time.Now().UnixNano(), ext)
		uploadPath := filepath.Join("uploads", "decoration_videos", newFilename)
		if err := os.MkdirAll(filepath.Dir(uploadPath), 0755); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory"})
			return
		}
		if err := c.SaveUploadedFile(file, uploadPath); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
			return
		}

		videoURL := fmt.Sprintf("/uploads/decoration_videos/%s", newFilename)
		title := strings.TrimSpace(c.PostForm("title"))

		var id int64
		err = db.QueryRow(
			`INSERT INTO decoration_videos (title, url) VALUES ($1, $2) RETURNING id`,
			title, videoURL,
		).Scan(&id)
		if err != nil {
			log.Printf("❌ UploadDecorationVideo: insert failed: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save video"})
			return
		}

		log.Printf("✅ UploadDecorationVideo: video %d uploaded: %s", id, videoURL)
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"id":      id,
			"title":   title,
			"url":     videoURL,
		})
	}
}

// DeleteDecorationVideo — DELETE /decoration-videos/:id (только админ).
func DeleteDecorationVideo(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}
		// Удаляем файл с диска (если получится), затем запись.
		var url string
		_ = db.QueryRow(`SELECT url FROM decoration_videos WHERE id = $1`, id).Scan(&url)
		if url != "" {
			_ = os.Remove(filepath.Join(".", strings.TrimPrefix(url, "/")))
		}
		if _, err := db.Exec(`DELETE FROM decoration_videos WHERE id = $1`, id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}
