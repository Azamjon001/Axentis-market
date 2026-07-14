package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// Get Companies
func GetCompanies(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// SECURITY: credential fields (password, access key, private code) are
		// returned only to the company itself. This endpoint is public — the
		// storefronts use it to list shops — so leaking them here would hand
		// out every seller's login to anyone.

		// Для админ панели показываем все компании, для пользователей - только approved
		query := `
			SELECT id, name, phone, password_hash, COALESCE(password_plain, ''), access_key, mode, private_code, status, logo_url, address, description, products_description, latitude, longitude, delivery_enabled, is_enabled, COALESCE(platform_commission_percent, 3), COALESCE(is_verified, FALSE)
			FROM companies
			ORDER BY created_at DESC
		`

		rows, err := db.Query(query)

		if err != nil {
			log.Printf("❌ GetCompanies: Failed to query companies: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch companies"})
			return
		}
		defer rows.Close()

		companies := make([]map[string]interface{}, 0)
		for rows.Next() {
			var comp struct {
				ID                  int64
				Name                string
				Phone               string
				PasswordHash        string
				PasswordPlain       string
				AccessKey           sql.NullString
				Mode                string
				PrivateCode         sql.NullString
				Status              string
				LogoURL             sql.NullString
				Address             sql.NullString
				Description         sql.NullString
				ProductsDescription sql.NullString
				Latitude            sql.NullFloat64
				Longitude           sql.NullFloat64
				DeliveryEnabled     bool
				IsEnabled           sql.NullBool
				PlatformCommission  float64
				IsVerified          bool
			}

			if err := rows.Scan(&comp.ID, &comp.Name, &comp.Phone, &comp.PasswordHash, &comp.PasswordPlain, &comp.AccessKey, &comp.Mode, &comp.PrivateCode, &comp.Status,
				&comp.LogoURL, &comp.Address, &comp.Description, &comp.ProductsDescription, &comp.Latitude, &comp.Longitude, &comp.DeliveryEnabled, &comp.IsEnabled, &comp.PlatformCommission, &comp.IsVerified); err != nil {
				log.Printf("❌ GetCompanies: Failed to scan row: %v", err)
				continue
			}

			company := map[string]interface{}{
				"id":              comp.ID,
				"name":            comp.Name,
				"phone":           comp.Phone,
				"mode":            comp.Mode,
				"status":          comp.Status,
				"deliveryEnabled": comp.DeliveryEnabled,
				"platformCommissionPercent": comp.PlatformCommission,
				"isVerified":      comp.IsVerified,
			}

			// 🔒 Пароль и приватный код видит ТОЛЬКО сама компания в своей строке
			// (панель настроек продавца читает свой private code). Bcrypt-хэш не
			// отдаётся никому. Эндпоинт публичный — анонимам учётные данные не
			// отдаются вообще.
			if ctxRole(c) == "company" && ctxCompanyID(c) == comp.ID {
				if comp.PasswordPlain != "" {
					company["password"] = comp.PasswordPlain
				} else if comp.PasswordHash != "" && !strings.HasPrefix(comp.PasswordHash, "$2") {
					company["password"] = comp.PasswordHash
				}
				if comp.PrivateCode.Valid {
					company["privateCode"] = comp.PrivateCode.String
				}
			}
			// 🔑 30-значный ключ доступа виден самой компании И администратору
			// платформы: админ выдаёт ключи компаниям и должен всегда видеть их
			// в панели управления.
			if comp.AccessKey.Valid &&
				(isAdmin(c) || (ctxRole(c) == "company" && ctxCompanyID(c) == comp.ID)) {
				company["accessKey"] = comp.AccessKey.String
			}
			if comp.LogoURL.Valid {
				company["logoUrl"] = comp.LogoURL.String
			}
			if comp.Address.Valid {
				company["address"] = comp.Address.String
			}
			if comp.Description.Valid {
				company["description"] = comp.Description.String
			}
			if comp.ProductsDescription.Valid {
				company["productsDescription"] = comp.ProductsDescription.String
			}
			if comp.Latitude.Valid {
				company["latitude"] = comp.Latitude.Float64
			}
			if comp.Longitude.Valid {
				company["longitude"] = comp.Longitude.Float64
			}
			if comp.IsEnabled.Valid {
				company["is_enabled"] = comp.IsEnabled.Bool
			}

			companies = append(companies, company)
		}

		log.Printf("✅ GetCompanies: Returning %d companies", len(companies))
		c.JSON(http.StatusOK, companies)
	}
}

