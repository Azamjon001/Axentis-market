package handlers

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"time"

	"azaton-backend/config"
	"azaton-backend/middleware"
	"azaton-backend/sms"

	"github.com/gin-gonic/gin"
)

// ─── SMS-вход (OTP) ───────────────────────────────────────────────────────────
// POST /auth/otp/request  { phone }            → отправляет 6-значный код
// POST /auth/otp/verify   { phone, code, ... } → проверяет код и логинит
//
// Верификация кода = доказательство владения номером, поэтому verify выдаёт
// JWT и создаёт аккаунт, если его ещё нет (как у Uzum/Yandex Market).
// Коды хранятся хешированными (HMAC-SHA256 с JWT-секретом), живут 5 минут,
// максимум 5 попыток ввода и 3 отправки на номер за 10 минут.

const (
	otpTTL            = 5 * time.Minute
	otpMaxAttempts    = 5
	otpMaxPer10Min    = 3
	otpResendCooldown = 60 * time.Second
)

func MigrateOTPTables(db *sql.DB) {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS otp_codes (
			id         BIGSERIAL PRIMARY KEY,
			phone      VARCHAR(20) NOT NULL,
			code_hash  VARCHAR(64) NOT NULL,
			attempts   INT DEFAULT 0,
			used       BOOLEAN DEFAULT FALSE,
			expires_at TIMESTAMPTZ NOT NULL,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_otp_codes_phone ON otp_codes(phone, created_at DESC)`,
		// Телефон → chat_id Телеграм-бота (бесплатная доставка кодов).
		`CREATE TABLE IF NOT EXISTS telegram_links (
			phone      VARCHAR(20) PRIMARY KEY,
			chat_id    BIGINT NOT NULL,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
	}
	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			log.Printf("❌ OTP migration failed: %v", err)
		}
	}
}

func hashOTP(cfg *config.Config, phone, code string) string {
	mac := hmac.New(sha256.New, []byte(cfg.JWTSecret))
	mac.Write([]byte(phone + ":" + code))
	return hex.EncodeToString(mac.Sum(nil))
}

func generateOTPCode() string {
	n, err := rand.Int(rand.Reader, big.NewInt(900000))
	if err != nil {
		// crypto/rand практически не падает; на всякий случай — не 0.
		return "348219"
	}
	return fmt.Sprintf("%06d", n.Int64()+100000)
}

// IssueOTPCode генерирует новый код входа для номера, сохраняет его хеш и
// возвращает открытый код для доставки. Используется потоком Telegram
// «поделиться контактом»: как только покупатель делится номером в боте, код
// выдаётся и отправляется ему в чат. VerifyOTP всегда берёт самый свежий код,
// поэтому этот путь совместим с обычным запросом кода из приложения.
func IssueOTPCode(db *sql.DB, cfg *config.Config, phone string) (string, error) {
	phone = sms.NormalizePhone(phone)
	code := generateOTPCode()
	if _, err := db.Exec(`
		INSERT INTO otp_codes (phone, code_hash, expires_at) VALUES ($1, $2, $3)
	`, phone, hashOTP(cfg, phone, code), time.Now().Add(otpTTL)); err != nil {
		return "", err
	}
	return code, nil
}

