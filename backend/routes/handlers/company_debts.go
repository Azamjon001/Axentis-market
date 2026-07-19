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
// 🧾 «Дафтар» — журнал долгов клиентов (рассрочка/долговая тетрадь).
//
// Классическую тетрадь долгов продавца переносим в цифру: кому, сколько,
// когда обещал вернуть, сколько уже погашено. Единый API для веб-панели
// и мобильного приложения. Утром (10:00 Ташкент) продавцу приходит push
// со сводкой долгов, у которых наступил или прошёл срок.
// ============================================================================

// MigrateCompanyDebts — таблица долгов + цель продаж компании (идемпотентно).
func MigrateCompanyDebts(db *sql.DB) {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS company_debts (
			id BIGSERIAL PRIMARY KEY,
			company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
			customer_name TEXT NOT NULL,
			customer_phone TEXT DEFAULT '',
			amount NUMERIC NOT NULL,
			paid_amount NUMERIC NOT NULL DEFAULT 0,
			note TEXT DEFAULT '',
			due_date DATE,
			status TEXT NOT NULL DEFAULT 'open',
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_company_debts_company ON company_debts(company_id)`,
		// 🎯 Дневная цель продаж (для кольца прогресса на дашборде)
		`ALTER TABLE companies ADD COLUMN IF NOT EXISTS daily_sales_goal NUMERIC DEFAULT 0`,
		// Дата последнего напоминания о долгах (раз в день)
		`ALTER TABLE companies ADD COLUMN IF NOT EXISTS debts_last_reminder_date DATE`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			log.Printf("⚠️ MigrateCompanyDebts: %v", err)
		}
	}
}

func debtToJSON(id int64, companyID int64, name, phone string, amount, paid float64, note string, dueDate sql.NullTime, status string, createdAt time.Time) gin.H {
	res := gin.H{
		"id":            id,
		"companyId":     companyID,
		"customerName":  name,
		"customerPhone": phone,
		"amount":        amount,
		"paidAmount":    paid,
		"note":          note,
		"status":        status,
		"createdAt":     createdAt.Format(time.RFC3339),
	}
	if dueDate.Valid {
		res["dueDate"] = dueDate.Time.Format("2006-01-02")
	}
	return res
}

// ListDebts — GET /debts?companyId=
func ListDebts(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID, err := strconv.ParseInt(c.Query("companyId"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "companyId is required"})
			return
		}
		if !requireCompanyMatch(c, companyID) {
			return
		}

		rows, err := db.Query(`
			SELECT id, company_id, customer_name, customer_phone, amount, paid_amount, note, due_date, status, created_at
			FROM company_debts WHERE company_id = $1
			ORDER BY (status = 'open') DESC, due_date NULLS LAST, created_at DESC
			LIMIT 1000
		`, companyID)
		if err != nil {
			log.Printf("⚠️ ListDebts: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load debts"})
			return
		}
		defer rows.Close()

		result := []gin.H{}
		for rows.Next() {
			var id, cid int64
			var name, phone, note, status string
			var amount, paid float64
			var dueDate sql.NullTime
			var createdAt time.Time
			if rows.Scan(&id, &cid, &name, &phone, &amount, &paid, &note, &dueDate, &status, &createdAt) == nil {
				result = append(result, debtToJSON(id, cid, name, phone, amount, paid, note, dueDate, status, createdAt))
			}
		}
		c.JSON(http.StatusOK, result)
	}
}

// CreateDebt — POST /debts
func CreateDebt(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			CompanyID     int64   `json:"companyId"`
			CustomerName  string  `json:"customerName"`
			CustomerPhone string  `json:"customerPhone"`
			Amount        float64 `json:"amount"`
			Note          string  `json:"note"`
			DueDate       string  `json:"dueDate"` // YYYY-MM-DD, опционально
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if !requireCompanyMatch(c, req.CompanyID) {
			return
		}
		if strings.TrimSpace(req.CustomerName) == "" || req.Amount <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "customerName and positive amount are required"})
			return
		}

		var dueDate interface{}
		if req.DueDate != "" {
			if d, err := time.Parse("2006-01-02", req.DueDate); err == nil {
				dueDate = d
			}
		}

		var id int64
		var createdAt time.Time
		err := db.QueryRow(`
			INSERT INTO company_debts (company_id, customer_name, customer_phone, amount, note, due_date)
			VALUES ($1, $2, $3, $4, $5, $6)
			RETURNING id, created_at
		`, req.CompanyID, strings.TrimSpace(req.CustomerName), strings.TrimSpace(req.CustomerPhone),
			req.Amount, strings.TrimSpace(req.Note), dueDate).Scan(&id, &createdAt)
		if err != nil {
			log.Printf("⚠️ CreateDebt: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create debt"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "id": id, "createdAt": createdAt.Format(time.RFC3339)})
	}
}

// debtOwner возвращает company_id долга (0 — не найден).
func debtOwner(db *sql.DB, debtID string) int64 {
	var companyID int64
	if err := db.QueryRow(`SELECT company_id FROM company_debts WHERE id = $1`, debtID).Scan(&companyID); err != nil {
		return 0
	}
	return companyID
}

// UpdateDebt — PUT /debts/:id
// Поддерживает частичное погашение: { "addPayment": 50000 } прибавляет к
// paid_amount; при полном погашении статус автоматически становится paid.
func UpdateDebt(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		debtID := c.Param("id")
		companyID := debtOwner(db, debtID)
		if companyID == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Debt not found"})
			return
		}
		if !requireCompanyMatch(c, companyID) {
			return
		}

		var req struct {
			CustomerName  *string  `json:"customerName"`
			CustomerPhone *string  `json:"customerPhone"`
			Amount        *float64 `json:"amount"`
			AddPayment    *float64 `json:"addPayment"`
			Note          *string  `json:"note"`
			DueDate       *string  `json:"dueDate"`
			Status        *string  `json:"status"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		query := "UPDATE company_debts SET updated_at = NOW()"
		args := []interface{}{}
		n := 1
		add := func(clause string, v interface{}) {
			query += fmt.Sprintf(", "+clause, n)
			args = append(args, v)
			n++
		}
		if req.CustomerName != nil {
			add("customer_name = $%d", strings.TrimSpace(*req.CustomerName))
		}
		if req.CustomerPhone != nil {
			add("customer_phone = $%d", strings.TrimSpace(*req.CustomerPhone))
		}
		if req.Amount != nil && *req.Amount > 0 {
			add("amount = $%d", *req.Amount)
		}
		if req.AddPayment != nil && *req.AddPayment > 0 {
			add("paid_amount = LEAST(amount, paid_amount + $%d)", *req.AddPayment)
		}
		if req.Note != nil {
			add("note = $%d", strings.TrimSpace(*req.Note))
		}
		if req.DueDate != nil {
			if *req.DueDate == "" {
				query += ", due_date = NULL"
			} else if d, err := time.Parse("2006-01-02", *req.DueDate); err == nil {
				add("due_date = $%d", d)
			}
		}
		if req.Status != nil && (*req.Status == "open" || *req.Status == "paid") {
			add("status = $%d", *req.Status)
		}
		// Полное погашение закрывает долг автоматически
		query += ", status = CASE WHEN paid_amount >= amount THEN 'paid' ELSE status END"
		query += fmt.Sprintf(" WHERE id = $%d", n)
		args = append(args, debtID)

		if _, err := db.Exec(query, args...); err != nil {
			log.Printf("⚠️ UpdateDebt: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update debt"})
			return
		}
		// Отдаём обновлённую запись
		var id, cid int64
		var name, phone, note, status string
		var amount, paid float64
		var dueDate sql.NullTime
		var createdAt time.Time
		err := db.QueryRow(`
			SELECT id, company_id, customer_name, customer_phone, amount, paid_amount, note, due_date, status, created_at
			FROM company_debts WHERE id = $1
		`, debtID).Scan(&id, &cid, &name, &phone, &amount, &paid, &note, &dueDate, &status, &createdAt)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{"success": true})
			return
		}
		c.JSON(http.StatusOK, debtToJSON(id, cid, name, phone, amount, paid, note, dueDate, status, createdAt))
	}
}

