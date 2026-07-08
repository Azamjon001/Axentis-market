package handlers

import (
	"database/sql"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// GetLoyaltyAccount returns a user's points balance and recent transactions.
func GetLoyaltyAccount(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		phone := c.Param("phone")

		var balance, earned, spent int
		err := db.QueryRow(`
			SELECT points_balance, total_earned, total_spent
			FROM loyalty_accounts WHERE user_phone = $1
		`, phone).Scan(&balance, &earned, &spent)
		if err == sql.ErrNoRows {
			// No account yet — report an empty balance rather than 404.
			c.JSON(http.StatusOK, gin.H{
				"userPhone": phone, "pointsBalance": 0, "totalEarned": 0,
				"totalSpent": 0, "transactions": []gin.H{},
			})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch loyalty account"})
			return
		}

		rows, _ := db.Query(`
			SELECT id, points, type, order_id, COALESCE(description, ''), created_at
			FROM loyalty_transactions WHERE user_phone = $1
			ORDER BY created_at DESC LIMIT 50
		`, phone)
		txs := make([]gin.H, 0)
		if rows != nil {
			defer rows.Close()
			for rows.Next() {
				var (
					id        int64
					points    int
					txType    string
					orderID   sql.NullInt64
					descr     string
					createdAt time.Time
				)
				if err := rows.Scan(&id, &points, &txType, &orderID, &descr, &createdAt); err != nil {
					continue
				}
				tx := gin.H{"id": id, "points": points, "type": txType, "description": descr, "createdAt": createdAt}
				if orderID.Valid {
					tx["orderId"] = orderID.Int64
				}
				txs = append(txs, tx)
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"userPhone": phone, "pointsBalance": balance, "totalEarned": earned,
			"totalSpent": spent, "transactions": txs,
		})
	}
}

// EarnLoyaltyPoints credits points to a user (e.g. cashback on a completed order).
func EarnLoyaltyPoints(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			UserPhone   string `json:"userPhone"`
			Points      int    `json:"points"`
			OrderID     *int64 `json:"orderId"`
			Description string `json:"description"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if req.UserPhone == "" || req.Points <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "userPhone and a positive points value are required"})
			return
		}

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}
		defer tx.Rollback()

		var newBalance int
		err = tx.QueryRow(`
			INSERT INTO loyalty_accounts (user_phone, points_balance, total_earned, updated_at)
			VALUES ($1, $2, $2, NOW())
			ON CONFLICT (user_phone) DO UPDATE SET
				points_balance = loyalty_accounts.points_balance + EXCLUDED.points_balance,
				total_earned   = loyalty_accounts.total_earned + EXCLUDED.total_earned,
				updated_at     = NOW()
			RETURNING points_balance
		`, req.UserPhone, req.Points).Scan(&newBalance)
		if err != nil {
			log.Printf("❌ EarnLoyaltyPoints: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to credit points"})
			return
		}
		if _, err := tx.Exec(`
			INSERT INTO loyalty_transactions (user_phone, points, type, order_id, description)
			VALUES ($1, $2, 'earn', $3, $4)
		`, req.UserPhone, req.Points, req.OrderID, req.Description); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record transaction"})
			return
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to credit points"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "pointsBalance": newBalance})
	}
}

// RedeemLoyaltyPoints debits points from a user, rejecting if the balance is too low.
func RedeemLoyaltyPoints(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			UserPhone   string `json:"userPhone"`
			Points      int    `json:"points"`
			OrderID     *int64 `json:"orderId"`
			Description string `json:"description"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if req.UserPhone == "" || req.Points <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "userPhone and a positive points value are required"})
			return
		}
		// Списывать баллы можно только со своего счёта.
		if !requirePhoneMatch(c, req.UserPhone) {
			return
		}

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}
		defer tx.Rollback()

		// Lock the account row so concurrent redemptions can't overspend.
		var balance int
		err = tx.QueryRow(`SELECT points_balance FROM loyalty_accounts WHERE user_phone = $1 FOR UPDATE`, req.UserPhone).Scan(&balance)
		if err == sql.ErrNoRows || (err == nil && balance < req.Points) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Недостаточно баллов", "pointsBalance": balance})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read balance"})
			return
		}

		newBalance := balance - req.Points
		if _, err := tx.Exec(`
			UPDATE loyalty_accounts
			SET points_balance = $1, total_spent = total_spent + $2, updated_at = NOW()
			WHERE user_phone = $3
		`, newBalance, req.Points, req.UserPhone); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to debit points"})
			return
		}
		if _, err := tx.Exec(`
			INSERT INTO loyalty_transactions (user_phone, points, type, order_id, description)
			VALUES ($1, $2, 'redeem', $3, $4)
		`, req.UserPhone, req.Points, req.OrderID, req.Description); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record transaction"})
			return
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to debit points"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "pointsBalance": newBalance})
	}
}
