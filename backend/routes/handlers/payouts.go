package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ─── 💸 Вывод средств компаний ────────────────────────────────────────────────
//
// Онлайн-оплаты покупателей (картой в приложении) поступают на счёт платформы.
// Компания выводит заработанное за вычетом комиссии платформы (индивидуальная
// ставка companies.platform_commission_percent).
//
// ФИНАНСОВАЯ КОРРЕКТНОСТЬ — главные правила этого файла:
//   1. Баланс считается ТОЛЬКО на сервере, одним SQL-запросом на NUMERIC
//      (никакой плавающей точки и никаких доверенных сумм с фронтенда).
//   2. Создание выплаты выполняется в транзакции под advisory-lock компании —
//      два параллельных запроса не могут вывести одни и те же деньги.
//   3. Комиссия удерживается всегда: доступно = онлайн-выручка × (1 − c%) −
//      уже выведенное/в обработке. Failed/cancelled суммы возвращаются в баланс.
//   4. Выплата помечается completed только после фактического подтверждения
//      перевода (ответ merchant-провайдера или ручное подтверждение админа).

// payoutBalance — сводка по деньгам компании. Все значения в сумах.
type payoutBalance struct {
	OnlineRevenue     float64 `json:"onlineRevenue"`     // сумма выполненных онлайн-заказов
	CommissionPercent float64 `json:"commissionPercent"` // текущая ставка комиссии
	CommissionAmount  float64 `json:"commissionAmount"`  // сколько удерживает платформа
	Earned            float64 `json:"earned"`            // выручка − комиссия
	WithdrawnTotal    float64 `json:"withdrawnTotal"`    // уже выплачено (completed)
	InProgress        float64 `json:"inProgress"`        // в обработке (pending+processing)
	Available         float64 `json:"available"`         // доступно к выводу прямо сейчас
}

// computePayoutBalance — единый источник правды по балансу. Выполняется одним
// запросом; NUMERIC-математика на стороне PostgreSQL, округление вниз до сума
// (floor), чтобы никогда не разрешить вывести больше заработанного.
func computePayoutBalance(q interface {
	QueryRow(query string, args ...interface{}) *sql.Row
}, companyID int64) (payoutBalance, error) {
	var b payoutBalance
	err := q.QueryRow(`
		WITH revenue AS (
			SELECT COALESCE(SUM(total_amount), 0)::numeric AS online_revenue
			FROM orders
			WHERE company_id = $1 AND status IN ('delivered', 'completed')
		), commission AS (
			SELECT COALESCE(platform_commission_percent, 3)::numeric AS pct
			FROM companies WHERE id = $1
		), paid AS (
			SELECT
				COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0)::numeric  AS withdrawn,
				COALESCE(SUM(amount) FILTER (WHERE status IN ('pending','processing')), 0)::numeric AS in_progress
			FROM payouts WHERE company_id = $1
		)
		SELECT
			revenue.online_revenue,
			commission.pct,
			ROUND(revenue.online_revenue * commission.pct / 100, 2)                            AS commission_amount,
			FLOOR(revenue.online_revenue * (100 - commission.pct) / 100)                        AS earned,
			paid.withdrawn,
			paid.in_progress,
			GREATEST(
				FLOOR(revenue.online_revenue * (100 - commission.pct) / 100)
					- paid.withdrawn - paid.in_progress,
				0
			) AS available
		FROM revenue, commission, paid
	`, companyID).Scan(
		&b.OnlineRevenue, &b.CommissionPercent, &b.CommissionAmount,
		&b.Earned, &b.WithdrawnTotal, &b.InProgress, &b.Available,
	)
	return b, err
}

// GetPayoutBalance — GET /companies/:companyId/payout-balance.
func GetPayoutBalance(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid company id"})
			return
		}
		if !requireCompanyMatch(c, companyID) {
			return
		}
		balance, err := computePayoutBalance(db, companyID)
		if err != nil {
			log.Printf("❌ GetPayoutBalance: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to compute balance"})
			return
		}
		c.JSON(http.StatusOK, balance)
	}
}

var cardDigitsRe = regexp.MustCompile(`^\d{16}$`)

// maskCard — компании и в списках показываем только маску: 8600 12•• •••• 3456.
func maskCard(card string) string {
	d := strings.ReplaceAll(card, " ", "")
	if len(d) < 10 {
		return "••••"
	}
	return d[:6] + "••••••" + d[len(d)-4:]
}

