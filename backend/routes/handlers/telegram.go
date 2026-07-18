package handlers

import (
	"bytes"
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"azaton-backend/sms"

	"github.com/gin-gonic/gin"
)

// 🤖 Telegram-оповещения для магазинов.
//
// Философия: Telegram — НЕ второй интерфейс проекта, а канал только для
// критических сигналов и короткой сводки. Всё управление — на сайте.
//
// Что шлёт бот:
//   • «Критический остаток» — когда товар опускается до ПОЛОВИНЫ порога
//     панели критических товаров (дешёвые: порог 20 → сигнал при ≤10;
//     дорогие: порог 10 → сигнал при ≤5). Один раз на товар, флаг
//     сбрасывается после пополнения склада выше полного порога.
//   • «Дневной отчёт» — одно сообщение в 21:00 по Ташкенту: заказы,
//     выручка, наценка, касса, отмены, критические товары.
//
// Привязка: в настройках панели компания получает ссылку
// t.me/<бот>?start=<код>; бот по /start <код> запоминает chat_id.
// Токен бота задаётся переменной окружения TELEGRAM_BOT_TOKEN — без неё
// вся подсистема тихо выключена.

var (
	tgToken    string
	tgBotName  string
	tgInitOnce sync.Once
	// 📲 OTP-доставка (вход по SMS-коду): не-«/start <код>» сообщения из
	// long polling передаются сюда — тот же обработчик, что у webhook.
	// Так один бот обслуживает и магазины (оповещения), и покупателей (коды).
	tgOTPSender *sms.Sender
)

// SetTelegramOTPSender подключает OTP-доставку к long polling боту.
// Вызывается из routes.Setup после создания sms.Sender.
func SetTelegramOTPSender(s *sms.Sender) { tgOTPSender = s }

const tzTashkentOffset = 5 * 3600 // UTC+5, DST в Узбекистане нет

func tgAPI(method string) string {
	return "https://api.telegram.org/bot" + tgToken + "/" + method
}

func initTelegram() {
	tgInitOnce.Do(func() {
		tgToken = strings.TrimSpace(os.Getenv("TELEGRAM_BOT_TOKEN"))
		if tgToken == "" {
			return
		}
		// Узнаём username бота — нужен для ссылки привязки t.me/<бот>?start=…
		resp, err := http.Get(tgAPI("getMe"))
		if err != nil {
			log.Printf("⚠️ Telegram getMe: %v", err)
			return
		}
		defer resp.Body.Close()
		var out struct {
			OK     bool `json:"ok"`
			Result struct {
				Username string `json:"username"`
			} `json:"result"`
		}
		if json.NewDecoder(resp.Body).Decode(&out) == nil && out.OK {
			tgBotName = out.Result.Username
			log.Printf("🤖 Telegram-бот подключён: @%s", tgBotName)
		}
	})
}

// sendTelegramMessage отправляет HTML-сообщение в чат. Ошибки не фатальны.
func sendTelegramMessage(chatID int64, text string) error {
	payload, _ := json.Marshal(map[string]interface{}{
		"chat_id":                  chatID,
		"text":                     text,
		"parse_mode":               "HTML",
		"disable_web_page_preview": true,
	})
	resp, err := http.Post(tgAPI("sendMessage"), "application/json", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("telegram sendMessage %d: %s", resp.StatusCode, string(body))
	}
	return nil
}

func randomConnectCode() string {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	b := make([]byte, 10)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("C%d", time.Now().UnixNano())
	}
	for i := range b {
		b[i] = alphabet[int(b[i])%len(alphabet)]
	}
	return string(b)
}

// GetCompanyTelegramStatus — GET /companies/:id/telegram
// Статус привязки + ссылка для подключения (код создаётся при первом запросе).
func GetCompanyTelegramStatus(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		initTelegram()
		companyID := c.Param("id")

		if tgToken == "" {
			c.JSON(http.StatusOK, gin.H{"enabled": false, "connected": false})
			return
		}

		var chatID sql.NullInt64
		var code sql.NullString
		err := db.QueryRow(`SELECT telegram_chat_id, telegram_connect_code FROM companies WHERE id = $1`, companyID).
			Scan(&chatID, &code)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Company not found"})
			return
		}

		if !code.Valid || code.String == "" {
			code.String = randomConnectCode()
			db.Exec(`UPDATE companies SET telegram_connect_code = $1 WHERE id = $2`, code.String, companyID)
		}

		resp := gin.H{
			"enabled":   true,
			"connected": chatID.Valid && chatID.Int64 != 0,
			"botName":   tgBotName,
		}
		if tgBotName != "" {
			resp["connectLink"] = "https://t.me/" + tgBotName + "?start=" + code.String
		}
		c.JSON(http.StatusOK, resp)
	}
}