// DeleteDebt — DELETE /debts/:id
func DeleteDebt(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		debtID := c.Param("id")
		companyID := debtOwner(db, debtID)
		if companyID == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Debt not found"})
			return
		}
		if !requireCompanyMatch(c, companyID) {
			return
		}
		if _, err := db.Exec(`DELETE FROM company_debts WHERE id = $1`, debtID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete debt"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// RunDebtReminderWorkers — push-напоминание о долгах со сроком «сегодня и
// раньше»: раз в день после 10:00 по Ташкенту.
func RunDebtReminderWorkers(db *sql.DB) {
	go func() {
		ticker := time.NewTicker(15 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			if n := runDebtReminders(db); n > 0 {
				log.Printf("💳 DebtReminder: отправлено %d напоминаний", n)
			}
		}
	}()
}

func runDebtReminders(db *sql.DB) int {
	tz := time.FixedZone("UZT", tzTashkentOffset)
	now := time.Now().In(tz)
	if now.Hour() < 10 {
		return 0
	}
	today := now.Format("2006-01-02")

	rows, err := db.Query(`
		SELECT c.id, c.expo_push_token,
		       COUNT(d.id),
		       COALESCE(SUM(d.amount - d.paid_amount), 0),
		       COUNT(d.id) FILTER (WHERE d.due_date < $1::date)
		FROM companies c
		JOIN company_debts d ON d.company_id = c.id
		WHERE c.expo_push_token IS NOT NULL AND c.expo_push_token <> ''
		  AND d.status = 'open' AND d.due_date IS NOT NULL AND d.due_date <= $1::date
		  AND (c.debts_last_reminder_date IS NULL OR c.debts_last_reminder_date < $1::date)
		GROUP BY c.id, c.expo_push_token
		LIMIT 500
	`, today)
	if err != nil {
		log.Printf("⚠️ DebtReminder query: %v", err)
		return 0
	}
	defer rows.Close()

	type row struct {
		companyID int64
		token     string
		count     int
		total     float64
		overdue   int
	}
	var list []row
	for rows.Next() {
		var r row
		if rows.Scan(&r.companyID, &r.token, &r.count, &r.total, &r.overdue) == nil {
			list = append(list, r)
		}
	}

	sent := 0
	for _, r := range list {
		body := fmt.Sprintf("Срок у %d долгов на %s", r.count, formatSumUZS(r.total))
		if r.overdue > 0 {
			body += fmt.Sprintf(", из них просрочено: %d", r.overdue)
		}
		if _, err := SendExpoPushNotificationData(
			[]string{r.token}, "💳 Дафтар: пора напомнить о долгах", body,
			map[string]interface{}{"type": "company_debt_reminder"},
		); err != nil {
			continue
		}
		db.Exec(`UPDATE companies SET debts_last_reminder_date = $1 WHERE id = $2`, today, r.companyID)
		sent++
	}
	return sent
}
