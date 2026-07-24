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
	tgOpenAIKey    string // ключ OpenAI для голосовых отчётов (STT + разбор)
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
		tgOpenAIKey = strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
		if tgOpenAIKey != "" {
			log.Printf("🎙 Голосовые отчёты в боте компаний включены (OpenAI)")
		}
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
//   - открыть магазин прямо в Telegram (Web App, без установки);
//   - скачать приложение (APK) — если задан APK_DOWNLOAD_URL.
//
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
					Voice *struct {
						FileID string `json:"file_id"`
					} `json:"voice"`
				} `json:"message"`
				CallbackQuery *struct {
					ID      string `json:"id"`
					Data    string `json:"data"`
					Message struct {
						MessageID int64 `json:"message_id"`
						Chat      struct {
							ID int64 `json:"id"`
						} `json:"chat"`
					} `json:"message"`
				} `json:"callback_query"`
			}
			if json.Unmarshal(raw, &upd) != nil {
				continue
			}
			offset = upd.UpdateID + 1
			// Нажатие inline-кнопки: язык / период / раздел. Всё в одном
			// сообщении — как у @BotFather: правим текущее сообщение и клавиатуру,
			// новых сообщений не шлём.
			if upd.CallbackQuery != nil {
				answerCallback(upd.CallbackQuery.ID)
				handleCompanyCallback(db,
					upd.CallbackQuery.Message.Chat.ID,
					upd.CallbackQuery.Message.MessageID,
					upd.CallbackQuery.Data)
				continue
			}
			if upd.Message == nil {
				continue
			}
			// 🎙 Голосовое сообщение компании — дневной отчёт голосом (STT + LLM).
			// В отдельной горутине: распознавание идёт несколько секунд, нельзя
			// блокировать общий цикл опроса.
			if upd.Message.Voice != nil {
				go handleCompanyVoice(db, upd.Message.Chat.ID, upd.Message.Voice.FileID)
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
			sendLanguageMenu(chatID)
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
	sendTelegramMessage(chatID, fmt.Sprintf(
		"✅ Магазин «%s» подключён!\n\nСюда приходят: ⚠️ критические остатки, 📊 дневной отчёт в 21:00, 💳 напоминания о долгах.",
		html.EscapeString(companyName)))
	sendLanguageMenu(chatID)
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

// ─── Аналитика магазина прямо в Telegram (стиль @BotFather) ──────────────────
//
// Одно живое сообщение. Пользователь выбирает язык (🇺🇿/🇷🇺) → появляется
// главное меню с переключателем периода (сегодня / неделя) и разделами
// (финансы, заказы, критические остатки). Любое нажатие ПРАВИТ то же
// сообщение (editMessageText) и его inline-клавиатуру — новых сообщений не шлём.
//
// Состояние целиком живёт в callback_data (язык, период, раздел), поэтому
// хранить его в БД не нужно:
//   L:<lang>                 — выбран язык, показать меню (период = день);
//   M:<lang>:<period>        — меню с переключателем периода (d|w);
//   S:<lang>:<period>:<sec>  — раздел (fin|ord|low), у него кнопка «Назад» → M;
//   LANG                     — вернуться к выбору языка.

// tr выбирает строку по языку интерфейса бота (uz — узбекский, иначе русский).
func tr(lang, uz, ru string) string {
	if lang == "uz" {
		return uz
	}
	return ru
}

// languageKeyboard — клавиатура выбора языка.
func languageKeyboard() [][]map[string]interface{} {
	return [][]map[string]interface{}{
		{
			{"text": "🇺🇿 Oʻzbekcha", "callback_data": "L:uz"},
			{"text": "🇷🇺 Русский", "callback_data": "L:ru"},
		},
	}
}

const languagePrompt = "🌐 <b>Tilni tanlang / Выберите язык</b>"

// sendLanguageMenu — единственное «новое» сообщение бота: приветствие с выбором
// языка. Дальше всё живёт правкой этого сообщения.
func sendLanguageMenu(chatID int64) {
	payload, _ := json.Marshal(map[string]interface{}{
		"chat_id":                  chatID,
		"text":                     languagePrompt,
		"parse_mode":               "HTML",
		"disable_web_page_preview": true,
		"reply_markup":             map[string]interface{}{"inline_keyboard": languageKeyboard()},
	})
	if resp, err := http.Post(tgAPI("sendMessage"), "application/json", bytes.NewReader(payload)); err == nil {
		resp.Body.Close()
	}
}

// editTelegramMenu правит текст и inline-клавиатуру существующего сообщения.
func editTelegramMenu(chatID, messageID int64, text string, keyboard [][]map[string]interface{}) {
	payload, _ := json.Marshal(map[string]interface{}{
		"chat_id":                  chatID,
		"message_id":               messageID,
		"text":                     text,
		"parse_mode":               "HTML",
		"disable_web_page_preview": true,
		"reply_markup":             map[string]interface{}{"inline_keyboard": keyboard},
	})
	if resp, err := http.Post(tgAPI("editMessageText"), "application/json", bytes.NewReader(payload)); err == nil {
		resp.Body.Close()
	}
}

// handleCompanyCallback — маршрутизатор нажатий inline-кнопок бота компаний.
func handleCompanyCallback(db *sql.DB, chatID, messageID int64, data string) {
	switch {
	case data == "LANG":
		editTelegramMenu(chatID, messageID, languagePrompt, languageKeyboard())
	case strings.HasPrefix(data, "L:"):
		lang := normLang(strings.TrimPrefix(data, "L:"))
		saveCompanyLang(db, chatID, lang)
		editToMainMenu(db, chatID, messageID, lang, "d")
	case strings.HasPrefix(data, "M:"):
		p := strings.Split(data, ":")
		if len(p) == 3 {
			lang := normLang(p[1])
			saveCompanyLang(db, chatID, lang)
			editToMainMenu(db, chatID, messageID, lang, normPeriod(p[2]))
		}
	case strings.HasPrefix(data, "S:"):
		p := strings.Split(data, ":")
		if len(p) == 4 {
			lang := normLang(p[1])
			saveCompanyLang(db, chatID, lang)
			editToSection(db, chatID, messageID, lang, normPeriod(p[2]), p[3])
		}
	}
}

// saveCompanyLang запоминает выбранный в боте язык — чтобы уведомления
// (дневной отчёт, критостатки, напоминания о долгах) приходили на нём.
func saveCompanyLang(db *sql.DB, chatID int64, lang string) {
	db.Exec(`UPDATE companies SET tg_lang = $1 WHERE telegram_chat_id = $2`, lang, chatID)
}

// companyLang возвращает выбранный компанией язык бота ('uz'/'ru'), по умолчанию 'ru'.
func companyLang(db *sql.DB, companyID int64) string {
	var lang sql.NullString
	db.QueryRow(`SELECT tg_lang FROM companies WHERE id = $1`, companyID).Scan(&lang)
	if lang.Valid && lang.String == "uz" {
		return "uz"
	}
	return "ru"
}

func normLang(s string) string {
	if s == "uz" {
		return "uz"
	}
	return "ru"
}

func normPeriod(s string) string {
	if s == "w" {
		return "w"
	}
	return "d"
}

// mainMenuKeyboard — главное меню: переключатель периода + разделы.
func mainMenuKeyboard(lang, period string) [][]map[string]interface{} {
	dayLabel := tr(lang, "Bugun", "Сегодня")
	weekLabel := tr(lang, "Hafta", "Неделя")
	if period == "w" {
		weekLabel = "✅ " + weekLabel
		dayLabel = "📅 " + dayLabel
	} else {
		dayLabel = "✅ " + dayLabel
		weekLabel = "📅 " + weekLabel
	}
	return [][]map[string]interface{}{
		{
			{"text": dayLabel, "callback_data": "M:" + lang + ":d"},
			{"text": weekLabel, "callback_data": "M:" + lang + ":w"},
		},
		{{"text": tr(lang, "💰 Moliya", "💰 Финансы"), "callback_data": "S:" + lang + ":" + period + ":fin"}},
		{{"text": tr(lang, "🧾 Sotilgan tovarlar", "🧾 Проданные товары"), "callback_data": "S:" + lang + ":" + period + ":sold"}},
		{{"text": tr(lang, "📋 Buyurtmalar", "📋 Заказы"), "callback_data": "S:" + lang + ":" + period + ":ord"}},
		{{"text": tr(lang, "📦 Kritik qoldiq", "📦 Критические остатки"), "callback_data": "S:" + lang + ":" + period + ":low"}},
		{{"text": tr(lang, "🌐 Tilni almashtirish", "🌐 Сменить язык"), "callback_data": "LANG"}},
	}
}

// backKeyboard — единственная кнопка «Назад» в раздел меню (с тем же периодом).
func backKeyboard(lang, period string) [][]map[string]interface{} {
	return [][]map[string]interface{}{
		{{"text": tr(lang, "⬅️ Orqaga", "⬅️ Назад"), "callback_data": "M:" + lang + ":" + period}},
	}
}

// periodLabel — человекочитаемая подпись периода.
func periodLabel(lang, period string) string {
	if period == "w" {
		return tr(lang, "Hafta (7 kun)", "Неделя (7 дней)")
	}
	return tr(lang, "Bugun", "Сегодня")
}

// periodFrom возвращает начало периода (в UTC) по часовому поясу Ташкента:
// «сегодня» — с полуночи, «неделя» — за последние 7 дней.
func periodFrom(period string) time.Time {
	tz := time.FixedZone("UZT", tzTashkentOffset)
	now := time.Now().In(tz)
	dayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, tz).UTC()
	if period == "w" {
		return dayStart.AddDate(0, 0, -6)
	}
	return dayStart
}

