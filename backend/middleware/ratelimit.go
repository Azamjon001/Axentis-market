package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

// ipRateLimiter keeps one token-bucket limiter per client IP and evicts idle
// entries periodically so memory stays bounded under many distinct callers.
type ipRateLimiter struct {
	mu      sync.Mutex
	clients map[string]*ipClient
	rate    rate.Limit
	burst   int
}

type ipClient struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

func newIPRateLimiter(r rate.Limit, burst int) *ipRateLimiter {
	l := &ipRateLimiter{
		clients: make(map[string]*ipClient),
		rate:    r,
		burst:   burst,
	}
	go l.cleanupLoop()
	return l
}

func (l *ipRateLimiter) cleanupLoop() {
	for {
		time.Sleep(5 * time.Minute)
		l.mu.Lock()
		for ip, cl := range l.clients {
			if time.Since(cl.lastSeen) > 10*time.Minute {
				delete(l.clients, ip)
			}
		}
		l.mu.Unlock()
	}
}

func (l *ipRateLimiter) limiterFor(ip string) *rate.Limiter {
	l.mu.Lock()
	defer l.mu.Unlock()
	cl, ok := l.clients[ip]
	if !ok {
		cl = &ipClient{limiter: rate.NewLimiter(l.rate, l.burst)}
		l.clients[ip] = cl
	}
	cl.lastSeen = time.Now()
	return cl.limiter
}

// RateLimit returns middleware that allows a short burst of `burst` requests
// and then refills at `perMinute` requests per minute, per client IP. It is
// meant to throttle abuse (e.g. login brute-force) without getting in the way
// of normal usage, so keep the limits generous.
func RateLimit(perMinute float64, burst int) gin.HandlerFunc {
	limiter := newIPRateLimiter(rate.Limit(perMinute/60.0), burst)
	return func(c *gin.Context) {
		if !limiter.limiterFor(c.ClientIP()).Allow() {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "Too many requests. Please slow down and try again shortly.",
			})
			return
		}
		c.Next()
	}
}
