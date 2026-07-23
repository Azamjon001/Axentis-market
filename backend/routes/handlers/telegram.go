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
	"strconv"
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
	tgToken        string // бот КОМПАНИЙ: оповещения + аналитика + привязка
	tgBotName      string
	tgBuyerToken   string // бот ПОКУПАТЕЛЕЙ: приветствие + Web App + OTP
	tgBuyerBotName string
	tgInitOnce     sync.Once
	// 📲 OTP-доставка (вход по SMS-коду): сообщения покупателей (контакты)
	// передаются сюда — тот же обработчик, что у webhook.
	tgOTPSender *sms.Sender
)

// SetTelegramOTPSender подключает OTP-доставку к long polling боту.
// Вызывается из routes.Setup после создания sms.Sender.
func SetTelegramOTPSender(s *sms.Sender) { tgOTPSender = s }

const tzTashkentOffset = 5 * 3600 // UTC+5, DST в Узбекистане нет

func tgAPI(method string) string { return tgAPIFor(tgToken, method) }

func tgAPIFor(token, method string) string {
	return "https://api.telegram.org/bot" + token + "/" + method
}

// tgGetUsername узнаёт @username бота по токену (нужно для ссылок t.me/<бот>).
func tgGetUsername(token string) string {
	resp, err := http.Get(tgAPIFor(token, "getMe"))
	if err != nil {
		log.Printf("⚠️ Telegram getMe: %v", err)
		return ""
	}
	defer resp.Body.Close()
	var out struct {
		OK     bool `json:"ok"`
		Result struct {
			Username string `json:"username"`
		} `json:"result"`
	}
	if json.NewDecoder(resp.Body).Decode(&out) == nil && out.OK {
		return out.Result.Username
	}
	return ""
}

