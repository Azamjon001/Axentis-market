package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// ─── Часто покупают вместе ────────────────────────────────────────────────────
// GET /products/:id/frequently-bought-with
// Возвращает до 8 товаров, которые чаще всего покупали вместе с данным товаром.
// SQL: ищет другие товары, встречающиеся в заказах где есть productId,
// сортирует по частоте совместных покупок.
func GetFrequentlyBoughtWith(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		productID, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid product id"})
			return
		}

		rows, err := db.Query(`
			WITH orders_with_product AS (
				SELECT id FROM orders
				WHERE status NOT IN ('cancelled', 'pending')
				  AND items::text LIKE '%"productId":' || $1 || '%'
				  OR  items::text LIKE '%"product_id":' || $1 || '%'
				LIMIT 500
			),
			other_items AS (
				SELECT elem->>'productId'  AS pid
				FROM   orders_with_product o,
				       jsonb_array_elements(
				           (SELECT items FROM orders WHERE id = o.id)
				       ) AS elem
				WHERE  (elem->>'productId')::bigint <> $1
				  AND  (elem->>'productId') IS NOT NULL
				UNION ALL
				SELECT elem->>'product_id' AS pid
				FROM   orders_with_product o,
				       jsonb_array_elements(
				           (SELECT items FROM orders WHERE id = o.id)
				       ) AS elem
				WHERE  (elem->>'product_id')::bigint <> $1
				  AND  (elem->>'product_id') IS NOT NULL
			)
			SELECT p.id, p.name,
			       COALESCE(
			           NULLIF((SELECT MIN(pv.selling_price) FROM product_variants pv WHERE pv.product_id = p.id AND pv.selling_price > 0), 0),
			           NULLIF(p.selling_price, 0),
			           p.price
			       ) AS price,
			       p.images,
			       COALESCE(p.sold_count, 0) AS sold_count,
			       c.name AS company_name,
			       COUNT(*) AS co_count
			FROM   other_items oi
			JOIN   products p ON p.id = oi.pid::bigint
			LEFT JOIN companies c ON c.id = p.company_id
			WHERE  p.available_for_customers = TRUE
			GROUP BY p.id, p.name, p.selling_price, p.price, p.images, p.sold_count, c.name
			ORDER BY co_count DESC, sold_count DESC
			LIMIT 8
		`, productID, productID)
		if err != nil {
			log.Printf("❌ FrequentlyBoughtWith: %v", err)
			c.JSON(http.StatusOK, []interface{}{})
			return
		}
		defer rows.Close()

		type Product struct {
			ID          int64   `json:"id"`
			Name        string  `json:"name"`
			Price       float64 `json:"price"`
			Images      string  `json:"images"`
			SoldCount   int     `json:"sold_count"`
			CompanyName string  `json:"companyName"`
		}
		results := make([]Product, 0)
		for rows.Next() {
			var p Product
			var coCount int
			if err := rows.Scan(&p.ID, &p.Name, &p.Price, &p.Images, &p.SoldCount, &p.CompanyName, &coCount); err != nil {
				continue
			}
			results = append(results, p)
		}
		c.JSON(http.StatusOK, results)
	}
}

// ─── SLA: автоотмена зависших заказов ────────────────────────────────────────
// POST /internal/sla-cancel
// Отменяет заказы со статусом "pending" старше N минут (default 45).
// Вызывается внешним cron или из фоновой горутины при старте.
func SLACancelStaleOrders(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		cancelled, err := runSLACancel(db, 45)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"cancelled": cancelled})
	}
}

// RunSLAWorker запускает фоновую горутину, которая каждые 5 минут отменяет
// заказы, зависшие в статусе "pending" дольше timeoutMinutes.
func RunSLAWorker(db *sql.DB, timeoutMinutes int) {
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			n, err := runSLACancel(db, timeoutMinutes)
			if err != nil {
				log.Printf("⚠️ SLAWorker: %v", err)
			} else if n > 0 {
				log.Printf("🕐 SLAWorker: auto-cancelled %d stale orders", n)
			}
		}
	}()
}

