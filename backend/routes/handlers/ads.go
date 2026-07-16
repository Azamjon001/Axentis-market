package handlers

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// Advertisement структура рекламного объявления
type Advertisement struct {
	ID              string     `json:"id"`
	Title           string     `json:"title"`
	Content         string     `json:"content"`
	Caption         *string    `json:"caption,omitempty"`
	ImageURL        *string    `json:"image_url,omitempty"`
	LinkURL         *string    `json:"link_url,omitempty"`
	Status          string     `json:"status"` // pending, approved, rejected
	AdType          string     `json:"ad_type"` // company, product
	CompanyID       *string    `json:"company_id,omitempty"`
	CompanyName     *string    `json:"company_name,omitempty"`
	ProductID       *string    `json:"product_id,omitempty"`
	ProductName     *string    `json:"product_name,omitempty"`
	ProductPrice    *float64   `json:"product_price,omitempty"`
	ProductImage    *string    `json:"product_image,omitempty"`
	SubmittedAt     *time.Time `json:"submitted_at,omitempty"`
	ReviewedAt      *time.Time `json:"reviewed_at,omitempty"`
	RejectionReason *string    `json:"rejection_reason,omitempty"`
	AdminMessage    *string    `json:"admin_message,omitempty"` // 🆕 Подробное сообщение от админа
	DurationDays    int        `json:"duration_days"`           // Срок размещения (2–7 дней), выбирает компания
	ExpiresAt       *time.Time `json:"expires_at,omitempty"`    // Когда баннер снимается (reviewed_at + duration_days)
	CreatedAt       time.Time  `json:"created_at"`
}

const (
	adMinDurationDays = 2
	adMaxDurationDays = 7
)

// GetApprovedAds возвращает рекламные объявления по фильтрам
func GetApprovedAds(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		status := c.Query("status")
		companyID := c.Query("companyId")
		
		log.Printf("📢 GetAds: status=%s, companyId=%s", status, companyID)

		// ⏳ Снимаем баннеры с истёкшим сроком размещения
		if _, err := db.Exec(`
			UPDATE advertisements
			SET status = 'expired', updated_at = NOW()
			WHERE status = 'approved' AND expires_at IS NOT NULL AND expires_at < NOW()
		`); err != nil {
			log.Printf("⚠️ [GetAds] Failed to expire ads: %v", err)
		}

		var ads []Advertisement
		var rows *sql.Rows
		var err error
		
		// Базовый запрос с поддержкой типов рекламы
		query := `
			SELECT 
				a.id, 
				a.title, 
				a.content, 
				a.caption, 
				a.image_url, 
				a.link_url, 
				a.status,
				COALESCE(a.ad_type, 'company') as ad_type,
				a.company_id,
				c.name as company_name,
				a.product_id,
				p.name as product_name,
				p.price as product_price,
				(p.images->0->>'url') as product_image,
				a.submitted_at,
				a.reviewed_at,
				a.rejection_reason,
				a.admin_message,
				COALESCE(a.duration_days, 7) as duration_days,
				a.expires_at,
				a.created_at
			FROM advertisements a
			LEFT JOIN companies c ON a.company_id = c.id
			LEFT JOIN products p ON a.product_id = p.id
		`
		
		// Строим WHERE условия
		var conditions []string
		var args []interface{}
		argCount := 1
		
		if status != "" {
			conditions = append(conditions, fmt.Sprintf("a.status = $%d", argCount))
			args = append(args, status)
			argCount++
		}
		
		if companyID != "" {
			conditions = append(conditions, fmt.Sprintf("a.company_id = $%d", argCount))
			args = append(args, companyID)
			argCount++
		} else {
			// 🔐 Публичная лента баннеров: изоляция публичного/закрытого режима.
			// Запрос по конкретной компании (панель) не трогаем — компания видит
			// свои баннеры независимо от режима.
			conditions = append(conditions, modeCondition(c, "c", &args))
			argCount = len(args) + 1
		}

		if len(conditions) > 0 {
			query += " WHERE " + strings.Join(conditions, " AND ")
		}
		
		query += " ORDER BY a.created_at DESC"
		
		rows, err = db.Query(query, args...)
		
		if err != nil {
			log.Printf("❌ Error querying ads: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to load advertisements",
			})
			return
		}
		defer rows.Close()
		
		for rows.Next() {
			var ad Advertisement
			var productPrice sql.NullFloat64
			err := rows.Scan(
				&ad.ID,
				&ad.Title,
				&ad.Content,
				&ad.Caption,
				&ad.ImageURL,
				&ad.LinkURL,
				&ad.Status,
				&ad.AdType,
				&ad.CompanyID,
				&ad.CompanyName,
				&ad.ProductID,
				&ad.ProductName,
				&productPrice,
				&ad.ProductImage,
				&ad.SubmittedAt,
				&ad.ReviewedAt,
				&ad.RejectionReason,
				&ad.AdminMessage, // 🆕 Добавлено
				&ad.DurationDays,
				&ad.ExpiresAt,
				&ad.CreatedAt,
			)
			if err != nil {
				log.Printf("❌ Error scanning ad: %v", err)
				continue
			}
			
			// Конвертируем productPrice
			if productPrice.Valid {
				ad.ProductPrice = &productPrice.Float64
			}
			
			ads = append(ads, ad)
		}
		
		if ads == nil {
			ads = []Advertisement{}
		}
		
		log.Printf("✅ [GetAds] Loaded %d ads (status=%s, companyId=%s)", len(ads), status, companyID)
		
		// Дополнительное логирование для отладки
		if len(ads) > 0 {
			log.Printf("📊 [GetAds] Sample ad: ID=%s, Title=%s, Status=%s", ads[0].ID, ads[0].Title, ads[0].Status)
		}
		
		c.JSON(http.StatusOK, gin.H{
			"ads": ads,
		})
	}
}