// editToMainMenu правит сообщение в главное меню магазина.
func editToMainMenu(db *sql.DB, chatID, messageID int64, lang, period string) {
	_, name, ok := companyByChat(db, chatID)
	if !ok {
		return
	}
	text := fmt.Sprintf("🏪 <b>%s</b>\n📅 %s\n\n%s",
		html.EscapeString(name), periodLabel(lang, period),
		tr(lang, "Boʻlimni tanlang:", "Выберите раздел:"))
	// Подсказка о голосовом отчёте — только если функция включена (есть ключ).
	if tgOpenAIKey != "" {
		text += "\n\n" + tr(lang,
			"🎙 Kunlik hisobotni ovozli xabar bilan yuboring — sotuv, foyda va qarzni oʻzim hisoblayman.",
			"🎙 Отправьте голосовое сообщение с дневным отчётом — сам посчитаю продажи, прибыль и долги.")
	}
	editTelegramMenu(chatID, messageID, text, mainMenuKeyboard(lang, period))
}

// editToSection правит сообщение в выбранный раздел.
func editToSection(db *sql.DB, chatID, messageID int64, lang, period, section string) {
	_, name, ok := companyByChat(db, chatID)
	if !ok {
		return
	}
	var text string
	switch section {
	case "fin":
		text = companyFinanceText(db, chatID, name, lang, period)
	case "sold":
		text = companySoldText(db, chatID, name, lang, period)
	case "ord":
		text = companyOrdersText(db, chatID, name, lang, period)
	case "low":
		text = companyLowStockText(db, chatID, name, lang)
	default:
		editToMainMenu(db, chatID, messageID, lang, period)
		return
	}
	editTelegramMenu(chatID, messageID, text, backKeyboard(lang, period))
}

