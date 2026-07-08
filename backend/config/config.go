package config

import (
	"log"
	"os"
)

type Config struct {
	Port          string
	GinMode       string
	DBHost        string
	DBPort        string
	DBUser        string
	DBPassword    string
	DBName        string
	DBSSLMode     string
	JWTSecret     string
	JWTExpiration string
	AllowedOrigins string
	CardEncryptionKey string
	AdminPhone     string
	AdminCode      string
}

func Load() *Config {
	return &Config{
		Port:          getEnv("PORT", "3000"),
		GinMode:       getEnv("GIN_MODE", "debug"),
		DBHost:        getEnv("DB_HOST", "localhost"),
		DBPort:        getEnv("DB_PORT", "5432"),
		DBUser:        getEnv("DB_USER", "onlineshop2_user"),
		DBPassword:    getEnv("DB_PASSWORD", "your_secure_password_here"),
		DBName:        getEnv("DB_NAME", "onlineshop2"),
		DBSSLMode:     getEnv("DB_SSLMODE", "disable"),
		JWTSecret:     getEnv("JWT_SECRET", "your_jwt_secret"),
		JWTExpiration: getEnv("JWT_EXPIRATION", "168h"),
		AllowedOrigins: getEnv("ALLOWED_ORIGINS", "http://localhost:5173"),
		CardEncryptionKey: getEnv("CARD_ENCRYPTION_KEY", ""),
		// Admin login credentials (kept as the project's existing hardcoded
		// values by default; override via env in production).
		AdminPhone: getEnv("ADMIN_PHONE", "914751330"),
		AdminCode:  getEnv("ADMIN_CODE", "15051"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// Validate logs loud warnings for insecure default configuration. It never
// aborts startup (so existing deployments keep running), but it makes a
// misconfigured production server impossible to miss in the logs.
func (c *Config) Validate() {
	switch c.JWTSecret {
	case "", "your_jwt_secret", "your_very_strong_jwt_secret_key_here_change_in_production":
		log.Println("🚨 SECURITY: JWT_SECRET is using an insecure default value. " +
			"Set a long random JWT_SECRET environment variable in production — " +
			"anyone who knows this value can forge authentication tokens.")
	}

	switch c.DBPassword {
	case "", "your_secure_password_here":
		log.Println("🚨 SECURITY: DB_PASSWORD is using a placeholder/empty value. " +
			"Set a real DB_PASSWORD environment variable in production.")
	}

	if c.AdminPhone == "914751330" && c.AdminCode == "15051" {
		log.Println("🚨 SECURITY: ADMIN_PHONE/ADMIN_CODE are using the well-known default values. " +
			"These credentials grant FULL admin access to the platform — set unique values " +
			"via environment variables immediately.")
	}

	if c.GinMode != "release" {
		log.Println("⚠️  GIN_MODE is not 'release'. Set GIN_MODE=release in production " +
			"to avoid leaking stack traces and debug details to clients.")
	}
}