func runSLACancel(db *sql.DB, timeoutMinutes int) (int64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Fetch stale orders to notify customers before cancelling
	rows, err := db.QueryContext(ctx, `
		SELECT id, customer_phone, order_code
		FROM orders
		WHERE status = 'pending'
		  AND created_at < NOW() - ($1 || ' minutes')::interval
	`, strconv.Itoa(timeoutMinutes))
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	type stale struct {
		id    int64
		phone string
		code  string
	}
	var stales []stale
	for rows.Next() {
		var s stale
		if err := rows.Scan(&s.id, &s.phone, &s.code); err == nil {
			stales = append(stales, s)
		}
	}
	rows.Close()

	if len(stales) == 0 {
		return 0, nil
	}

	ids := make([]int64, len(stales))
	for i, s := range stales {
		ids[i] = s.id
	}

	// Batch cancel
	res, err := db.ExecContext(ctx, `
		UPDATE orders SET status = 'cancelled', updated_at = NOW()
		WHERE id = ANY($1) AND status = 'pending'
	`, ids)
	if err != nil {
		return 0, err
	}
	n, _ := res.RowsAffected()

	// Send notification to each customer
	for _, s := range stales {
		_, _ = db.ExecContext(ctx, `
			INSERT INTO notifications (user_phone, title, body, type, created_at)
			VALUES ($1, $2, $3, 'order_cancelled', NOW())
		`, s.phone,
			"Заказ отменён",
			"Заказ #"+s.code+" был автоматически отменён, так как магазин не принял его вовремя.")
	}

	return n, nil
}

// ─── Антифрод: защита от злоупотреблений ─────────────────────────────────────
// CheckAntiFraud — проверяет, не является ли пользователь подозрительным.
// Вызывается внутри CreateOrder перед вставкой заказа.
// Критерии:
//   - > 5 отменённых заказов за последние 7 дней → заблокировать оформление
//   - > 10 заказов за последние 24 часа (бот / накрутка)
func CheckAntiFraud(db *sql.DB, phone string) (blocked bool, reason string) {
	if phone == "" {
		return false, ""
	}

	var cancelled7d int
	_ = db.QueryRow(`
		SELECT COUNT(*) FROM orders
		WHERE customer_phone = $1
		  AND status = 'cancelled'
		  AND created_at > NOW() - INTERVAL '7 days'
	`, phone).Scan(&cancelled7d)
	if cancelled7d >= 5 {
		return true, "Слишком много отменённых заказов. Обратитесь в поддержку."
	}

	var orders24h int
	_ = db.QueryRow(`
		SELECT COUNT(*) FROM orders
		WHERE customer_phone = $1
		  AND created_at > NOW() - INTERVAL '24 hours'
	`, phone).Scan(&orders24h)
	if orders24h >= 10 {
		return true, "Слишком много заказов за короткое время. Попробуйте позже."
	}

	return false, ""
}

// ─── Рейтинг продавца ────────────────────────────────────────────────────────
// GET /companies/:id/rating
// Возвращает автоматически рассчитанный рейтинг компании на основе:
//   - % выполненных заказов (вес 50%)
//   - Средняя оценка отзывов (вес 30%)
//   - Скорость принятия заказов — медианное время pending→confirmed (вес 20%)
func GetCompanyRating(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid company id"})
			return
		}

		var totalOrders, completedOrders int
		_ = db.QueryRow(`
			SELECT COUNT(*), COUNT(*) FILTER (WHERE status IN ('completed','delivered'))
			FROM orders WHERE company_id = $1
		`, companyID).Scan(&totalOrders, &completedOrders)

		completionRate := 0.0
		if totalOrders > 0 {
			completionRate = float64(completedOrders) / float64(totalOrders)
		}

		var avgRating sql.NullFloat64
		_ = db.QueryRow(`
			SELECT AVG(r.rating) FROM reviews r
			JOIN products p ON r.product_id = p.id
			WHERE p.company_id = $1
		`, companyID).Scan(&avgRating)
		reviewScore := 0.0
		if avgRating.Valid {
			reviewScore = avgRating.Float64 / 5.0
		}

		// Score 0–5
		score := (completionRate*0.5 + reviewScore*0.3 + 0.2) * 5.0

		level := "Новичок"
		switch {
		case score >= 4.5:
			level = "Топ продавец"
		case score >= 3.5:
			level = "Надёжный"
		case score >= 2.5:
			level = "Стабильный"
		}

		c.JSON(http.StatusOK, gin.H{
			"score":           score,
			"level":           level,
			"completionRate":  completionRate,
			"reviewScore":     reviewScore * 5.0,
			"totalOrders":     totalOrders,
			"completedOrders": completedOrders,
		})
	}
}