// GetTopCompanies returns the "hit" shops — public, approved companies ranked
// by how much they sell (sum of product sold_count), then rating, then views.
// Powers the Instagram-style "recommended shops" row on the home screen.
func GetTopCompanies(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`
			SELECT c.id, c.name, COALESCE(c.logo_url, ''), COALESCE(c.address, ''),
			       COALESCE((SELECT SUM(p.sold_count) FROM products p WHERE p.company_id = c.id), 0) AS sold_units,
			       COALESCE(c.view_count, 0) AS view_count,
			       COALESCE((SELECT AVG(rating) FROM company_ratings cr WHERE cr.company_id = c.id), 0) AS rating,
			       COALESCE((SELECT COUNT(*) FROM company_ratings cr WHERE cr.company_id = c.id), 0) AS rating_count,
			       COALESCE((SELECT COUNT(*) FROM products p WHERE p.company_id = c.id AND p.available_for_customers = TRUE), 0) AS product_count,
			       COALESCE(c.is_verified, FALSE) AS is_verified
			FROM companies c
			WHERE c.status = 'approved'
			  AND (c.mode = 'public' OR c.mode IS NULL)
			  AND COALESCE(c.is_enabled, TRUE) = TRUE
			ORDER BY sold_units DESC, rating DESC, view_count DESC
			LIMIT 12
		`)
		if err != nil {
			log.Printf("❌ GetTopCompanies: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch top companies"})
			return
		}
		defer rows.Close()

		list := make([]gin.H, 0)
		for rows.Next() {
			var (
				id                       int64
				name, logo, address      string
				soldUnits, viewCount     int
				rating                   float64
				ratingCount, productCnt  int
				isVerified               bool
			)
			if err := rows.Scan(&id, &name, &logo, &address, &soldUnits, &viewCount, &rating, &ratingCount, &productCnt, &isVerified); err != nil {
				continue
			}
			list = append(list, gin.H{
				"id": id, "name": name, "logoUrl": logo, "address": address,
				"soldUnits": soldUnits, "viewCount": viewCount,
				"rating": rating, "ratingCount": ratingCount, "productCount": productCnt,
				"isVerified": isVerified,
			})
		}
		c.JSON(http.StatusOK, list)
	}
}

// Get Single Company
func GetCompany(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		var company struct {
			ID                  int64
			Name                string
			Phone               string
			Mode                string
			Status              string
			LogoURL             sql.NullString
			CoverURL            sql.NullString
			Address             sql.NullString
			Description         sql.NullString
			ProductsDescription sql.NullString
			Latitude            sql.NullFloat64
			Longitude           sql.NullFloat64
			DeliveryEnabled     bool
			DeliveryRadiusKm    sql.NullFloat64
			DeliveryRadiusLat   sql.NullFloat64
			DeliveryRadiusLng   sql.NullFloat64
			DeliveryCostPerKm   sql.NullFloat64
			ReturnEnabled       sql.NullBool
			ReturnWindowHours   sql.NullInt64
			Region              sql.NullString
			District            sql.NullString
			ServiceRegions      sql.NullString
			CoverVideoURL       sql.NullString
			PlatformCommission  sql.NullFloat64
			IsVerified          bool
		}

		err := db.QueryRow(`
			SELECT id, name, phone, mode, status, logo_url, cover_url, address, description, products_description, latitude, longitude, delivery_enabled,
			       COALESCE(delivery_radius_km, 0), delivery_radius_lat, delivery_radius_lng,
			       COALESCE(delivery_cost_per_km, 1500), COALESCE(return_enabled, true), COALESCE(return_window_hours, 24),
			       region, district, COALESCE(service_regions::text, '[]'), cover_video_url,
			       COALESCE(platform_commission_percent, 3), COALESCE(is_verified, FALSE)
			FROM companies WHERE id = $1
		`, id).Scan(&company.ID, &company.Name, &company.Phone, &company.Mode, &company.Status,
			&company.LogoURL, &company.CoverURL, &company.Address, &company.Description, &company.ProductsDescription, &company.Latitude, &company.Longitude, &company.DeliveryEnabled,
			&company.DeliveryRadiusKm, &company.DeliveryRadiusLat, &company.DeliveryRadiusLng,
			&company.DeliveryCostPerKm, &company.ReturnEnabled, &company.ReturnWindowHours,
			&company.Region, &company.District, &company.ServiceRegions, &company.CoverVideoURL,
			&company.PlatformCommission, &company.IsVerified)

		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Company not found"})
			return
		}

		result := map[string]interface{}{
			"id":              company.ID,
			"name":            company.Name,
			"phone":           company.Phone,
			"mode":            company.Mode,
			"status":          company.Status,
			"deliveryEnabled": company.DeliveryEnabled,
			"isVerified":      company.IsVerified,
		}

		if company.LogoURL.Valid {
			result["logoUrl"] = company.LogoURL.String
		}
		if company.CoverURL.Valid {
			result["coverUrl"] = company.CoverURL.String
		}
		if company.Address.Valid {
			result["address"] = company.Address.String
		}
		if company.Description.Valid {
			result["description"] = company.Description.String
		}
		if company.ProductsDescription.Valid {
			result["productsDescription"] = company.ProductsDescription.String
		}
		if company.Latitude.Valid {
			result["latitude"] = company.Latitude.Float64
		}
		if company.Longitude.Valid {
			result["longitude"] = company.Longitude.Float64
		}
		result["deliveryRadiusKm"] = company.DeliveryRadiusKm.Float64
		if company.DeliveryRadiusLat.Valid {
			result["deliveryRadiusLat"] = company.DeliveryRadiusLat.Float64
		}
		if company.DeliveryRadiusLng.Valid {
			result["deliveryRadiusLng"] = company.DeliveryRadiusLng.Float64
		}
		result["deliveryCostPerKm"] = company.DeliveryCostPerKm.Float64
		result["returnEnabled"] = company.ReturnEnabled.Bool
		result["returnWindowHours"] = company.ReturnWindowHours.Int64
		if company.Region.Valid {
			result["region"] = company.Region.String
		}
		if company.District.Valid {
			result["district"] = company.District.String
		}
		// service_regions хранится как JSONB-массив — отдаём как массив, а не строку.
		if company.ServiceRegions.Valid && company.ServiceRegions.String != "" {
			var regions []string
			if err := json.Unmarshal([]byte(company.ServiceRegions.String), &regions); err == nil {
				result["serviceRegions"] = regions
			} else {
				result["serviceRegions"] = []string{}
			}
		} else {
			result["serviceRegions"] = []string{}
		}
		if company.CoverVideoURL.Valid {
			result["coverVideoUrl"] = company.CoverVideoURL.String
		}
		if company.PlatformCommission.Valid {
			result["platformCommissionPercent"] = company.PlatformCommission.Float64
		}

		// Получаем средний рейтинг компании
		var avgRating float64
		var ratingCount int
		err = db.QueryRow(`
			SELECT COALESCE(AVG(rating), 0), COUNT(*) 
			FROM company_ratings 
			WHERE company_id = $1
		`, id).Scan(&avgRating, &ratingCount)

		if err == nil {
			result["averageRating"] = avgRating
			result["ratingCount"] = ratingCount
		}

		log.Printf("📤 GetCompany: Returning company %s, logoUrl=%v, rating=%.2f (%d)", id, result["logoUrl"], avgRating, ratingCount)
		c.JSON(http.StatusOK, result)
	}
}

