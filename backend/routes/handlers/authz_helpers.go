package handlers

import (
	"azaton-backend/middleware"
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Small helpers for handler-level authorization checks. The principal is
// attached to the context by the auth middleware; these helpers compare it
// to identifiers arriving in request bodies (which are attacker-controlled).

func ctxRole(c *gin.Context) string      { return c.GetString(middleware.CtxRole) }
func ctxPhone(c *gin.Context) string     { return c.GetString(middleware.CtxPhone) }
func ctxCompanyID(c *gin.Context) int64  { return c.GetInt64(middleware.CtxCompanyID) }
func isAdmin(c *gin.Context) bool        { return ctxRole(c) == "admin" }

// canActForPhone reports whether the caller may act on behalf of the given
// user phone: the platform admin always can; anyone else only for their own
// token phone.
func canActForPhone(c *gin.Context, phone string) bool {
	if isAdmin(c) {
		return true
	}
	p := ctxPhone(c)
	return p != "" && p == phone
}

// requirePhoneMatch is canActForPhone plus writing the 401/403 response.
// Returns false when the request has been aborted.
func requirePhoneMatch(c *gin.Context, phone string) bool {
	if canActForPhone(c, phone) {
		return true
	}
	if ctxRole(c) == "" {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
	} else {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Доступ запрещён"})
	}
	return false
}

// requireCartItemOwner verifies the cart item identified by id belongs to the
// caller. Missing items pass through so the handler can answer 404 itself.
func requireCartItemOwner(c *gin.Context, db *sql.DB, itemID string) bool {
	var owner string
	err := db.QueryRow(`SELECT user_phone FROM cart_items WHERE id = $1`, itemID).Scan(&owner)
	if err != nil {
		return true // not found / db error — the handler's own query reports it
	}
	return requirePhoneMatch(c, owner)
}

// requireCompanyMatch verifies the caller is the platform admin or the given
// company. Returns false when the request has been aborted.
func requireCompanyMatch(c *gin.Context, companyID int64) bool {
	if isAdmin(c) {
		return true
	}
	if ctxRole(c) == "company" && ctxCompanyID(c) == companyID {
		return true
	}
	if ctxRole(c) == "" {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
	} else {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Доступ запрещён"})
	}
	return false
}