func initTelegram() {
	tgInitOnce.Do(func() {
		tgToken = strings.TrimSpace(os.Getenv("TELEGRAM_BOT_TOKEN"))
		tgBuyerToken = strings.TrimSpace(os.Getenv("TELEGRAM_BUYER_BOT_TOKEN"))
		if tgToken != "" {
			tgBotName = tgGetUsername(tgToken)
			log.Printf("🤖 Telegram-бот КОМПАНИЙ подключён: @%s", tgBotName)
		}
		if tgBuyerToken != "" {
			tgBuyerBotName = tgGetUsername(tgBuyerToken)
			log.Printf("🛍 Telegram-бот ПОКУПАТЕЛЕЙ подключён: @%s", tgBuyerBotName)
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

// sendTelegramWelcome — приветствие покупателю на /start с выбором:
//   • открыть магазин прямо в Telegram (Web App, без установки);
//   • скачать приложение (APK) — если задан APK_DOWNLOAD_URL.
// Веб-адрес берём из PUBLIC_WEB_URL (по умолчанию https://axentis.uz). Чтобы
// кнопка Web App работала, домен нужно указать боту в @BotFather (Mini App).
func sendTelegramWelcome(chatID int64) {
	webURL := strings.TrimSpace(os.Getenv("PUBLIC_WEB_URL"))
	if webURL == "" {
		webURL = "https://axentis.uz"
	}
	apkURL := strings.TrimSpace(os.Getenv("APK_DOWNLOAD_URL"))

	rows := [][]map[string]interface{}{
		{{"text": "🛍 Открыть магазин в Telegram", "web_app": map[string]string{"url": webURL}}},
	}
	if apkURL != "" {
		rows = append(rows, []map[string]interface{}{
			{"text": "⬇️ Скачать приложение (Android)", "url": apkURL},
		})
	}
	text := "👋 Добро пожаловать в <b>Axentis Market</b>!\n\n" +
		"Выберите, как удобнее пользоваться:\n\n" +
		"🛍 <b>Открыть магазин в Telegram</b> — покупки прямо здесь, без установки.\n"
	if apkURL != "" {
		text += "⬇️ <b>Скачать приложение</b> — полноценное приложение для Android."
	}
	payload, _ := json.Marshal(map[string]interface{}{
		"chat_id":                  chatID,
		"text":                     text,
		"parse_mode":               "HTML",
		"disable_web_page_preview": true,
		"reply_markup":             map[string]interface{}{"inline_keyboard": rows},
	})
	resp, err := http.Post(tgAPIFor(buyerToken(), "sendMessage"), "application/json", bytes.NewReader(payload))
	if err != nil {
		log.Printf("⚠️ Telegram welcome: %v", err)
		return
	}
	resp.Body.Close()
}

// buyerToken — токен бота покупателей; если отдельный не задан, используем бот
// компаний (одноботовый режим — обратная совместимость).
func buyerToken() string {
	if tgBuyerToken != "" {
		return tgBuyerToken
	}
	return tgToken
}

// buyerBotUsername — @username бота покупателей (для ссылок t.me/<бот>);
// откат на бот компаний в одноботовом режиме.
func buyerBotUsername() string {
	if tgBuyerBotName != "" {
		return tgBuyerBotName
	}
	return tgBotName
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

	// Бот покупателей (если задан отдельный токен): приветствие + Web App + OTP.
	if tgBuyerToken != "" {
		go pollBuyerBotUpdates(db)
	}

	if tgToken == "" {
		log.Println("ℹ️ TELEGRAM_BOT_TOKEN не задан — оповещения магазинам выключены")
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
		url := fmt.Sprintf("%s?timeout=50&offset=%d&allowed_updates=[\"message\",\"callback_query\"]", tgAPI("getUpdates"), offset)
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
				CallbackQuery *struct {
					ID      string `json:"id"`
					Data    string `json:"data"`
					Message struct {
						Chat struct {
							ID int64 `json:"id"`
						} `json:"chat"`
					} `json:"message"`
				} `json:"callback_query"`
			}
			if json.Unmarshal(raw, &upd) != nil {
				continue
			}
			offset = upd.UpdateID + 1
			// Нажатие кнопки аналитики.
			if upd.CallbackQuery != nil {
				answerCallback(upd.CallbackQuery.ID)
				if upd.CallbackQuery.Data == "stats_today" {
					handleCompanyStatsToday(db, upd.CallbackQuery.Message.Chat.ID)
				}
				continue
			}
			if upd.Message == nil {
				continue
			}
			handleTelegramMessage(db, upd.Message.Chat.ID, strings.TrimSpace(upd.Message.Text), raw)
		}
	}
}

// pollBuyerBotUpdates — long polling бота ПОКУПАТЕЛЕЙ (приветствие + OTP).
func pollBuyerBotUpdates(db *sql.DB) {
	var offset int64
	client := &http.Client{Timeout: 60 * time.Second}
	for {
		url := fmt.Sprintf("%s?timeout=50&offset=%d&allowed_updates=[\"message\"]", tgAPIFor(tgBuyerToken, "getUpdates"), offset)
		resp, err := client.Get(url)
		if err != nil {
			time.Sleep(10 * time.Second)
			continue
		}
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
			handleBuyerMessage(upd.Message.Chat.ID, strings.TrimSpace(upd.Message.Text), raw)
		}
	}
}

// handleTelegramMessage — обработчик бота КОМПАНИЙ: привязка магазина + меню
// аналитики. В одноботовом режиме (бот покупателей не задан) он же обслуживает
// покупателей — приветствие и OTP, ради обратной совместимости.
func handleTelegramMessage(db *sql.DB, chatID int64, text string, raw []byte) {
	singleBot := tgBuyerToken == ""

	code := ""
	if strings.HasPrefix(text, "/start") {
		code = strings.TrimSpace(strings.TrimPrefix(text, "/start"))
	}

	// Плоский /start.
	if text == "/start" {
		if singleBot {
			sendTelegramWelcome(chatID)
			return
		}
		var cid int64
		var cname string
		if err := db.QueryRow(`SELECT id, name FROM companies WHERE telegram_chat_id = $1`, chatID).Scan(&cid, &cname); err == nil {
			sendCompanyAnalyticsMenu(chatID, fmt.Sprintf("🏪 <b>%s</b>\n\nНажмите кнопку — покажу показатели за сегодня.", html.EscapeString(cname)))
		} else {
			sendTelegramMessage(chatID, "Это бот Axentis Market для магазинов.\nПодключите его в панели: Настройки → Telegram-оповещения.")
		}
		return
	}

	// Контакт покупателя / произвольный текст / /start otp — только в одноботовом
	// режиме отдаём OTP-доставщику. В двухботовом это делает бот покупателей.
	if code == "" || code == "otp" {
		if singleBot && tgOTPSender != nil {
			tgOTPSender.HandleTelegramUpdate(raw)
		}
		return
	}

	// /start <код> — привязка магазина.
	var companyID int64
	var companyName string
	err := db.QueryRow(`SELECT id, name FROM companies WHERE telegram_connect_code = $1`, code).
		Scan(&companyID, &companyName)
	if err != nil {
		if singleBot && tgOTPSender != nil {
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
	sendCompanyAnalyticsMenu(chatID, fmt.Sprintf(
		"✅ Магазин «%s» подключён!\n\nСюда приходят: ⚠️ критические остатки, 📊 дневной отчёт в 21:00, 💳 напоминания о долгах.\n\nА кнопкой ниже — показатели за сегодня.",
		html.EscapeString(companyName)))
}

// handleBuyerMessage — обработчик бота ПОКУПАТЕЛЕЙ: приветствие + доставка OTP.
func handleBuyerMessage(chatID int64, text string, raw []byte) {
	if text == "/start" {
		sendTelegramWelcome(chatID)
		return
	}
	// /start otp, контакты, прочее → OTP-доставщик (поделиться номером, коды).
	if tgOTPSender != nil {
		tgOTPSender.HandleTelegramUpdate(raw)
	}
}

// ─── Аналитика магазина прямо в Telegram ─────────────────────────────────────

// sendCompanyAnalyticsMenu шлёт сообщение с кнопкой «Аналитика за сегодня».
func sendCompanyAnalyticsMenu(chatID int64, text string) {
	payload, _ := json.Marshal(map[string]interface{}{
		"chat_id":    chatID,
		"text":       text,
		"parse_mode": "HTML",
		"reply_markup": map[string]interface{}{
			"inline_keyboard": [][]map[string]interface{}{
				{{"text": "📊 Аналитика за сегодня", "callback_data": "stats_today"}},
			},
		},
	})
	if resp, err := http.Post(tgAPI("sendMessage"), "application/json", bytes.NewReader(payload)); err == nil {
		resp.Body.Close()
	}
}

// answerCallback закрывает «часики» на нажатой кнопке.
func answerCallback(id string) {
	payload, _ := json.Marshal(map[string]interface{}{"callback_query_id": id})
	if resp, err := http.Post(tgAPI("answerCallbackQuery"), "application/json", bytes.NewReader(payload)); err == nil {
		resp.Body.Close()
	}
}

// handleCompanyStatsToday достаёт показатели магазина за сегодня и шлёт их.
func handleCompanyStatsToday(db *sql.DB, chatID int64) {
	var companyID int64
	var companyName string
	if err := db.QueryRow(`SELECT id, name FROM companies WHERE telegram_chat_id = $1`, chatID).
		Scan(&companyID, &companyName); err != nil {
		sendTelegramMessage(chatID, "Магазин не привязан. Подключите бота в панели: Настройки → Telegram-оповещения.")
		return
	}
	var todayOrders int
	var todayRevenue, todayProfit float64
	db.QueryRow(`
		SELECT
			COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE),
			COALESCE(SUM(total_amount) FILTER (WHERE created_at::date = CURRENT_DATE AND status IN ('delivered','completed')), 0),
			COALESCE(SUM(COALESCE(markup_profit,0)) FILTER (WHERE created_at::date = CURRENT_DATE AND status IN ('delivered','completed')), 0)
		FROM orders WHERE company_id = $1
	`, companyID).Scan(&todayOrders, &todayRevenue, &todayProfit)
	var soldUnits int64
	db.QueryRow(`SELECT COALESCE(SUM(sold_count),0) FROM products WHERE company_id = $1`, companyID).Scan(&soldUnits)

	msg := fmt.Sprintf(
		"📊 <b>%s</b> — сегодня\n\n"+
			"💰 Выручка: <b>%s сум</b>\n"+
			"📈 Чистая прибыль: <b>%s сум</b>\n"+
			"🛍 Заказы: <b>%d</b>\n"+
			"📦 Продано единиц (всего): <b>%d</b>",
		html.EscapeString(companyName), fmtMoney(todayRevenue), fmtMoney(todayProfit), todayOrders, soldUnits)
	sendCompanyAnalyticsMenu(chatID, msg)
}

// fmtMoney форматирует сумму целым числом с разделением тысяч пробелом.
func fmtMoney(v float64) string {
	n := int64(v + 0.5)
	neg := ""
	if n < 0 {
		neg = "-"
		n = -n
	}
	s := strconv.FormatInt(n, 10)
	var b []byte
	for i := 0; i < len(s); i++ {
		if i > 0 && (len(s)-i)%3 == 0 {
			b = append(b, ' ')
		}
		b = append(b, s[i])
	}
	return neg + string(b)
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
			     AND COALESCE(c.tg_notify_stock, TRUE)
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
	today := now.Format("2006-01-02")
	dayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, tz).UTC()

	// ⚙️ Час отчёта настраивается компанией (tg_daily_hour, по умолчанию 21);
	// шлём тем, у кого отчёт включён и его час уже наступил.
	rows, err := db.Query(`
		SELECT id, name, telegram_chat_id FROM companies
		WHERE telegram_chat_id IS NOT NULL
		  AND COALESCE(tg_notify_daily, TRUE)
		  AND COALESCE(tg_daily_hour, 21) <= $2
		  AND (telegram_last_report_date IS NULL OR telegram_last_report_date < $1)
		LIMIT 200
	`, today, now.Hour())
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
