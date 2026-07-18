// Package sms delivers one-time codes and notifications to users' phones.
//
// Providers are tried in order until one succeeds:
//
//  1. Eskiz.uz — the standard Uzbek SMS gateway. New accounts get a free
//     test package (100 SMS); production sending costs ~95 UZS/msg.
//     Configure with ESKIZ_EMAIL / ESKIZ_PASSWORD (ESKIZ_FROM optional).
//  2. Telegram bot — completely free. Works for users who have linked the
//     bot (shared their phone via /start → "share contact"); the mapping
//     phone → chat_id is stored in the telegram_links table.
//  3. Dev fallback — logs the message. In non-release mode the OTP handler
//     additionally returns the code in the API response so the flow can be
//     tested end-to-end without any provider configured.
package sms

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// Sender delivers a text message to a phone number and reports the channel
// used ("sms", "telegram" or "dev").
type Sender struct {
	db *sql.DB

	eskizEmail    string
	eskizPassword string
	eskizFrom     string

	telegramToken string

	httpClient *http.Client

	mu         sync.Mutex
	eskizToken string
	eskizExp   time.Time
}

func NewSender(db *sql.DB, eskizEmail, eskizPassword, eskizFrom, telegramToken string) *Sender {
	return &Sender{
		db:            db,
		eskizEmail:    eskizEmail,
		eskizPassword: eskizPassword,
		eskizFrom:     eskizFrom,
		telegramToken: telegramToken,
		httpClient:    &http.Client{Timeout: 15 * time.Second},
	}
}

// Send tries every configured channel in order. It returns the channel that
// accepted the message, or "dev" when nothing is configured (message logged).
func (s *Sender) Send(phone, message string) (string, error) {
	phone = NormalizePhone(phone)

	if s.eskizEmail != "" && s.eskizPassword != "" {
		if err := s.sendEskiz(phone, message); err == nil {
			return "sms", nil
		} else {
			log.Printf("⚠️ SMS: Eskiz delivery to %s failed: %v (falling back)", phone, err)
		}
	}

	if s.telegramToken != "" {
		if err := s.sendTelegram(phone, message); err == nil {
			return "telegram", nil
		} else {
			log.Printf("⚠️ SMS: Telegram delivery to %s failed: %v (falling back)", phone, err)
		}
	}

	// Dev fallback: never lose the message silently.
	log.Printf("📨 SMS[dev] to %s: %s", phone, message)
	return "dev", nil
}

// NormalizePhone strips everything but digits and ensures the 998-prefixed
// international form Uzbek gateways expect (998901234567).
func NormalizePhone(phone string) string {
	var b strings.Builder
	for _, r := range phone {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	digits := b.String()
	if len(digits) == 9 { // 901234567 → 998901234567
		return "998" + digits
	}
	return digits
}

// ─── Eskiz.uz ─────────────────────────────────────────────────────────────────

func (s *Sender) eskizAuth() (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.eskizToken != "" && time.Now().Before(s.eskizExp) {
		return s.eskizToken, nil
	}

	form := url.Values{"email": {s.eskizEmail}, "password": {s.eskizPassword}}
	resp, err := s.httpClient.PostForm("https://notify.eskiz.uz/api/auth/login", form)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var body struct {
		Data struct {
			Token string `json:"token"`
		} `json:"data"`
		Message string `json:"message"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return "", err
	}
	if body.Data.Token == "" {
		return "", fmt.Errorf("eskiz auth failed: %s", body.Message)
	}
	// Eskiz tokens live ~30 days; refresh daily to stay safe.
	s.eskizToken = body.Data.Token
	s.eskizExp = time.Now().Add(24 * time.Hour)
	return s.eskizToken, nil
}

func (s *Sender) sendEskiz(phone, message string) error {
	token, err := s.eskizAuth()
	if err != nil {
		return err
	}

	form := url.Values{
		"mobile_phone": {phone},
		"message":      {message},
		"from":         {s.eskizFrom},
	}
	req, err := http.NewRequest(http.MethodPost, "https://notify.eskiz.uz/api/message/sms/send",
		strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		// Token expired server-side — drop the cache so the next call re-auths.
		s.mu.Lock()
		s.eskizToken = ""
		s.mu.Unlock()
		return fmt.Errorf("eskiz token rejected (will re-auth)")
	}
	if resp.StatusCode >= 300 {
		var eb struct {
			Message string `json:"message"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&eb)
		return fmt.Errorf("eskiz send failed: HTTP %d %s", resp.StatusCode, eb.Message)
	}
	return nil
}

