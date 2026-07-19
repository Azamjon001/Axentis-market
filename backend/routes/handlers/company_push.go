package handlers

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// Push-уведомления для КОМПАНИЙ (мобильное приложение Axentis Business).
//
// Покупательские push уже живут в users.expo_push_token; здесь — зеркальный
// механизм для продавцов: токен хранится в companies.expo_push_token,
// уведомления шлются через тот же Expo Push API (SendExpoPushNotificationData).
//
// Два сценария:
//   1. Мгновенный push о новом заказе (вызывается из CreateOrder);
//   2. Утренняя сводка в 08:00 по Ташкенту: вчерашние продажи + остатки.
// ============================================================================

// MigrateCompanyPushTables — колонки для push-токена компании (идемпотентно).
func MigrateCompanyPushTables(db *sql.DB) {
	stmts := []string{
		`ALTER TABLE companies ADD COLUMN IF NOT EXISTS expo_push_token TEXT`,
		`ALTER TABLE companies ADD COLUMN IF NOT EXISTS push_new_orders BOOLEAN DEFAULT TRUE`,
		`ALTER TABLE companies ADD COLUMN IF NOT EXISTS push_daily_summary BOOLEAN DEFAULT TRUE`,
		`ALTER TABLE companies ADD COLUMN IF NOT EXISTS push_last_summary_date DATE`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			log.Printf("⚠️ MigrateCompanyPushTables: %v", err)
		}
	}
}

