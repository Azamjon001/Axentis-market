package routes

import (
	"azaton-backend/config"
	"azaton-backend/middleware"
	"azaton-backend/routes/handlers"
	"database/sql"
	"strings"

	"github.com/gin-gonic/gin"
)

func Setup(router *gin.Engine, db *sql.DB, cfg *config.Config) {
	// CORS middleware
	router.Use(func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		// Always allow localhost/127.0.0.1 for dev (any port)
		allowed := strings.HasPrefix(origin, "http://localhost:") ||
			strings.HasPrefix(origin, "http://127.0.0.1:") ||
			strings.HasPrefix(origin, "http://192.168.")

		if !allowed {
			for _, o := range strings.Split(cfg.AllowedOrigins, ",") {
				if strings.TrimSpace(o) == origin {
					allowed = true
					break
				}
			}
		}

		if allowed {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		}

		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// Serve static files from uploads directory
	router.Static("/uploads", "./uploads")

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// 🔗 Страницы шаринга с OG-превью (фото+цена в Telegram/Instagram).
	// nginx проксирует сюда /product/:id и /company/:id.
	router.GET("/share/product/:id", handlers.ShareProduct(db))
	router.GET("/share/company/:id", handlers.ShareCompany(db))

	// 🔍 SEO: robots.txt + динамический sitemap.xml (Google индексирует товары)
	router.GET("/robots.txt", handlers.RobotsTxt)
	router.GET("/sitemap.xml", handlers.Sitemap(db))

	// API routes
	api := router.Group("/api")
	// Attach the authenticated principal (companyId/phone/role) to the request
	// context whenever a valid Bearer token is supplied. Non-blocking: requests
	// without a token still work, so no existing flow breaks.
	api.Use(middleware.OptionalAuth(cfg))
	{
		// Auth routes
		auth := api.Group("/auth")
		// Throttle auth endpoints to slow down brute-force / credential stuffing.
		// Limits are deliberately generous so real users are never affected.
		auth.Use(middleware.RateLimit(30, 10))
		{
			auth.POST("/register/user", handlers.RegisterUser(db))
			auth.POST("/login/user", handlers.LoginUser(db))
			auth.POST("/register/company", handlers.RegisterCompany(db, cfg))
			auth.POST("/login/company", handlers.LoginCompany(db, cfg))
			auth.POST("/login/admin", handlers.LoginAdmin(db, cfg))
		}

		// Products routes
		products := api.Group("/products")
		{
			products.GET("", handlers.GetProducts(db)) // Все товары или с query param companyId
			products.GET("/search", handlers.SearchProducts(db)) // 🔍 Умный поиск (опечатки, фильтры, сортировка)
			products.GET("/suggest", handlers.SuggestProducts(db)) // 💡 Автодополнение поисковой строки
			products.GET("/find-by-barcode", handlers.FindProductByBarcode(db)) // Поиск по штрих-коду (включая варианты)
			products.POST("", middleware.RequireCompany(cfg), handlers.CreateProduct(db))
			products.PUT("/:id", middleware.RequireCompany(cfg), middleware.RequireResourceOwner(db, "products"), handlers.UpdateProduct(db))
			products.DELETE("/:id", middleware.RequireCompany(cfg), middleware.RequireResourceOwner(db, "products"), handlers.DeleteProduct(db))
			products.POST("/:id/images", middleware.RequireCompany(cfg), middleware.RequireResourceOwner(db, "products"), handlers.UploadProductImages(db))
			products.DELETE("/:id/images", middleware.RequireCompany(cfg), middleware.RequireResourceOwner(db, "products"), handlers.DeleteProductImage(db))
			products.GET("/:id", handlers.GetProductByID(db))
			products.GET("/:id/reviews", handlers.GetProductReviews(db))
			products.GET("/:id/review-stats", handlers.GetReviewStats(db))
			products.GET("/:id/similar", handlers.GetSimilarProducts(db))
			products.GET("/:id/frequently-bought-with", handlers.GetFrequentlyBoughtWith(db))
			products.GET("/:id/flash-sale", handlers.GetProductFlashSale(db))
			products.POST("/:id/notify-stock", handlers.SubscribeStockNotification(db)) // 🔔 Сообщить о поступлении
			products.POST("/:id/view", handlers.TrackProductView(db))
			products.GET("/personalized", handlers.GetPersonalizedFeed(db))
			// Variant routes — SKU management per product
			products.GET("/:id/variants", handlers.GetProductVariants(db))
			products.POST("/:id/variants", middleware.RequireCompany(cfg), middleware.RequireResourceOwner(db, "products"), handlers.CreateProductVariant(db))
			products.PUT("/:id/variants/:variantId", middleware.RequireCompany(cfg), middleware.RequireResourceOwner(db, "products"), handlers.UpdateProductVariant(db))
			products.DELETE("/:id/variants/:variantId", middleware.RequireCompany(cfg), middleware.RequireResourceOwner(db, "products"), handlers.DeleteProductVariant(db))
		}

		// AI routes
		ai := api.Group("/ai")
		{
			ai.POST("/parse-products", middleware.RequireCompany(cfg), handlers.AIParseProducts())
		}

		// Reviews routes
		reviews := api.Group("/reviews")
		{
			reviews.POST("", handlers.CreateReview(db))
			reviews.POST("/upload-image", handlers.UploadReviewImage(db)) // 📷 Загрузка фото для отзыва
			reviews.POST("/:id/vote", handlers.VoteReview(db)) // 👍 Лайк/дизлайк отзыва
			reviews.DELETE("/:id", middleware.RequireCompany(cfg), handlers.DeleteReview(db)) // 🗑 Продавец удаляет отзыв
		}

		// Broadcast chat — общий канал (админ = владелец, компании = участники).
		// RequireCompany здесь = «нужен валидный токен»; роль проверяется внутри.
		broadcast := api.Group("/broadcast", middleware.RequireCompany(cfg))
		{
			broadcast.GET("/messages", handlers.GetBroadcastMessages(db))
			broadcast.POST("/messages", handlers.SendBroadcastMessage(db))
			broadcast.PUT("/messages/:id", handlers.EditBroadcastMessage(db))
			broadcast.DELETE("/messages/:id", handlers.DeleteBroadcastMessage(db))
			broadcast.POST("/upload", handlers.UploadBroadcastMedia(db))
			broadcast.POST("/ban", middleware.RequireAdmin(cfg), handlers.BanBroadcastCompany(db))
			broadcast.DELETE("/ban/:companyId", middleware.RequireAdmin(cfg), handlers.UnbanBroadcastCompany(db))
			broadcast.GET("/bans", middleware.RequireAdmin(cfg), handlers.ListBroadcastBans(db))
		}

		// 💸 Выплаты: проверка карты и отмена — компания; очередь и статусы — админ.
		payouts := api.Group("/payouts")
		{
			payouts.POST("/verify-card", handlers.VerifyPayoutCard(db))
			payouts.PUT("/:id/cancel", handlers.CancelPayout(db))
			payouts.GET("", middleware.RequireAdmin(cfg), handlers.GetAllPayouts(db))
			payouts.PUT("/:id/status", middleware.RequireAdmin(cfg), handlers.UpdatePayoutStatus(db))
		}

		// 📜 Политика конфиденциальности: чтение — публичное (показывается при
		// регистрации/входе), редактирование — только админ, принятие — фиксируется.
		policies := api.Group("/policies")
		{
			policies.GET("/:audience", handlers.GetPolicy(db))
			policies.PUT("/:audience", middleware.RequireAdmin(cfg), handlers.UpdatePolicy(db))
			policies.POST("/:audience/accept", handlers.AcceptPolicy(db))
		}

		// Регионы доставки: список — публичный; создание/изменение — только админ.
		regions := api.Group("/regions")
		{
			regions.GET("", handlers.ListRegions(db))
			regions.GET("/resolve", handlers.ResolveRegionAtPoint(db)) // 📍 точка покупателя → зоны доставки
			regions.POST("", middleware.RequireAdmin(cfg), handlers.CreateRegion(db))
			regions.PUT("/:id", middleware.RequireAdmin(cfg), handlers.UpdateRegion(db))
			regions.DELETE("/:id", middleware.RequireAdmin(cfg), handlers.DeleteRegion(db))
		}

		// 🎬 Декоративные видео: список — публичный; загрузка/удаление — только админ.
		decorationVideos := api.Group("/decoration-videos")
		{
			decorationVideos.GET("", handlers.ListDecorationVideos(db))
			decorationVideos.POST("", middleware.RequireAdmin(cfg), handlers.UploadDecorationVideo(db))
			decorationVideos.DELETE("/:id", middleware.RequireAdmin(cfg), handlers.DeleteDecorationVideo(db))
		}

		// Companies routes
		companies := api.Group("/companies")
		{
			companies.GET("", handlers.GetCompanies(db))
			companies.GET("/nearest", handlers.GetNearestCompany(db)) // 📍 Поиск ближайшей компании
			companies.GET("/top", handlers.GetTopCompanies(db)) // ⭐ Хитовые магазины (рекомендации)
			companies.GET("/:id", handlers.GetCompany(db))
			companies.POST("/:id/verify-access", handlers.VerifyAccessKey(db))
			companies.PUT("/:id/verify", middleware.RequireAdmin(cfg), handlers.SetCompanyVerified(db)) // ✅ Значок «Проверенный магазин» (админ)
			companies.PUT("/:id", middleware.RequireAdminOrOwnCompany(), handlers.UpdateCompany(db))
			companies.DELETE("/:id", middleware.RequireAdminOrOwnCompany(), handlers.DeleteCompany(db))
			companies.POST("/:id/view", handlers.TrackCompanyView(db))
			companies.GET("/:id/stats", handlers.GetCompanyStats(db))
			companies.GET("/:id/rating", handlers.GetCompanyRating(db))
			companies.POST("/:id/subscribe", handlers.SubscribeToCompany(db))
			companies.POST("/:id/unsubscribe", handlers.UnsubscribeFromCompany(db))
			companies.PUT("/:id/expenses", middleware.RequireAdminOrOwnCompany(), handlers.UpdateCompanyExpenses(db))
			// 💸 Вывод средств: баланс и история — компания/админ; создание — компания
			companies.GET("/:id/payout-balance", handlers.GetPayoutBalance(db))
			companies.GET("/:id/payouts", handlers.GetCompanyPayouts(db))
			companies.POST("/:id/payouts", handlers.CreatePayout(db))
			companies.POST("/:id/upload-logo", middleware.RequireAdminOrOwnCompany(), handlers.UploadCompanyLogo(db))
			companies.POST("/:id/upload-cover", middleware.RequireAdminOrOwnCompany(), handlers.UploadCompanyCover(db)) // 🖼️ Фоновое фото магазина
			companies.PUT("/:id/privacy", middleware.RequireAdminOrOwnCompany(), handlers.ToggleCompanyPrivacy(db)) // 🔐 Переключение приватности
			companies.PUT("/:id/region", middleware.RequireAdminOrOwnCompany(), handlers.SetCompanyRegion(db)) // 🗺️ Компания выбирает регион доставки
			companies.PUT("/:id/delivery", middleware.RequireAdminOrOwnCompany(), handlers.ToggleCompanyDelivery(db)) // 🚚 Переключение доставки
			companies.POST("/verify-private-code", handlers.VerifyPrivateCode(db)) // 🔍 Проверка кода
			companies.POST("/:id/rate", handlers.RateCompany(db)) // ⭐ Оценка компании
			companies.GET("/:id/reviews", handlers.GetCompanyReviews(db)) // 💬 Отзывы магазина
			companies.GET("/:id/product-reviews", handlers.GetCompanyProductReviews(db)) // ⭐ Отзывы на товары компании (для панели)
			// 📸 Сторис магазина: продавец публикует/удаляет, покупатель видит активные
			companies.GET("/:id/stories", handlers.GetCompanyStories(db))
			companies.POST("/:id/stories", middleware.RequireAdminOrOwnCompany(), handlers.CreateShopStory(db))
			companies.DELETE("/:id/stories/:storyId", middleware.RequireAdminOrOwnCompany(), handlers.DeleteShopStory(db))
			// 🎉 Скидочные кампании магазина (именованные акции)
			companies.GET("/:id/campaigns", middleware.RequireAdminOrOwnCompany(), handlers.GetCompanyCampaigns(db))
			companies.POST("/:id/campaigns", middleware.RequireAdminOrOwnCompany(), handlers.CreateCampaign(db))
			companies.DELETE("/:id/campaigns/:campaignId", middleware.RequireAdminOrOwnCompany(), handlers.DeleteCampaign(db))
		}

		// 📸 Активные сторис всех магазинов (лента вверху главной) + счётчик просмотров
		stories := api.Group("/stories")
		{
			stories.GET("", handlers.GetActiveStories(db))
			stories.POST("/:id/view", handlers.ViewShopStory(db))
		}

		// 🎉 Активные скидочные кампании (именованные ряды на главной)
		api.GET("/campaigns", handlers.GetActiveCampaigns(db))

		// Sales routes
		sales := api.Group("/sales")
		{
			sales.GET("", middleware.RequireCompany(cfg), middleware.RequireCompanyScope("companyId"), handlers.GetSales(db))
			sales.POST("", middleware.RequireCompany(cfg), handlers.CreateSale(db))
		}

		// Cash Sales routes (для панели штрих-кода)
		cashSales := api.Group("/cash-sales")
		{
			cashSales.POST("", middleware.RequireCompany(cfg), handlers.CreateCashSale(db))
			cashSales.GET("", middleware.RequireCompany(cfg), middleware.RequireCompanyScope("companyId"), handlers.GetCashSales(db))
		}

		// Orders routes
		orders := api.Group("/orders")
		{
			orders.GET("", handlers.GetOrders(db))
			orders.GET("/:id", handlers.GetOrderByID(db))
			orders.POST("", handlers.CreateOrder(db))
			orders.POST("/:id/confirm", handlers.ConfirmOrder(db))
			orders.PATCH("/:id", handlers.UpdateOrderStatus(db))
			orders.PUT("/:id/status", handlers.UpdateOrderStatus(db))
			orders.PUT("/:id/mark-delivered", handlers.MarkOrderDelivered(db))
			orders.GET("/:id/courier-location", handlers.GetOrderCourierLocation(db)) // 🚴 Живое отслеживание курьера покупателем
		}

		// Courier routes. Couriers get their own JWT (role "courier") at login;
		// managing couriers is company/admin-only, and a courier can only act
		// on itself (status/location/orders).
		couriers := api.Group("/couriers")
		{
			couriers.POST("/login", middleware.RateLimit(30, 10), handlers.LoginCourier(db, cfg))
			couriers.GET("", middleware.RequireCompany(cfg), middleware.RequireCompanyScope("company_id"), handlers.GetCouriers(db))
			couriers.POST("", middleware.RequireCompany(cfg), handlers.CreateCourier(db))
			couriers.DELETE("/:id", middleware.RequireCompany(cfg), middleware.RequireCourierAccess(db), handlers.DeleteCourier(db))
			couriers.PUT("/:id/status", middleware.RequireCourierAccess(db), handlers.UpdateCourierStatus(db))
			couriers.PUT("/:id/location", middleware.RequireCourierAccess(db), handlers.UpdateCourierLocation(db))
			couriers.GET("/:id/orders", middleware.RequireCourierAccess(db), handlers.GetCourierShippedOrders(db))
			couriers.GET("/:id/stats", middleware.RequireCourierAccess(db), handlers.GetCourierStats(db)) // 📊 Доставлено сегодня/всего
		}

		// Users routes
		users := api.Group("/users")
		{
			users.POST("/check-unique", handlers.CheckUserUnique(db))
			users.GET("/count", handlers.GetUsersCount(db))
			users.DELETE("", middleware.RequireAdmin(cfg), handlers.DeleteAllUsers(db)) // 🗑️ Опасная зона админки
			users.GET("/:phone", handlers.GetUserByPhone(db))
			// Old cart/likes routes removed - use /api/cart and /api/favorites instead
			users.POST("/:phone/avatar", middleware.RequireSelfPhone("phone"), handlers.UploadUserAvatar(db))
			users.DELETE("/:phone/avatar", middleware.RequireSelfPhone("phone"), handlers.DeleteUserAvatar(db))
			users.GET("/:phone/profile", handlers.GetUserProfile(db))
			users.GET("/:phone/reviews", handlers.GetUserReviews(db))
			users.GET("/:phone/recently-viewed", middleware.RequireSelfPhone("phone"), handlers.GetRecentlyViewed(db)) // 👁 Недавно смотрели
			users.GET("/:phone/recommendations", middleware.RequireSelfPhone("phone"), handlers.GetRecommendations(db)) // ✨ Рекомендуем вам
			users.GET("/:phone/stats", handlers.GetUserStats(db))
			users.POST("/:phone/subscribe", middleware.RequireSelfPhone("phone"), handlers.ToggleSubscription(db))
			users.GET("/:phone/subscription-status/:targetPhone", handlers.CheckSubscriptionStatus(db))
			users.POST("/:phone/increment-views", handlers.IncrementProfileViews(db))
			// 📍 Адреса доставки — личные данные, доступны только владельцу телефона (или админу)
			users.GET("/:phone/default-delivery-address", middleware.RequireSelfPhone("phone"), handlers.GetUserDefaultDeliveryAddress(db))
			// Delivery addresses (multiple saved locations)
			users.GET("/:phone/frequent-locations", middleware.RequireSelfPhone("phone"), handlers.GetFrequentLocations(db)) // 📍 Частые места доставки (топ-3)
			users.GET("/:phone/addresses", middleware.RequireSelfPhone("phone"), handlers.GetUserAddresses(db))
			users.POST("/:phone/addresses", middleware.RequireSelfPhone("phone"), handlers.AddUserAddress(db))
			users.PUT("/:phone/addresses/:id", middleware.RequireSelfPhone("phone"), handlers.UpdateUserAddress(db))
			users.DELETE("/:phone/addresses/:id", middleware.RequireSelfPhone("phone"), handlers.DeleteUserAddress(db))
			users.PUT("/:phone/addresses/:id/default", middleware.RequireSelfPhone("phone"), handlers.SetDefaultAddress(db))
		}

		// Cart routes (🛒 Новый API для корзины с БД)
		// Корзина привязана к телефону — все операции только для владельца
		// телефона из JWT (или админа). Операции по телу запроса / id позиции
		// проверяются внутри обработчиков.
		cart := api.Group("/cart")
		{
			cart.GET("/:phone", middleware.RequireSelfPhone("phone"), handlers.GetUserCart(db))        // Получить корзину пользователя
			cart.GET("/:phone/count", middleware.RequireSelfPhone("phone"), handlers.GetCartCount(db)) // Количество товаров в корзине
			cart.POST("", handlers.AddToCart(db))                            // Добавить товар в корзину (quantity += N)
			cart.POST("/set", handlers.SetCartItemQuantity(db))              // Установить точное количество (upsert, 0=удалить)
			cart.PUT("/item/:id", handlers.UpdateCartItem(db))               // Обновить количество (по DB id)
			cart.DELETE("/item/:id", handlers.RemoveFromCart(db))            // Удалить товар из корзины (по DB id)
			cart.DELETE("/item", handlers.RemoveCartItemByProduct(db))       // Удалить товар из корзины (по phone+product_id)
			cart.DELETE("/user/:phone", middleware.RequireSelfPhone("phone"), handlers.ClearCart(db)) // Очистить всю корзину
		}

		// Favorites routes (❤️ Новый API для избранного с БД)
		favorites := api.Group("/favorites")
		{
			favorites.GET("/:phone", middleware.RequireSelfPhone("phone"), handlers.GetUserFavorites(db))        // Получить избранное пользователя
			favorites.GET("/:phone/count", middleware.RequireSelfPhone("phone"), handlers.GetFavoritesCount(db)) // Количество избранных
			favorites.GET("/check", handlers.CheckFavoriteStatus(db))        // Проверить статус (query: phone, product_id)
			favorites.POST("", handlers.AddToFavorites(db))                  // Добавить в избранное
			favorites.POST("/toggle", handlers.ToggleFavorite(db))           // Переключить статус (toggle)
			favorites.DELETE("", handlers.RemoveFromFavorites(db))           // Удалить из избранного
			favorites.DELETE("/user/:phone", middleware.RequireSelfPhone("phone"), handlers.ClearFavorites(db)) // Очистить все избранное
		}

		// Payment Cards routes — строго личные данные: только владелец телефона
		// из JWT (или админ). Удаление/`default` проверяют владельца карты внутри.
		paymentCards := api.Group("/payment-cards")
		{
			paymentCards.GET("/:phone", middleware.RequireSelfPhone("phone"), handlers.GetUserPaymentCards(db))
			paymentCards.POST("", handlers.AddPaymentCard(db, cfg))
			paymentCards.DELETE("/:id", handlers.DeletePaymentCard(db))
			paymentCards.PUT("/:id/default", handlers.SetDefaultCard(db))
		}

		// Notifications routes
		notifications := api.Group("/notifications")
		{
			notifications.GET("", handlers.GetUserNotifications(db))
			notifications.GET("/unread-count", handlers.GetUnreadNotificationsCount(db))
			notifications.PUT("/:id/read", handlers.MarkNotificationAsRead(db))
			notifications.PUT("/mark-all-read", handlers.MarkAllNotificationsAsRead(db))
			notifications.POST("/send", middleware.RequireAdmin(cfg), handlers.SendAdminNotification(db))      // Отправка от админа
			notifications.GET("/users-list", middleware.RequireAdmin(cfg), handlers.GetAllUsersPhones(db))     // Список пользователей (только админ)
			notifications.POST("/push-token", handlers.SaveExpoPushToken(db))    // Сохранение Expo Push Token
		}

		// Company Messages routes (📨 Сообщения компаниям от админа)
		companyMessages := api.Group("/company-messages")
		{
			companyMessages.POST("/send", middleware.RequireAdmin(cfg), handlers.SendMessageToCompany(db))                         // Отправить компании
			companyMessages.POST("/send-all", middleware.RequireAdmin(cfg), handlers.SendMessageToAllCompanies(db))                // Отправить всем
			companyMessages.GET("/companies", middleware.RequireAdmin(cfg), handlers.GetAllCompaniesForMessages(db))               // Список компаний (только админ)
			companyMessages.GET("/company/:companyId", middleware.RequireAdminOrOwnCompanyParam("companyId"), handlers.GetCompanyMessages(db))              // Сообщения компании
			companyMessages.GET("/company/:companyId/count", middleware.RequireAdminOrOwnCompanyParam("companyId"), handlers.GetCompanyMessagesCount(db))   // Кол-во непрочитанных
			companyMessages.PUT("/:id/read", middleware.RequireCompany(cfg), middleware.RequireResourceOwner(db, "company_messages"), handlers.MarkCompanyMessageAsRead(db)) // Отметить как прочитано
			companyMessages.PUT("/company/:companyId/read-all", middleware.RequireAdminOrOwnCompanyParam("companyId"), handlers.MarkAllCompanyMessagesAsRead(db)) // Все прочитано
		}

		// Expenses routes
		expenses := api.Group("/expenses")
		{
			expenses.GET("", middleware.RequireCompany(cfg), middleware.RequireCompanyScope("companyId"), handlers.GetExpenses(db))
			expenses.POST("", middleware.RequireCompany(cfg), handlers.CreateExpense(db))
			expenses.DELETE("/:id", middleware.RequireCompany(cfg), middleware.RequireResourceOwner(db, "expenses"), handlers.DeleteExpense(db))
		}

		// Custom Expenses routes
		customExpenses := api.Group("/custom-expenses")
		{
			customExpenses.GET("", middleware.RequireCompany(cfg), middleware.RequireCompanyScope("companyId"), handlers.GetCustomExpenses(db))
			customExpenses.POST("", middleware.RequireCompany(cfg), handlers.CreateCustomExpense(db))
			customExpenses.PUT("/:id", middleware.RequireCompany(cfg), middleware.RequireResourceOwner(db, "custom_expenses"), handlers.UpdateCustomExpense(db))
			customExpenses.DELETE("/:id", middleware.RequireCompany(cfg), middleware.RequireResourceOwner(db, "custom_expenses"), handlers.DeleteCustomExpense(db))
		}

		// Product Purchases routes (📦 История закупок товаров)
		productPurchases := api.Group("/product-purchases")
		{
			productPurchases.GET("", middleware.RequireCompany(cfg), middleware.RequireCompanyScope("companyId"), handlers.GetProductPurchases(db)) // Список закупок
			productPurchases.POST("", middleware.RequireCompany(cfg), handlers.CreateProductPurchase(db))              // Создание записи о закупке
			productPurchases.GET("/stats", middleware.RequireCompany(cfg), middleware.RequireCompanyScope("companyId"), handlers.GetProductPurchaseStats(db)) // Статистика закупок
			productPurchases.PUT("/:id", middleware.RequireCompany(cfg), middleware.RequireResourceOwner(db, "product_purchases"), handlers.UpdateProductPurchase(db))           // Обновление закупки
			productPurchases.DELETE("/:id", middleware.RequireCompany(cfg), middleware.RequireResourceOwner(db, "product_purchases"), handlers.DeleteProductPurchase(db))        // Удаление закупки
		}

		// Analytics routes
		// Аналитика — финансовые данные компании: только сама компания или админ
		analytics := api.Group("/analytics")
		{
			analytics.GET("/company/:companyId", middleware.RequireAdminOrOwnCompanyParam("companyId"), handlers.GetCompanyAnalytics(db))
			analytics.GET("/company/:companyId/dashboard", middleware.RequireAdminOrOwnCompanyParam("companyId"), handlers.GetCompanyDashboard(db)) // 📊 Единый дашборд продавца
			analytics.GET("/company/:companyId/inventory-insights", middleware.RequireAdminOrOwnCompanyParam("companyId"), handlers.GetInventoryInsights(db)) // 📦 Прогноз остатков + ABC-анализ
			analytics.GET("/revenue", middleware.RequireCompany(cfg), middleware.RequireCompanyScope("companyId"), handlers.GetRevenueAnalytics(db))
			analytics.GET("/admin/overview", middleware.RequireAdmin(cfg), handlers.GetAdminOverview(db)) // 📊 Дашборд платформы
		}

		// 🛡️ Служебные админ-разделы: лента модерации, жалобы.
		admin := api.Group("/admin", middleware.RequireAdmin(cfg))
		{
			admin.GET("/moderation-feed", handlers.GetModerationFeed(db)) // 🔔 Что ждёт решения
			admin.GET("/global-search", handlers.GlobalSearch(db))       // 🔍 Единый поиск по платформе
			admin.GET("/credentials", handlers.GetAdminCredentials(db, cfg))    // 🔐 Текущий телефон-логин админа
			admin.PUT("/credentials", handlers.UpdateAdminCredentials(db, cfg)) // 🔐 Сменить телефон/пароль админа
		}

		// 🚩 Жалобы: создание — публично (покупатель), разбор — только админ.
		complaints := api.Group("/complaints")
		{
			complaints.POST("", handlers.CreateComplaint(db))
			complaints.GET("", middleware.RequireAdmin(cfg), handlers.GetComplaints(db))
			complaints.PUT("/:id/resolve", middleware.RequireAdmin(cfg), handlers.ResolveComplaint(db))
		}

		// Admin Delivery Revenue routes (💰 Доходы админа от доставки — только админ)
		adminDeliveryRevenue := api.Group("/admin-delivery-revenue", middleware.RequireAdmin(cfg))
		{
			adminDeliveryRevenue.GET("", handlers.GetAdminDeliveryRevenue(db))         // Список доходов от доставки
			adminDeliveryRevenue.GET("/stats", handlers.GetAdminDeliveryStats(db))     // Статистика доходов
		}

		// Ads routes
		ads := api.Group("/ads")
		{
			ads.GET("", handlers.GetApprovedAds(db))
			ads.POST("", middleware.RequireCompany(cfg), handlers.CreateAd(db))
			ads.POST("/upload-image", middleware.RequireCompany(cfg), handlers.UploadAdImage(db)) // 🆕 Загрузка изображения
			ads.PUT("/:id/moderate", middleware.RequireAdmin(cfg), handlers.ModerateAd(db))
			ads.PUT("/:id/link", middleware.RequireAdmin(cfg), handlers.UpdateAdLink(db))
			ads.DELETE("/:id", middleware.RequireCompany(cfg), middleware.RequireResourceOwner(db, "advertisements"), handlers.DeleteAd(db))
			ads.DELETE("/company/:companyId/all", middleware.RequireAdminOrOwnCompanyParam("companyId"), handlers.DeleteAllCompanyAds(db)) // 🆕 Удаление всех реклам компании
		}

		// Categories routes (global, managed by admin)
		categories := api.Group("/categories")
		{
			categories.GET("", gin.WrapF(handlers.GetCategories(db)))
			categories.POST("", middleware.RequireAdmin(cfg), gin.WrapF(handlers.CreateCategory(db)))
			categories.POST("/upload-icon", middleware.RequireAdmin(cfg), gin.WrapF(handlers.UploadCategoryIcon(db))) // Загрузка картинки-иконки (админ)
			categories.PUT("/:id", middleware.RequireAdmin(cfg), gin.WrapF(handlers.UpdateCategory(db)))
			categories.DELETE("/:id", middleware.RequireAdmin(cfg), gin.WrapF(handlers.DeleteCategory(db)))
			categories.GET("/products", gin.WrapF(handlers.GetProductsByCategory(db)))
		}

		// Discounts routes
		discounts := api.Group("/discounts")
		{
			discounts.POST("", middleware.RequireCompany(cfg), handlers.CreateDiscount(db))                       // Создание скидки компанией
			discounts.GET("/company/:companyId", handlers.GetCompanyDiscounts(db)) // Скидки компании
			discounts.GET("/all", middleware.RequireAdmin(cfg), handlers.GetAllDiscounts(db)) // Все скидки (только админ)
			discounts.GET("/approved", handlers.GetApprovedDiscounts(db))         // Одобренные скидки (клиенты)
			discounts.PUT("/:id/status", middleware.RequireAdmin(cfg), handlers.UpdateDiscountStatus(db))       // Обновление статуса (админ)
			discounts.DELETE("/:id", middleware.RequireCompany(cfg), handlers.DeleteDiscount(db))                 // Удаление скидки
		}

		// Aggressive Discounts routes (🔥 Агрессивные скидки для распродажи)
		aggressiveDiscounts := api.Group("/aggressive-discounts")
		{
			aggressiveDiscounts.POST("", middleware.RequireCompany(cfg), handlers.CreateAggressiveDiscount(db))                       // Создание агрессивной скидки
			aggressiveDiscounts.GET("/company/:companyId", handlers.GetCompanyAggressiveDiscounts(db)) // Агрессивные скидки компании
			aggressiveDiscounts.GET("/approved", handlers.GetApprovedAggressiveDiscounts(db))         // Одобренные агрессивные скидки
			aggressiveDiscounts.GET("/product/:productId", handlers.GetProductAggressiveDiscount(db)) // Агрессивная скидка товара
			aggressiveDiscounts.DELETE("/:id", middleware.RequireCompany(cfg), middleware.RequireResourceOwner(db, "aggressive_discounts"), handlers.DeleteAggressiveDiscount(db))                // Удаление агрессивной скидки
		}

		// Referral Agents routes (👥 Реферальная система)
		referrals := api.Group("/referrals")
		{
			referrals.POST("/agents", middleware.RequireAdmin(cfg), handlers.CreateReferralAgent(db))                    // Создание агента (админ)
			referrals.POST("/agents/login", handlers.LoginReferralAgent(db, cfg))               // Вход агента
			referrals.GET("/agents", middleware.RequireAdmin(cfg), handlers.GetReferralAgents(db)) // Список агентов (админ) — содержит креды
			referrals.GET("/agents/:id/stats", middleware.RequireAgentSelf("id"), handlers.GetReferralAgentStats(db))         // Статистика агента (сам агент/админ)
			referrals.GET("/agents/:id/analytics", middleware.RequireAgentSelf("id"), handlers.GetAgentFinancialAnalytics(db)) // 💰 Финансовая аналитика агента (сам агент/админ)
			referrals.PUT("/agents/:id/password", middleware.RequireAdmin(cfg), handlers.UpdateReferralAgentPassword(db)) // Смена пароля агента
			referrals.PUT("/agents/:id/commission", middleware.RequireAdmin(cfg), handlers.UpdateReferralAgentCommission(db)) // Изменить % агента (админ)
			referrals.DELETE("/agents/:id", middleware.RequireAdmin(cfg), handlers.DeleteReferralAgent(db))              // Удаление агента (админ)
			referrals.GET("/agents/:id/companies", middleware.RequireAgentSelf("id"), handlers.GetMyReferredCompanies(db)) // Компании агента (сам агент/админ)
			referrals.GET("/validate/:code", handlers.ValidateReferralCode(db))            // Проверка кода
			referrals.PUT("/companies/:id/toggle", middleware.RequireAdmin(cfg), handlers.ToggleCompanyStatus(db))       // Включить/выключить компанию
			referrals.PUT("/companies/:id/commission", middleware.RequireAdmin(cfg), handlers.UpdateCompanyCommission(db)) // Изменить % платформы для компании (админ) + уведомление
			referrals.GET("/companies/all", middleware.RequireAdmin(cfg), handlers.GetCompaniesWithReferralInfo(db)) // Компании с реф. инфо (админ)
		}

		// Promo codes / coupons (🎟️ промокоды) — platform-wide or per-company
		promoCodes := api.Group("/promo-codes")
		{
			promoCodes.POST("", middleware.RequireAdmin(cfg), handlers.CreatePromoCode(db))                       // Создать промокод
			promoCodes.GET("/all", middleware.RequireAdmin(cfg), handlers.GetAllPromoCodes(db))                   // Все промокоды (только админ)
			promoCodes.GET("/company/:companyId", middleware.RequireAdminOrOwnCompanyParam("companyId"), handlers.GetCompanyPromoCodes(db)) // Промокоды компании (+ платформенные)
			promoCodes.POST("/company/:companyId", middleware.RequireAdminOrOwnCompanyParam("companyId"), handlers.CreateCompanyPromoCode(db))       // 🎟️ Компания создаёт свой промокод
			promoCodes.DELETE("/company/:companyId/:id", middleware.RequireAdminOrOwnCompanyParam("companyId"), handlers.DeleteCompanyPromoCode(db)) // Удалить свой промокод
			promoCodes.POST("/validate", handlers.ValidatePromoCode(db))            // Проверить промокод (без списания)
			promoCodes.POST("/redeem", handlers.RedeemPromoCode(db))                // Зафиксировать использование
			promoCodes.PUT("/:id/toggle", middleware.RequireAdmin(cfg), handlers.TogglePromoCode(db))             // Вкл/выкл промокод
			promoCodes.DELETE("/:id", middleware.RequireAdmin(cfg), handlers.DeletePromoCode(db))                 // Удалить промокод
		}

		// Order returns / refunds (↩️ возвраты и споры)
		returns := api.Group("/returns")
		{
			returns.POST("", handlers.CreateReturn(db))             // Покупатель создаёт заявку на возврат
			returns.GET("", handlers.GetReturns(db))                // Список (?companyId= или ?customerPhone=)
			returns.GET("/:id", handlers.GetReturn(db))             // Одна заявка
			returns.PUT("/:id/status", handlers.UpdateReturnStatus(db)) // Компания/админ меняет статус
		}

		// Product questions & answers (❓ вопросы к товару)
		questions := api.Group("/questions")
		{
			questions.POST("/:id/answer", middleware.RequireCompany(cfg), middleware.RequireResourceOwner(db, "product_questions"), handlers.AnswerQuestion(db)) // Ответ продавца
			questions.DELETE("/:id", middleware.RequireCompany(cfg), middleware.RequireResourceOwner(db, "product_questions"), handlers.DeleteQuestion(db))      // Удалить вопрос
		}
		// Per-product question routes live under /products for discoverability.
		products.POST("/:id/questions", handlers.AskQuestion(db)) // Задать вопрос о товаре
		products.GET("/:id/questions", handlers.GetProductQuestions(db)) // Вопросы по товару
		questions.GET("/company/:companyId", middleware.RequireAdminOrOwnCompanyParam("companyId"), handlers.GetCompanyQuestions(db)) // Все вопросы компании (для ответов продавца)

		// 📢 Внутренняя реклама (промо-размещение). Продавец подаёт заявку,
		// админ одобряет с суммой и сроком, товары поднимаются в выдаче.
		promotions := api.Group("/promotions")
		{
			promotions.POST("", middleware.RequireCompany(cfg), handlers.CreatePromotionRequest(db))                                   // Заявка продавца
			promotions.GET("/company/:companyId", middleware.RequireAdminOrOwnCompanyParam("companyId"), handlers.GetCompanyPromotions(db)) // Свои заявки
			promotions.GET("", middleware.RequireAdmin(cfg), handlers.GetAllPromotions(db))                                             // Все (админ, ?status=pending)
			promotions.GET("/revenue", middleware.RequireAdmin(cfg), handlers.GetPromotionRevenue(db))                                  // Доход платформы
			promotions.PUT("/:id/approve", middleware.RequireAdmin(cfg), handlers.ApprovePromotion(db))                                 // Одобрить + оплата
			promotions.PUT("/:id/reject", middleware.RequireAdmin(cfg), handlers.RejectPromotion(db))                                   // Отклонить
			promotions.DELETE("/:id", middleware.RequireCompany(cfg), handlers.CancelPromotion(db))                                     // Досрочная остановка (владелец/админ)
		}

		// Loyalty / cashback points (⭐ баллы и кэшбэк)
		loyalty := api.Group("/loyalty")
		{
			loyalty.GET("/:phone", middleware.RequireSelfPhone("phone"), handlers.GetLoyaltyAccount(db)) // Баланс + история (только владелец)
			// Начисление баллов происходит на сервере (awardCashback при доставке
			// заказа); внешний вызов — только для админа, иначе любой мог бы
			// начислить себе бесконечный кэшбэк.
			loyalty.POST("/earn", middleware.RequireAdmin(cfg), handlers.EarnLoyaltyPoints(db))
			loyalty.POST("/redeem", handlers.RedeemLoyaltyPoints(db)) // Списать баллы (владелец — проверка внутри)
		}

		// Internal maintenance endpoints (не публичные — только админ)
		internal := api.Group("/internal", middleware.RequireAdmin(cfg))
		{
			internal.POST("/sla-cancel", handlers.SLACancelStaleOrders(db))
		}
	}
}