// ToggleCompanyDelivery - включает/выключает доставку для конкретной компании
func ToggleCompanyDelivery(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID := c.Param("id")

		var req struct {
			DeliveryEnabled bool `json:"deliveryEnabled"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		_, err := db.Exec(`
			UPDATE companies
			SET delivery_enabled = $1, updated_at = NOW()
			WHERE id = $2
		`, req.DeliveryEnabled, companyID)

		if err != nil {
			log.Printf("❌ ToggleCompanyDelivery: Failed to update delivery setting: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update delivery setting"})
			return
		}

		log.Printf("✅ ToggleCompanyDelivery: Company %s delivery_enabled set to %v", companyID, req.DeliveryEnabled)
		c.JSON(http.StatusOK, gin.H{"success": true, "deliveryEnabled": req.DeliveryEnabled})
	}
}

// Update Company
func UpdateCompany(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		var req struct {
			Name                string   `json:"name"`
			Phone               string   `json:"phone"`
			Password            string   `json:"password"`
			AccessKey           string   `json:"access_key"`
			Description         string   `json:"description"`
			Address             string   `json:"address"`
			ProductsDescription string   `json:"productsDescription"`
			Latitude            *float64 `json:"latitude"`
			Longitude           *float64 `json:"longitude"`
			DeliveryRadiusKm    *float64 `json:"deliveryRadiusKm"`
			DeliveryRadiusLat   *float64 `json:"deliveryRadiusLat"`
			DeliveryRadiusLng   *float64 `json:"deliveryRadiusLng"`
			DeliveryCostPerKm   *float64 `json:"deliveryCostPerKm"`
			ReturnEnabled       *bool    `json:"returnEnabled"`
			ReturnWindowHours   *int     `json:"returnWindowHours"`
			Region              *string  `json:"region"`              // основной регион (область) компании
			District            *string  `json:"district"`            // район
			ServiceRegions      *[]string `json:"serviceRegions"`     // 🗺️ регионы доставки (мультивыбор)
			CoverVideoUrl       *string  `json:"coverVideoUrl"`       // 🎬 видео-декорация для страницы магазина
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Строим динамический запрос в зависимости от переданных полей
		query := "UPDATE companies SET updated_at = NOW()"
		args := []interface{}{}
		argCount := 1

		if req.Name != "" {
			query += fmt.Sprintf(", name = $%d", argCount)
			args = append(args, req.Name)
			argCount++
		}
		if req.Phone != "" {
			query += fmt.Sprintf(", phone = $%d", argCount)
			args = append(args, req.Phone)
			argCount++
		}
		if req.Password != "" {
			// Store the bcrypt hash for the login flow, and keep the readable
			// plaintext in password_plain so the admin panel can display/edit it.
			hashed, hErr := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
			if hErr != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
				return
			}
			query += fmt.Sprintf(", password_hash = $%d", argCount)
			args = append(args, string(hashed))
			argCount++
			query += fmt.Sprintf(", password_plain = $%d", argCount)
			args = append(args, req.Password)
			argCount++
		}
		if req.AccessKey != "" {
			query += fmt.Sprintf(", access_key = $%d", argCount)
			args = append(args, req.AccessKey)
			argCount++
		}
		if req.Description != "" {
			query += fmt.Sprintf(", description = $%d", argCount)
			args = append(args, req.Description)
			argCount++
		}
		if req.Address != "" {
			query += fmt.Sprintf(", address = $%d", argCount)
			args = append(args, req.Address)
			argCount++
		}
		if req.ProductsDescription != "" {
			query += fmt.Sprintf(", products_description = $%d", argCount)
			args = append(args, req.ProductsDescription)
			argCount++
		}
		if req.Latitude != nil {
			query += fmt.Sprintf(", latitude = $%d", argCount)
			args = append(args, *req.Latitude)
			argCount++
		}
		if req.Longitude != nil {
			query += fmt.Sprintf(", longitude = $%d", argCount)
			args = append(args, *req.Longitude)
			argCount++
		}
		if req.DeliveryRadiusKm != nil {
			query += fmt.Sprintf(", delivery_radius_km = $%d", argCount)
			args = append(args, *req.DeliveryRadiusKm)
			argCount++
		}
		if req.DeliveryRadiusLat != nil {
			query += fmt.Sprintf(", delivery_radius_lat = $%d", argCount)
			args = append(args, *req.DeliveryRadiusLat)
			argCount++
		}
		if req.DeliveryRadiusLng != nil {
			query += fmt.Sprintf(", delivery_radius_lng = $%d", argCount)
			args = append(args, *req.DeliveryRadiusLng)
			argCount++
		}
		if req.DeliveryCostPerKm != nil {
			query += fmt.Sprintf(", delivery_cost_per_km = $%d", argCount)
			args = append(args, *req.DeliveryCostPerKm)
			argCount++
		}
		if req.ReturnEnabled != nil {
			query += fmt.Sprintf(", return_enabled = $%d", argCount)
			args = append(args, *req.ReturnEnabled)
			argCount++
		}
		if req.ReturnWindowHours != nil {
			query += fmt.Sprintf(", return_window_hours = $%d", argCount)
			args = append(args, *req.ReturnWindowHours)
			argCount++
		}
		if req.Region != nil {
			query += fmt.Sprintf(", region = $%d", argCount)
			args = append(args, *req.Region)
			argCount++
		}
		if req.District != nil {
			query += fmt.Sprintf(", district = $%d", argCount)
			args = append(args, *req.District)
			argCount++
		}
		if req.ServiceRegions != nil {
			// Сохраняем как JSONB-массив названий регионов.
			regionsJSON, mErr := json.Marshal(*req.ServiceRegions)
			if mErr != nil {
				regionsJSON = []byte("[]")
			}
			query += fmt.Sprintf(", service_regions = $%d::jsonb", argCount)
			args = append(args, string(regionsJSON))
			argCount++
		}
		if req.CoverVideoUrl != nil {
			query += fmt.Sprintf(", cover_video_url = $%d", argCount)
			args = append(args, *req.CoverVideoUrl)
			argCount++
		}

		query += fmt.Sprintf(" WHERE id = $%d", argCount)
		args = append(args, id)

		log.Printf("📝 UpdateCompany: Executing query with %d params for company %s", len(args), id)
		_, err := db.Exec(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update company"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// Delete Company
func DeleteCompany(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		// Prevent deleting main company (id = 1)
		if id == "1" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Cannot delete main company"})
			return
		}

		_, err := db.Exec("DELETE FROM companies WHERE id = $1", id)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete company"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// Verify Access Key
// SetCompanyVerified — PUT /companies/:id/verify (только админ).
// Выдаёт или снимает значок «Проверенный магазин».
func SetCompanyVerified(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			IsVerified bool `json:"isVerified"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		res, err := db.Exec(`UPDATE companies SET is_verified = $1, updated_at = NOW() WHERE id = $2`, req.IsVerified, c.Param("id"))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update verification"})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Company not found"})
			return
		}
		log.Printf("✅ Company %s verification set to %v", c.Param("id"), req.IsVerified)
		c.JSON(http.StatusOK, gin.H{"success": true, "isVerified": req.IsVerified})
	}
}

