package handlers

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// ⚙️ Настройки Telegram-бота компании: ЧТО отправлять и КОГДА.
//
// Каждое уведомление можно включить/выключить, у отчётов настраивается час
// отправки (по Ташкенту). Настройки читаются воркерами telegram.go,
// company_debts.go и хендлером нового заказа.
//
//   • tg_notify_orders — 🛍 новый заказ (мгновенно)
//   • tg_notify_stock  — ⚠️ критические остатки (по мере наступления)
//   • tg_notify_daily  + tg_daily_hour — 📊 дневной отчёт
//   • tg_notify_debts  + tg_debts_hour — 💳 напоминание о долгах (дафтар)
// ============================================================================

func MigrateTelegramSettings(db *sql.DB) {
	stmts := []string{
		`ALTER TABLE companies ADD COLUMN IF NOT EXISTS tg_notify_orders BOOLEAN DEFAULT TRUE`,
		`ALTER TABLE companies ADD COLUMN IF NOT EXISTS tg_notify_stock BOOLEAN DEFAULT TRUE`,
		`ALTER TABLE companies ADD COLUMN IF NOT EXISTS tg_notify_daily BOOLEAN DEFAULT TRUE`,
		`ALTER TABLE companies ADD COLUMN IF NOT EXISTS tg_daily_hour INT DEFAULT 21`,
		`ALTER TABLE companies ADD COLUMN IF NOT EXISTS tg_notify_debts BOOLEAN DEFAULT TRUE`,
		`ALTER TABLE companies ADD COLUMN IF NOT EXISTS tg_debts_hour INT DEFAULT 10`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			log.Printf("⚠️ MigrateTelegramSettings: %v", err)
		}
	}
}

// GetTelegramSettings — GET /companies/:id/telegram-settings
func GetTelegramSettings(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid company ID"})
			return
		}
		if !requireCompanyMatch(c, companyID) {
			return
		}
		var orders, stock, daily, debtsOn sql.NullBool
		var dailyHour, debtsHour sql.NullInt64
		err = db.QueryRow(`
			SELECT COALESCE(tg_notify_orders, TRUE), COALESCE(tg_notify_stock, TRUE),
			       COALESCE(tg_notify_daily, TRUE), COALESCE(tg_daily_hour, 21),
			       COALESCE(tg_notify_debts, TRUE), COALESCE(tg_debts_hour, 10)
			FROM companies WHERE id = $1
		`, companyID).Scan(&orders, &stock, &daily, &dailyHour, &debtsOn, &debtsHour)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Company not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"notifyOrders": orders.Bool,
			"notifyStock":  stock.Bool,
			"notifyDaily":  daily.Bool,
			"dailyHour":    dailyHour.Int64,
			"notifyDebts":  debtsOn.Bool,
			"debtsHour":    debtsHour.Int64,
		})
	}
}

// UpdateTelegramSettings — PUT /companies/:id/telegram-settings
func UpdateTelegramSettings(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid company ID"})
			return
		}
		if !requireCompanyMatch(c, companyID) {
			return
		}
		var req struct {
			NotifyOrders *bool `json:"notifyOrders"`
			NotifyStock  *bool `json:"notifyStock"`
			NotifyDaily  *bool `json:"notifyDaily"`
			DailyHour    *int  `json:"dailyHour"`
			NotifyDebts  *bool `json:"notifyDebts"`
			DebtsHour    *int  `json:"debtsHour"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		clampHour := func(h int) int {
			if h < 0 {
				return 0
			}
			if h > 23 {
				return 23
			}
			return h
		}
		query := "UPDATE companies SET updated_at = NOW()"
		args := []interface{}{}
		n := 1
		add := func(clause string, v interface{}) {
			query += fmt.Sprintf(", "+clause, n)
			args = append(args, v)
			n++
		}
		if req.NotifyOrders != nil {
			add("tg_notify_orders = $%d", *req.NotifyOrders)
		}
		if req.NotifyStock != nil {
			add("tg_notify_stock = $%d", *req.NotifyStock)
		}
		if req.NotifyDaily != nil {
			add("tg_notify_daily = $%d", *req.NotifyDaily)
		}
		if req.DailyHour != nil {
			add("tg_daily_hour = $%d", clampHour(*req.DailyHour))
		}
		if req.NotifyDebts != nil {
			add("tg_notify_debts = $%d", *req.NotifyDebts)
		}
		if req.DebtsHour != nil {
			add("tg_debts_hour = $%d", clampHour(*req.DebtsHour))
		}
		query += fmt.Sprintf(" WHERE id = $%d", n)
		args = append(args, companyID)
		if _, err := db.Exec(query, args...); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save settings"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// NotifyCompanyOrderTelegram — 🛍 мгновенное сообщение о новом заказе в
// Telegram-бот магазина (вызывается из CreateOrder в горутине).
func NotifyCompanyOrderTelegram(db *sql.DB, companyID int64, orderCode string, totalAmount float64, customerName string) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("⚠️ NotifyCompanyOrderTelegram panic: %v", r)
		}
	}()
	var chatID sql.NullInt64
	var enabled sql.NullBool
	err := db.QueryRow(`
		SELECT telegram_chat_id, COALESCE(tg_notify_orders, TRUE)
		FROM companies WHERE id = $1
	`, companyID).Scan(&chatID, &enabled)
	if err != nil || !chatID.Valid || chatID.Int64 == 0 || !enabled.Bool {
		return
	}
	text := fmt.Sprintf("🛍 <b>Новый заказ #%s</b>\n💰 %s", orderCode, formatSumUZS(totalAmount))
	if customerName != "" {
		text += "\n👤 " + customerName
	}
	if err := sendTelegramMessage(chatID.Int64, text); err != nil {
		log.Printf("⚠️ NotifyCompanyOrderTelegram: %v", err)
	}
}
