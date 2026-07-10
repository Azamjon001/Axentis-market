package handlers

import (
	"net/url"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

// ─── Область видимости товаров (публичные / закрытые компании) ───────────────
//
// Правило платформы:
//   - обычный (публичный) покупатель видит ТОЛЬКО товары публичных компаний;
//   - покупатель закрытой компании (mode=private&privateCompanyId=N) видит
//     ТОЛЬКО товары своей закрытой компании — ни одна публичная позиция в его
//     выдачу не попадает, и наоборот.
//
// Все витринные запросы (каталог, поиск, подсказки, категории, похожие,
// рекомендации, персональная лента) обязаны фильтровать через этот помощник,
// иначе товары закрытых компаний утекут в публичную выдачу.

// visibilityCondValues строит SQL-условие видимости по query-параметрам.
// alias — алиас таблицы companies в запросе (обычно "c").
// args/argN — накапливаемые аргументы запроса и номер следующего плейсхолдера.
func visibilityCondValues(q url.Values, alias string, args *[]interface{}, argN *int) string {
	if q.Get("mode") == "private" {
		if pid := strings.TrimSpace(q.Get("privateCompanyId")); pid != "" {
			cond := "(" + alias + ".id = $" + strconv.Itoa(*argN) + " AND " + alias + ".mode = 'private')"
			*args = append(*args, pid)
			*argN++
			return cond
		}
	}
	return "(" + alias + ".mode = 'public' OR " + alias + ".mode IS NULL)"
}

// visibilityCond — то же самое для gin-хендлеров.
func visibilityCond(c *gin.Context, alias string, args *[]interface{}, argN *int) string {
	return visibilityCondValues(c.Request.URL.Query(), alias, args, argN)
}