// CreateAd создает новое рекламное объявление
func CreateAd(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Title     string  `json:"title" binding:"required"`
			Content   string  `json:"content" binding:"required"`
			Caption   *string `json:"caption"`
			ImageURL  *string `json:"image_url"` // ✅ Изменено с imageUrl на image_url
			LinkURL   *string `json:"link_url"`  // ✅ Изменено с linkUrl на link_url
			AdType       string  `json:"ad_type" binding:"required,oneof=company product"` // ✅ Изменено с adType на ad_type
			CompanyID    *int64  `json:"company_id"` // ✅ Изменено с companyId на company_id
			ProductID    *int64  `json:"product_id"` // ✅ Изменено с productId на product_id
			DurationDays int     `json:"duration_days"` // Срок размещения (2–7 дней)
		}
		
		if err := c.ShouldBindJSON(&req); err != nil {
			log.Printf("❌ CreateAd binding error: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		
		log.Printf("📢 CreateAd received: title=%s, image_url=%v, ad_type=%s, company_id=%v", 
			req.Title, req.ImageURL, req.AdType, req.CompanyID)
		
		// Компания создаёт рекламу только от своего имени.
		if !isAdmin(c) {
			cid := ctxCompanyID(c)
			req.CompanyID = &cid
		}

		// Валидация: для product рекламы нужен productId
		if req.AdType == "product" && (req.ProductID == nil || *req.ProductID == 0) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "productId is required for product ads"})
			return
		}

		// Срок размещения: минимум 2 дня, максимум неделя
		if req.DurationDays == 0 {
			req.DurationDays = adMaxDurationDays
		}
		if req.DurationDays < adMinDurationDays || req.DurationDays > adMaxDurationDays {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("duration_days must be between %d and %d", adMinDurationDays, adMaxDurationDays)})
			return
		}

		// Создаем рекламу со статусом pending
		var adID int
		var err error
		
		log.Printf("📢 CreateAd: Creating %s ad (company: %v, product: %v)", req.AdType, req.CompanyID, req.ProductID)
		
		err = db.QueryRow(`
			INSERT INTO advertisements
			(title, content, caption, image_url, link_url, ad_type, status, company_id, product_id, duration_days, submitted_at, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, $9, NOW(), NOW())
			RETURNING id
		`, req.Title, req.Content, req.Caption, req.ImageURL, req.LinkURL, req.AdType, req.CompanyID, req.ProductID, req.DurationDays).Scan(&adID)
		
		if err != nil {
			log.Printf("❌ Error creating ad: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create ad"})
			return
		}
		
		log.Printf("✅ Created ad ID: %d (company_id: %v, image_url: %v)", adID, req.CompanyID, req.ImageURL)
		
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"id":      adID,
		})
	}
}

// ModerateAd модерирует рекламу (approve/reject)
func ModerateAd(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		adID := c.Param("id")
		
		log.Printf("📝 [ModerateAd] Starting moderation for ad: %s", adID)
		
		var req struct {
			Status       string  `json:"status" binding:"required,oneof=approved rejected"`
			Reason       *string `json:"reason"`
			AdminMessage *string `json:"admin_message"` // 🆕 Подробное сообщение от админа
		}
		
		if err := c.ShouldBindJSON(&req); err != nil {
			log.Printf("❌ [ModerateAd] Invalid request: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		
		log.Printf("📝 [ModerateAd] Setting status to: %s for ad: %s (admin_message: %v)", req.Status, adID, req.AdminMessage)
		
		// При одобрении запускаем отсчёт срока размещения:
		// expires_at = NOW() + duration_days (выбран компанией, 2–7 дней)
		result, err := db.Exec(`
			UPDATE advertisements
			SET status = $1, reviewed_at = NOW(), rejection_reason = $2, admin_message = $3,
			    expires_at = CASE
			        WHEN $1 = 'approved' THEN NOW() + make_interval(days => LEAST(GREATEST(COALESCE(duration_days, 7), 2), 7))
			        ELSE NULL
			    END
			WHERE id = $4
		`, req.Status, req.Reason, req.AdminMessage, adID)
		
		if err != nil {
			log.Printf("❌ [ModerateAd] Error moderating ad: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to moderate ad"})
			return
		}
		
		rowsAffected, _ := result.RowsAffected()
		log.Printf("✅ [ModerateAd] Moderated ad %s: %s (rows affected: %d)", adID, req.Status, rowsAffected)
		
		if rowsAffected == 0 {
			log.Printf("⚠️ [ModerateAd] Warning: No rows affected - ad might not exist")
		}
		
		c.JSON(http.StatusOK, gin.H{
			"success": true,
		})
	}
}