// companyByChat находит магазин по chat_id Telegram; false — не привязан.
func companyByChat(db *sql.DB, chatID int64) (int64, string, bool) {
	var id int64
	var name string
	if err := db.QueryRow(`SELECT id, name FROM companies WHERE telegram_chat_id = $1`, chatID).Scan(&id, &name); err != nil {
		sendTelegramMessage(chatID, "Магазин не привязан. Подключите бота в панели: Настройки → Telegram-оповещения.")
		return 0, "", false
	}
	return id, name, true
}

// answerCallback закрывает «часики» на нажатой кнопке.
func answerCallback(id string) {
	payload, _ := json.Marshal(map[string]interface{}{"callback_query_id": id})
	if resp, err := http.Post(tgAPI("answerCallbackQuery"), "application/json", bytes.NewReader(payload)); err == nil {
		resp.Body.Close()
	}
}

// companyFinanceText — финансы магазина за выбранный период. Без «продано всего»:
// показываем то, что относится к периоду (заказы, выручка, наценка, касса).
func companyFinanceText(db *sql.DB, chatID int64, name, lang, period string) string {
	companyID, _, _ := companyByChatQuiet(db, chatID)
	from := periodFrom(period)

	var orders int
	var revenue, profit float64
	db.QueryRow(`
		SELECT
			COUNT(*) FILTER (WHERE status NOT IN ('cancelled')),
			COALESCE(SUM(total_amount) FILTER (WHERE status IN ('delivered','completed')), 0),
			COALESCE(SUM(COALESCE(markup_profit,0)) FILTER (WHERE status NOT IN ('cancelled')), 0)
		FROM orders WHERE company_id = $1 AND created_at >= $2
	`, companyID, from).Scan(&orders, &revenue, &profit)

	var posCnt int
	var posSum float64
	db.QueryRow(`
		SELECT COUNT(*), COALESCE(SUM(total_amount),0)
		FROM sales WHERE company_id = $1 AND created_at >= $2
	`, companyID, from).Scan(&posCnt, &posSum)

	suffix := tr(lang, "soʻm", "сум")
	var b strings.Builder
	fmt.Fprintf(&b, "💰 <b>%s</b> — %s\n\n", html.EscapeString(name), periodLabel(lang, period))
	fmt.Fprintf(&b, "%s: <b>%s %s</b>\n", tr(lang, "🛍 Buyurtmalar", "🛍 Заказы"), fmtInt(orders), tr(lang, "ta", "шт"))
	fmt.Fprintf(&b, "%s: <b>%s %s</b>\n", tr(lang, "📈 Daromad", "📈 Выручка"), fmtMoney(revenue), suffix)
	fmt.Fprintf(&b, "%s: <b>%s %s</b>\n", tr(lang, "💵 Sof foyda", "💵 Чистая прибыль"), fmtMoney(profit), suffix)
	fmt.Fprintf(&b, "%s: <b>%d</b> · <b>%s %s</b>", tr(lang, "🏪 Kassa (oflayn)", "🏪 Касса (офлайн)"), posCnt, fmtMoney(posSum), suffix)
	return b.String()
}