// DisconnectCompanyTelegram — DELETE /companies/:id/telegram
func DisconnectCompanyTelegram(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID := c.Param("id")
		if _, err := db.Exec(`UPDATE companies SET telegram_chat_id = NULL WHERE id = $1`, companyID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to disconnect"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// RunTelegramWorkers запускает подсистему Telegram: обработку /start (привязка),
// оповещения о критических остатках и дневной отчёт. Без TELEGRAM_BOT_TOKEN —
// не делает ничего.
func RunTelegramWorkers(db *sql.DB) {
	initTelegram()
	if tgToken == "" {
		log.Println("ℹ️ TELEGRAM_BOT_TOKEN не задан — Telegram-оповещения выключены")
		return
	}

	go pollTelegramUpdates(db)

	// Критические остатки — каждые 5 минут.
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			if n := runTelegramStockAlerts(db); n > 0 {
				log.Printf("📦 TelegramStock: отправлено %d оповещений", n)
			}
		}
	}()

	// Дневной отчёт — проверяем каждые 10 минут, шлём после 21:00 Ташкента.
	go func() {
		ticker := time.NewTicker(10 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			if n := runTelegramDailyReports(db); n > 0 {
				log.Printf("📊 TelegramReport: отправлено %d отчётов", n)
			}
		}
	}()
}

// pollTelegramUpdates — long polling getUpdates: ловим «/start <код>» и
// привязываем chat_id к компании. Webhook не нужен.
func pollTelegramUpdates(db *sql.DB) {
	var offset int64
	client := &http.Client{Timeout: 60 * time.Second}
	for {
		url := fmt.Sprintf("%s?timeout=50&offset=%d&allowed_updates=[\"message\"]", tgAPI("getUpdates"), offset)
		resp, err := client.Get(url)
		if err != nil {
			time.Sleep(10 * time.Second)
			continue
		}
		// Каждое обновление держим и в разобранном, и в сыром виде: свои
		// команды («/start <код>» магазина) обрабатываем сами, всё остальное
		// (контакты покупателей для OTP-кодов) отдаём sms.Sender.
		var out struct {
			OK     bool              `json:"ok"`
			Result []json.RawMessage `json:"result"`
		}
		decodeErr := json.NewDecoder(resp.Body).Decode(&out)
		resp.Body.Close()
		if decodeErr != nil || !out.OK {
			time.Sleep(10 * time.Second)
			continue
		}
		for _, raw := range out.Result {
			var upd struct {
				UpdateID int64 `json:"update_id"`
				Message  *struct {
					Text string `json:"text"`
					Chat struct {
						ID int64 `json:"id"`
					} `json:"chat"`
				} `json:"message"`
			}
			if json.Unmarshal(raw, &upd) != nil {
				continue
			}
			offset = upd.UpdateID + 1
			if upd.Message == nil {
				continue
			}
			handleTelegramMessage(db, upd.Message.Chat.ID, strings.TrimSpace(upd.Message.Text), raw)
		}
	}
}