// VerifyPayoutCard — POST /payouts/verify-card {cardNumber}.
// Проверка реквизитов ПЕРЕД выводом: у платёжного провайдера запрашивается
// имя владельца карты, чтобы компания подтвердила, что переводит себе.
// Пока merchant API не настроен — честно сообщаем об этом (без имитации).
func VerifyPayoutCard(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		if ctxRole(c) != "company" && !isAdmin(c) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			return
		}
		var req struct {
			CardNumber string `json:"cardNumber"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}
		card := strings.ReplaceAll(strings.TrimSpace(req.CardNumber), " ", "")
		if !cardDigitsRe.MatchString(card) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Номер карты должен содержать 16 цифр"})
			return
		}

		provider, configured := merchantProvider()
		if !configured {
			c.JSON(http.StatusOK, gin.H{
				"verified":   false,
				"configured": false,
				"maskedCard": maskCard(card),
				"message":    "Автопроверка карты будет доступна после подключения merchant API. Укажите имя владельца вручную — оно будет проверено при обработке выплаты.",
			})
			return
		}
		holder, err := provider.VerifyCard(card)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"verified":   false,
				"configured": true,
				"maskedCard": maskCard(card),
				"message":    "Не удалось проверить карту: " + err.Error(),
			})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"verified":   true,
			"configured": true,
			"maskedCard": maskCard(card),
			"cardHolder": holder,
		})
	}
}

// CreatePayout — POST /companies/:companyId/payouts {cardNumber, cardHolder, amount}.
// Транзакция + advisory-lock компании: параллельные запросы не могут вывести
// одни и те же деньги. Сумма проверяется против баланса, посчитанного ВНУТРИ
// транзакции.
func CreatePayout(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid company id"})
			return
		}
		if !requireCompanyMatch(c, companyID) {
			return
		}

		var req struct {
			CardNumber string  `json:"cardNumber"`
			CardHolder string  `json:"cardHolder"`
			Amount     float64 `json:"amount"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}
		card := strings.ReplaceAll(strings.TrimSpace(req.CardNumber), " ", "")
		if !cardDigitsRe.MatchString(card) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Номер карты должен содержать 16 цифр"})
			return
		}
		// Целые сумы: дробные суммы вывода не принимаем.
		amount := float64(int64(req.Amount))
		if amount <= 0 || amount != req.Amount {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Сумма должна быть целым положительным числом"})
			return
		}
		const minPayout = 10000 // минимальный вывод — 10 000 сум
		if amount < minPayout {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Минимальная сумма вывода — %d сум", minPayout)})
			return
		}

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start transaction"})
			return
		}
		defer tx.Rollback()

		// 🔒 Одна выплата компании за раз: advisory-lock снимается при COMMIT/ROLLBACK.
		if _, err := tx.Exec(`SELECT pg_advisory_xact_lock($1)`, companyID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to acquire lock"})
			return
		}

		balance, err := computePayoutBalance(tx, companyID)
		if err != nil {
			log.Printf("❌ CreatePayout balance: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to compute balance"})
			return
		}
		if amount > balance.Available {
			c.JSON(http.StatusUnprocessableEntity, gin.H{
				"error":     fmt.Sprintf("Недостаточно средств: доступно %.0f сум", balance.Available),
				"available": balance.Available,
			})
			return
		}

		var (
			payoutID   int64
			commission = balance.CommissionPercent
		)
		err = tx.QueryRow(`
			INSERT INTO payouts (company_id, amount, card_number, card_holder, status, commission_percent)
			VALUES ($1, $2, $3, $4, 'pending', $5)
			RETURNING id
		`, companyID, amount, card, strings.TrimSpace(req.CardHolder), commission).Scan(&payoutID)
		if err != nil {
			log.Printf("❌ CreatePayout insert: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create payout"})
			return
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to commit"})
			return
		}

		// Деньги зарезервированы (pending). Дальше пытаемся провести перевод через
		// merchant-провайдера. Ошибка провайдера НЕ теряет заявку — она остаётся
		// pending и обрабатывается админом вручную.
		status := "pending"
		var providerRef string
		if provider, configured := merchantProvider(); configured {
			ref, terr := provider.Transfer(card, amount, fmt.Sprintf("payout-%d", payoutID))
			now := time.Now()
			if terr == nil {
				status = "completed"
				providerRef = ref
				_, _ = db.Exec(`
					UPDATE payouts SET status = 'completed', provider_ref = $1, processed_at = $2 WHERE id = $3
				`, ref, now, payoutID)
			} else {
				log.Printf("⚠️ CreatePayout transfer failed (stays pending for manual processing): %v", terr)
			}
		}

		newBalance, _ := computePayoutBalance(db, companyID)
		c.JSON(http.StatusOK, gin.H{
			"success":     true,
			"id":          payoutID,
			"status":      status,
			"providerRef": providerRef,
			"maskedCard":  maskCard(card),
			"amount":      amount,
			"balance":     newBalance,
		})
	}
}

