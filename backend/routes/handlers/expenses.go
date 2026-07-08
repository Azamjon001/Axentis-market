package handlers

import (
	"database/sql"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// Create Expense
func CreateExpense(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req map[string]interface{}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		companyID := c.GetInt64("companyId") // From JWT middleware
		
		// Parse date or use current date
		date := time.Now()
		if dateStr, ok := req["date"].(string); ok && dateStr != "" {
			parsedDate, err := time.Parse("2006-01-02", dateStr)
			if err == nil {
				date = parsedDate
			}
		}

		var expenseID int64
		err := db.QueryRow(`
			INSERT INTO expenses (company_id, amount, category, description, expense_date, created_at)
			VALUES ($1, $2, $3, $4, $5, NOW())
			RETURNING id
		`, companyID, req["amount"], req["category"], req["description"], date).Scan(&expenseID)

		if err != nil {
			log.Printf("❌ Error creating expense: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create expense"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "id": expenseID})
	}
}

// Get Expenses (with filters)
func GetExpenses(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID := c.Query("companyId")
		if companyID == "" {
			companyID = c.Param("companyId")
		}

		query := `SELECT id, company_id, amount, category, description, expense_date, created_at 
		          FROM expenses WHERE company_id = $1 ORDER BY expense_date DESC`

		rows, err := db.Query(query, companyID)
		if err != nil {
			log.Printf("❌ Error getting expenses: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get expenses"})
			return
		}
		defer rows.Close()

		expenses := []map[string]interface{}{}
		for rows.Next() {
			var id, companyID int64
			var amount float64
			var category, description sql.NullString
			var expenseDate, createdAt time.Time

			err := rows.Scan(&id, &companyID, &amount, &category, &description, &expenseDate, &createdAt)
			if err != nil {
				log.Printf("❌ Error scanning expense: %v", err)
				continue
			}

			expense := map[string]interface{}{
				"id":          id,
				"companyId":   companyID,
				"amount":      amount,
				"category":    "",
				"description": "",
				"expenseDate": expenseDate.Format("2006-01-02"),
				"createdAt":   createdAt.Format(time.RFC3339),
			}

			if category.Valid {
				expense["category"] = category.String
			}
			if description.Valid {
				expense["description"] = description.String
			}

			expenses = append(expenses, expense)
		}

		c.JSON(http.StatusOK, expenses)
	}
}

// Delete Expense
func DeleteExpense(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		_, err := db.Exec("DELETE FROM expenses WHERE id = $1", id)
		if err != nil {
			log.Printf("❌ Error deleting expense: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete expense"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}
