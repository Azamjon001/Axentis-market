package handlers

import (
	"database/sql"
	"log"
	"net/http"
	"strconv"
	"time"

	"azaton-backend/config"
	"azaton-backend/models"
	"azaton-backend/security"

	"github.com/gin-gonic/gin"
)

// GetUserPaymentCards возвращает все карты пользователя
func GetUserPaymentCards(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userPhone := c.Param("phone")

		if userPhone == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Phone is required"})
			return
		}

		query := `
			SELECT id, user_phone, card_number_last4, 
			       COALESCE(card_holder_first_name, ''), COALESCE(card_holder_last_name, ''),
			       card_holder_name, card_expiry, card_type, is_default, created_at, updated_at
			FROM payment_cards
			WHERE user_phone = $1
			ORDER BY is_default DESC, created_at DESC
		`

		rows, err := db.Query(query, userPhone)
		if err != nil {
			log.Printf("Error fetching payment cards: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch cards"})
			return
		}
		defer rows.Close()

		cards := []models.PaymentCard{}
		for rows.Next() {
			var card models.PaymentCard
			var expiry sql.NullString
			err := rows.Scan(
				&card.ID,
				&card.UserPhone,
				&card.CardNumberLast4,
				&card.CardHolderFirstName,
				&card.CardHolderLastName,
				&card.CardHolderName,
				&expiry,
				&card.CardType,
				&card.IsDefault,
				&card.CreatedAt,
				&card.UpdatedAt,
			)
			if err != nil {
				log.Printf("Error scanning card: %v", err)
				continue
			}
			if expiry.Valid {
				card.CardExpiry = &expiry.String
			}
			cards = append(cards, card)
		}

		c.JSON(http.StatusOK, cards)
	}
}

