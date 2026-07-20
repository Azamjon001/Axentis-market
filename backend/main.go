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

	// Migrate OTP tables (SMS login codes + telegram links)
	handlers.MigrateOTPTables(db)

	// Start SLA worker: auto-cancel orders pending > 45 min
	handlers.RunSLAWorker(db, 45)

	// Start engagement workers: back-in-stock alerts + abandoned-cart reminders
	handlers.RunEngagementWorkers(db)

	// Telegram-оповещения магазинам: критические остатки + дневной отчёт 21:00
	// (включается переменной окружения TELEGRAM_BOT_TOKEN)
	handlers.RunTelegramWorkers(db)

	// 📲 Push-уведомления продавцам (приложение Axentis Business):
	// колонки токенов + утренняя сводка 08:00 по Ташкенту
	handlers.MigrateCompanyPushTables(db)
	handlers.RunCompanyPushWorkers(db)

	// 🧾 «Дафтар» (долги клиентов) + 🎯 дневная цель продаж:
	// таблица долгов + напоминания о сроках 10:00 по Ташкенту
	handlers.MigrateCompanyDebts(db)
	handlers.RunDebtReminderWorkers(db)

	// 🚚 Поставщики (автозаказ из плана закупки)
	handlers.MigrateSuppliers(db)

	// 📊 История инвентаризаций (акты ревизий)
	handlers.MigrateInventoryChecks(db)

	// ⚙️ Настройки Telegram-уведомлений (что и когда шлёт бот)
	handlers.MigrateTelegramSettings(db)

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
