package handlers

import (
	"database/sql"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// CompanyMessage - структура сообщения для компании
type CompanyMessage struct {
	ID          int64     `json:"id"`
	CompanyID   int64     `json:"company_id"`
	CompanyName string    `json:"company_name"`
	Title       string    `json:"title"`
	Message     string    `json:"message"`
	SenderName  string    `json:"sender_name"` // "Axis" - от админа
	CreatedAt   time.Time `json:"created_at"`
	IsRead      bool      `json:"is_read"`
}

// SendMessageToCompany - отправить сообщение одной компании
func SendMessageToCompany(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input struct {
			CompanyID int64  `json:"company_id"`
			Title     string `json:"title"`
			Message   string `json:"message"`
		}

		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data"})
			return
		}

		// Валидация
		if input.CompanyID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Company ID is required"})
			return
		}
		if input.Title == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Title is required"})
			return
		}
		if input.Message == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Message is required"})
			return
		}

log.Printf("📤 Attempting to send message to company ID: %d", input.CompanyID)

	// ✅ ПРОВЕРКА: Существует ли компания с таким ID
	var companyExists bool
	err := db.QueryRow(`SELECT EXISTS(SELECT 1 FROM companies WHERE id = $1)`, input.CompanyID).Scan(&companyExists)
	if err != nil {
		log.Printf("❌ Error checking company existence: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	
	if !companyExists {
		log.Printf("⚠️ Company with ID %d does not exist!", input.CompanyID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Company not found",
			"details": "Компания с таким ID не существует в базе данных",
		})
		return
	}

	// Сохраняем сообщение в базу
	var messageID int64
	err = db.QueryRow(`
		INSERT INTO company_messages (company_id, title, message, sender_name)
		VALUES ($1, $2, $3, 'Axis')
		RETURNING id
	`, input.CompanyID, input.Title, input.Message).Scan(&messageID)

	if err != nil {
		log.Printf("❌ Failed to save message to company %d: %v", input.CompanyID, err)
		log.Printf("👀 Check if 'company_messages' table exists in database")
		log.Printf("👀 SQL Error details: %T", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to send message",
		})
		return
	}

	log.Printf("✅ Message successfully sent to company %d (message_id: %d): %s", input.CompanyID, messageID, input.Title)

		c.JSON(http.StatusOK, gin.H{
			"success":    true,
			"message_id": messageID,
			"message":    "Message sent successfully",
		})
	}
}

// SendMessageToAllCompanies - отправить сообщение всем компаниям
func SendMessageToAllCompanies(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input struct {
			Title   string `json:"title"`
			Message string `json:"message"`
		}

		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data"})
			return
		}

		// Валидация
		if input.Title == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Title is required"})
			return
		}
		if input.Message == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Message is required"})
			return
		}

		// Получаем все компании
		rows, err := db.Query(`SELECT id FROM companies`)
		if err != nil {
			log.Printf("❌ Error fetching companies: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch companies"})
			return
		}
		defer rows.Close()

		sentCount := 0
		companyIDs := []int64{}
		for rows.Next() {
			var companyID int64
			if err := rows.Scan(&companyID); err != nil {
				continue
			}

			// Сохраняем сообщение для каждой компании
			_, err := db.Exec(`
				INSERT INTO company_messages (company_id, title, message, sender_name)
				VALUES ($1, $2, $3, 'Axis')
			`, companyID, input.Title, input.Message)

			if err != nil {
				log.Printf("⚠️ Failed to save message to company %d: %v", companyID, err)
				log.Printf("👀 SQL Error details: %T", err)
			} else {
				sentCount++
				companyIDs = append(companyIDs, companyID)
				log.Printf("📧 Message saved for company ID: %d", companyID)
			}
		}

		log.Printf("📢 Message sent to ALL companies (%d recipients): %s", sentCount, input.Title)
		log.Printf("🎯 Company IDs that received the message: %v", companyIDs)

		c.JSON(http.StatusOK, gin.H{
			"success":   true,
			"sentCount": sentCount,
			"message":   "Messages sent successfully",
		})
	}
}

// GetCompanyMessages - получить сообщения для компании
func GetCompanyMessages(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyIDStr := c.Param("companyId")
		if companyIDStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Company ID is required"})
			return
		}

		log.Printf("📬 Fetching messages for company ID: %s", companyIDStr)

		rows, err := db.Query(`
			SELECT id, company_id, title, message, sender_name, created_at, is_read
			FROM company_messages
			WHERE company_id = $1
			ORDER BY created_at DESC
			LIMIT 100
		`, companyIDStr)

		if err != nil {
			log.Printf("❌ Error fetching company messages: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch messages"})
			return
		}
		defer rows.Close()

		messages := make([]CompanyMessage, 0)
		for rows.Next() {
			var msg CompanyMessage
			if err := rows.Scan(&msg.ID, &msg.CompanyID, &msg.Title, &msg.Message, 
				&msg.SenderName, &msg.CreatedAt, &msg.IsRead); err != nil {
				log.Printf("⚠️ Error scanning message: %v", err)
				continue
			}
			messages = append(messages, msg)
		}

		log.Printf("✅ Found %d messages for company %s", len(messages), companyIDStr)
		c.JSON(http.StatusOK, messages)
	}
}

// GetCompanyMessagesCount - получить количество непрочитанных сообщений
func GetCompanyMessagesCount(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyIDStr := c.Param("companyId")
		if companyIDStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Company ID is required"})
			return
		}

		var count int
		err := db.QueryRow(`
			SELECT COUNT(*) FROM company_messages 
			WHERE company_id = $1 AND is_read = false
		`, companyIDStr).Scan(&count)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count messages"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"count": count})
	}
}

// MarkCompanyMessageAsRead - отметить сообщение как прочитанное
func MarkCompanyMessageAsRead(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		messageID := c.Param("id")

		_, err := db.Exec(`UPDATE company_messages SET is_read = true WHERE id = $1`, messageID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update message"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// MarkAllCompanyMessagesAsRead - отметить все сообщения как прочитанные
func MarkAllCompanyMessagesAsRead(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyIDStr := c.Param("companyId")
		if companyIDStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Company ID is required"})
			return
		}

		_, err := db.Exec(`UPDATE company_messages SET is_read = true WHERE company_id = $1`, companyIDStr)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update messages"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// GetAllCompaniesForMessages - получить список всех компаний для отправки сообщений
func GetAllCompaniesForMessages(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`
			SELECT id, name, COALESCE(description, '') as description
			FROM companies
			ORDER BY name
			LIMIT 500
		`)
		if err != nil {
			log.Printf("❌ Error fetching companies: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch companies"})
			return
		}
		defer rows.Close()

		companies := make([]map[string]interface{}, 0)
		for rows.Next() {
			var id int64
			var name, description string
			if err := rows.Scan(&id, &name, &description); err != nil {
				continue
			}
			companies = append(companies, map[string]interface{}{
				"id":          id,
				"name":        name,
				"description": description,
			})
		}

		log.Printf("📋 Found %d companies for messaging", len(companies))
		c.JSON(http.StatusOK, companies)
	}
}
