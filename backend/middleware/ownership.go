package middleware

import (
	"database/sql"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// RequireResourceOwner verifies that the authenticated company owns the
// resource identified by the :id path param. It looks up the resource's
// company_id in the given table and compares it to the companyId attached by
// RequireCompany. Must be chained AFTER RequireCompany.
//
// `table` is always a fixed internal constant supplied at route-setup time
// (never user input), so interpolating it into the query is safe — the id is
// still passed as a bound parameter.
func RequireResourceOwner(db *sql.DB, table string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// The platform admin may act on any resource.
		if c.GetString(CtxRole) == "admin" {
			c.Next()
			return
		}
		companyID := c.GetInt64(CtxCompanyID)
		if companyID == 0 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			return
		}
		id := c.Param("id")
		var owner sql.NullInt64
		err := db.QueryRow("SELECT company_id FROM "+table+" WHERE id = $1", id).Scan(&owner)
		if err == sql.ErrNoRows {
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}
		if !owner.Valid || owner.Int64 != companyID {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Доступ запрещён: ресурс принадлежит другой компании"})
			return
		}
		c.Next()
	}
}

// RequireAdminOrOwnCompany allows the request when the caller is the platform
// admin, or when the authenticated company is acting on its OWN company record
// (the :id path param equals the token's companyId). Used for routes that both
// the admin (any company) and a company (itself) legitimately call.
func RequireAdminOrOwnCompany() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.GetString(CtxRole) == "admin" {
			c.Next()
			return
		}
		companyID := c.GetInt64(CtxCompanyID)
		if companyID == 0 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			return
		}
		if c.Param("id") != strconv.FormatInt(companyID, 10) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Доступ запрещён"})
			return
		}
		c.Next()
	}
}
