package middleware

import (
	"azaton-backend/config"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// Context keys populated by the auth middleware. Handlers read these via
// c.GetInt64(CtxCompanyID) / c.GetString(CtxRole) instead of trusting the
// request body for the caller's identity.
const (
	CtxCompanyID = "companyId"
	CtxPhone     = "phone"
	CtxRole      = "role"
)

// GenerateToken creates a signed JWT for an authenticated principal.
// role is one of "company", "admin", "agent". The lifetime is taken from
// cfg.JWTExpiration (falling back to 7 days if it cannot be parsed).
func GenerateToken(cfg *config.Config, companyID int64, phone, role string) (string, error) {
	ttl := 168 * time.Hour
	if d, err := time.ParseDuration(cfg.JWTExpiration); err == nil && d > 0 {
		ttl = d
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"companyId": companyID,
		"phone":     phone,
		"role":      role,
		"iat":       time.Now().Unix(),
		"exp":       time.Now().Add(ttl).Unix(),
	})
	return token.SignedString([]byte(cfg.JWTSecret))
}

// parseToken validates the Bearer token from the Authorization header and
// returns its claims. It enforces the HMAC signing method so a token signed
// with a different algorithm cannot be accepted.
func parseToken(cfg *config.Config, c *gin.Context) (jwt.MapClaims, bool) {
	header := c.GetHeader("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		return nil, false
	}
	tokenStr := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
	if tokenStr == "" {
		return nil, false
	}

	claims := jwt.MapClaims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(cfg.JWTSecret), nil
	})
	if err != nil || !token.Valid {
		return nil, false
	}
	return claims, true
}

// applyClaims copies the principal from a validated token into the request
// context so downstream handlers can trust it.
func applyClaims(c *gin.Context, claims jwt.MapClaims) {
	if v, ok := claims["companyId"].(float64); ok {
		c.Set(CtxCompanyID, int64(v))
	}
	if v, ok := claims["phone"].(string); ok {
		c.Set(CtxPhone, v)
	}
	if v, ok := claims["role"].(string); ok {
		c.Set(CtxRole, v)
	}
}

// OptionalAuth decodes a valid Bearer token if one is present and stores the
// principal in the request context. Requests without a token (or with an
// invalid one) pass through unchanged.
//
// This is intentionally non-blocking: every existing public/unauthenticated
// flow keeps working, while authenticated callers get their identity attached
// so handlers can rely on c.GetInt64("companyId") instead of an attacker-
// controlled body field. It is the safe first step toward fully enforced auth.
func OptionalAuth(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		if claims, ok := parseToken(cfg, c); ok {
			applyClaims(c, claims)
		}
		c.Next()
	}
}

// RequireCompany blocks the request unless a valid token is present. Provided
// for gradual rollout: attach it to sensitive routes once the clients are
// confirmed to always send a token.
func RequireCompany(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, ok := parseToken(cfg, c)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			return
		}
		applyClaims(c, claims)
		c.Next()
	}
}

// RequireAdmin blocks the request unless the token carries the "admin" role.
func RequireAdmin(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, ok := parseToken(cfg, c)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			return
		}
		if role, _ := claims["role"].(string); role != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
			return
		}
		applyClaims(c, claims)
		c.Next()
	}
}