func VerifyAccessKey(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		var requestBody struct {
			AccessKey string `json:"accessKey"`
		}

		if err := c.ShouldBindJSON(&requestBody); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
			return
		}

		// Query company from database
		var company struct {
			ID          int64
			Name        string
			Phone       string
			AccessKey   sql.NullString
			Mode        string
			Status      string
			LogoURL     sql.NullString
			Address     sql.NullString
			Description sql.NullString
		}

		query := `
			SELECT id, name, phone, access_key, mode, status, logo_url, address, description
			FROM companies
			WHERE id = $1
		`

		err := db.QueryRow(query, id).Scan(
			&company.ID, &company.Name, &company.Phone, &company.AccessKey,
			&company.Mode, &company.Status, &company.LogoURL, &company.Address, &company.Description,
		)

		if err != nil {
			if err == sql.ErrNoRows {
				c.JSON(http.StatusNotFound, gin.H{"error": "Company not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch company"})
			return
		}

		// Verify access key
		if !company.AccessKey.Valid || requestBody.AccessKey != company.AccessKey.String {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid access key"})
			return
		}

		// Return company data
		result := map[string]interface{}{
			"id":     company.ID,
			"name":   company.Name,
			"phone":  company.Phone,
			"mode":   company.Mode,
			"status": company.Status,
		}

		if company.LogoURL.Valid {
			result["logoUrl"] = company.LogoURL.String
		}
		if company.Address.Valid {
			result["address"] = company.Address.String
		}
		if company.Description.Valid {
			result["description"] = company.Description.String
		}

		c.JSON(http.StatusOK, result)
	}
}

