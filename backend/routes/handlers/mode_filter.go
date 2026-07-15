package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// Синхронизация публичного и закрытого (B2B) маркетплейса.
//
// Один и тот же API обслуживает три клиента: публичный сайт, публичное
// приложение и закрытое приложение компании. Изоляция определяется двумя
// query-параметрами, которые клиент прикладывает к КАЖДОМУ публичному
// листингу товаров/компаний:
//
//	mode=private&privateCompanyId=<id> — закрытый режим: видны товары только
//	    этой одной компании (у которой companies.mode='private').
//	(параметры отсутствуют / mode=public) — публичный режим: видны только
//	    товары публичных компаний (mode='public' или NULL).
//
// Благодаря этому закрытые товары никогда не попадают в публичную выдачу, а
// закрытое приложение никогда не показывает чужие (публичные) товары —
// синхронизация во всех трёх клиентах одинаковая.

// modeConditionFor — ядро: по значениям mode/privateCompanyId возвращает
// SQL-условие видимости для таблицы companies с заданным алиасом и при
// необходимости дописывает аргумент в args. Плейсхолдер нумеруется как
// $len(args), поэтому вызывать нужно на том же растущем срезе args, что и
// остальные параметры запроса.
func modeConditionFor(mode, privateCompanyID, alias string, args *[]interface{}) string {
	if mode == "private" && privateCompanyID != "" {
		*args = append(*args, privateCompanyID)
		return fmt.Sprintf("(%s.id = $%d AND %s.mode = 'private')", alias, len(*args), alias)
	}
	return fmt.Sprintf("(%s.mode = 'public' OR %s.mode IS NULL)", alias, alias)
}

// modeCondition — вариант для gin-хендлеров.
func modeCondition(c *gin.Context, alias string, args *[]interface{}) string {
	return modeConditionFor(c.Query("mode"), c.Query("privateCompanyId"), alias, args)
}

// modeConditionHTTP — вариант для net/http-хендлеров.
func modeConditionHTTP(r *http.Request, alias string, args *[]interface{}) string {
	q := r.URL.Query()
	return modeConditionFor(q.Get("mode"), q.Get("privateCompanyId"), alias, args)
}

// isPrivateRequest сообщает, пришёл ли gin-запрос из закрытого приложения.
func isPrivateRequest(c *gin.Context) (string, bool) {
	if c.Query("mode") == "private" {
		if pcid := c.Query("privateCompanyId"); pcid != "" {
			return pcid, true
		}
	}
	return "", false
}

// mayAccessPrivateCompany сообщает, вправе ли вызывающий видеть данные закрытой
// компании: это платформенный админ, сама компания или запрос из её закрытого
// приложения (mode=private&privateCompanyId=<этот id>). Используется, чтобы
// закрыть прямой доступ по ID к приватным товарам/компаниям, минуя листинги.
func mayAccessPrivateCompany(c *gin.Context, companyID int64) bool {
	if isAdmin(c) {
		return true
	}
	if ctxRole(c) == "company" && ctxCompanyID(c) == companyID {
		return true
	}
	if pcid, ok := isPrivateRequest(c); ok && pcid == strconv.FormatInt(companyID, 10) {
		return true
	}
	return false
}