func handleTelegramMessage(db *sql.DB, chatID int64, text string, raw []byte) {
	code := ""
	if strings.HasPrefix(text, "/start") {
		code = strings.TrimSpace(strings.TrimPrefix(text, "/start"))
	}
	if code == "" {
		// Не привязка магазина → это покупатель: OTP-доставщик попросит
		// поделиться номером и запомнит chat_id (вход по SMS-коду бесплатно).
		if tgOTPSender != nil {
			tgOTPSender.HandleTelegramUpdate(raw)
			return
		}
		sendTelegramMessage(chatID, "Это бот Axentis Market.\nМагазины подключают его в панели: Настройки → Telegram-оповещения.")
		return
	}
	var companyID int64
	var companyName string
	err := db.QueryRow(`SELECT id, name FROM companies WHERE telegram_connect_code = $1`, code).
		Scan(&companyID, &companyName)
	if err != nil {
		// Код не компании — возможно, это deep-link OTP-потока; отдаём доставщику.
		if tgOTPSender != nil {
			tgOTPSender.HandleTelegramUpdate(raw)
			return
		}
		sendTelegramMessage(chatID, "❌ Код привязки не найден или устарел. Откройте настройки панели и получите новую ссылку.")
		return
	}
	if _, err := db.Exec(`UPDATE companies SET telegram_chat_id = $1 WHERE id = $2`, chatID, companyID); err != nil {
		sendTelegramMessage(chatID, "❌ Не удалось сохранить привязку, попробуйте ещё раз.")
		return
	}
	sendTelegramMessage(chatID, fmt.Sprintf(
		"✅ Магазин «%s» подключён!\n\nТеперь сюда будут приходить:\n• ⚠️ оповещения о критических остатках товаров\n• 📊 дневной отчёт в 21:00\n\nОтключить можно в панели: Настройки → Telegram-оповещения.",
		html.EscapeString(companyName)))
}

// runTelegramStockAlerts шлёт оповещение, когда остаток товара падает до
// ПОЛОВИНЫ порога «критических товаров» из панели:
//   цена ниже средней по магазину  → порог 20 → сигнал при остатке ≤ 10;
//   цена выше средней              → порог 10 → сигнал при остатке ≤ 5.
// Один сигнал на товар; после пополнения выше ПОЛНОГО порога флаг снимается,
// и при следующем падении придёт новое оповещение.
func runTelegramStockAlerts(db *sql.DB) int {
	rows, err := db.Query(`
		WITH stock AS (
			SELECT p.id, p.company_id, p.name, COALESCE(p.price, 0) AS price,
			       COALESCE(NULLIF((SELECT SUM(pv.stock_quantity) FROM product_variants pv WHERE pv.product_id = p.id), 0), p.quantity, 0) AS stock,
			       p.tg_low_stock_notified_at
			FROM products p
			JOIN companies c ON c.id = p.company_id AND c.telegram_chat_id IS NOT NULL
			WHERE p.name NOT LIKE '__CATEGORY_MARKER__%'
		),
		avgp AS (
			SELECT company_id, AVG(price) AS avg_price FROM stock GROUP BY company_id
		)
		SELECT s.id, s.company_id, c.telegram_chat_id, s.name, s.stock,
		       CASE WHEN s.price < a.avg_price THEN 10 ELSE 5 END AS alert_at,
		       (s.tg_low_stock_notified_at IS NOT NULL) AS notified
		FROM stock s
		JOIN avgp a ON a.company_id = s.company_id
		JOIN companies c ON c.id = s.company_id
	`)
	if err != nil {
		log.Printf("⚠️ TelegramStock query: %v", err)
		return 0
	}
	defer rows.Close()

	type alertRow struct {
		productID int64
		name      string
		stock     int
	}
	alertsByChat := map[int64][]alertRow{}
	var resetIDs []int64

	for rows.Next() {
		var (
			id, companyID, chatID int64
			name                  string
			stock, alertAt        int
			notified              bool
		)
		if rows.Scan(&id, &companyID, &chatID, &name, &stock, &alertAt, &notified) != nil {
			continue
		}
		_ = companyID
		switch {
		case stock > 0 && stock <= alertAt && !notified:
			alertsByChat[chatID] = append(alertsByChat[chatID], alertRow{id, name, stock})
		case notified && stock > alertAt*2:
			// Склад пополнили выше полного порога — взводим флаг заново.
			resetIDs = append(resetIDs, id)
		}
	}

	for _, id := range resetIDs {
		db.Exec(`UPDATE products SET tg_low_stock_notified_at = NULL WHERE id = $1`, id)
	}

	sent := 0
	for chatID, alerts := range alertsByChat {
		var sb strings.Builder
		sb.WriteString("⚠️ <b>Критический остаток товаров</b>\n\n")
		limit := len(alerts)
		if limit > 15 {
			limit = 15
		}
		for i := 0; i < limit; i++ {
			sb.WriteString(fmt.Sprintf("• %s — <b>осталось %d шт.</b>\n", html.EscapeString(alerts[i].name), alerts[i].stock))
		}
		if len(alerts) > limit {
			sb.WriteString(fmt.Sprintf("…и ещё %d товаров\n", len(alerts)-limit))
		}
		sb.WriteString("\nПополните склад, чтобы не потерять продажи.")
		if err := sendTelegramMessage(chatID, sb.String()); err != nil {
			log.Printf("⚠️ TelegramStock send: %v", err)
			continue
		}
		for _, a := range alerts {
			db.Exec(`UPDATE products SET tg_low_stock_notified_at = NOW() WHERE id = $1`, a.productID)
		}
		sent += len(alerts)
	}
	return sent
}