// scanPayoutsRows читает выплаты; полный номер карты отдаём только админу
// (он нужен для фактического перевода), компании — маску.
func scanPayoutsRows(rows *sql.Rows, includeFullCard bool) []gin.H {
	list := make([]gin.H, 0)
	for rows.Next() {
		var (
			id, companyID        int64
			amount, commission   float64
			card, holder, status string
			providerRef          sql.NullString
			failureReason        sql.NullString
			createdAt            time.Time
			processedAt          sql.NullTime
			companyName          sql.NullString
		)
		if err := rows.Scan(&id, &companyID, &amount, &card, &holder, &status,
			&providerRef, &failureReason, &commission, &createdAt, &processedAt, &companyName); err != nil {
			continue
		}
		item := gin.H{
			"id": id, "companyId": companyID, "amount": amount,
			"maskedCard": maskCard(card), "cardHolder": holder,
			"status": status, "commissionPercent": commission,
			"createdAt": createdAt,
		}
		if includeFullCard {
			item["cardNumber"] = card
		}
		if companyName.Valid {
			item["companyName"] = companyName.String
		}
		if providerRef.Valid {
			item["providerRef"] = providerRef.String
		}
		if failureReason.Valid && failureReason.String != "" {
			item["failureReason"] = failureReason.String
		}
		if processedAt.Valid {
			item["processedAt"] = processedAt.Time
		}
		list = append(list, item)
	}
	return list
}

const payoutSelect = `
	SELECT p.id, p.company_id, p.amount, p.card_number, p.card_holder, p.status,
	       p.provider_ref, p.failure_reason, p.commission_percent, p.created_at, p.processed_at,
	       c.name
	FROM payouts p
	LEFT JOIN companies c ON c.id = p.company_id
`

// GetCompanyPayouts — GET /companies/:companyId/payouts. История выплат компании.
func GetCompanyPayouts(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid company id"})
			return
		}
		if !requireCompanyMatch(c, companyID) {
			return
		}
		rows, err := db.Query(payoutSelect+` WHERE p.company_id = $1 ORDER BY p.created_at DESC LIMIT 200`, companyID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch payouts"})
			return
		}
		defer rows.Close()
		c.JSON(http.StatusOK, scanPayoutsRows(rows, isAdmin(c)))
	}
}

// CancelPayout — PUT /payouts/:id/cancel. Компания может отменить только СВОЮ
// выплату и только пока она pending (атомарный UPDATE с условием статуса).
func CancelPayout(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var companyID int64
		if err := db.QueryRow(`SELECT company_id FROM payouts WHERE id = $1`, id).Scan(&companyID); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "payout not found"})
			return
		}
		if !requireCompanyMatch(c, companyID) {
			return
		}
		res, err := db.Exec(`
			UPDATE payouts SET status = 'cancelled', processed_at = NOW()
			WHERE id = $1 AND status = 'pending'
		`, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to cancel"})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "Выплата уже в обработке — отмена невозможна"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "status": "cancelled"})
	}
}

// GetAllPayouts — GET /payouts?status= (только админ). Очередь на обработку.
func GetAllPayouts(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		status := strings.TrimSpace(c.Query("status"))
		var (
			rows *sql.Rows
			err  error
		)
		if status != "" {
			rows, err = db.Query(payoutSelect+` WHERE p.status = $1 ORDER BY p.created_at DESC LIMIT 500`, status)
		} else {
			rows, err = db.Query(payoutSelect + ` ORDER BY p.created_at DESC LIMIT 500`)
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch payouts"})
			return
		}
		defer rows.Close()
		c.JSON(http.StatusOK, scanPayoutsRows(rows, true))
	}
}