// Track Company View
func TrackCompanyView(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID := c.Param("id")

		// Увеличиваем счетчик просмотров
		_, err := db.Exec(`
			UPDATE companies 
			SET view_count = COALESCE(view_count, 0) + 1 
			WHERE id = $1
		`, companyID)

		if err != nil {
			log.Printf("❌ TrackCompanyView: Failed to update view count: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to track view"})
			return
		}

		log.Printf("✅ TrackCompanyView: View tracked for company %s", companyID)
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// Get Company Stats
func GetCompanyStats(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID := c.Param("id")

		var stats struct {
			Views               int
			Subscribers         int
			TotalProducts       int
			TotalSales          int
			EmployeeExpenses    float64
			ElectricityExpenses float64
			PurchaseCosts       float64
		}

		// Получаем статистику компании включая затраты
		err := db.QueryRow(`
			SELECT 
				COALESCE(view_count, 0)
			FROM companies 
			WHERE id = $1
		`, companyID).Scan(&stats.Views)

		if err != nil {
			log.Printf("❌ GetCompanyStats: Failed to get company data: %v", err)
			stats.Views = 0
			stats.EmployeeExpenses = 0
			stats.ElectricityExpenses = 0
			stats.PurchaseCosts = 0
		}

		// Получаем количество подписчиков
		err = db.QueryRow(`
			SELECT COUNT(*) 
			FROM company_subscribers 
			WHERE company_id = $1
		`, companyID).Scan(&stats.Subscribers)

		if err != nil {
			log.Printf("❌ GetCompanyStats: Failed to get subscribers: %v", err)
			stats.Subscribers = 0
		}

		// Получаем количество товаров
		err = db.QueryRow(`
			SELECT COUNT(*) 
			FROM products 
			WHERE company_id = $1
		`, companyID).Scan(&stats.TotalProducts)

		if err != nil {
			log.Printf("❌ GetCompanyStats: Failed to get total products: %v", err)
			stats.TotalProducts = 0
		}

// Получаем количество продаж (онлайн заказы кроме pending)
	err = db.QueryRow(`
		SELECT COUNT(*) 
		FROM orders 
		WHERE company_id = $1 AND status IN ('confirmed', 'completed', 'rejected')
		`, companyID).Scan(&stats.TotalSales)

		if err != nil {
			log.Printf("❌ GetCompanyStats: Failed to get total sales: %v", err)
			stats.TotalSales = 0
		}

		// 📦 Только УСПЕШНЫЕ (завершённые) заказы — показатель для дашборда и
		// социального доказательства на странице магазина.
		var completedOrders int
		db.QueryRow(`SELECT COUNT(*) FROM orders WHERE company_id = $1 AND status = 'completed'`, companyID).Scan(&completedOrders)

		// Получаем средний рейтинг компании
		var avgRating float64
		var ratingCount int
		err = db.QueryRow(`
			SELECT COALESCE(AVG(rating), 0), COUNT(*)
			FROM company_ratings
			WHERE company_id = $1
		`, companyID).Scan(&avgRating, &ratingCount)

		if err != nil {
			log.Printf("❌ GetCompanyStats: Failed to get rating: %v", err)
			avgRating = 0
			ratingCount = 0
		}

		log.Printf("✅ GetCompanyStats: Company %s has %d views, %d subscribers, %d products, %d sales, rating %.2f (%d)",
			companyID, stats.Views, stats.Subscribers, stats.TotalProducts, stats.TotalSales, avgRating, ratingCount)
		c.JSON(http.StatusOK, gin.H{
			"views":               stats.Views,
			"subscribers":         stats.Subscribers,
			"total_products":      stats.TotalProducts,
			"total_sales":         stats.TotalSales,
			"completedOrders":     completedOrders,
			"employeeExpenses":    stats.EmployeeExpenses,
			"electricityExpenses": stats.ElectricityExpenses,
			"purchaseCosts":       stats.PurchaseCosts,
			"averageRating":       avgRating,
			"ratingCount":         ratingCount,
		})
	}
}