// companySoldText — какие товары и сколько продано за период, с выручкой и
// чистой прибылью по каждому. Данные берём из позиций (items JSONB) заказов и
// офлайн-продаж: имя, количество, цена с наценкой, наценка (markupAmount).
func companySoldText(db *sql.DB, chatID int64, name, lang, period string) string {
	companyID, _, _ := companyByChatQuiet(db, chatID)
	from := periodFrom(period)
	rows, err := db.Query(`
		WITH raw AS (
			SELECT
				COALESCE(NULLIF(item->>'name',''), NULLIF(item->>'productName',''), NULLIF(item->>'product_name','')) AS pname,
				CASE
					WHEN item->>'productId'  ~ '^\d+$' THEN (item->>'productId')::bigint
					WHEN item->>'product_id' ~ '^\d+$' THEN (item->>'product_id')::bigint
					WHEN item->>'id'         ~ '^\d+$' THEN (item->>'id')::bigint
					ELSE NULL END AS product_id,
				CASE WHEN item->>'quantity' ~ '^\d+$' THEN (item->>'quantity')::int ELSE 1 END AS qty,
				COALESCE(
					CASE WHEN item->>'priceWithMarkup'  ~ '^\d+(\.\d+)?$' THEN (item->>'priceWithMarkup')::numeric
					     WHEN item->>'price_with_markup' ~ '^\d+(\.\d+)?$' THEN (item->>'price_with_markup')::numeric
					     WHEN item->>'price'             ~ '^\d+(\.\d+)?$' THEN (item->>'price')::numeric
					     ELSE 0 END, 0) AS unit_price,
				CASE WHEN item->>'markupAmount' ~ '^-?\d+(\.\d+)?$' THEN (item->>'markupAmount')::numeric ELSE NULL END AS markup
			FROM orders o, jsonb_array_elements(o.items) item
			WHERE o.company_id = $1 AND o.created_at >= $2
			  AND o.status NOT IN ('cancelled') AND jsonb_typeof(o.items) = 'array'
			UNION ALL
			SELECT
				COALESCE(NULLIF(item->>'name',''), NULLIF(item->>'productName',''), NULLIF(item->>'product_name','')) AS pname,
				CASE
					WHEN item->>'productId'  ~ '^\d+$' THEN (item->>'productId')::bigint
					WHEN item->>'product_id' ~ '^\d+$' THEN (item->>'product_id')::bigint
					WHEN item->>'id'         ~ '^\d+$' THEN (item->>'id')::bigint
					ELSE NULL END AS product_id,
				CASE WHEN item->>'quantity' ~ '^\d+$' THEN (item->>'quantity')::int ELSE 1 END AS qty,
				COALESCE(
					CASE WHEN item->>'priceWithMarkup'  ~ '^\d+(\.\d+)?$' THEN (item->>'priceWithMarkup')::numeric
					     WHEN item->>'price_with_markup' ~ '^\d+(\.\d+)?$' THEN (item->>'price_with_markup')::numeric
					     WHEN item->>'price'             ~ '^\d+(\.\d+)?$' THEN (item->>'price')::numeric
					     ELSE 0 END, 0) AS unit_price,
				CASE WHEN item->>'markupAmount' ~ '^-?\d+(\.\d+)?$' THEN (item->>'markupAmount')::numeric ELSE NULL END AS markup
			FROM sales s, jsonb_array_elements(s.items) item
			WHERE s.company_id = $1 AND s.created_at >= $2 AND jsonb_typeof(s.items) = 'array'
		),
		joined AS (
			SELECT
				COALESCE(r.pname, p.name) AS disp_name,
				r.qty,
				r.unit_price,
				-- Чистая прибыль на единицу: если товар есть в складе — продажная
				-- минус себестоимость (p.price = Tan narx); иначе берём markupAmount
				-- из позиции; иначе 0.
				COALESCE(
					CASE WHEN p.price IS NOT NULL AND p.price > 0 AND r.unit_price > 0
					     THEN r.unit_price - p.price ELSE NULL END,
					r.markup, 0) AS unit_profit
			FROM raw r
			LEFT JOIN products p ON p.id = r.product_id
		)
		SELECT COALESCE(MIN(disp_name), $3) AS pname,
		       SUM(qty) AS qty,
		       SUM(unit_price * qty) AS revenue,
		       SUM(unit_profit * qty) AS profit
		FROM joined
		WHERE disp_name IS NOT NULL AND disp_name <> ''
		GROUP BY lower(disp_name)
		ORDER BY qty DESC
		LIMIT 15
	`, companyID, from, tr(lang, "Tovar", "Товар"))
	if err != nil {
		return tr(lang, "Sotuvlarni olishning imkoni boʻlmadi.", "Не удалось получить продажи.")
	}
	defer rows.Close()

	suffix := tr(lang, "soʻm", "сум")
	var b strings.Builder
	fmt.Fprintf(&b, "🧾 <b>%s</b> — %s\n\n", html.EscapeString(name), periodLabel(lang, period))
	var totalQty int
	var totalRevenue, totalProfit float64
	n := 0
	for rows.Next() {
		var pname string
		var qty int
		var revenue, profit float64
		if rows.Scan(&pname, &qty, &revenue, &profit) != nil {
			continue
		}
		n++
		totalQty += qty
		totalRevenue += revenue
		totalProfit += profit
		fmt.Fprintf(&b, "• %s — <b>%d %s</b>\n   💵 %s %s · %s <b>%s %s</b>\n",
			html.EscapeString(pname), qty, tr(lang, "dona", "шт"),
			fmtMoney(revenue), suffix,
			tr(lang, "sof foyda", "чистая прибыль"), fmtMoney(profit), suffix)
	}
	if n == 0 {
		b.WriteString(tr(lang, "Bu davrda sotuvlar yoʻq.", "За этот период продаж нет."))
		return b.String()
	}
	fmt.Fprintf(&b, "\n<b>%s:</b> %d %s · %s %s · %s <b>%s %s</b>",
		tr(lang, "Jami", "Итого"), totalQty, tr(lang, "dona", "шт"),
		fmtMoney(totalRevenue), suffix,
		tr(lang, "sof foyda", "чистая прибыль"), fmtMoney(totalProfit), suffix)
	return b.String()
}

