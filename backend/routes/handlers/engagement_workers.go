package handlers

import (
	"database/sql"
	"log"
	"strconv"
	"time"
)

// RunEngagementWorkers запускает фоновые задачи вовлечения:
//   • «товар снова в наличии» — push подписавшимся, когда склад пополнили;
//   • «брошенная корзина» — напоминание, если корзина лежит нетронутой.
// Отдельные тикеры, всё только на SQL, без внешних зависимостей.
func RunEngagementWorkers(db *sql.DB) {
	// Поступление товара — проверяем часто (чтобы push пришёл вскоре после пополнения).
	go func() {
		ticker := time.NewTicker(3 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			if n := runBackInStock(db); n > 0 {
				log.Printf("🔔 BackInStock: уведомлено %d подписок", n)
			}
		}
	}()

	// Брошенная корзина — реже (напоминание не должно быть навязчивым).
	go func() {
		ticker := time.NewTicker(30 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			if n := runAbandonedCart(db); n > 0 {
				log.Printf("🛒 AbandonedCart: напомнено %d покупателям", n)
			}
		}
	}()

	// Снижение цены на избранное — проверяем нечасто.
	go func() {
		ticker := time.NewTicker(15 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			if n := runPriceDropAlerts(db); n > 0 {
				log.Printf("💸 PriceDrop: уведомлено %d по избранному", n)
			}
		}
	}()

	// «Пора обновить запас?» — редкая проверка: циклы покупок меряются днями.
	go func() {
		ticker := time.NewTicker(6 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			if n := runRepeatPurchaseReminders(db); n > 0 {
				log.Printf("🔁 RepeatPurchase: напомнено %d покупателям", n)
			}
		}
	}()
}

// runRepeatPurchaseReminders — «пора обновить запас» (Amazon-классика для
// расходников). Товар куплен 2+ раза → считаем средний цикл покупки; если с
// последней покупки прошло больше цикла и товар в наличии — шлём push.
// Повторное напоминание по той же паре (покупатель, товар) — только после
// НОВОЙ покупки либо спустя два цикла.
func runRepeatPurchaseReminders(db *sql.DB) int {
	rows, err := db.Query(`
		WITH purchases AS (
			SELECT o.customer_phone AS phone,
			       CASE
			           WHEN item->>'productId'  ~ '^\d+$' THEN (item->>'productId')::bigint
			           WHEN item->>'product_id' ~ '^\d+$' THEN (item->>'product_id')::bigint
			       END AS pid,
			       o.created_at
			FROM orders o, jsonb_array_elements(o.items) item
			WHERE o.status NOT IN ('cancelled')
			  AND jsonb_typeof(o.items) = 'array'
			  AND o.created_at > NOW() - INTERVAL '180 days'
			  AND COALESCE(o.customer_phone, '') <> ''
		),
		agg AS (
			SELECT phone, pid,
			       COUNT(*) AS times,
			       MAX(created_at) AS last_buy,
			       GREATEST(
			           EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) / 86400.0
			               / GREATEST(COUNT(*) - 1, 1),
			           3
			       ) AS cycle_days
			FROM purchases
			WHERE pid IS NOT NULL
			GROUP BY phone, pid
			HAVING COUNT(*) >= 2
		)
		SELECT a.phone, a.pid, p.name, COALESCE(u.expo_push_token, '')
		FROM agg a
		JOIN products p ON p.id = a.pid
			AND p.quantity > 0 AND p.available_for_customers = TRUE
		LEFT JOIN users u ON u.phone = a.phone
		LEFT JOIN repeat_reminders r ON r.user_phone = a.phone AND r.product_id = a.pid
		WHERE a.last_buy < NOW() - make_interval(days => CEIL(a.cycle_days)::int)
		  AND (r.last_notified_at IS NULL
		       OR r.last_notified_at < a.last_buy
		       OR r.last_notified_at < NOW() - make_interval(days => CEIL(a.cycle_days * 2)::int))
		LIMIT 300
	`)
	if err != nil {
		log.Printf("⚠️ RepeatPurchase query: %v", err)
		return 0
	}
	defer rows.Close()

	type hit struct {
		phone   string
		product int64
		name    string
		token   string
	}
	var hits []hit
	for rows.Next() {
		var h hit
		if rows.Scan(&h.phone, &h.product, &h.name, &h.token) == nil {
			hits = append(hits, h)
		}
	}

	for _, h := range hits {
		title := "🔁 Пора обновить запас?"
		body := h.name + " — вы обычно покупаете его примерно в это время"
		db.Exec(`INSERT INTO notifications (user_phone, type, title, message, product_id)
			VALUES ($1, 'repeat_purchase', $2, $3, $4)`, h.phone, title, body, h.product)
		if h.token != "" {
			SendExpoPushNotificationData([]string{h.token}, title, body,
				map[string]interface{}{"type": "product", "productId": h.product})
		}
		db.Exec(`INSERT INTO repeat_reminders (user_phone, product_id, last_notified_at)
			VALUES ($1, $2, NOW())
			ON CONFLICT (user_phone, product_id) DO UPDATE SET last_notified_at = NOW()`,
			h.phone, h.product)
	}
	return len(hits)
}

