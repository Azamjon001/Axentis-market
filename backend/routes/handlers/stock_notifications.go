package handlers

import (
	"database/sql"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// SubscribeStockNotification — POST /products/:id/notify-stock
// Покупатель просит сообщить, когда закончившийся товар снова появится.
// Тело: { "phone": "+998..." }. Повторная подписка обновляет запись.
func SubscribeStockNotification(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		productID, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid product id"})
			return
		}
		var body struct {
			Phone string `json:"phone"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.Phone == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "phone required"})
			return
		}

		// upsert: сбрасываем notified_at, если человек подписался заново
		_, err = db.Exec(`
			INSERT INTO stock_notifications (product_id, customer_phone)
			VALUES ($1, $2)
			ON CONFLICT (product_id, customer_phone)
			DO UPDATE SET notified_at = NULL, created_at = NOW()
		`, productID, body.Phone)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to subscribe"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"subscribed": true})
	}
}