// companyByChatQuiet — как companyByChat, но без ответа в чат при ошибке.
func companyByChatQuiet(db *sql.DB, chatID int64) (int64, string, bool) {
	var id int64
	var name string
	if err := db.QueryRow(`SELECT id, name FROM companies WHERE telegram_chat_id = $1`, chatID).Scan(&id, &name); err != nil {
		return 0, "", false
	}
	return id, name, true
}

// fmtInt форматирует целое с разделением тысяч пробелом.
func fmtInt(v int) string { return fmtMoney(float64(v)) }

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

func statusLabel(lang, s string) string {
	ru := map[string]string{
		"pending": "новый", "confirmed": "принят", "processing": "в обработке",
		"shipped": "в пути", "delivered": "доставлен", "completed": "завершён",
		"cancelled": "отменён",
	}
	uz := map[string]string{
		"pending": "yangi", "confirmed": "qabul qilindi", "processing": "jarayonda",
		"shipped": "yoʻlda", "delivered": "yetkazildi", "completed": "yakunlandi",
		"cancelled": "bekor qilindi",
	}
	if lang == "uz" {
		if v, ok := uz[s]; ok {
			return v
		}
		return s
	}
	if v, ok := ru[s]; ok {
		return v
	}
	return s
}

// companyOrdersText — заказы магазина за выбранный период (день/неделя).
func companyOrdersText(db *sql.DB, chatID int64, name, lang, period string) string {
	companyID, _, _ := companyByChatQuiet(db, chatID)
	from := periodFrom(period)
	rows, err := db.Query(`
		SELECT COALESCE(order_code,''), COALESCE(customer_name,''), COALESCE(total_amount,0),
		       COALESCE(status,''), created_at
		FROM orders WHERE company_id = $1 AND created_at >= $2
		ORDER BY id DESC LIMIT 10
	`, companyID, from)
	if err != nil {
		return tr(lang, "Buyurtmalarni olishning imkoni boʻlmadi.", "Не удалось получить заказы.")
	}
	defer rows.Close()
	var b strings.Builder
	fmt.Fprintf(&b, "📋 <b>%s</b> — %s\n\n", html.EscapeString(name), periodLabel(lang, period))
	n := 0
	for rows.Next() {
		var code, cname, status string
		var amount float64
		var created time.Time
		if rows.Scan(&code, &cname, &amount, &status, &created) != nil {
			continue
		}
		if code == "" {
			code = tr(lang, "buyurtma", "заказ")
		}
		n++
		fmt.Fprintf(&b, "• <b>%s</b> — %s %s · %s\n   %s · %s\n",
			html.EscapeString(code), fmtMoney(amount), tr(lang, "soʻm", "сум"), statusLabel(lang, status),
			html.EscapeString(cname), created.Format("02.01 15:04"))
	}
	if n == 0 {
		b.WriteString(tr(lang, "Bu davrda buyurtmalar yoʻq.", "За этот период заказов нет."))
	}
	return b.String()
}

