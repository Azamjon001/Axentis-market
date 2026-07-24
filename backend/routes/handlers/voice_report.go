package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"strings"
	"time"
)

// 🎙 Голосовой дневной отчёт для компаний.
//
// Продавцу удобнее наговорить, что он продал за день, чем стучать по кнопкам.
// Он присылает боту голосовое (обычно на узбекском): «продал 10 кг яблок по
// 15 000, дал в долг Анвару 60 000, ещё продал 2,5 кг груш по 12 000». Бот:
//   1) скачивает голосовое из Telegram;
//   2) распознаёт речь (OpenAI Whisper);
//   3) извлекает структурированные данные (LLM → JSON): продажи, долги, расходы;
//   4) считает выручку и ЧИСТУЮ прибыль (себестоимость берётся из цифрового
//      склада, если товар там найден);
//   5) названные долги автоматически добавляет в «тетрадь долгов»
//      (company_debts) — по ним потом придёт напоминание;
//   6) присылает аккуратный текстовый отчёт.
//
// Требуется ключ OPENAI_API_KEY. Без него функция тихо выключена.

// voiceParse — структура, которую LLM извлекает из расшифровки речи.
type voiceParse struct {
	Sales []struct {
		Name      string  `json:"name"`
		Quantity  float64 `json:"quantity"`
		Unit      string  `json:"unit"`
		UnitPrice float64 `json:"unitPrice"`
	} `json:"sales"`
	Debts []struct {
		Person string  `json:"person"`
		Amount float64 `json:"amount"`
		// Через сколько дней вернуть (если названо в речи). 0 — не названо.
		DueInDays int `json:"dueInDays"`
	} `json:"debts"`
	Expenses []struct {
		Name   string  `json:"name"`
		Amount float64 `json:"amount"`
	} `json:"expenses"`
}

// handleCompanyVoice — весь путь обработки голосового сообщения компании.
func handleCompanyVoice(db *sql.DB, chatID int64, fileID string) {
	companyID, _, ok := companyByChatQuiet(db, chatID)
	if !ok {
		sendTelegramMessage(chatID, "Магазин не привязан. Подключите бота в панели: Настройки → Telegram-оповещения.")
		return
	}
	if tgOpenAIKey == "" {
		sendTelegramMessage(chatID, "🎙 Ovozli hisobot funksiyasi hozircha yoqilmagan.\n(Sozlash: OPENAI_API_KEY.)")
		return
	}

	sendTelegramMessage(chatID, "🎙 Ovozli xabar qayta ishlanmoqda…")

	audio, filename, err := tgDownloadFile(fileID)
	if err != nil {
		log.Printf("⚠️ Voice download: %v", err)
		sendTelegramMessage(chatID, "❌ Ovozli xabarni yuklab boʻlmadi, qaytadan urinib koʻring.")
		return
	}

	transcript, err := openAITranscribe(audio, filename)
	if err != nil || strings.TrimSpace(transcript) == "" {
		log.Printf("⚠️ Voice transcribe: %v", err)
		sendTelegramMessage(chatID, "❌ Nutqni tanib boʻlmadi. Iltimos, tinchroq va aniqroq gapiring.")
		return
	}

	parsed, err := openAIExtract(transcript)
	if err != nil {
		log.Printf("⚠️ Voice extract: %v", err)
		sendTelegramMessage(chatID, "❌ Xabarni tahlil qilib boʻlmadi, qaytadan urinib koʻring.")
		return
	}

	sendTelegramMessage(chatID, buildVoiceReport(db, companyID, transcript, parsed))
}