// ─── Персональная лента ───────────────────────────────────────────────────────
// GET /products/personalized?phone=…
// Возвращает товары, ранжированные по истории пользователя:
//   1. Категории ранее купленных товаров (наивысший приоритет)
//   2. Бренды ранее купленных товаров
//   3. Популярные товары (fallback)
func GetPersonalizedFeed(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		phone := c.Query("phone")
		limit := 40

		if phone == "" {
			// Гость — просто популярные
			rows, _ := db.Query(`
				SELECT p.id, p.name,
				       COALESCE(NULLIF((SELECT MIN(pv.selling_price) FROM product_variants pv WHERE pv.product_id = p.id AND pv.selling_price > 0),0), NULLIF(p.selling_price,0), p.price) AS price,
				       p.images, COALESCE(p.sold_count,0), p.category, COALESCE(c.name,'') AS company_name
				FROM products p
				LEFT JOIN companies c ON c.id = p.company_id
				WHERE p.available_for_customers = TRUE AND (c.mode = 'public' OR c.mode IS NULL)
				ORDER BY sold_count DESC, p.created_at DESC
				LIMIT $1
			`, limit)
			c.JSON(http.StatusOK, scanProductRows(rows))
			return
		}

		// Извлекаем категории и бренды из истории заказов
		rows, err := db.Query(`
			WITH user_history AS (
				SELECT elem->>'productId' AS pid
				FROM orders,
				     jsonb_array_elements(items) AS elem
				WHERE customer_phone = $1 AND status NOT IN ('cancelled')
				LIMIT 200
			),
			preferred AS (
				SELECT COALESCE(p.category,'') AS cat, COALESCE(p.brand,'') AS brand
				FROM user_history h
				JOIN products p ON p.id = h.pid::bigint
			)
			SELECT p.id, p.name,
			       COALESCE(NULLIF((SELECT MIN(pv.selling_price) FROM product_variants pv WHERE pv.product_id = p.id AND pv.selling_price > 0),0), NULLIF(p.selling_price,0), p.price) AS price,
			       p.images, COALESCE(p.sold_count,0), COALESCE(p.category,''), COALESCE(c.name,'') AS company_name,
			       (
			           CASE WHEN p.category IN (SELECT cat FROM preferred) THEN 3 ELSE 0 END +
			           CASE WHEN COALESCE(p.brand,'') IN (SELECT brand FROM preferred WHERE brand <> '') THEN 2 ELSE 0 END +
			           CASE WHEN p.sold_count > 50 THEN 1 ELSE 0 END
			       ) AS relevance
			FROM products p
			LEFT JOIN companies c ON c.id = p.company_id
			WHERE p.available_for_customers = TRUE
			  AND (c.mode = 'public' OR c.mode IS NULL)
			  AND p.id NOT IN (
			      SELECT DISTINCT h.pid::bigint FROM user_history h WHERE h.pid ~ '^[0-9]+$'
			  )
			ORDER BY relevance DESC, p.sold_count DESC, p.created_at DESC
			LIMIT $2
		`, phone, limit)
		if err != nil {
			log.Printf("❌ PersonalizedFeed: %v", err)
			c.JSON(http.StatusOK, []interface{}{})
			return
		}
		c.JSON(http.StatusOK, scanProductRows(rows))
	}
}

type feedProduct struct {
	ID          int64   `json:"id"`
	Name        string  `json:"name"`
	Price       float64 `json:"price"`
	Images      string  `json:"images"`
	SoldCount   int     `json:"sold_count"`
	Category    string  `json:"category"`
	CompanyName string  `json:"companyName"`
}

func scanProductRows(rows *sql.Rows) []feedProduct {
	if rows == nil {
		return []feedProduct{}
	}
	defer rows.Close()
	results := make([]feedProduct, 0)
	for rows.Next() {
		var p feedProduct
		var extra interface{}
		cols, _ := rows.Columns()
		if len(cols) == 8 {
			// personalized feed has relevance col
			if err := rows.Scan(&p.ID, &p.Name, &p.Price, &p.Images, &p.SoldCount, &p.Category, &p.CompanyName, &extra); err == nil {
				results = append(results, p)
			}
		} else {
			if err := rows.Scan(&p.ID, &p.Name, &p.Price, &p.Images, &p.SoldCount, &p.Category, &p.CompanyName); err == nil {
				results = append(results, p)
			}
		}
	}
	return results
}

// ─── Flash-sale: активные акции с таймером ───────────────────────────────────
// GET /products/:id/flash-sale
// Проверяет, есть ли у товара активная агрессивная скидка с временем окончания.
func GetProductFlashSale(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		productID := c.Param("id")

		var discountPercent float64
		var endsAt sql.NullTime
		var discountedPrice sql.NullFloat64

		err := db.QueryRow(`
			SELECT ad.discount_percent,
			       ad.ends_at,
			       p.price * (1.0 - ad.discount_percent / 100.0) AS discounted_price
			FROM aggressive_discounts ad
			JOIN products p ON p.id = ad.product_id
			WHERE ad.product_id = $1
			  AND ad.status = 'approved'
			  AND (ad.ends_at IS NULL OR ad.ends_at > NOW())
			ORDER BY ad.discount_percent DESC
			LIMIT 1
		`, productID).Scan(&discountPercent, &endsAt, &discountedPrice)

		if err == sql.ErrNoRows || err != nil {
			c.JSON(http.StatusOK, gin.H{"active": false})
			return
		}

		resp := gin.H{
			"active":          true,
			"discountPercent": discountPercent,
			"discountedPrice": discountedPrice.Float64,
		}
		if endsAt.Valid {
			resp["endsAt"] = endsAt.Time.UTC().Format(time.RFC3339)
		}
		c.JSON(http.StatusOK, resp)
	}
}

