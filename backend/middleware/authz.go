package middleware

import (
	"database/sql"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// This file contains authorization middlewares that rely on the principal
// already attached to the context by OptionalAuth (which runs on the whole
// /api group). They only read the context — no token re-parsing.

// abortUnauthorized ends the request with 401 when no principal is attached,
// or 403 when a principal is attached but not allowed.
func abortForbidden(c *gin.Context) {
	if c.GetString(CtxRole) == "" {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Доступ запрещён"})
}

// RequireSelfPhone allows the platform admin, or a caller whose token phone
// equals the phone path parameter. Protects per-user resources (cart,
// favorites, addresses, saved cards, loyalty…) from being read or modified
// by anyone who merely knows the victim's phone number.
func RequireSelfPhone(param string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role := c.GetString(CtxRole)
		if role == "admin" {
			c.Next()
			return
		}
		phone := c.GetString(CtxPhone)
		if phone == "" || phone != c.Param(param) {
			abortForbidden(c)
			return
		}
		c.Next()
	}
}

// RequireCompanyScope allows the platform admin unconditionally; a company
// token only when the companyId query parameter (any of the given keys, or
// the path param if prefixed with ":") matches the token's company. Blocks
// everyone else. Protects per-company financial data (sales, expenses,
// analytics…).
func RequireCompanyScope(keys ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role := c.GetString(CtxRole)
		if role == "admin" {
			c.Next()
			return
		}
		companyID := c.GetInt64(CtxCompanyID)
		if role != "company" || companyID == 0 {
			abortForbidden(c)
			return
		}
		want := strconv.FormatInt(companyID, 10)
		for _, k := range keys {
			var got string
			if len(k) > 0 && k[0] == ':' {
				got = c.Param(k[1:])
			} else {
				got = c.Query(k)
			}
			if got != "" && got != want {
				abortForbidden(c)
				return
			}
		}
		c.Next()
	}
}

// RequireAdminOrOwnCompanyParam is RequireAdminOrOwnCompany with a
// configurable path-parameter name (some routes use :companyId).
func RequireAdminOrOwnCompanyParam(param string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.GetString(CtxRole) == "admin" {
			c.Next()
			return
		}
		companyID := c.GetInt64(CtxCompanyID)
		if c.GetString(CtxRole) != "company" || companyID == 0 ||
			c.Param(param) != strconv.FormatInt(companyID, 10) {
			abortForbidden(c)
			return
		}
		c.Next()
	}
}

// RequireAgentSelf allows the platform admin, or a referral agent acting on
// its own :id (agent tokens carry the agent id in the companyId claim).
func RequireAgentSelf(param string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role := c.GetString(CtxRole)
		if role == "admin" {
			c.Next()
			return
		}
		if role != "agent" || c.Param(param) != strconv.FormatInt(c.GetInt64(CtxCompanyID), 10) {
			abortForbidden(c)
			return
		}
		c.Next()
	}
}

// RequireCourierAccess allows the platform admin, the courier itself (courier
// tokens carry the courier id in the companyId claim), or the company that
// owns the courier identified by the :id path param.
func RequireCourierAccess(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		role := c.GetString(CtxRole)
		id := c.Param("id")
		switch role {
		case "admin":
			c.Next()
			return
		case "courier":
			if id == strconv.FormatInt(c.GetInt64(CtxCompanyID), 10) {
				c.Next()
				return
			}
		case "company":
			var owner sql.NullInt64
			err := db.QueryRow(`SELECT company_id FROM couriers WHERE id = $1`, id).Scan(&owner)
			if err == nil && owner.Valid && owner.Int64 == c.GetInt64(CtxCompanyID) {
				c.Next()
				return
			}
		}
		abortForbidden(c)
	}
}
