package handlers

import (
	"database/sql"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// GetCustomExpenses - получить пользовательские расходы компании
func GetCustomExpenses(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID := c.Query("companyId")

		log.Printf("💸 GetCustomExpenses called for companyId=%s", companyID)

		expenses := make([]map[string]interface{}, 0)

		rows, err := db.Query(`
			SELECT id, company_id, expense_name, amount, COALESCE(monthly_amount, 0),
			       COALESCE(expense_type, 'monthly'), COALESCE(percentage_value, 0),
			       description, expense_date, created_at
			FROM custom_expenses
			WHERE company_id = $1
			ORDER BY created_at DESC
		`, companyID)

		if err != nil {
			log.Printf("❌ GetCustomExpenses: Database error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch custom expenses"})
			return
		}
		defer rows.Close()

		for rows.Next() {
			var e struct {
				ID              int64
				CompanyID       int64
				ExpenseName     string
				Amount          float64
				MonthlyAmount   float64
				ExpenseType     string
				PercentageValue float64
				Description     sql.NullString
				ExpenseDate     string
				CreatedAt       string
			}

			if err := rows.Scan(
				&e.ID, &e.CompanyID, &e.ExpenseName, &e.Amount, &e.MonthlyAmount,
				&e.ExpenseType, &e.PercentageValue,
				&e.Description, &e.ExpenseDate, &e.CreatedAt,
			); err != nil {
				log.Printf("❌ GetCustomExpenses: Row scan error: %v", err)
				continue
			}

			expense := map[string]interface{}{
				"id":               e.ID,
				"company_id":       e.CompanyID,
				"expense_name":     e.ExpenseName,
				"amount":           e.Amount,
				"monthly_amount":   e.MonthlyAmount,
				"expense_type":     e.ExpenseType,
				"percentage_value": e.PercentageValue,
				"expense_date":     e.ExpenseDate,
				"created_at":       e.CreatedAt,
			}

			if e.Description.Valid {
				expense["description"] = e.Description.String
			} else {
				expense["description"] = nil
			}

			expenses = append(expenses, expense)
		}

		log.Printf("💸 GetCustomExpenses: Found %d expenses for companyId=%s", len(expenses), companyID)
		c.JSON(http.StatusOK, expenses)
	}
}

// CreateCustomExpense - создать новую пользовательскую затрату
func CreateCustomExpense(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			CompanyID       int64   `json:"company_id" binding:"required"`
			ExpenseName     string  `json:"expense_name" binding:"required"`
			Amount          float64 `json:"amount"`
			MonthlyAmount   float64 `json:"monthly_amount"`
			ExpenseType     string  `json:"expense_type"`
			PercentageValue float64 `json:"percentage_value"`
			Description     *string `json:"description"`
			ExpenseDate     *string `json:"expense_date"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			log.Printf("❌ CreateCustomExpense: Invalid JSON: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if req.ExpenseType == "" {
			req.ExpenseType = "monthly"
		}

		// Расход записывается только на компанию из токена.
		if !isAdmin(c) {
			req.CompanyID = ctxCompanyID(c)
		}

		expenseDate := time.Now()
		if req.ExpenseDate != nil && *req.ExpenseDate != "" {
			if parsed, err := time.Parse("2006-01-02", *req.ExpenseDate); err == nil {
				expenseDate = parsed
			}
		}

		log.Printf("💸 CreateCustomExpense: company_id=%d, name=%s, type=%s, amount=%.2f, monthly=%.2f, pct=%.4f",
			req.CompanyID, req.ExpenseName, req.ExpenseType, req.Amount, req.MonthlyAmount, req.PercentageValue)

		var expenseID int64
		err := db.QueryRow(`
			INSERT INTO custom_expenses
			  (company_id, expense_name, amount, monthly_amount, expense_type, percentage_value, description, expense_date)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			RETURNING id
		`, req.CompanyID, req.ExpenseName, req.Amount, req.MonthlyAmount,
			req.ExpenseType, req.PercentageValue, req.Description, expenseDate).Scan(&expenseID)

		if err != nil {
			log.Printf("❌ CreateCustomExpense: Database error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create custom expense"})
			return
		}

		log.Printf("✅ CreateCustomExpense: Created expense ID=%d", expenseID)
		c.JSON(http.StatusOK, gin.H{"success": true, "id": expenseID})
	}
}

// UpdateCustomExpense - обновить пользовательскую затрату
func UpdateCustomExpense(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid expense ID"})
			return
		}

		var req struct {
			ExpenseName     string  `json:"expense_name"`
			Amount          float64 `json:"amount"`
			MonthlyAmount   float64 `json:"monthly_amount"`
			ExpenseType     string  `json:"expense_type"`
			PercentageValue float64 `json:"percentage_value"`
			Description     *string `json:"description"`
			ExpenseDate     *string `json:"expense_date"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			log.Printf("❌ UpdateCustomExpense: Invalid JSON: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if req.ExpenseType == "" {
			req.ExpenseType = "monthly"
		}

		log.Printf("💸 UpdateCustomExpense: ID=%d, name=%s, type=%s, amount=%.2f, monthly=%.2f, pct=%.4f",
			id, req.ExpenseName, req.ExpenseType, req.Amount, req.MonthlyAmount, req.PercentageValue)

		query := `
			UPDATE custom_expenses
			SET expense_name = $1, amount = $2, monthly_amount = $3,
			    expense_type = $4, percentage_value = $5, description = $6, updated_at = NOW()
			WHERE id = $7
		`
		args := []interface{}{req.ExpenseName, req.Amount, req.MonthlyAmount,
			req.ExpenseType, req.PercentageValue, req.Description, id}

		if req.ExpenseDate != nil && *req.ExpenseDate != "" {
			if parsed, err := time.Parse("2006-01-02", *req.ExpenseDate); err == nil {
				query = `
					UPDATE custom_expenses
					SET expense_name = $1, amount = $2, monthly_amount = $3,
					    expense_type = $4, percentage_value = $5, description = $6,
					    expense_date = $7, updated_at = NOW()
					WHERE id = $8
				`
				args = []interface{}{req.ExpenseName, req.Amount, req.MonthlyAmount,
					req.ExpenseType, req.PercentageValue, req.Description, parsed, id}
			}
		}

		if _, err = db.Exec(query, args...); err != nil {
			log.Printf("❌ UpdateCustomExpense: Database error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update custom expense"})
			return
		}

		log.Printf("✅ UpdateCustomExpense: Updated expense ID=%d", id)
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// DeleteCustomExpense - удалить пользовательскую затрату
func DeleteCustomExpense(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid expense ID"})
			return
		}

		log.Printf("💸 DeleteCustomExpense: ID=%d", id)

		result, err := db.Exec(`DELETE FROM custom_expenses WHERE id = $1`, id)
		if err != nil {
			log.Printf("❌ DeleteCustomExpense: Database error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete custom expense"})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Expense not found"})
			return
		}

		log.Printf("✅ DeleteCustomExpense: Deleted expense ID=%d", id)
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}