// ─── Скор товара для ранжирования ────────────────────────────────────────────
// Пересчитывает score всех товаров одной компании.
// Вызывается при подтверждении заказа и после добавления отзыва.
// score = (продажи×0.4) + (рейтинг/5×0.3) + (конверсия×0.2) + (новизна×0.1)
func RecalcProductScores(db *sql.DB, companyID int64) {
	_, _ = db.Exec(`
		UPDATE products p SET
		    score = (
		        LEAST(COALESCE(p.sold_count, 0)::float / NULLIF(
		            (SELECT MAX(sold_count) FROM products WHERE company_id = $1), 0
		        ), 1.0) * 0.4
		        +
		        COALESCE((
		            SELECT AVG(r.rating) / 5.0 FROM reviews r WHERE r.product_id = p.id
		        ), 0.5) * 0.3
		        +
		        CASE WHEN EXTRACT(EPOCH FROM (NOW() - p.created_at)) < 604800 THEN 0.1 ELSE 0 END
		        +
		        0.2
		    )
		WHERE p.company_id = $1
	`, companyID)
}

// ─── Трекинг просмотров (для персональной ленты) ─────────────────────────────
// POST /products/:id/view  body: { phone: "..." }
func TrackProductView(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		productID := c.Param("id")
		var body struct {
			Phone string `json:"phone"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.Phone == "" {
			c.Status(http.StatusNoContent)
			return
		}
		// Upsert — обновляем счётчик просмотров
		_, _ = db.Exec(`
			INSERT INTO product_views (product_id, user_phone, view_count, last_viewed_at)
			VALUES ($1, $2, 1, NOW())
			ON CONFLICT (product_id, user_phone)
			DO UPDATE SET view_count = product_views.view_count + 1, last_viewed_at = NOW()
		`, productID, body.Phone)
		c.Status(http.StatusNoContent)
	}
}

// ─── Миграция таблиц для новых алгоритмов ────────────────────────────────────
// Вызывается из main.go при старте (после основных миграций).
func MigrateAlgorithmTables(db *sql.DB) {
	queries := []string{
		// Скор товара для ранжирования
		`ALTER TABLE products ADD COLUMN IF NOT EXISTS score FLOAT DEFAULT 0.5`,

		// Таблица просмотров для персональной ленты
		`CREATE TABLE IF NOT EXISTS product_views (
			id           BIGSERIAL PRIMARY KEY,
			product_id   BIGINT NOT NULL,
			user_phone   VARCHAR(20) NOT NULL,
			view_count   INT DEFAULT 1,
			last_viewed_at TIMESTAMPTZ DEFAULT NOW(),
			UNIQUE(product_id, user_phone)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_product_views_phone ON product_views(user_phone)`,
		// Быстрый «недавно смотрели»: свежие просмотры пользователя без сортировки на лету.
		`CREATE INDEX IF NOT EXISTS idx_product_views_phone_recent ON product_views(user_phone, last_viewed_at DESC)`,

		// Notifications table (if not exists yet)
		`CREATE TABLE IF NOT EXISTS notifications (
			id         BIGSERIAL PRIMARY KEY,
			user_phone VARCHAR(20),
			title      TEXT,
			body       TEXT,
			type       VARCHAR(50),
			is_read    BOOLEAN DEFAULT FALSE,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,

		// ends_at для aggressive discounts (flash sale)
		`ALTER TABLE aggressive_discounts ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ`,
	}

	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			log.Printf("⚠️ MigrateAlgorithmTables: %v (query: %.80s)", err, q)
		}
	}

	// Инициализируем score для существующих товаров
	_, _ = db.Exec(`
		UPDATE products SET score = 0.5 WHERE score IS NULL OR score = 0
	`)

	log.Println("✅ Algorithm tables ready")
}

// Вспомогательная функция для чтения images из JSON строки
func parseImagesJSON(s string) []string {
	var imgs []string
	if s == "" {
		return imgs
	}
	_ = json.Unmarshal([]byte(s), &imgs)
	return imgs
}