// companyLowStockText — товары с критическим остатком. Алгоритм ТОТ ЖЕ, что в
// дашборде/«Расширенной аналитике»: остаток = сумма по вариантам (иначе
// quantity); порог зависит от цены — дешёвые (цена ниже средней по магазину)
// ≤ 20 шт, дорогие ≤ 10 шт. Нулевые остатки сюда не попадают.
func companyLowStockText(db *sql.DB, chatID int64, name, lang string) string {
	companyID, _, _ := companyByChatQuiet(db, chatID)
	rows, err := db.Query(`
		WITH stock AS (
			SELECT p.name,
			       COALESCE(p.price, 0) AS price,
			       COALESCE(NULLIF((SELECT SUM(pv.stock_quantity) FROM product_variants pv WHERE pv.product_id = p.id), 0), p.quantity, 0) AS stock
			FROM products p
			WHERE p.company_id = $1 AND p.name NOT LIKE '__CATEGORY_MARKER__%'
		),
		avgp AS (SELECT AVG(price) AS avg_price FROM stock)
		SELECT stock.name, stock.stock
		FROM stock, avgp
		WHERE stock.stock > 0
		  AND stock.stock <= CASE WHEN stock.price < avgp.avg_price THEN 20 ELSE 10 END
		ORDER BY stock.stock ASC
		LIMIT 20
	`, companyID)
	if err != nil {
		return tr(lang, "Qoldiqlarni olishning imkoni boʻlmadi.", "Не удалось получить остатки.")
	}
	defer rows.Close()
	var b strings.Builder
	fmt.Fprintf(&b, "📦 <b>%s</b> — %s\n\n", html.EscapeString(name), tr(lang, "kritik qoldiq", "критические остатки"))
	n := 0
	for rows.Next() {
		var pname string
		var qty int
		if rows.Scan(&pname, &qty) != nil {
			continue
		}
		n++
		fmt.Fprintf(&b, "• %s — <b>%d %s</b>\n", html.EscapeString(pname), qty, tr(lang, "dona", "шт"))
	}
	if n == 0 {
		b.WriteString(tr(lang, "✅ Hammasi joyida — kritik qoldiq yoʻq.", "✅ Всё в порядке — критических остатков нет."))
	}
	return b.String()
}

