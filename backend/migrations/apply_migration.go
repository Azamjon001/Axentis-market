package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/lib/pq"
)

func main() {
	// Database connection
	dbHost := getEnv("DB_HOST", "localhost")
	dbPort := getEnv("DB_PORT", "5432")
	dbUser := getEnv("DB_USER", "azaton_user")
	dbPassword := getEnv("DB_PASSWORD", "your_secure_password_here")
	dbName := getEnv("DB_NAME", "azaton")
	dbSSLMode := getEnv("DB_SSLMODE", "disable")

	connStr := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		dbHost, dbPort, dbUser, dbPassword, dbName, dbSSLMode,
	)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatal("Failed to ping database:", err)
	}

	log.Println("✅ Connected to database")

	// Apply migration
	migration := `ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT;`
	
	_, err = db.Exec(migration)
	if err != nil {
		log.Fatal("❌ Failed to apply migration:", err)
	}

	log.Println("✅ Migration applied successfully: Added brand column to products table")
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