// UpdatePayoutStatus — PUT /payouts/:id/status (только админ).
// Ручная обработка, пока merchant API не подключён: админ выполняет перевод и
// подтверждает его здесь. Разрешённые переходы:
//   pending → processing | completed | failed
//   processing → completed | failed
// completed — терминальный статус: помеченную выплату изменить нельзя.
func UpdatePayoutStatus(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var req struct {
			Status        string `json:"status"`
			ProviderRef   string `json:"providerRef"`
			FailureReason string `json:"failureReason"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}
		valid := map[string]bool{"processing": true, "completed": true, "failed": true}
		if !valid[req.Status] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "status must be processing|completed|failed"})
			return
		}
		// $1 приводится к text во всех местах использования: без каста Postgres
		// выводит для параметра противоречивые типы (varchar в SET, text в CASE)
		// и падает с "inconsistent types deduced for parameter $1".
		res, err := db.Exec(`
			UPDATE payouts
			SET status = $1::text,
			    provider_ref = COALESCE(NULLIF($2, ''), provider_ref),
			    failure_reason = CASE WHEN $1::text = 'failed' THEN NULLIF($3, '') ELSE failure_reason END,
			    processed_at = CASE WHEN $1::text IN ('completed', 'failed') THEN NOW() ELSE processed_at END
			WHERE id = $4 AND status IN ('pending', 'processing')
		`, req.Status, req.ProviderRef, req.FailureReason, id)
		if err != nil {
			log.Printf("❌ UpdatePayoutStatus: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update"})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "Выплата не найдена или уже завершена"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "status": req.Status})
	}
}

// ─── Merchant-провайдер (перевод на карту) ────────────────────────────────────
//
// Абстракция над платёжным API. Ключи придут позже — до их появления provider
// не сконфигурирован, автоперевод не выполняется, а заявки обрабатываются
// админом вручную. Контракт HTTP-провайдера:
//   POST {MERCHANT_API_URL}/verify-card  {"cardNumber": "..."}          → {"cardHolder": "..."}
//   POST {MERCHANT_API_URL}/transfer     {"cardNumber","amount","ref"}  → {"transactionId": "..."}
// Авторизация: заголовок Authorization: Bearer {MERCHANT_API_KEY}.

type payoutProvider interface {
	VerifyCard(cardNumber string) (holder string, err error)
	Transfer(cardNumber string, amount float64, ref string) (providerRef string, err error)
}

type httpMerchantProvider struct {
	baseURL string
	apiKey  string
}

// merchantProvider возвращает провайдера и признак «настроен ли он».
func merchantProvider() (payoutProvider, bool) {
	baseURL := strings.TrimRight(os.Getenv("MERCHANT_API_URL"), "/")
	apiKey := os.Getenv("MERCHANT_API_KEY")
	if baseURL == "" || apiKey == "" {
		return nil, false
	}
	return &httpMerchantProvider{baseURL: baseURL, apiKey: apiKey}, true
}

func (p *httpMerchantProvider) call(path string, payload interface{}, out interface{}) error {
	body, _ := json.Marshal(payload)
	req, err := http.NewRequest(http.MethodPost, p.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.apiKey)
	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var e struct {
			Error string `json:"error"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&e)
		if e.Error != "" {
			return errors.New(e.Error)
		}
		return fmt.Errorf("merchant API responded %d", resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

func (p *httpMerchantProvider) VerifyCard(cardNumber string) (string, error) {
	var out struct {
		CardHolder string `json:"cardHolder"`
	}
	if err := p.call("/verify-card", gin.H{"cardNumber": cardNumber}, &out); err != nil {
		return "", err
	}
	if out.CardHolder == "" {
		return "", errors.New("провайдер не вернул имя владельца")
	}
	return out.CardHolder, nil
}

func (p *httpMerchantProvider) Transfer(cardNumber string, amount float64, ref string) (string, error) {
	var out struct {
		TransactionID string `json:"transactionId"`
	}
	if err := p.call("/transfer", gin.H{"cardNumber": cardNumber, "amount": amount, "ref": ref}, &out); err != nil {
		return "", err
	}
	if out.TransactionID == "" {
		return "", errors.New("провайдер не вернул id транзакции")
	}
	return out.TransactionID, nil
}