// Subscribe to Company
func SubscribeToCompany(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID := c.Param("id")

		var req struct {
			UserPhone string `json:"userPhone"`
		}

		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		// Вставляем подписку (игнорируем если уже есть)
		_, err := db.Exec(`
			INSERT INTO company_subscribers (company_id, user_phone, subscribed_at)
			VALUES ($1, $2, NOW())
			ON CONFLICT (company_id, user_phone) DO NOTHING
		`, companyID, req.UserPhone)

		if err != nil {
			log.Printf("❌ SubscribeToCompany: Failed to subscribe: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to subscribe"})
			return
		}

		log.Printf("✅ SubscribeToCompany: User %s subscribed to company %s", req.UserPhone, companyID)
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// Unsubscribe from Company
func UnsubscribeFromCompany(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID := c.Param("id")

		var req struct {
			UserPhone string `json:"userPhone"`
		}

		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		// Удаляем подписку
		_, err := db.Exec(`
			DELETE FROM company_subscribers 
			WHERE company_id = $1 AND user_phone = $2
		`, companyID, req.UserPhone)

		if err != nil {
			log.Printf("❌ UnsubscribeFromCompany: Failed to unsubscribe: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to unsubscribe"})
			return
		}

		log.Printf("✅ UnsubscribeFromCompany: User %s unsubscribed from company %s", req.UserPhone, companyID)
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// Update Company Expenses
func UpdateCompanyExpenses(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID := c.Param("id")

		var req struct {
			EmployeeExpenses    float64 `json:"employeeExpenses"`
			ElectricityExpenses float64 `json:"electricityExpenses"`
			PurchaseCosts       float64 `json:"purchaseCosts"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			log.Printf("❌ UpdateCompanyExpenses: Invalid request body: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
			return
		}

		_, err := db.Exec(`
			UPDATE companies 
			SET updated_at = NOW()
			WHERE id = $1
		`, companyID)

		if err != nil {
			log.Printf("❌ UpdateCompanyExpenses: Failed to update expenses: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update expenses"})
			return
		}

		log.Printf("✅ UpdateCompanyExpenses: Updated expenses for company %s", companyID)
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// UploadCompanyLogo - загружает логотип компании
func UploadCompanyLogo(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID := c.Param("id")

		file, err := c.FormFile("file")
		if err != nil {
			log.Printf("❌ UploadCompanyLogo: Failed to get file: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": "No file provided"})
			return
		}

		// Generate unique filename
		ext := filepath.Ext(file.Filename)
		newFilename := fmt.Sprintf("company_%s_logo_%d%s", companyID, time.Now().Unix(), ext)
		uploadPath := filepath.Join("uploads", "logos", newFilename)

		// Ensure directory exists
		if err := os.MkdirAll(filepath.Dir(uploadPath), 0755); err != nil {
			log.Printf("❌ UploadCompanyLogo: Failed to create directory: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory"})
			return
		}

		// Save file
		if err := c.SaveUploadedFile(file, uploadPath); err != nil {
			log.Printf("❌ UploadCompanyLogo: Failed to save file: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
			return
		}
		optimizeImage(uploadPath) // 🖼️ сжатие/ресайз

		// Generate URL
		logoURL := fmt.Sprintf("/uploads/logos/%s", newFilename)

		// Update company logo in database
		_, err = db.Exec(`
			UPDATE companies 
			SET logo_url = $1, updated_at = NOW() 
			WHERE id = $2
		`, logoURL, companyID)

		if err != nil {
			log.Printf("❌ UploadCompanyLogo: Failed to update database: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update logo"})
			return
		}

		log.Printf("✅ UploadCompanyLogo: Logo uploaded for company %s: %s", companyID, logoURL)
		c.JSON(http.StatusOK, gin.H{
			"success":  true,
			"logo_url": logoURL,
		})
	}
}

// UploadCompanyCover - загружает фоновое (обложку) фото магазина.
func UploadCompanyCover(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID := c.Param("id")

		file, err := c.FormFile("file")
		if err != nil {
			log.Printf("❌ UploadCompanyCover: Failed to get file: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": "No file provided"})
			return
		}

		ext := filepath.Ext(file.Filename)
		newFilename := fmt.Sprintf("company_%s_cover_%d%s", companyID, time.Now().Unix(), ext)
		uploadPath := filepath.Join("uploads", "covers", newFilename)

		if err := os.MkdirAll(filepath.Dir(uploadPath), 0755); err != nil {
			log.Printf("❌ UploadCompanyCover: Failed to create directory: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory"})
			return
		}

		if err := c.SaveUploadedFile(file, uploadPath); err != nil {
			log.Printf("❌ UploadCompanyCover: Failed to save file: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
			return
		}
		optimizeImage(uploadPath) // 🖼️ сжатие/ресайз

		coverURL := fmt.Sprintf("/uploads/covers/%s", newFilename)

		_, err = db.Exec(`
			UPDATE companies
			SET cover_url = $1, updated_at = NOW()
			WHERE id = $2
		`, coverURL, companyID)
		if err != nil {
			log.Printf("❌ UploadCompanyCover: Failed to update database: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update cover"})
			return
		}

		log.Printf("✅ UploadCompanyCover: Cover uploaded for company %s: %s", companyID, coverURL)
		c.JSON(http.StatusOK, gin.H{
			"success":   true,
			"cover_url": coverURL,
		})
	}
}

// 🔐 ToggleCompanyPrivacy - переключает режим компании (public/private)
// При переключении на private генерирует уникальный код (5-6 цифр)
// При переключении на public удаляет код
func ToggleCompanyPrivacy(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID := c.Param("id")

		var req struct {
			Mode string `json:"mode" binding:"required"` // "public" или "private"
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if req.Mode != "public" && req.Mode != "private" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Mode must be 'public' or 'private'"})
			return
		}

		log.Printf("🔐 ToggleCompanyPrivacy: Company %s switching to %s mode", companyID, req.Mode)

		var privateCode *string
		if req.Mode == "private" {
			// Генерируем уникальный код (5-6 цифр)
			code := generatePrivateCode(db)
			privateCode = &code
			log.Printf("🔐 Generated private code: %s", code)
		}

		// Обновляем режим и код компании
		_, err := db.Exec(`
			UPDATE companies 
			SET mode = $1, private_code = $2, updated_at = NOW() 
			WHERE id = $3
		`, req.Mode, privateCode, companyID)

		if err != nil {
			log.Printf("❌ ToggleCompanyPrivacy: Failed to update company: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update company mode"})
			return
		}

		response := gin.H{
			"success": true,
			"mode":    req.Mode,
		}

		if privateCode != nil {
			response["privateCode"] = *privateCode
		}

		c.JSON(http.StatusOK, response)
	}
}

// GetNearestCompany - Поиск ближайшей компании к покупателю
// GET /companies/nearest?lat=41.3&lng=69.2&district=Учтепа&excludeId=5
func GetNearestCompany(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		lat := c.Query("lat")
		lng := c.Query("lng")
		district := c.Query("district")
		excludeID := c.Query("excludeId") // ID компании, которую нужно исключить из поиска

		if lat == "" || lng == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "lat and lng parameters are required"})
			return
		}

		// SQL запрос с формулой Haversine для расчета расстояния
		query := `
			SELECT 
				id, 
				name, 
				phone, 
				address, 
				latitude, 
				longitude, 
				district,
				region,
				delivery_enabled,
				(
					6371 * acos(
						cos(radians($1)) * cos(radians(latitude)) *
						cos(radians(longitude) - radians($2)) +
						sin(radians($1)) * sin(radians(latitude))
					)
				) AS distance
			FROM companies
			WHERE 
				latitude IS NOT NULL 
				AND longitude IS NOT NULL
				AND status = 'approved'
				AND is_enabled = true
		`

		args := []interface{}{lat, lng}

		// 🔐 Изоляция режимов: закрытые компании не должны находиться как
		// «ближайший магазин» в публичных клиентах, а закрытому приложению —
		// только его компания.
		query += " AND " + modeCondition(c, "companies", &args)
		argCounter := len(args) + 1

		// Фильтр по району (если указан)
		if district != "" {
			query += fmt.Sprintf(" AND (district = $%d OR region = $%d)", argCounter, argCounter)
			args = append(args, district)
			argCounter++
		}

		// Исключаем текущую компанию
		if excludeID != "" {
			query += fmt.Sprintf(" AND id != $%d", argCounter)
			args = append(args, excludeID)
			argCounter++
		}

		query += " ORDER BY distance ASC LIMIT 1"

		log.Printf("🔍 Searching nearest company: lat=%s, lng=%s, district=%s, excludeId=%s", lat, lng, district, excludeID)

		var company struct {
			ID              int64
			Name            string
			Phone           string
			Address         sql.NullString
			Latitude        sql.NullFloat64
			Longitude       sql.NullFloat64
			District        sql.NullString
			Region          sql.NullString
			DeliveryEnabled bool
			Distance        float64
		}

		err := db.QueryRow(query, args...).Scan(
			&company.ID,
			&company.Name,
			&company.Phone,
			&company.Address,
			&company.Latitude,
			&company.Longitude,
			&company.District,
			&company.Region,
			&company.DeliveryEnabled,
			&company.Distance,
		)

		if err == sql.ErrNoRows {
			log.Printf("ℹ️ No nearby companies found for lat=%s, lng=%s, district=%s", lat, lng, district)
			c.JSON(http.StatusNotFound, gin.H{"error": "No nearby companies found"})
			return
		}

		if err != nil {
			log.Printf("❌ GetNearestCompany: Query failed: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to find nearest company"})
			return
		}

		response := map[string]interface{}{
			"id":              company.ID,
			"name":            company.Name,
			"phone":           company.Phone,
			"distance":        fmt.Sprintf("%.2f", company.Distance), // км с 2 знаками
			"deliveryEnabled": company.DeliveryEnabled,
		}

		if company.Address.Valid {
			response["address"] = company.Address.String
		}
		if company.Latitude.Valid {
			response["latitude"] = company.Latitude.Float64
		}
		if company.Longitude.Valid {
			response["longitude"] = company.Longitude.Float64
		}
		if company.District.Valid {
			response["district"] = company.District.String
		}
		if company.Region.Valid {
			response["region"] = company.Region.String
		}

		log.Printf("✅ Found nearest company: %s (ID: %d, Distance: %.2f km)", company.Name, company.ID, company.Distance)

		c.JSON(http.StatusOK, response)
	}
}

// generatePrivateCode - генерирует уникальный код для приватной компании
func generatePrivateCode(db *sql.DB) string {
	rand.Seed(time.Now().UnixNano())

	for {
		// Генерируем случайное число от 10000 до 999999 (5-6 цифр)
		code := fmt.Sprintf("%d", rand.Intn(990000)+10000)

		// Проверяем уникальность
		var exists bool
		err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM companies WHERE private_code = $1)", code).Scan(&exists)

		if err != nil || !exists {
			return code
		}
	}
}

// 🔍 VerifyPrivateCode - проверяет код приватной компании
func VerifyPrivateCode(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			PrivateCode string `json:"privateCode" binding:"required"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		var companyID int64
		var companyName string
		var logoURL sql.NullString

		err := db.QueryRow(`
			SELECT id, name, logo_url 
			FROM companies 
			WHERE private_code = $1 AND mode = 'private'
		`, req.PrivateCode).Scan(&companyID, &companyName, &logoURL)

		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Invalid private code"})
			return
		}

		if err != nil {
			log.Printf("❌ VerifyPrivateCode: Database error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify code"})
			return
		}

		response := gin.H{
			"success":   true,
			"companyId": companyID,
			"name":      companyName,
		}

		if logoURL.Valid {
			response["logoUrl"] = logoURL.String
		}

		c.JSON(http.StatusOK, response)
	}
}

