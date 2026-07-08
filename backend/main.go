package main

import (
	"azaton-backend/config"
	"azaton-backend/database"
	"azaton-backend/routes"
	"azaton-backend/routes/handlers"
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Initialize configuration
	cfg := config.Load()
	cfg.Validate() // logs loud warnings for insecure defaults (never aborts)

	// Initialize database connection
	db, err := database.Connect(cfg)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	defer db.Close()

	// Run migrations
	if err := database.Migrate(db); err != nil {
		log.Fatal("Failed to run migrations:", err)
	}

	// Migrate algorithm tables (score, product_views, etc.)
	handlers.MigrateAlgorithmTables(db)

	// Start SLA worker: auto-cancel orders pending > 45 min
	handlers.RunSLAWorker(db, 45)

	// Start engagement workers: back-in-stock alerts + abandoned-cart reminders
	handlers.RunEngagementWorkers(db)

	// Provide config to user auth handlers so they can issue JWT tokens.
	handlers.InitUserConfig(cfg)

	// Initialize Firebase Admin SDK (опционально - работает с Expo fallback)
	_, err = handlers.InitFirebase()
	if err != nil {
		log.Printf("⚠️ Firebase not initialized: %v (будет использоваться Expo Push API)", err)
	}

	// Setup Gin router
	if cfg.GinMode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}
	router := gin.Default()
	
	// Set max multipart memory for image uploads (20MB)
	router.MaxMultipartMemory = 20 << 20 // 20MB

	// Setup routes
	routes.Setup(router, db, cfg)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	log.Printf("🚀 Server starting on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