// SaveCompanyPushToken — PUT /companies/:id/push-token
// Тело: { "token": "ExponentPushToken[...]", "newOrders": true, "dailySummary": true }
// Пустой token отвязывает устройство (выход из приложения).
func SaveCompanyPushToken(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid company ID"})
			return
		}
		if !requireCompanyMatch(c, companyID) {
			return
		}

		var input struct {
			Token        string `json:"token"`
			NewOrders    *bool  `json:"newOrders"`
			DailySummary *bool  `json:"dailySummary"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		newOrders := true
		if input.NewOrders != nil {
			newOrders = *input.NewOrders
		}
		dailySummary := true
		if input.DailySummary != nil {
			dailySummary = *input.DailySummary
		}

		_, err = db.Exec(`
			UPDATE companies
			SET expo_push_token = NULLIF($1, ''),
			    push_new_orders = $2,
			    push_daily_summary = $3
			WHERE id = $4
		`, strings.TrimSpace(input.Token), newOrders, dailySummary, companyID)
		if err != nil {
			log.Printf("⚠️ SaveCompanyPushToken: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save push token"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// NotifyCompanyNewOrder — мгновенный push продавцу о новом заказе.
// Вызывается из CreateOrder в горутине: ошибка пуша не должна ломать заказ.
func NotifyCompanyNewOrder(db *sql.DB, companyID int64, orderCode string, totalAmount float64, customerName string) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("⚠️ NotifyCompanyNewOrder panic: %v", r)
		}
	}()

	var token sql.NullString
	var enabled sql.NullBool
	err := db.QueryRow(`
		SELECT expo_push_token, push_new_orders FROM companies WHERE id = $1
	`, companyID).Scan(&token, &enabled)
	if err != nil || !token.Valid || token.String == "" {
		return
	}
	if enabled.Valid && !enabled.Bool {
		return
	}

	title := "🛍 Новый заказ!"
	body := fmt.Sprintf("Заказ #%s на %s", orderCode, formatSumUZS(totalAmount))
	if customerName != "" {
		body += " от " + customerName
	}
	if _, err := SendExpoPushNotificationData(
		[]string{token.String}, title, body,
		map[string]interface{}{"type": "company_new_order", "orderCode": orderCode},
	); err != nil {
		log.Printf("⚠️ NotifyCompanyNewOrder push: %v", err)
	}
}

// formatSumUZS — «1 234 567 сум» (общий формат сумм в уведомлениях).
func formatSumUZS(v float64) string {
	s := fmt.Sprintf("%.0f", v)
	var out strings.Builder
	for i, ch := range s {
		if i > 0 && (len(s)-i)%3 == 0 {
			out.WriteByte(' ')
		}
		out.WriteRune(ch)
	}
	return out.String() + " сум"
}

// RunCompanyPushWorkers — утренняя сводка продавцу в 08:00 по Ташкенту.
// Паттерн тот же, что у RunTelegramWorkers: тикер + дата последней отправки
// в БД, чтобы сводка уходила ровно один раз в день.
func RunCompanyPushWorkers(db *sql.DB) {
	go func() {
		ticker := time.NewTicker(10 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			if n := runCompanyMorningSummaries(db); n > 0 {
				log.Printf("☀️ CompanyPush: отправлено %d утренних сводок", n)
			}
		}
	}()
}

func runCompanyMorningSummaries(db *sql.DB) int {
	tz := time.FixedZone("UZT", tzTashkentOffset)
	now := time.Now().In(tz)
	if now.Hour() < 8 {
		return 0
	}
	today := now.Format("2006-01-02")
	// Вчера: [вчера 00:00, сегодня 00:00) по Ташкенту
	dayEnd := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, tz).UTC()
	dayStart := dayEnd.Add(-24 * time.Hour)

	rows, err := db.Query(`
		SELECT id, name, expo_push_token FROM companies
		WHERE expo_push_token IS NOT NULL AND expo_push_token <> ''
		  AND COALESCE(push_daily_summary, TRUE)
		  AND (push_last_summary_date IS NULL OR push_last_summary_date < $1)
		LIMIT 500
	`, today)
	if err != nil {
		log.Printf("⚠️ CompanyPush query: %v", err)
		return 0
	}
	defer rows.Close()

	type comp struct {
		id    int64
		name  string
		token string
	}
	var comps []comp
	for rows.Next() {
		var c comp
		if rows.Scan(&c.id, &c.name, &c.token) == nil {
			comps = append(comps, c)
		}
	}

	sent := 0
	for _, cmp := range comps {
		var ordersCnt int
		var revenue float64
		db.QueryRow(`
			SELECT COUNT(*) FILTER (WHERE status NOT IN ('cancelled')),
			       COALESCE(SUM(total_amount) FILTER (WHERE status NOT IN ('cancelled')), 0)
			FROM orders WHERE company_id = $1 AND created_at >= $2 AND created_at < $3
		`, cmp.id, dayStart, dayEnd).Scan(&ordersCnt, &revenue)

		var posCnt int
		var posSum float64
		db.QueryRow(`
			SELECT COUNT(*), COALESCE(SUM(total_amount), 0)
			FROM sales WHERE company_id = $1 AND created_at >= $2 AND created_at < $3
		`, cmp.id, dayStart, dayEnd).Scan(&posCnt, &posSum)

		// Критические остатки — тот же порог, что в Telegram-отчёте
		var criticalCnt int
		db.QueryRow(`
			WITH stock AS (
				SELECT COALESCE(p.price, 0) AS price,
				       COALESCE(NULLIF((SELECT SUM(pv.stock_quantity) FROM product_variants pv WHERE pv.product_id = p.id), 0), p.quantity, 0) AS stock
				FROM products p
				WHERE p.company_id = $1 AND p.name NOT LIKE '__CATEGORY_MARKER__%'
			),
			avgp AS (SELECT AVG(price) AS avg_price FROM stock)
			SELECT COUNT(*) FROM stock, avgp
			WHERE stock.stock > 0
			  AND stock.stock <= CASE WHEN stock.price < avgp.avg_price THEN 20 ELSE 10 END
		`, cmp.id).Scan(&criticalCnt)

		title := "☀️ Доброе утро, " + cmp.name + "!"
		var sb strings.Builder
		if ordersCnt == 0 && posCnt == 0 {
			sb.WriteString("Вчера продаж не было.")
		} else {
			sb.WriteString(fmt.Sprintf("Вчера: %d заказов на %s", ordersCnt, formatSumUZS(revenue)))
			if posCnt > 0 {
				sb.WriteString(fmt.Sprintf(", касса — %d на %s", posCnt, formatSumUZS(posSum)))
			}
			sb.WriteString(".")
		}
		if criticalCnt > 0 {
			sb.WriteString(fmt.Sprintf(" ⚠️ Заканчивается товаров: %d — пора докупить!", criticalCnt))
		}

		if _, err := SendExpoPushNotificationData(
			[]string{cmp.token}, title, sb.String(),
			map[string]interface{}{"type": "company_daily_summary"},
		); err != nil {
			log.Printf("⚠️ CompanyPush summary to %d: %v", cmp.id, err)
			continue
		}
		db.Exec(`UPDATE companies SET push_last_summary_date = $1 WHERE id = $2`, today, cmp.id)
		sent++
	}
	return sent
}