// RateCompany - поставить оценку компании
func RateCompany(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyIDStr := c.Param("id")

		var req struct {
			UserPhone string `json:"user_phone" binding:"required"`
			UserName  string `json:"user_name"`
			Rating    int    `json:"rating" binding:"required,min=1,max=5"`
			Comment   string `json:"comment"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			log.Printf("❌ RateCompany: Invalid request: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data"})
			return
		}

		log.Printf("⭐ RateCompany called for company %s by user %s (rating: %d)",
			companyIDStr, req.UserPhone, req.Rating)

		// Вставляем или обновляем оценку + отзыв
		_, err := db.Exec(`
			INSERT INTO company_ratings (company_id, user_phone, user_name, rating, comment, updated_at)
			VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
			ON CONFLICT (company_id, user_phone)
			DO UPDATE SET rating = $4, comment = $5, user_name = $3, updated_at = CURRENT_TIMESTAMP
		`, companyIDStr, req.UserPhone, req.UserName, req.Rating, req.Comment)

		if err != nil {
			log.Printf("❌ RateCompany: Failed to save rating: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save rating"})
			return
		}

		// Получаем обновленный средний рейтинг
		var avgRating float64
		var ratingCount int
		err = db.QueryRow(`
			SELECT COALESCE(AVG(rating), 0), COUNT(*) 
			FROM company_ratings 
			WHERE company_id = $1
		`, companyIDStr).Scan(&avgRating, &ratingCount)

		if err != nil {
			log.Printf("❌ RateCompany: Failed to get average rating: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get rating"})
			return
		}

		log.Printf("✅ RateCompany: Rating saved. New average: %.2f (%d ratings)", avgRating, ratingCount)
		c.JSON(http.StatusOK, gin.H{
			"message":      "Rating saved successfully",
			"averageRating": avgRating,
			"ratingCount":   ratingCount,
		})
	}
}

// GetCompanyReviews — список отзывов магазина (оценки с текстом).
func GetCompanyReviews(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		companyID := c.Param("id")

		rows, err := db.Query(`
			SELECT COALESCE(cr.user_name, '') AS user_name,
			       cr.user_phone,
			       cr.rating,
			       COALESCE(cr.comment, '') AS comment,
			       COALESCE(cr.updated_at, cr.created_at) AS created_at,
			       COALESCE(u.avatar_url, '') AS user_avatar_url
			FROM company_ratings cr
			LEFT JOIN users u ON u.phone = cr.user_phone
			WHERE cr.company_id = $1 AND COALESCE(cr.comment, '') <> ''
			ORDER BY COALESCE(cr.updated_at, cr.created_at) DESC
			LIMIT 100
		`, companyID)
		if err != nil {
			log.Printf("❌ GetCompanyReviews: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load reviews"})
			return
		}
		defer rows.Close()

		reviews := make([]gin.H, 0)
		for rows.Next() {
			var userName, userPhone, comment, avatarURL string
			var rating int
			var createdAt time.Time
			if err := rows.Scan(&userName, &userPhone, &rating, &comment, &createdAt, &avatarURL); err != nil {
				continue
			}
			reviews = append(reviews, gin.H{
				"user_name":       userName,
				"user_phone":      userPhone,
				"rating":          rating,
				"comment":         comment,
				"created_at":      createdAt,
				"user_avatar_url": avatarURL,
			})
		}

		c.JSON(http.StatusOK, gin.H{"reviews": reviews})
	}
}