// tgDownloadFile скачивает файл Telegram по file_id: getFile → download.
func tgDownloadFile(fileID string) ([]byte, string, error) {
	resp, err := http.Get(tgAPI("getFile") + "?file_id=" + fileID)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()
	var out struct {
		OK     bool `json:"ok"`
		Result struct {
			FilePath string `json:"file_path"`
		} `json:"result"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil || !out.OK || out.Result.FilePath == "" {
		return nil, "", fmt.Errorf("getFile failed")
	}
	url := "https://api.telegram.org/file/bot" + tgToken + "/" + out.Result.FilePath
	fResp, err := http.Get(url)
	if err != nil {
		return nil, "", err
	}
	defer fResp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(fResp.Body, 25<<20)) // до 25 МБ
	if err != nil {
		return nil, "", err
	}
	filename := "voice.ogg"
	if i := strings.LastIndex(out.Result.FilePath, "/"); i >= 0 {
		filename = out.Result.FilePath[i+1:]
	}
	return data, filename, nil
}

// openAITranscribe распознаёт речь (Whisper). Язык подсказываем узбекский —
// продавцы диктуют на узбекском, так точность выше.
func openAITranscribe(audio []byte, filename string) (string, error) {
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	fw, err := w.CreateFormFile("file", filename)
	if err != nil {
		return "", err
	}
	if _, err := fw.Write(audio); err != nil {
		return "", err
	}
	w.WriteField("model", "whisper-1")
	w.WriteField("language", "uz")
	w.WriteField("response_format", "text")
	w.Close()

	req, err := http.NewRequest("POST", "https://api.openai.com/v1/audio/transcriptions", &buf)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+tgOpenAIKey)
	req.Header.Set("Content-Type", w.FormDataContentType())

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("whisper %d: %s", resp.StatusCode, string(body))
	}
	return strings.TrimSpace(string(body)), nil
}

// openAIExtract просит LLM вытащить из расшифровки строгий JSON: продажи, долги,
// расходы. Математику НЕ доверяем модели — считаем сами в Go (см. buildVoiceReport).
func openAIExtract(transcript string) (*voiceParse, error) {
	system := "Ты — парсер устных отчётов продавца (речь на узбекском или русском). " +
		"Извлеки из текста: проданные товары, выданные в долг суммы и расходы. " +
		"Верни СТРОГО JSON без пояснений в формате: " +
		`{"sales":[{"name":"","quantity":0,"unit":"","unitPrice":0}],"debts":[{"person":"","amount":0,"dueInDays":0}],"expenses":[{"name":"","amount":0}]}. ` +
		"quantity — число (штук/кг/литров), unit — единица (dona/kg/litr). " +
		"unitPrice — цена за ОДНУ единицу в сумах (число, без пробелов). " +
		"amount — сумма в сумах. dueInDays — через сколько дней обещали вернуть долг " +
		"(например «через неделю» → 7, «завтра» → 1); если срок не назван — 0. " +
		"Если чего-то в речи нет — верни пустой массив. Только JSON."

	payload := map[string]interface{}{
		"model": "gpt-4o-mini",
		"messages": []map[string]string{
			{"role": "system", "content": system},
			{"role": "user", "content": transcript},
		},
		"response_format": map[string]string{"type": "json_object"},
		"temperature":     0,
	}
	body, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", "https://api.openai.com/v1/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+tgOpenAIKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("chat %d: %s", resp.StatusCode, string(raw))
	}
	var out struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(raw, &out); err != nil || len(out.Choices) == 0 {
		return nil, fmt.Errorf("bad chat response")
	}
	var parsed voiceParse
	if err := json.Unmarshal([]byte(out.Choices[0].Message.Content), &parsed); err != nil {
		return nil, fmt.Errorf("bad json content: %w", err)
	}
	return &parsed, nil
}

// productCostByName ищет себестоимость товара по имени в складе компании.
func productCostByName(db *sql.DB, companyID int64, name string) (float64, bool) {
	name = strings.TrimSpace(name)
	if name == "" {
		return 0, false
	}
	var price float64
	err := db.QueryRow(`
		SELECT COALESCE(price, 0) FROM products
		WHERE company_id = $1
		  AND name NOT LIKE '__CATEGORY_MARKER__%'
		  AND lower(name) LIKE '%' || lower($2) || '%'
		ORDER BY length(name) ASC
		LIMIT 1
	`, companyID, name).Scan(&price)
	if err != nil {
		return 0, false
	}
	return price, price > 0
}

// buildVoiceReport считает итоги, добавляет долги в тетрадь и формирует ответ
// на узбекском (продавцы диктуют на узбекском).
func buildVoiceReport(db *sql.DB, companyID int64, transcript string, p *voiceParse) string {
	var b strings.Builder
	b.WriteString("🎙 <b>Ovozli hisobot</b>\n\n")
	b.WriteString("📝 <i>" + html.EscapeString(transcript) + "</i>\n")

	var totalRevenue, totalProfit, totalExpenses, totalDebt float64
	profitKnown := false

	if len(p.Sales) > 0 {
		b.WriteString("\n🧾 <b>Sotuvlar:</b>\n")
		for _, s := range p.Sales {
			qty := s.Quantity
			if qty <= 0 {
				qty = 1
			}
			revenue := s.UnitPrice * qty
			totalRevenue += revenue
			unit := s.Unit
			if unit == "" {
				unit = "dona"
			}
			line := fmt.Sprintf("• %s — %s %s · %s soʻm",
				html.EscapeString(s.Name), trimNum(qty), html.EscapeString(unit), fmtMoney(revenue))
			if cost, ok := productCostByName(db, companyID, s.Name); ok {
				profit := (s.UnitPrice - cost) * qty
				totalProfit += profit
				profitKnown = true
				line += fmt.Sprintf(" · <b>sof foyda %s soʻm</b>", fmtMoney(profit))
			} else {
				line += " · <i>(skladda topilmadi — foyda hisoblanmadi)</i>"
			}
			b.WriteString(line + "\n")
		}
	}

	if len(p.Expenses) > 0 {
		b.WriteString("\n📉 <b>Xarajatlar:</b>\n")
		for _, e := range p.Expenses {
			totalExpenses += e.Amount
			b.WriteString(fmt.Sprintf("• %s — %s soʻm\n", html.EscapeString(e.Name), fmtMoney(e.Amount)))
		}
	}

	// Долги — добавляем в тетрадь долгов; по ним потом придёт напоминание.
	var addedDebts []string
	for _, d := range p.Debts {
		if d.Amount <= 0 || strings.TrimSpace(d.Person) == "" {
			continue
		}
		totalDebt += d.Amount
		// Срок возврата: как названо в речи, иначе через 7 дней — чтобы по долгу
		// сработало напоминание (worker шлёт по due_date).
		days := d.DueInDays
		if days <= 0 {
			days = 7
		}
		dueDate := time.Now().Add(time.Duration(days) * 24 * time.Hour).Format("2006-01-02")
		_, err := db.Exec(`
			INSERT INTO company_debts (company_id, customer_name, customer_phone, amount, note, due_date)
			VALUES ($1, $2, '', $3, $4, $5)
		`, companyID, strings.TrimSpace(d.Person), d.Amount, "Ovozli hisobot orqali qoʻshildi", dueDate)
		if err != nil {
			log.Printf("⚠️ Voice debt insert: %v", err)
			continue
		}
		addedDebts = append(addedDebts, fmt.Sprintf("• %s — %s soʻm <i>(%s gacha)</i>",
			html.EscapeString(d.Person), fmtMoney(d.Amount), dueDate))
	}

	b.WriteString("\n━━━━━━━━━━━━━━\n")
	b.WriteString(fmt.Sprintf("💰 Jami tushum: <b>%s soʻm</b>\n", fmtMoney(totalRevenue)))
	if totalExpenses > 0 {
		b.WriteString(fmt.Sprintf("📉 Xarajatlar: <b>%s soʻm</b>\n", fmtMoney(totalExpenses)))
	}
	if profitKnown {
		net := totalProfit - totalExpenses
		b.WriteString(fmt.Sprintf("📈 Sof foyda: <b>%s soʻm</b>\n", fmtMoney(net)))
	}

	if len(addedDebts) > 0 {
		b.WriteString("\n💳 <b>Qarz daftariga qoʻshildi</b> (eslatma keladi):\n")
		b.WriteString(strings.Join(addedDebts, "\n") + "\n")
		b.WriteString(fmt.Sprintf("Jami qarz: <b>%s soʻm</b>\n", fmtMoney(totalDebt)))
	}

	if len(p.Sales) == 0 && len(p.Debts) == 0 && len(p.Expenses) == 0 {
		b.WriteString("\n⚠️ Xabardan sotuv/qarz/xarajat aniqlanmadi. Qaytadan, aniqroq gapirib koʻring.")
	}

	return b.String()
}

// trimNum печатает число без лишних нулей: 2.5 → «2.5», 10.0 → «10».
func trimNum(v float64) string {
	s := fmt.Sprintf("%.2f", v)
	s = strings.TrimRight(s, "0")
	s = strings.TrimRight(s, ".")
	return s
}
