package handlers

import (
	"database/sql"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
)

// Upload User Avatar
func UploadUserAvatar(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		phone := c.Param("phone")
		
		file, err := c.FormFile("avatar")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
			return
		}

		// Create uploads directory if not exists
		uploadDir := "./uploads/avatars"
		os.MkdirAll(uploadDir, 0755)

		// Generate filename
		filename := phone + filepath.Ext(file.Filename)
		savePath := filepath.Join(uploadDir, filename)

		// Save file
		if err := c.SaveUploadedFile(file, savePath); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
			return
		}
		optimizeImage(savePath) // 🖼️ сжатие/ресайз

		// Update database
		avatarURL := "/uploads/avatars/" + filename
		_, err = db.Exec(`
			INSERT INTO users (phone, avatar_url, name)
			VALUES ($1, $2, '')
			ON CONFLICT (phone) DO UPDATE SET avatar_url = $2, updated_at = NOW()
		`, phone, avatarURL)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update database"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "avatar_url": avatarURL})
	}
}

// Delete User Avatar
func DeleteUserAvatar(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		phone := c.Param("phone")

		// Get current avatar URL
		var avatarURL sql.NullString
		err := db.QueryRow("SELECT avatar_url FROM users WHERE phone = $1", phone).Scan(&avatarURL)
		
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}

		// Delete file if exists
		if avatarURL.Valid && avatarURL.String != "" {
			filePath := "." + avatarURL.String
			os.Remove(filePath)
		}

		// Update database
		_, err = db.Exec(`UPDATE users SET avatar_url = NULL WHERE phone = $1`, phone)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update database"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// Get User Profile — returns all user fields the mobile app expects (camelCase).
func GetUserProfile(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		phone := c.Param("phone")

		var (
			id                         int64
			phone_                     string
			name, surname              sql.NullString
			avatarURL                  sql.NullString
			mode                       sql.NullString
			privateCompanyID           sql.NullInt64
			defaultDeliveryAddress     sql.NullString
			defaultDeliveryCoordinates sql.NullString
			defaultRecipientName       sql.NullString
			expoPushToken              sql.NullString
			followersCount             int
			followingCount             int
			profileViews               int
			createdAt, updatedAt       string
		)

		err := db.QueryRow(`
			SELECT id, phone,
			       COALESCE(name, ''), COALESCE(surname, ''),
			       avatar_url, COALESCE(mode, 'public'), private_company_id,
			       default_delivery_address, default_delivery_coordinates, default_recipient_name,
			       expo_push_token,
			       COALESCE(followers_count, 0), COALESCE(following_count, 0), COALESCE(profile_views, 0),
			       created_at, updated_at
			FROM users WHERE phone = $1
		`, phone).Scan(
			&id, &phone_,
			&name, &surname,
			&avatarURL, &mode, &privateCompanyID,
			&defaultDeliveryAddress, &defaultDeliveryCoordinates, &defaultRecipientName,
			&expoPushToken,
			&followersCount, &followingCount, &profileViews,
			&createdAt, &updatedAt,
		)

		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}

		response := gin.H{
			"id":             id,
			"phone":          phone_,
			"name":           name.String,
			"surname":        surname.String,
			"avatarUrl":      avatarURL.String,
			"mode":           mode.String,
			"followersCount": followersCount,
			"followingCount": followingCount,
			"profileViews":   profileViews,
			"createdAt":      createdAt,
			"updatedAt":      updatedAt,
		}

		if privateCompanyID.Valid {
			response["privateCompanyId"] = privateCompanyID.Int64
		}
		if defaultDeliveryAddress.Valid && defaultDeliveryAddress.String != "" {
			response["defaultDeliveryAddress"] = defaultDeliveryAddress.String
		}
		if defaultDeliveryCoordinates.Valid && defaultDeliveryCoordinates.String != "" {
			response["defaultDeliveryCoordinates"] = defaultDeliveryCoordinates.String
		}
		if defaultRecipientName.Valid && defaultRecipientName.String != "" {
			response["defaultRecipientName"] = defaultRecipientName.String
		}
		if expoPushToken.Valid && expoPushToken.String != "" {
			response["expoPushToken"] = expoPushToken.String
		}

		c.JSON(http.StatusOK, response)
	}
}

// Get Users Count (for admin panel)
func GetUsersCount(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var count int64
		err := db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
		
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"count": count})
	}
}