// runPriceDropAlerts уведомляет, если на товар из «Избранного» появилась
// одобренная скидка, о которой покупателю ещё не сообщали.
func runPriceDropAlerts(db *sql.DB) int {
	rows, err := db.Query(`
		SELECT DISTINCT ON (f.user_phone, f.product_id)
		       f.user_phone, f.product_id, p.name, d.id, d.discount_percent, COALESCE(u.expo_push_token, '')
		FROM user_favorites f
		JOIN products p ON p.id = f.product_id
		JOIN discounts d ON d.product_id = f.product_id AND d.status = 'approved'
		LEFT JOIN users u ON u.phone = f.user_phone
		WHERE p.quantity > 0 AND p.available_for_customers = TRUE
		  AND (f.notified_discount_id IS NULL OR f.notified_discount_id <> d.id)
		ORDER BY f.user_phone, f.product_id, d.discount_percent DESC
		LIMIT 500
	`)
	if err != nil {
		log.Printf("⚠️ PriceDrop query: %v", err)
		return 0
	}
	defer rows.Close()

	type hit struct {
		phone    string
		product  int64
		name     string
		discount int64
		percent  float64
		token    string
	}
	var hits []hit
	for rows.Next() {
		var h hit
		if rows.Scan(&h.phone, &h.product, &h.name, &h.discount, &h.percent, &h.token) == nil {
			hits = append(hits, h)
		}
	}

	for _, h := range hits {
		title := "💸 Цена снизилась!"
		body := h.name + " из избранного теперь со скидкой −" + strconv.Itoa(int(h.percent)) + "%"
		db.Exec(`INSERT INTO notifications (user_phone, type, title, message, product_id)
			VALUES ($1, 'price_drop', $2, $3, $4)`, h.phone, title, body, h.product)
		if h.token != "" {
			SendExpoPushNotificationData([]string{h.token}, title, body,
				map[string]interface{}{"type": "product", "productId": h.product})
		}
		db.Exec(`UPDATE user_favorites SET notified_discount_id = $1 WHERE user_phone = $2 AND product_id = $3`,
			h.discount, h.phone, h.product)
	}
	return len(hits)
}

// runBackInStock находит подписки на товары, которые снова в наличии,
// шлёт push + кладёт in-app уведомление и помечает подписку выполненной.
func runBackInStock(db *sql.DB) int {
	rows, err := db.Query(`
		SELECT sn.id, sn.customer_phone, sn.product_id, p.name, COALESCE(u.expo_push_token, '')
		FROM stock_notifications sn
		JOIN products p ON p.id = sn.product_id
		LEFT JOIN users u ON u.phone = sn.customer_phone
		WHERE sn.notified_at IS NULL AND p.quantity > 0
		LIMIT 500
	`)
	if err != nil {
		log.Printf("⚠️ BackInStock query: %v", err)
		return 0
	}
	defer rows.Close()

	type hit struct {
		id      int64
		phone   string
		product int64
		name    string
		token   string
	}
	var hits []hit
	for rows.Next() {
		var h hit
		if rows.Scan(&h.id, &h.phone, &h.product, &h.name, &h.token) == nil {
			hits = append(hits, h)
		}
	}

	for _, h := range hits {
		title := "🔔 Снова в наличии!"
		body := h.name + " снова доступен — успейте заказать"
		// in-app уведомление
		db.Exec(`INSERT INTO notifications (user_phone, type, title, message, product_id)
			VALUES ($1, 'back_in_stock', $2, $3, $4)`, h.phone, title, body, h.product)
		// push
		if h.token != "" {
			SendExpoPushNotificationData([]string{h.token}, title, body,
				map[string]interface{}{"type": "product", "productId": h.product})
		}
		db.Exec(`UPDATE stock_notifications SET notified_at = NOW() WHERE id = $1`, h.id)
	}
	return len(hits)
}

// runAbandonedCart напоминает про корзину, которая пролежала нетронутой
// от 3 до 48 часов и по которой ещё не отправляли напоминание.
func runAbandonedCart(db *sql.DB) int {
	rows, err := db.Query(`
		SELECT ci.user_phone, COUNT(*) AS items, COALESCE(MAX(u.expo_push_token), '')
		FROM cart_items ci
		LEFT JOIN users u ON u.phone = ci.user_phone
		WHERE ci.reminder_sent_at IS NULL
		GROUP BY ci.user_phone
		HAVING MAX(ci.updated_at) < NOW() - INTERVAL '3 hours'
		   AND MAX(ci.updated_at) > NOW() - INTERVAL '48 hours'
		LIMIT 500
	`)
	if err != nil {
		log.Printf("⚠️ AbandonedCart query: %v", err)
		return 0
	}
	defer rows.Close()

	type hit struct {
		phone string
		items int
		token string
	}
	var hits []hit
	for rows.Next() {
		var h hit
		if rows.Scan(&h.phone, &h.items, &h.token) == nil {
			hits = append(hits, h)
		}
	}

	for _, h := range hits {
		title := "🛒 Вы забыли товары в корзине"
		body := "Загляните в корзину — ваши товары ждут вас"
		db.Exec(`INSERT INTO notifications (user_phone, type, title, message)
			VALUES ($1, 'abandoned_cart', $2, $3)`, h.phone, title, body)
		if h.token != "" {
			SendExpoPushNotificationData([]string{h.token}, title, body,
				map[string]interface{}{"type": "cart"})
		}
		db.Exec(`UPDATE cart_items SET reminder_sent_at = NOW() WHERE user_phone = $1 AND reminder_sent_at IS NULL`, h.phone)
	}
	return len(hits)
}