// ─── Telegram bot ─────────────────────────────────────────────────────────────

func (s *Sender) sendTelegram(phone, message string) error {
	if s.db == nil {
		return fmt.Errorf("no db for telegram links")
	}
	var chatID int64
	err := s.db.QueryRow(`SELECT chat_id FROM telegram_links WHERE phone = $1`, phone).Scan(&chatID)
	if err == sql.ErrNoRows {
		return fmt.Errorf("phone %s has not linked the telegram bot", phone)
	}
	if err != nil {
		return err
	}

	payload, _ := json.Marshal(map[string]interface{}{
		"chat_id": chatID,
		"text":    message,
	})
	resp, err := s.httpClient.Post(
		"https://api.telegram.org/bot"+s.telegramToken+"/sendMessage",
		"application/json", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("telegram sendMessage failed: HTTP %d", resp.StatusCode)
	}
	return nil
}

// HandleTelegramUpdate processes one webhook update from the bot. Supported
// interactions:
//   - /start → replies with a "share your phone" button;
//   - contact message → stores phone → chat_id in telegram_links so OTP codes
//     can be delivered to this user for free.
func (s *Sender) HandleTelegramUpdate(raw []byte) {
	var upd struct {
		Message struct {
			Chat struct {
				ID int64 `json:"id"`
			} `json:"chat"`
			Text    string `json:"text"`
			Contact *struct {
				PhoneNumber string `json:"phone_number"`
				UserID      int64  `json:"user_id"`
			} `json:"contact"`
			From struct {
				ID int64 `json:"id"`
			} `json:"from"`
		} `json:"message"`
	}
	if err := json.Unmarshal(raw, &upd); err != nil || upd.Message.Chat.ID == 0 {
		return
	}
	chatID := upd.Message.Chat.ID

	if upd.Message.Contact != nil {
		// Only trust a contact the user shared about themselves.
		if upd.Message.Contact.UserID != 0 && upd.Message.Contact.UserID != upd.Message.From.ID {
			s.replyTelegram(chatID, "Пожалуйста, поделитесь своим собственным контактом.")
			return
		}
		phone := NormalizePhone(upd.Message.Contact.PhoneNumber)
		_, err := s.db.Exec(`
			INSERT INTO telegram_links (phone, chat_id, created_at)
			VALUES ($1, $2, NOW())
			ON CONFLICT (phone) DO UPDATE SET chat_id = $2, created_at = NOW()
		`, phone, chatID)
		if err != nil {
			log.Printf("❌ telegram_links upsert: %v", err)
			return
		}
		s.replyTelegram(chatID, "✅ Готово! Теперь коды подтверждения Axentis Market будут приходить сюда бесплатно.")
		return
	}

	// Any text (incl. /start) → ask for the contact.
	s.replyTelegramWithContactButton(chatID,
		"Здравствуйте! Нажмите кнопку ниже, чтобы получать коды входа Axentis Market в Telegram.")
}

func (s *Sender) replyTelegram(chatID int64, text string) {
	payload, _ := json.Marshal(map[string]interface{}{
		"chat_id":      chatID,
		"text":         text,
		"reply_markup": map[string]interface{}{"remove_keyboard": true},
	})
	s.postTelegram(payload)
}

func (s *Sender) replyTelegramWithContactButton(chatID int64, text string) {
	payload, _ := json.Marshal(map[string]interface{}{
		"chat_id": chatID,
		"text":    text,
		"reply_markup": map[string]interface{}{
			"keyboard": [][]map[string]interface{}{
				{{"text": "📱 Поделиться номером", "request_contact": true}},
			},
			"resize_keyboard":   true,
			"one_time_keyboard": true,
		},
	})
	s.postTelegram(payload)
}

func (s *Sender) postTelegram(payload []byte) {
	resp, err := s.httpClient.Post(
		"https://api.telegram.org/bot"+s.telegramToken+"/sendMessage",
		"application/json", bytes.NewReader(payload))
	if err != nil {
		log.Printf("⚠️ telegram reply failed: %v", err)
		return
	}
	resp.Body.Close()
}