// RequestOTP — отправить код входа на телефон.
func RequestOTP(db *sql.DB, cfg *config.Config, sender *sms.Sender) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Phone string `json:"phone" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Укажите номер телефона"})
			return
		}
		phone := sms.NormalizePhone(req.Phone)
		if len(phone) < 12 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат номера"})
			return
		}

		// Антиспам: не чаще 1 кода в минуту и 3 кодов за 10 минут на номер.
		var recentCount int
		var lastSent sql.NullTime
		_ = db.QueryRow(`
			SELECT COUNT(*), MAX(created_at)
			FROM otp_codes
			WHERE phone = $1 AND created_at > NOW() - INTERVAL '10 minutes'
		`, phone).Scan(&recentCount, &lastSent)
		if lastSent.Valid && time.Since(lastSent.Time) < otpResendCooldown {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":      "Код уже отправлен. Повторная отправка через минуту.",
				"retryAfter": int((otpResendCooldown - time.Since(lastSent.Time)).Seconds()),
			})
			return
		}
		if recentCount >= otpMaxPer10Min {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "Слишком много запросов. Попробуйте позже."})
			return
		}

		code := generateOTPCode()
		if _, err := db.Exec(`
			INSERT INTO otp_codes (phone, code_hash, expires_at) VALUES ($1, $2, $3)
		`, phone, hashOTP(cfg, phone, code), time.Now().Add(otpTTL)); err != nil {
			log.Printf("❌ RequestOTP insert: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать код"})
			return
		}

		channel, _ := sender.Send(phone, fmt.Sprintf("Axentis Market: код входа %s. Никому не сообщайте его.", code))

		resp := gin.H{"success": true, "channel": channel, "ttlSeconds": int(otpTTL.Seconds())}
		// Ссылка на Telegram-бота. Если код не удалось доставить напрямую (нет
		// SMS-провайдера и номер ещё не привязан к боту), клиент открывает бота,
		// где покупатель делится контактом и получает код (см. HandleTelegramUpdate).
		if bot := buyerBotUsername(); bot != "" {
			// ?start=otp — бот покажет кнопку «поделиться номером» (а плоский
			// /start — приветствие с выбором магазин/приложение). Используем
			// бота покупателей (или бот компаний в одноботовом режиме).
			resp["telegramUrl"] = "https://t.me/" + bot + "?start=otp"
			resp["needsTelegram"] = channel != "sms" && channel != "telegram"
		}
		// В dev-режиме код возвращается в ответе, чтобы поток работал без
		// настроенного провайдера. В release это выключено всегда.
		if channel == "dev" && cfg.GinMode != "release" {
			resp["devCode"] = code
		}
		c.JSON(http.StatusOK, resp)
	}
}

// VerifyOTP — проверить код и войти (или зарегистрироваться).
// Поддерживает приватный режим: mode="private" + privateCode привязывают
// покупателя к закрытой компании, как и обычный логин.
func VerifyOTP(db *sql.DB, cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Phone       string `json:"phone" binding:"required"`
			Code        string `json:"code" binding:"required"`
			Name        string `json:"name"`
			Surname     string `json:"surname"`
			Mode        string `json:"mode"`
			PrivateCode string `json:"privateCode"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Укажите телефон и код"})
			return
		}
		phone := sms.NormalizePhone(req.Phone)

		if req.Mode == "" {
			req.Mode = "public"
		}
		if req.Mode != "public" && req.Mode != "private" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Mode must be 'public' or 'private'"})
			return
		}
		var privateCompanyID *int64
		if req.Mode == "private" {
			if req.PrivateCode == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Укажите ID закрытой компании"})
				return
			}
			var companyID int64
			err := db.QueryRow(`SELECT id FROM companies WHERE private_code = $1 AND mode = 'private'`, req.PrivateCode).Scan(&companyID)
			if err == sql.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{"error": "Неверный ID компании"})
				return
			}
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось проверить ID компании"})
				return
			}
			privateCompanyID = &companyID
		}

		// Последний невалидированный код этого номера.
		var otpID int64
		var codeHash string
		var attempts int
		err := db.QueryRow(`
			SELECT id, code_hash, attempts
			FROM otp_codes
			WHERE phone = $1 AND used = FALSE AND expires_at > NOW()
			ORDER BY created_at DESC
			LIMIT 1
		`, phone).Scan(&otpID, &codeHash, &attempts)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Код не найден или истёк. Запросите новый."})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка проверки кода"})
			return
		}
		if attempts >= otpMaxAttempts {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "Слишком много неверных попыток. Запросите новый код."})
			return
		}

		if !hmac.Equal([]byte(codeHash), []byte(hashOTP(cfg, phone, req.Code))) {
			_, _ = db.Exec(`UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1`, otpID)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Неверный код"})
			return
		}
		_, _ = db.Exec(`UPDATE otp_codes SET used = TRUE WHERE id = $1`, otpID)

		// Владение номером доказано → логиним; создаём аккаунт при первом входе.
		var userID int64
		var name, surname sql.NullString
		err = db.QueryRow(`SELECT id, name, surname FROM users WHERE phone = $1`, phone).
			Scan(&userID, &name, &surname)
		if err == sql.ErrNoRows {
			err = db.QueryRow(`
				INSERT INTO users (phone, name, surname, mode, private_company_id, created_at, updated_at)
				VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
				RETURNING id
			`, phone, req.Name, req.Surname, req.Mode, privateCompanyID).Scan(&userID)
			name.String, name.Valid = req.Name, true
			surname.String, surname.Valid = req.Surname, true
		} else if err == nil {
			_, err = db.Exec(`UPDATE users SET mode = $1, private_company_id = $2, updated_at = NOW() WHERE id = $3`,
				req.Mode, privateCompanyID, userID)
		}
		if err != nil {
			log.Printf("❌ VerifyOTP user upsert: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось выполнить вход"})
			return
		}

		userObj := gin.H{
			"id":      userID,
			"phone":   phone,
			"name":    name.String,
			"surname": surname.String,
			"mode":    req.Mode,
		}
		if privateCompanyID != nil {
			userObj["privateCompanyId"] = *privateCompanyID
		}
		response := gin.H{"success": true, "user": userObj}
		if tok, err := middleware.GenerateToken(cfg, userID, phone, "user"); err == nil {
			response["token"] = tok
		}
		log.Printf("✅ OTP login: phone=%s userID=%d mode=%s", phone, userID, req.Mode)
		c.JSON(http.StatusOK, response)
	}
}

// TelegramWebhook — приём обновлений от Телеграм-бота (бесплатный канал
// доставки кодов). Регистрируется только когда задан TELEGRAM_BOT_TOKEN.
func TelegramWebhook(sender *sms.Sender) gin.HandlerFunc {
	return func(c *gin.Context) {
		raw, err := io.ReadAll(io.LimitReader(c.Request.Body, 1<<20))
		if err == nil {
			sender.HandleTelegramUpdate(raw)
		}
		c.Status(http.StatusOK)
	}
}
