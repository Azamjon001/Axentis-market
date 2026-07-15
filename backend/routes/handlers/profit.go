package handlers

import (
	"database/sql"
	"math"
	"net/http"

	"github.com/gin-gonic/gin"
)

// GetCompanyProfit — GET /analytics/company/:companyId/profit
//
// Простое и понятное разложение прибыли для дашборда продавца.
// Отвечает на человеческий вопрос: «Сколько я реально заработал и из чего это
// складывается — онлайн (заказы) и офлайн (касса)?».
//
// Прибыль = наценка (markup_profit): разница между ценой продажи и закупкой.
// Себестоимость (COGS) = выручка − прибыль.
//
// Выручка и прибыль по заказам учитываются ТОЛЬКО после доставки
// (status delivered/completed) — до этого покупатель ещё может вернуть товар.
// Только чтение.
func GetCompanyProfit(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID := c.Param("companyId")

		round := func(v float64) float64 { return math.Round(v) }

		// ── Онлайн: доставленные заказы ─────────────────────────────────────
		var onlineRevenue, onlineProfit float64
		var onlineCount int
		db.QueryRow(`
			SELECT COALESCE(SUM(total_amount), 0), COALESCE(SUM(markup_profit), 0), COUNT(*)
			FROM orders
			WHERE company_id = $1 AND status IN ('delivered', 'completed')
		`, companyID).Scan(&onlineRevenue, &onlineProfit, &onlineCount)

		// ── Офлайн: кассовые (POS) продажи ─────────────────────────────────
		var offlineRevenue, offlineProfit float64
		var offlineCount int
		db.QueryRow(`
			SELECT COALESCE(SUM(total_amount), 0), COALESCE(SUM(markup_profit), 0), COUNT(*)
			FROM sales
			WHERE company_id = $1
		`, companyID).Scan(&offlineRevenue, &offlineProfit, &offlineCount)

		// ── Сегодня (для контекста) ────────────────────────────────────────
		var todayRevenue, todayProfit float64
		db.QueryRow(`
			SELECT
				COALESCE(SUM(total_amount) FILTER (WHERE created_at::date = CURRENT_DATE AND status IN ('delivered','completed')), 0),
				COALESCE(SUM(markup_profit) FILTER (WHERE created_at::date = CURRENT_DATE AND status IN ('delivered','completed')), 0)
			FROM orders WHERE company_id = $1
		`, companyID).Scan(&todayRevenue, &todayProfit)
		var todayOffRevenue, todayOffProfit float64
		db.QueryRow(`
			SELECT
				COALESCE(SUM(total_amount) FILTER (WHERE created_at::date = CURRENT_DATE), 0),
				COALESCE(SUM(markup_profit) FILTER (WHERE created_at::date = CURRENT_DATE), 0)
			FROM sales WHERE company_id = $1
		`, companyID).Scan(&todayOffRevenue, &todayOffProfit)

		totalRevenue := onlineRevenue + offlineRevenue
		totalProfit := onlineProfit + offlineProfit
		cogs := totalRevenue - totalProfit // себестоимость проданного
		// Маржа в % — какую долю выручки продавец оставляет себе.
		margin := 0.0
		if totalRevenue > 0 {
			margin = totalProfit / totalRevenue * 100
		}

		block := func(rev, prof float64, count int) gin.H {
			m := 0.0
			if rev > 0 {
				m = prof / rev * 100
			}
			return gin.H{
				"revenue": round(rev),
				"profit":  round(prof),
				"cogs":    round(rev - prof),
				"count":   count,
				"margin":  math.Round(m*10) / 10,
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"online":  block(onlineRevenue, onlineProfit, onlineCount),
			"offline": block(offlineRevenue, offlineProfit, offlineCount),
			"total": gin.H{
				"revenue": round(totalRevenue),
				"profit":  round(totalProfit),
				"cogs":    round(cogs),
				"margin":  math.Round(margin*10) / 10,
				"count":   onlineCount + offlineCount,
			},
			"today": gin.H{
				"revenue": round(todayRevenue + todayOffRevenue),
				"profit":  round(todayProfit + todayOffProfit),
			},
		})
	}
}