// runTelegramDailyReports шлёт каждой подключённой компании одно сообщение
// в день после 21:00 по Ташкенту: заказы, выручка, наценка, касса, отмены,
// количество критических товаров.
func runTelegramDailyReports(db *sql.DB) int {
	tz := time.FixedZone("UZT", tzTashkentOffset)
	now := time.Now().In(tz)
	if now.Hour() < 21 {
		return 0
	}
	today := now.Format("2006-01-02")
	dayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, tz).UTC()

	rows, err := db.Query(`
		SELECT id, name, telegram_chat_id FROM companies
		WHERE telegram_chat_id IS NOT NULL
		  AND (telegram_last_report_date IS NULL OR telegram_last_report_date < $1)
		LIMIT 200
	`, today)
	if err != nil {
		log.Printf("⚠️ TelegramReport query: %v", err)
		return 0
	}
	defer rows.Close()

	type comp struct {
		id     int64
		name   string
		chatID int64
	}
	var comps []comp
	for rows.Next() {
		var c comp
		if rows.Scan(&c.id, &c.name, &c.chatID) == nil {
			comps = append(comps, c)
		}
	}

	fmtSum := func(v float64) string {
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

	sent := 0
	for _, cmp := range comps {
		var ordersCnt, cancelledCnt int
		var revenue, markup float64
		db.QueryRow(`
			SELECT COUNT(*) FILTER (WHERE status NOT IN ('cancelled')),
			       COUNT(*) FILTER (WHERE status IN ('cancelled')),
			       COALESCE(SUM(total_amount) FILTER (WHERE status NOT IN ('cancelled')), 0),
			       COALESCE(SUM(markup_profit) FILTER (WHERE status NOT IN ('cancelled')), 0)
			FROM orders WHERE company_id = $1 AND created_at >= $2
		`, cmp.id, dayStart).Scan(&ordersCnt, &cancelledCnt, &revenue, &markup)

		var posCnt int
		var posSum float64
		db.QueryRow(`
			SELECT COUNT(*), COALESCE(SUM(total_amount), 0)
			FROM sales WHERE company_id = $1 AND created_at >= $2
		`, cmp.id, dayStart).Scan(&posCnt, &posSum)

		// Критические товары (по полному порогу панели: 20 дешёвые / 10 дорогие)
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

		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("📊 <b>Отчёт за %s</b> — %s\n\n", now.Format("02.01.2006"), html.EscapeString(cmp.name)))
		sb.WriteString(fmt.Sprintf("🛍 Заказы онлайн: <b>%d</b> на %s\n", ordersCnt, fmtSum(revenue)))
		sb.WriteString(fmt.Sprintf("🏪 Касса (офлайн): <b>%d</b> на %s\n", posCnt, fmtSum(posSum)))
		sb.WriteString(fmt.Sprintf("💰 Наценка (навар): <b>%s</b>\n", fmtSum(markup)))
		if cancelledCnt > 0 {
			sb.WriteString(fmt.Sprintf("❌ Отменено заказов: %d\n", cancelledCnt))
		}
		if criticalCnt > 0 {
			sb.WriteString(fmt.Sprintf("\n⚠️ Товаров с критическим остатком: <b>%d</b> — загляните в панель.", criticalCnt))
		} else {
			sb.WriteString("\n✅ Все запасы в норме.")
		}

		if err := sendTelegramMessage(cmp.chatID, sb.String()); err != nil {
			log.Printf("⚠️ TelegramReport send (company %d): %v", cmp.id, err)
			continue
		}
		db.Exec(`UPDATE companies SET telegram_last_report_date = $1 WHERE id = $2`, today, cmp.id)
		sent++
	}
	return sent
}