// UpdateAdLink обновляет link_url рекламы (используется в админ-панели)
func UpdateAdLink(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		adID := c.Param("id")

		var req struct {
			LinkURL string `json:"link_url"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		result, err := db.Exec(`
			UPDATE advertisements
			SET link_url = $1, updated_at = NOW()
			WHERE id = $2
		`, req.LinkURL, adID)
		if err != nil {
			log.Printf("❌ [UpdateAdLink] Error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update link"})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Ad not found"})
			return
		}

		log.Printf("✅ [UpdateAdLink] Updated link for ad %s: %s", adID, req.LinkURL)
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// DeleteAd "удаляет" рекламу (устанавливает status = 'deleted')
// Реклама физически не удаляется, а помечается как deleted для отслеживания в админ-панели
func DeleteAd(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		adID := c.Param("id")
		
		log.Printf("🗑️ [DeleteAd] Deleting ad: %s", adID)
		
		// Вместо DELETE используем UPDATE status = 'deleted'
		result, err := db.Exec(`
			UPDATE advertisements 
			SET status = 'deleted', updated_at = NOW() 
			WHERE id = $1
		`, adID)
		
		if err != nil {
			log.Printf("❌ [DeleteAd] Error deleting ad: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete ad"})
			return
		}
		
		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			log.Printf("⚠️ [DeleteAd] Warning: Ad %s not found", adID)
			c.JSON(http.StatusNotFound, gin.H{"error": "Ad not found"})
			return
		}
		
		log.Printf("✅ [DeleteAd] Ad %s marked as deleted", adID)
		c.JSON(http.StatusOK, gin.H{
			"success": true,
		})
	}
}

// DeleteAllCompanyAds "удаляет" все рекламы компании (устанавливает status = 'deleted')
func DeleteAllCompanyAds(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID := c.Param("companyId")
		
		log.Printf("🗑️ [DeleteAllCompanyAds] Deleting all ads for company: %s", companyID)
		
		// Устанавливаем status = 'deleted' для всех реклам компании
		result, err := db.Exec(`
			UPDATE advertisements 
			SET status = 'deleted', updated_at = NOW() 
			WHERE company_id = $1 AND status != 'deleted'
		`, companyID)
		
		if err != nil {
			log.Printf("❌ [DeleteAllCompanyAds] Error deleting ads: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete ads"})
			return
		}
		
		rowsAffected, _ := result.RowsAffected()
		log.Printf("✅ [DeleteAllCompanyAds] Deleted %d ads for company %s", rowsAffected, companyID)
		
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"deleted": rowsAffected,
		})
	}
}

// UploadAdImage - загружает изображение для рекламы
func UploadAdImage(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		file, err := c.FormFile("file")
		if err != nil {
			log.Printf("❌ UploadAdImage: Failed to get file: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": "No file provided"})
			return
		}

		// Generate unique filename
		ext := filepath.Ext(file.Filename)
		newFilename := fmt.Sprintf("ad_%d%s", time.Now().Unix(), ext)
		uploadPath := filepath.Join("uploads", "ads", newFilename)

		// Ensure directory exists
		if err := os.MkdirAll(filepath.Dir(uploadPath), 0755); err != nil {
			log.Printf("❌ UploadAdImage: Failed to create directory: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory"})
			return
		}

		// Save file
		if err := c.SaveUploadedFile(file, uploadPath); err != nil {
			log.Printf("❌ UploadAdImage: Failed to save file: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
			return
		}
		optimizeImage(uploadPath) // 🖼️ сжатие/ресайз

		// Generate URL
		imageURL := fmt.Sprintf("/uploads/ads/%s", newFilename)

		log.Printf("✅ UploadAdImage: Image uploaded: %s", imageURL)
		c.JSON(http.StatusOK, gin.H{
			"success":   true,
			"image_url": imageURL,
		})
	}
}