// AddPaymentCard добавляет новую карту
func AddPaymentCard(db *sql.DB, cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			UserPhone           string  `json:"userPhone"`
			CardNumber          string  `json:"cardNumber"` // Полные 16 цифр
			CardExpiry          string  `json:"cardExpiry"` // MM/YY
			CardHolderFirstName string  `json:"cardHolderFirstName"` // Имя
			CardHolderLastName  string  `json:"cardHolderLastName"` // Фамилия
			CardType            *string `json:"cardType"`
			IsDefault           bool    `json:"isDefault"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
			return
		}

		if req.UserPhone == "" || req.CardNumber == "" || req.CardHolderFirstName == "" || req.CardHolderLastName == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Required fields missing"})
			return
		}
		// Карту можно привязать только к своему номеру телефона.
		if !requirePhoneMatch(c, req.UserPhone) {
			return
		}

		// Валидация номера карты (16 цифр)
		if len(req.CardNumber) != 16 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Card number must be 16 digits"})
			return
		}

		// Получаем последние 4 цифры
		cardLast4 := req.CardNumber[12:16]
		
		// Полное имя для совместимости
		fullName := req.CardHolderFirstName + " " + req.CardHolderLastName

		// Если новая карта ставится по умолчанию, убираем флаг у других карт
		if req.IsDefault {
			_, err := db.Exec("UPDATE payment_cards SET is_default = false WHERE user_phone = $1", req.UserPhone)
			if err != nil {
				log.Printf("Error updating default cards: %v", err)
			}
		}

		// Если у пользователя еще нет карт, ставим первую по умолчанию
		var cardCount int
		err := db.QueryRow("SELECT COUNT(*) FROM payment_cards WHERE user_phone = $1", req.UserPhone).Scan(&cardCount)
		if err == nil && cardCount == 0 {
			req.IsDefault = true
		}

		query := `
			INSERT INTO payment_cards 
			(user_phone, card_number_last4, card_number_encrypted, card_expiry, 
			 card_holder_first_name, card_holder_last_name, card_holder_name, 
			 card_type, is_default, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			RETURNING id, user_phone, card_number_last4, card_holder_first_name, card_holder_last_name, 
			          card_holder_name, card_expiry, card_type, is_default, created_at, updated_at
		`

		var card models.PaymentCard
		now := time.Now()

		// SECURITY: never store the raw card number. When CARD_ENCRYPTION_KEY is
		// configured, store an AES-256-GCM ciphertext; otherwise store nothing
		// (the last-4 digits are kept separately for display). Either way the
		// plaintext PAN never reaches the database.
		var encryptedCardNumber sql.NullString
		if cfg.CardEncryptionKey != "" {
			if enc, encErr := security.Encrypt(cfg.CardEncryptionKey, req.CardNumber); encErr == nil {
				encryptedCardNumber = sql.NullString{String: enc, Valid: true}
			} else {
				log.Printf("⚠️ AddPaymentCard: failed to encrypt card number: %v", encErr)
			}
		} else {
			log.Println("ℹ️ AddPaymentCard: CARD_ENCRYPTION_KEY not set — storing only last-4 digits, full number is discarded.")
		}

		var expiry sql.NullString
		err = db.QueryRow(
			query,
			req.UserPhone,
			cardLast4,
			encryptedCardNumber,
			req.CardExpiry,
			req.CardHolderFirstName,
			req.CardHolderLastName,
			fullName,
			req.CardType,
			req.IsDefault,
			now,
			now,
		).Scan(
			&card.ID,
			&card.UserPhone,
			&card.CardNumberLast4,
			&card.CardHolderFirstName,
			&card.CardHolderLastName,
			&card.CardHolderName,
			&expiry,
			&card.CardType,
			&card.IsDefault,
			&card.CreatedAt,
			&card.UpdatedAt,
		)

		if err != nil {
			log.Printf("Error inserting card: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add card"})
			return
		}

		if expiry.Valid {
			card.CardExpiry = &expiry.String
		}

		c.JSON(http.StatusCreated, card)
	}
}

// DeletePaymentCard удаляет карту
func DeletePaymentCard(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		cardID := c.Param("id")

		if cardID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Card ID is required"})
			return
		}

		id, err := strconv.ParseInt(cardID, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid card ID"})
			return
		}

		// Удалять карту может только её владелец (или админ).
		var owner string
		if err := db.QueryRow("SELECT user_phone FROM payment_cards WHERE id = $1", id).Scan(&owner); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Card not found"})
			return
		}
		if !requirePhoneMatch(c, owner) {
			return
		}

		_, err = db.Exec("DELETE FROM payment_cards WHERE id = $1", id)
		if err != nil {
			log.Printf("Error deleting card: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete card"})
			return
		}

		c.Status(http.StatusNoContent)
	}
}

// SetDefaultCard устанавливает карту по умолчанию
func SetDefaultCard(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		cardID := c.Param("id")

		if cardID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Card ID is required"})
			return
		}

		id, err := strconv.ParseInt(cardID, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid card ID"})
			return
		}

		// Получаем телефон пользователя для этой карты
		var userPhone string
		err = db.QueryRow("SELECT user_phone FROM payment_cards WHERE id = $1", id).Scan(&userPhone)
		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{"error": "Card not found"})
				return
			}
			log.Printf("Error fetching card: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch card"})
			return
		}

		// Менять карту по умолчанию может только её владелец (или админ).
		if !requirePhoneMatch(c, userPhone) {
			return
		}

		// Убираем флаг по умолчанию у всех карт этого пользователя
		_, err = db.Exec("UPDATE payment_cards SET is_default = false WHERE user_phone = $1", userPhone)
		if err != nil {
			log.Printf("Error updating default cards: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update cards"})
			return
		}

		// Устанавливаем флаг по умолчанию для выбранной карты
		_, err = db.Exec("UPDATE payment_cards SET is_default = true, updated_at = $1 WHERE id = $2", time.Now(), id)
		if err != nil {
			log.Printf("Error setting default card: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to set default card"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Default card updated"})
	}
}