// runTelegramStockAlerts шлёт оповещение, когда остаток товара падает до
// ПОЛОВИНЫ порога «критических товаров» из панели:
//
//	цена ниже средней по магазину  → порог 20 → сигнал при остатке ≤ 10;
//	цена выше средней              → порог 10 → сигнал при остатке ≤ 5.
//
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
		       (s.tg_low_stock_notified_at IS NOT NULL) AS notified,
		       COALESCE(c.tg_lang, 'ru') AS lang
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
	langByChat := map[int64]string{}
	var resetIDs []int64

	for rows.Next() {
		var (
			id, companyID, chatID int64
			name                  string
			stock, alertAt        int
			notified              bool
			lang                  string
		)
		if rows.Scan(&id, &companyID, &chatID, &name, &stock, &alertAt, &notified, &lang) != nil {
			continue
		}
		_ = companyID
		langByChat[chatID] = normLang(lang)
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
		lang := langByChat[chatID]
		var sb strings.Builder
		sb.WriteString(tr(lang, "⚠️ <b>Tovarlar kritik qoldiqda</b>\n\n", "⚠️ <b>Критический остаток товаров</b>\n\n"))
		limit := len(alerts)
		if limit > 15 {
			limit = 15
		}
		for i := 0; i < limit; i++ {
			sb.WriteString(fmt.Sprintf("• %s — <b>%s %d %s</b>\n", html.EscapeString(alerts[i].name),
				tr(lang, "qoldi", "осталось"), alerts[i].stock, tr(lang, "dona", "шт.")))
		}
		if len(alerts) > limit {
			sb.WriteString(fmt.Sprintf("%s %d %s\n", tr(lang, "…yana", "…и ещё"), len(alerts)-limit, tr(lang, "ta tovar", "товаров")))
		}
		sb.WriteString("\n" + tr(lang, "Sotuvni yoʻqotmaslik uchun omborni toʻldiring.", "Пополните склад, чтобы не потерять продажи."))
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
		SELECT id, name, telegram_chat_id, COALESCE(tg_lang, 'ru') FROM companies
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
		lang   string
	}
	var comps []comp
	for rows.Next() {
		var c comp
		if rows.Scan(&c.id, &c.name, &c.chatID, &c.lang) == nil {
			comps = append(comps, c)
		}
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

		lang := normLang(cmp.lang)
		cur := tr(lang, "soʻm", "сум")
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("📊 <b>%s %s</b> — %s\n\n",
			tr(lang, "Hisobot", "Отчёт за"), now.Format("02.01.2006"), html.EscapeString(cmp.name)))
		sb.WriteString(fmt.Sprintf("%s: <b>%d</b> · %s %s\n",
			tr(lang, "🛍 Onlayn buyurtmalar", "🛍 Заказы онлайн"), ordersCnt, fmtMoney(revenue), cur))
		sb.WriteString(fmt.Sprintf("%s: <b>%d</b> · %s %s\n",
			tr(lang, "🏪 Kassa (oflayn)", "🏪 Касса (офлайн)"), posCnt, fmtMoney(posSum), cur))
		sb.WriteString(fmt.Sprintf("%s: <b>%s %s</b>\n",
			tr(lang, "💰 Ustama (foyda)", "💰 Наценка (навар)"), fmtMoney(markup), cur))
		if cancelledCnt > 0 {
			sb.WriteString(fmt.Sprintf("%s: %d\n", tr(lang, "❌ Bekor qilingan buyurtmalar", "❌ Отменено заказов"), cancelledCnt))
		}
		if criticalCnt > 0 {
			sb.WriteString(fmt.Sprintf("\n%s: <b>%d</b> — %s",
				tr(lang, "⚠️ Kritik qoldiqdagi tovarlar", "⚠️ Товаров с критическим остатком"), criticalCnt,
				tr(lang, "panelga qarang.", "загляните в панель.")))
		} else {
			sb.WriteString("\n" + tr(lang, "✅ Zaxiralar yetarli.", "✅ Все запасы в норме."))
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
