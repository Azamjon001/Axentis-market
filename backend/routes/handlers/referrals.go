package handlers

import (
	"azaton-backend/config"
	"azaton-backend/middleware"
	"crypto/rand"
	"database/sql"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// ReferralAgent структура реферального агента
type ReferralAgent struct {
	ID               int64     `json:"id"`
	Phone            string    `json:"phone"`
	Password         *string   `json:"password,omitempty"` // Пароль в открытом виде
	UniqueCode       string    `json:"unique_code"`
	Name             string    `json:"name"`
	Surname          string    `json:"surname"`
	CommissionPercent float64  `json:"commission_percent"` // % от комиссии платформы
	IsActive         bool      `json:"is_active"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// generateUniqueCode генерирует 7-значный уникальный код
func generateUniqueCode() (string, error) {
	const digits = "0123456789"
	code := make([]byte, 7)
	for i := range code {
		num, err := rand.Int(rand.Reader, big.NewInt(int64(len(digits))))
		if err != nil {
			return "", err
		}
		code[i] = digits[num.Int64()]
	}
	return string(code), nil
}

// CreateReferralAgent - создание реферального агента (только для админа)
func CreateReferralAgent(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input struct {
			Phone            string  `json:"phone" binding:"required"`
			Password         string  `json:"password" binding:"required"`
			Name             string  `json:"name"`
			Surname          string  `json:"surname"`
			CommissionPercent *float64 `json:"commission_percent"`
		}

		if err := c.BindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// По умолчанию агент получает 10% от комиссии платформы.
		commission := 10.0
		if input.CommissionPercent != nil {
			commission = *input.CommissionPercent
		}

		// Генерируем уникальный код
		var uniqueCode string
		var err error
		for {
			uniqueCode, err = generateUniqueCode()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate code"})
				return
			}

			// Проверяем уникальность
			var exists bool
			err = db.QueryRow("SELECT EXISTS(SELECT 1 FROM referral_agents WHERE unique_code = $1)", uniqueCode).Scan(&exists)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
				return
			}
			if !exists {
				break
			}
		}

		// Хешируем пароль
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
			return
		}

		// Создаем агента
		var agentID int64
		err = db.QueryRow(`
			INSERT INTO referral_agents (phone, password_hash, password, unique_code, name, surname, commission_percent, is_active)
			VALUES ($1, $2, $3, $4, $5, $6, $7, true)
			RETURNING id
		`, input.Phone, string(hashedPassword), input.Password, uniqueCode, input.Name, input.Surname, commission).Scan(&agentID)

		if err != nil {
			log.Printf("❌ Error creating referral agent: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create referral agent"})
			return
		}

		log.Printf("✅ Referral agent created: ID=%d, Code=%s", agentID, uniqueCode)

		c.JSON(http.StatusCreated, gin.H{
		"id":                 agentID,
		"phone":              input.Phone,
		"password":           input.Password, // Возвращаем пароль только при создании
		"unique_code":        uniqueCode,
		"name":               input.Name,
		"surname":            input.Surname,
		"commission_percent": commission,
		"is_active":          true,
		})
	}
}

// LoginReferralAgent - вход реферального агента
func LoginReferralAgent(db *sql.DB, cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input struct {
			Phone    string `json:"phone" binding:"required"`
			Password string `json:"password" binding:"required"`
		}

		if err := c.BindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		var agent ReferralAgent
		var passwordHash string
		var password string

		err := db.QueryRow(`
			SELECT id, phone, password_hash, password, unique_code, name, is_active, created_at, updated_at
			FROM referral_agents
			WHERE phone = $1
		`, input.Phone).Scan(
			&agent.ID, &agent.Phone, &passwordHash, &password, &agent.UniqueCode,
			&agent.Name, &agent.IsActive, &agent.CreatedAt, &agent.UpdatedAt,
		)

		if err == sql.ErrNoRows {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
			return
		}
		if err != nil {
			log.Printf("❌ Error finding referral agent: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}

		// Проверяем пароль
		if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(input.Password)); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
			return
		}

		// Проверяем активность
		if !agent.IsActive {
			c.JSON(http.StatusForbidden, gin.H{"error": "Agent account is disabled"})
			return
		}

		log.Printf("✅ Referral agent logged in: ID=%d, Code=%s", agent.ID, agent.UniqueCode)

		// Issue a real JWT (role "agent") instead of a placeholder token.
		token, err := middleware.GenerateToken(cfg, agent.ID, agent.Phone, "agent")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
			return
		}

		// Never echo the plaintext password back to the client on login.
		agent.Password = nil

		c.JSON(http.StatusOK, gin.H{
			"agent": agent,
			"token": token,
		})
	}
}

// GetReferralAgents - получить список всех агентов (для админа)
func GetReferralAgents(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`
			SELECT id, phone, password, unique_code, name,
			       COALESCE(surname, ''), COALESCE(commission_percent, 10),
			       is_active, created_at, updated_at
			FROM referral_agents
			ORDER BY created_at DESC
		`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch agents"})
			return
		}
		defer rows.Close()

		var agents []ReferralAgent
		for rows.Next() {
			var agent ReferralAgent
			var password sql.NullString
			err := rows.Scan(
				&agent.ID, &agent.Phone, &password, &agent.UniqueCode, &agent.Name,
				&agent.Surname, &agent.CommissionPercent,
				&agent.IsActive, &agent.CreatedAt, &agent.UpdatedAt,
			)
			if err != nil {
				log.Printf("⚠️ Error scanning agent: %v", err)
				continue
			}
			// Добавляем пароль если он есть
			if password.Valid {
				agent.Password = &password.String
			}
			agents = append(agents, agent)
		}

		c.JSON(http.StatusOK, agents)
	}
}

// GetReferralAgentStats - статистика по агенту
func GetReferralAgentStats(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		agentID := c.Param("id")

		var stats struct {
			TotalCompanies  int `json:"totalCompanies"`
			ActiveCompanies int `json:"activeCompanies"`
			TrialCompanies  int `json:"trialCompanies"`
		}

		// Общее количество компаний
		db.QueryRow("SELECT COUNT(*) FROM companies WHERE referral_agent_id = $1", agentID).Scan(&stats.TotalCompanies)

		// Активные компании
		db.QueryRow("SELECT COUNT(*) FROM companies WHERE referral_agent_id = $1 AND is_enabled = true", agentID).Scan(&stats.ActiveCompanies)

		// Компании на пробном периоде
		db.QueryRow(`
			SELECT COUNT(*) FROM companies 
			WHERE referral_agent_id = $1 
			AND trial_end_date > NOW()
		`, agentID).Scan(&stats.TrialCompanies)

		c.JSON(http.StatusOK, stats)
	}
}

// UpdateReferralAgentPassword - обновление пароля агента
func UpdateReferralAgentPassword(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		agentID := c.Param("id")

		var input struct {
			OldPassword string `json:"oldPassword" binding:"required"`
			NewPassword string `json:"newPassword" binding:"required"`
		}

		if err := c.BindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Получаем текущий хеш пароля
		var currentHash string
		err := db.QueryRow("SELECT password_hash FROM referral_agents WHERE id = $1", agentID).Scan(&currentHash)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Agent not found"})
			return
		}

		// Проверяем старый пароль
		if err := bcrypt.CompareHashAndPassword([]byte(currentHash), []byte(input.OldPassword)); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid old password"})
			return
		}

		// Хешируем новый пароль
		newHash, err := bcrypt.GenerateFromPassword([]byte(input.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
			return
		}

		// Обновляем пароль
		_, err = db.Exec(`
			UPDATE referral_agents 
			SET password_hash = $1, updated_at = CURRENT_TIMESTAMP 
			WHERE id = $2
		`, string(newHash), agentID)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update password"})
			return
		}

		log.Printf("✅ Referral agent password updated: ID=%s", agentID)
		c.JSON(http.StatusOK, gin.H{"message": "Password updated successfully"})
	}
}

// DeleteReferralAgent - удаление реферального агента (только для админа)
func DeleteReferralAgent(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		agentID := c.Param("id")

		// Проверяем, есть ли у агента привязанные компании
		var companyCount int
		err := db.QueryRow(`
			SELECT COUNT(*) FROM companies WHERE referral_agent_id = $1
		`, agentID).Scan(&companyCount)

		if err != nil {
			log.Printf("❌ Error checking agent companies: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}

		// Если есть компании, устанавливаем referral_agent_id в NULL перед удалением
		if companyCount > 0 {
			_, err = db.Exec(`
				UPDATE companies 
				SET referral_agent_id = NULL, updated_at = CURRENT_TIMESTAMP 
				WHERE referral_agent_id = $1
			`, agentID)

			if err != nil {
				log.Printf("❌ Error unlinking companies: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to unlink companies"})
				return
			}
			log.Printf("✅ Unlinked %d companies from agent ID=%s", companyCount, agentID)
		}

		// Удаляем агента
		result, err := db.Exec(`DELETE FROM referral_agents WHERE id = $1`, agentID)
		if err != nil {
			log.Printf("❌ Error deleting referral agent: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete agent"})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Agent not found"})
			return
		}

		log.Printf("✅ Referral agent deleted: ID=%s (unlinked %d companies)", agentID, companyCount)
		c.JSON(http.StatusOK, gin.H{
			"message":         "Agent deleted successfully",
			"unlinkedCompanies": companyCount,
		})
	}
}

// ToggleCompanyStatus - включить/выключить компанию (для админа)
func ToggleCompanyStatus(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID := c.Param("id")

		var input struct {
			IsEnabled bool `json:"isEnabled"`
		}

		if err := c.BindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		_, err := db.Exec(`
			UPDATE companies 
			SET is_enabled = $1, updated_at = CURRENT_TIMESTAMP 
			WHERE id = $2
		`, input.IsEnabled, companyID)

		if err != nil {
			log.Printf("❌ Error toggling company status: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update company status"})
			return
		}

		status := "disabled"
		if input.IsEnabled {
			status = "enabled"
		}

		log.Printf("✅ Company %s %s", companyID, status)
		c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Company %s", status), "isEnabled": input.IsEnabled})
	}
}

// UpdateReferralAgentCommission - изменить процент агента (только админ)
func UpdateReferralAgentCommission(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		agentID := c.Param("id")

		var input struct {
			CommissionPercent float64 `json:"commission_percent"`
		}
		if err := c.BindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if input.CommissionPercent < 0 || input.CommissionPercent > 100 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Процент должен быть от 0 до 100"})
			return
		}

		res, err := db.Exec(`
			UPDATE referral_agents
			SET commission_percent = $1, updated_at = CURRENT_TIMESTAMP
			WHERE id = $2
		`, input.CommissionPercent, agentID)
		if err != nil {
			log.Printf("❌ Error updating agent commission: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update commission"})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Agent not found"})
			return
		}

		log.Printf("✅ Agent %s commission set to %.2f%%", agentID, input.CommissionPercent)
		c.JSON(http.StatusOK, gin.H{"message": "Commission updated", "commission_percent": input.CommissionPercent})
	}
}

// UpdateCompanyCommission - изменить процент платформы для компании (только админ).
// При изменении отправляет уведомление компании в инбокс (company_messages).
func UpdateCompanyCommission(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID := c.Param("id")

		var input struct {
			PlatformCommissionPercent float64 `json:"platform_commission_percent"`
			// Необязательное произвольное сообщение для компании; если пусто — текст по умолчанию.
			Message string `json:"message"`
		}
		if err := c.BindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if input.PlatformCommissionPercent < 0 || input.PlatformCommissionPercent > 100 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Процент должен быть от 0 до 100"})
			return
		}

		// Текущее значение и имя компании (для текста уведомления)
		var oldPercent float64
		var companyName string
		err := db.QueryRow(`
			SELECT COALESCE(platform_commission_percent, 3), name FROM companies WHERE id = $1
		`, companyID).Scan(&oldPercent, &companyName)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Company not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}

		if _, err := db.Exec(`
			UPDATE companies
			SET platform_commission_percent = $1, updated_at = CURRENT_TIMESTAMP
			WHERE id = $2
		`, input.PlatformCommissionPercent, companyID); err != nil {
			log.Printf("❌ Error updating company commission: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update commission"})
			return
		}

		// Уведомление компании об условиях контракта
		msg := input.Message
		if msg == "" {
			msg = fmt.Sprintf(
				"Условия вашего контракта обновлены: комиссия платформы теперь составляет %.0f%% от общей выручки (ранее %.0f%%). По вопросам свяжитесь с поддержкой.",
				input.PlatformCommissionPercent, oldPercent,
			)
		}
		if _, err := db.Exec(`
			INSERT INTO company_messages (company_id, title, message, sender_name)
			VALUES ($1, $2, $3, 'Axis')
		`, companyID, "Изменение условий контракта", msg); err != nil {
			// Уведомление не критично — логируем и продолжаем.
			log.Printf("⚠️ Failed to send commission-change notification to company %s: %v", companyID, err)
		}

		log.Printf("✅ Company %s (%s) platform commission %.2f%% → %.2f%%", companyID, companyName, oldPercent, input.PlatformCommissionPercent)
		c.JSON(http.StatusOK, gin.H{
			"message":                     "Commission updated",
			"platform_commission_percent": input.PlatformCommissionPercent,
		})
	}
}

// ValidateReferralCode - проверка реферального кода
func ValidateReferralCode(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		code := c.Param("code")

		var agent ReferralAgent
		err := db.QueryRow(`
			SELECT id, phone, unique_code, name, is_active
			FROM referral_agents
			WHERE unique_code = $1 AND is_active = true
		`, code).Scan(&agent.ID, &agent.Phone, &agent.UniqueCode, &agent.Name, &agent.IsActive)

		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Invalid referral code"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"valid":      true,
			"agentId":    agent.ID,
			"agentName":  agent.Name,
			"agentPhone": agent.Phone,
		})
	}
}

// GetCompaniesWithReferralInfo - получить компании с информацией о рефералах (для админа)
func GetCompaniesWithReferralInfo(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`
			SELECT
				c.id, c.name, c.phone, c.is_enabled, c.trial_end_date,
				c.trial_started_at, c.referral_code, c.created_at,
				COALESCE(c.platform_commission_percent, 3) AS platform_commission_percent,
				ra.unique_code as agent_code, ra.name as agent_name
			FROM companies c
			LEFT JOIN referral_agents ra ON c.referral_agent_id = ra.id
			ORDER BY c.created_at DESC
		`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch companies"})
			return
		}
		defer rows.Close()

		type CompanyWithReferral struct {
			ID                        int64      `json:"id"`
			Name                      string     `json:"name"`
			Phone                     string     `json:"phone"`
			IsEnabled                 bool       `json:"isEnabled"`
			TrialEndDate              *time.Time `json:"trialEndDate"`
			TrialStartedAt            *time.Time `json:"trialStartedAt"`
			ReferralCode              *string    `json:"referralCode"`
			PlatformCommissionPercent float64    `json:"platformCommissionPercent"`
			AgentCode                 *string    `json:"agentCode"`
			AgentName                 *string    `json:"agentName"`
			CreatedAt                 time.Time  `json:"createdAt"`
			IsTrialActive             bool       `json:"isTrialActive"`
			DaysUntilExpiry           *int       `json:"daysUntilExpiry"`
		}

		var companies []CompanyWithReferral
		for rows.Next() {
			var comp CompanyWithReferral
			err := rows.Scan(
				&comp.ID, &comp.Name, &comp.Phone, &comp.IsEnabled,
				&comp.TrialEndDate, &comp.TrialStartedAt, &comp.ReferralCode,
				&comp.CreatedAt, &comp.PlatformCommissionPercent,
				&comp.AgentCode, &comp.AgentName,
			)
			if err != nil {
				log.Printf("⚠️ Error scanning company: %v", err)
				continue
			}

			// Вычисляем статус пробного периода
			if comp.TrialEndDate != nil {
				comp.IsTrialActive = comp.TrialEndDate.After(time.Now())
				if comp.IsTrialActive {
					days := int(time.Until(*comp.TrialEndDate).Hours() / 24)
					comp.DaysUntilExpiry = &days
				}
			}

			companies = append(companies, comp)
		}

		c.JSON(http.StatusOK, companies)
	}
}

// GetAgentFinancialAnalytics - получить финансовую аналитику агента
func GetAgentFinancialAnalytics(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		agentIDStr := c.Param("id")
		agentID, err := strconv.ParseInt(agentIDStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid agent ID"})
			return
		}

		type CompanyFinancials struct {
			CompanyID         int64   `json:"company_id"`
			CompanyName       string  `json:"company_name"`
			CompanyPhone      string  `json:"company_phone"`
			TotalSales        float64 `json:"total_sales"`         // Общая выручка компании
			PlatformPercent   float64 `json:"platform_percent"`    // % платформы от выручки этой компании
			PlatformFee       float64 `json:"platform_fee"`        // Комиссия платформы (выручка × %)
			AgentCommission   float64 `json:"agent_commission"`    // Доход агента (комиссия платформы × % агента)
			IsEnabled         bool    `json:"is_enabled"`
			IsTrialActive     bool    `json:"is_trial_active"`
		}

		// Процент агента (общий для всех его компаний)
		var agentPercent float64
		if err := db.QueryRow(
			`SELECT COALESCE(commission_percent, 10) FROM referral_agents WHERE id = $1`, agentID,
		).Scan(&agentPercent); err != nil {
			log.Printf("⚠️ Error reading agent commission percent: %v", err)
			agentPercent = 10
		}

		// Получаем все компании агента с их выручкой и индивидуальным % платформы
		rows, err := db.Query(`
			SELECT
				c.id,
				c.name,
				c.phone,
				c.is_enabled,
				COALESCE(c.trial_end_date > CURRENT_TIMESTAMP, false) AS is_trial_active,
				COALESCE(c.platform_commission_percent, 3) AS platform_percent,
				COALESCE(
					(SELECT SUM(total_amount) FROM sales WHERE company_id = c.id),
					0
				) + COALESCE(
					(SELECT SUM(total_amount) FROM orders WHERE company_id = c.id AND status = 'completed'),
					0
				) AS total_sales
			FROM companies c
			WHERE c.referral_agent_id = $1
			ORDER BY total_sales DESC
		`, agentID)

		if err != nil {
			log.Printf("❌ Error fetching agent financial analytics: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}
		defer rows.Close()

		companies := []CompanyFinancials{}
		var totalAgentEarnings float64
		var totalPlatformFees float64
		var totalCompanySales float64

		for rows.Next() {
			var comp CompanyFinancials
			err := rows.Scan(
				&comp.CompanyID,
				&comp.CompanyName,
				&comp.CompanyPhone,
				&comp.IsEnabled,
				&comp.IsTrialActive,
				&comp.PlatformPercent,
				&comp.TotalSales,
			)
			if err != nil {
				log.Printf("⚠️ Error scanning company financials: %v", err)
				continue
			}

			// Комиссия платформы = выручка × % платформы для этой компании.
			// Доход агента = комиссия платформы × % агента.
			comp.PlatformFee = comp.TotalSales * comp.PlatformPercent / 100
			comp.AgentCommission = comp.PlatformFee * agentPercent / 100

			totalCompanySales += comp.TotalSales
			totalPlatformFees += comp.PlatformFee
			totalAgentEarnings += comp.AgentCommission

			companies = append(companies, comp)
		}

		response := gin.H{
			"companies":            companies,
			"total_companies":      len(companies),
			"total_company_sales":  totalCompanySales,
			"total_platform_fees":  totalPlatformFees,
			"total_agent_earnings": totalAgentEarnings,
			"agent_percent":        agentPercent,
		}

		log.Printf("✅ Agent %d financial analytics: Companies=%d, Total Sales=%.2f, Agent Earnings=%.2f", 
			agentID, len(companies), totalCompanySales, totalAgentEarnings)
		
		c.JSON(http.StatusOK, response)
	}
}

// StartCompanyTrial - запустить пробный период (автоматически при регистрации)
func StartCompanyTrial(db *sql.DB, companyID int64) error {
	trialEnd := time.Now().AddDate(0, 1, 0) // +1 месяц

	_, err := db.Exec(`
		UPDATE companies 
		SET trial_started_at = CURRENT_TIMESTAMP, 
		    trial_end_date = $1,
		    is_enabled = true
		WHERE id = $2
	`, trialEnd, companyID)

	if err != nil {
		log.Printf("❌ Error starting trial for company %d: %v", companyID, err)
		return err
	}

	log.Printf("✅ Trial started for company %d until %s", companyID, trialEnd.Format("2006-01-02"))
	return nil
}

// GetMyReferredCompanies - получить компании реферала
func GetMyReferredCompanies(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		agentIDStr := c.Param("id")
		agentID, err := strconv.ParseInt(agentIDStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid agent ID"})
			return
		}

		rows, err := db.Query(`
			SELECT 
				c.id, c.name, c.phone, c.is_enabled, 
				c.trial_end_date, c.created_at
			FROM companies c
			WHERE c.referral_agent_id = $1
			ORDER BY c.created_at DESC
		`, agentID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch companies"})
			return
		}
		defer rows.Close()

		type ReferredCompany struct {
			ID             int64      `json:"id"`
			Name           string     `json:"name"`
			Phone          string     `json:"phone"`
			IsEnabled      bool       `json:"isEnabled"`
			TrialEndDate   *time.Time `json:"trialEndDate"`
			CreatedAt      time.Time  `json:"createdAt"`
			IsTrialActive  bool       `json:"isTrialActive"`
			DaysRemaining  *int       `json:"daysRemaining"`
		}

		var companies []ReferredCompany
		for rows.Next() {
			var comp ReferredCompany
			err := rows.Scan(
				&comp.ID, &comp.Name, &comp.Phone, &comp.IsEnabled,
				&comp.TrialEndDate, &comp.CreatedAt,
			)
			if err != nil {
				log.Printf("⚠️ Error scanning company: %v", err)
				continue
			}

			if comp.TrialEndDate != nil {
				comp.IsTrialActive = comp.TrialEndDate.After(time.Now())
				if comp.IsTrialActive {
					days := int(time.Until(*comp.TrialEndDate).Hours() / 24)
					comp.DaysRemaining = &days
				}
			}

			companies = append(companies, comp)
		}

		c.JSON(http.StatusOK, companies)
	}
}
