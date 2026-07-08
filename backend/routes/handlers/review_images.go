package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// UploadReviewImage — приём фотографии для отзыва о товаре.
// Принимает multipart-поле "image", сохраняет в ./uploads/reviews и возвращает
// {"url": "/uploads/reviews/<file>"} для последующей отправки вместе с отзывом.
func UploadReviewImage(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		file, err := c.FormFile("image")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
			return
		}

		// Простая валидация типа по расширению.
		ext := strings.ToLower(filepath.Ext(file.Filename))
		switch ext {
		case ".jpg", ".jpeg", ".png", ".webp", ".heic":
		default:
			ext = ".jpg"
		}

		uploadDir := "./uploads/reviews"
		os.MkdirAll(uploadDir, 0755)

		filename := fmt.Sprintf("rev_%d%s", time.Now().UnixNano(), ext)
		savePath := filepath.Join(uploadDir, filename)

		if err := c.SaveUploadedFile(file, savePath); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
			return
		}
		optimizeImage(savePath) // 🖼️ сжатие/ресайз

		c.JSON(http.StatusOK, gin.H{"url": "/uploads/reviews/" + filename})
	}
}
