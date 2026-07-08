package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type Category struct {
	ID          int       `json:"id"`
	Name        string    `json:"name"`
	Icon        string    `json:"icon"`
	Description *string   `json:"description,omitempty"`
	IsActive    bool      `json:"isActive"`
	SortOrder   int       `json:"sortOrder"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// GetCategories - получить все категории
func GetCategories(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		// Проверяем параметр activeOnly
		activeOnly := r.URL.Query().Get("activeOnly") == "true"

		query := `SELECT id, name, icon, description, is_active, sort_order, created_at, updated_at 
		          FROM categories`
		if activeOnly {
			query += " WHERE is_active = true"
		}
		query += " ORDER BY sort_order ASC, name ASC"

		rows, err := db.Query(query)
		if err != nil {
			log.Printf("Error getting categories: %v", err)
			http.Error(w, `{"error": "Failed to get categories"}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var categories []Category
		for rows.Next() {
			var c Category
			var desc sql.NullString
			err := rows.Scan(&c.ID, &c.Name, &c.Icon, &desc, &c.IsActive, &c.SortOrder, &c.CreatedAt, &c.UpdatedAt)
			if err != nil {
				log.Printf("Error scanning category: %v", err)
				continue
			}
			if desc.Valid {
				c.Description = &desc.String
			}
			categories = append(categories, c)
		}

		if categories == nil {
			categories = []Category{}
		}

		json.NewEncoder(w).Encode(categories)
	}
}

// CreateCategory - создать категорию (только админ)
func CreateCategory(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		var input struct {
			Name        string  `json:"name"`
			Icon        string  `json:"icon"`
			Description *string `json:"description"`
			SortOrder   int     `json:"sortOrder"`
		}

		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			http.Error(w, `{"error": "Invalid request body"}`, http.StatusBadRequest)
			return
		}

		input.Name = strings.TrimSpace(input.Name)
		if input.Name == "" {
			http.Error(w, `{"error": "Name is required"}`, http.StatusBadRequest)
			return
		}

		if input.Icon == "" {
			input.Icon = "📦"
		}

		var category Category
		err := db.QueryRow(`
			INSERT INTO categories (name, icon, description, sort_order)
			VALUES ($1, $2, $3, $4)
			RETURNING id, name, icon, description, is_active, sort_order, created_at, updated_at
		`, input.Name, input.Icon, input.Description, input.SortOrder).Scan(
			&category.ID, &category.Name, &category.Icon, &category.Description,
			&category.IsActive, &category.SortOrder, &category.CreatedAt, &category.UpdatedAt,
		)

		if err != nil {
			if strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "unique constraint") {
				http.Error(w, `{"error": "Category with this name already exists"}`, http.StatusConflict)
				return
			}
			log.Printf("Error creating category: %v", err)
			http.Error(w, `{"error": "Failed to create category"}`, http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(category)
	}
}

// UpdateCategory - обновить категорию (только админ)
func UpdateCategory(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		// Получаем ID из URL
		path := strings.TrimPrefix(r.URL.Path, "/api/categories/")
		id, err := strconv.Atoi(path)
		if err != nil {
			http.Error(w, `{"error": "Invalid category ID"}`, http.StatusBadRequest)
			return
		}

		var input struct {
			Name        *string `json:"name"`
			Icon        *string `json:"icon"`
			Description *string `json:"description"`
			IsActive    *bool   `json:"isActive"`
			SortOrder   *int    `json:"sortOrder"`
		}

		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			http.Error(w, `{"error": "Invalid request body"}`, http.StatusBadRequest)
			return
		}

		// Проверяем существование категории
		var exists bool
		db.QueryRow("SELECT EXISTS(SELECT 1 FROM categories WHERE id = $1)", id).Scan(&exists)
		if !exists {
			http.Error(w, `{"error": "Category not found"}`, http.StatusNotFound)
			return
		}

		// Обновляем только переданные поля
		if input.Name != nil {
			db.Exec("UPDATE categories SET name = $1, updated_at = NOW() WHERE id = $2", *input.Name, id)
		}
		if input.Icon != nil {
			db.Exec("UPDATE categories SET icon = $1, updated_at = NOW() WHERE id = $2", *input.Icon, id)
		}
		if input.Description != nil {
			db.Exec("UPDATE categories SET description = $1, updated_at = NOW() WHERE id = $2", *input.Description, id)
		}
		if input.IsActive != nil {
			db.Exec("UPDATE categories SET is_active = $1, updated_at = NOW() WHERE id = $2", *input.IsActive, id)
		}
		if input.SortOrder != nil {
			db.Exec("UPDATE categories SET sort_order = $1, updated_at = NOW() WHERE id = $2", *input.SortOrder, id)
		}

		// Возвращаем обновленную категорию
		var category Category
		err = db.QueryRow(`
			SELECT id, name, icon, description, is_active, sort_order, created_at, updated_at 
			FROM categories WHERE id = $1
		`, id).Scan(&category.ID, &category.Name, &category.Icon, &category.Description,
			&category.IsActive, &category.SortOrder, &category.CreatedAt, &category.UpdatedAt)

		if err != nil {
			http.Error(w, `{"error": "Failed to get updated category"}`, http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(category)
	}
}

// DeleteCategory - удалить категорию (только админ)
func DeleteCategory(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		// Получаем ID из URL
		path := strings.TrimPrefix(r.URL.Path, "/api/categories/")
		id, err := strconv.Atoi(path)
		if err != nil {
			http.Error(w, `{"error": "Invalid category ID"}`, http.StatusBadRequest)
			return
		}

		result, err := db.Exec("DELETE FROM categories WHERE id = $1", id)
		if err != nil {
			log.Printf("Error deleting category: %v", err)
			http.Error(w, `{"error": "Failed to delete category"}`, http.StatusInternalServerError)
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			http.Error(w, `{"error": "Category not found"}`, http.StatusNotFound)
			return
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"message": "Category deleted successfully"})
	}
}

// GetProductsByCategory - получить товары по категории
func GetProductsByCategory(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		q := r.URL.Query()
		category := q.Get("category")
		if category == "" {
			http.Error(w, `{"error": "Category parameter is required"}`, http.StatusBadRequest)
			return
		}

		// Сортировка/фильтры выполняются на стороне БД (по всему набору, а не по
		// одной странице) и опираются на индексы из миграции 220 — каталог остаётся
		// быстрым даже при десятках тысяч товаров.
		// Цена для фильтра/сортировки берётся на уровне товара (индексируемое
		// выражение); вариативная минимальная цена используется только для показа.
		priceSort := "COALESCE(NULLIF(p.selling_price,0), p.price * (1.0 + COALESCE(p.markup_percent,0)/100.0))"

		conds := []string{"p.category = $1", "p.available_for_customers = true"}
		args := []interface{}{category}
		add := func(cond string, val interface{}) {
			args = append(args, val)
			conds = append(conds, fmt.Sprintf(cond, len(args)))
		}
		if br := strings.TrimSpace(q.Get("brand")); br != "" {
			add("lower(p.brand) = lower($%d)", br)
		}
		if v, err := strconv.ParseFloat(q.Get("minPrice"), 64); err == nil && v >= 0 {
			add(priceSort+" >= $%d", v)
		}
		if v, err := strconv.ParseFloat(q.Get("maxPrice"), 64); err == nil && v > 0 {
			add(priceSort+" <= $%d", v)
		}
		if q.Get("inStock") == "true" {
			conds = append(conds, "(p.quantity > 0 OR EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.stock_quantity > 0))")
		}

		orderBy := "p.created_at DESC"
		switch q.Get("sort") {
		case "price_asc":
			orderBy = priceSort + " ASC, p.id DESC"
		case "price_desc":
			orderBy = priceSort + " DESC, p.id DESC"
		case "new":
			orderBy = "p.created_at DESC"
		case "popular":
			orderBy = "COALESCE(p.sold_count,0) DESC, p.created_at DESC"
		}

		limit, offset := 40, 0
		if v, err := strconv.Atoi(q.Get("limit")); err == nil && v > 0 && v <= 100 {
			limit = v
		}
		if v, err := strconv.Atoi(q.Get("offset")); err == nil && v >= 0 {
			offset = v
		}
		args = append(args, limit, offset)

		query := fmt.Sprintf(`
			SELECT p.id, p.company_id, p.name, p.quantity, p.price, p.markup_percent,
			       COALESCE(
			           NULLIF((SELECT MIN(pv.selling_price) FROM product_variants pv WHERE pv.product_id = p.id AND pv.selling_price > 0), 0),
			           NULLIF(p.selling_price, 0),
			           p.price * (1.0 + COALESCE(p.markup_percent, 0) / 100.0)
			       ) AS selling_price,
			       p.markup_amount, p.barcode, p.barid, p.category, p.images,
			       p.description, p.brand, p.has_color_options, p.available_for_customers,
			       COALESCE(p.sold_count, 0) AS sold_count, p.created_at, p.updated_at,
			       c.name AS company_name,
			       COALESCE((SELECT AVG(cr.rating) FROM company_ratings cr WHERE cr.company_id = c.id), 0) AS company_rating
			FROM products p
			LEFT JOIN companies c ON p.company_id = c.id
			WHERE %s
			ORDER BY %s
			LIMIT $%d OFFSET $%d
		`, strings.Join(conds, " AND "), orderBy, len(args)-1, len(args))

		rows, err := db.Query(query, args...)

		if err != nil {
			log.Printf("Error getting products by category: %v", err)
			http.Error(w, `{"error": "Failed to get products"}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var products []map[string]interface{}
		for rows.Next() {
			var (
				id, companyID                                 int64
				name, companyName                             string
				quantity                                      int
				soldCount                                     int64
				price, markupPercent, sellingPrice, markupAmt float64
				companyRating                                 float64
				barcode, barid, cat, images, desc, brand      sql.NullString
				hasColorOptions, availableForCustomers        bool
				createdAt, updatedAt                          time.Time
			)

			err := rows.Scan(&id, &companyID, &name, &quantity, &price, &markupPercent,
				&sellingPrice, &markupAmt, &barcode, &barid, &cat, &images,
				&desc, &brand, &hasColorOptions, &availableForCustomers,
				&soldCount, &createdAt, &updatedAt, &companyName, &companyRating)
			if err != nil {
				log.Printf("Error scanning product: %v", err)
				continue
			}

			product := map[string]interface{}{
				"id":                    id,
				"companyId":             companyID,
				"companyName":           companyName,
				"name":                  name,
				"quantity":              quantity,
				"price":                 price,
				"markupPercent":         markupPercent,
				"sellingPrice":          sellingPrice,
				"markupAmount":          markupAmt,
				"hasColorOptions":       hasColorOptions,
				"availableForCustomers": availableForCustomers,
				"soldCount":             soldCount,
				"companyRating":         companyRating,
				"createdAt":             createdAt,
				"updatedAt":             updatedAt,
			}

			if brand.Valid {
				product["brand"] = brand.String
			}
			if barcode.Valid {
				product["barcode"] = barcode.String
			}
			if barid.Valid {
				product["barid"] = barid.String
			}
			if cat.Valid {
				product["category"] = cat.String
			}
			if desc.Valid {
				product["description"] = desc.String
			}
			if images.Valid {
				var imagesArr []string
				if err := json.Unmarshal([]byte(images.String), &imagesArr); err == nil {
					product["images"] = imagesArr
				} else {
					product["images"] = []string{}
				}
			} else {
				product["images"] = []string{}
			}

			products = append(products, product)
		}

		if products == nil {
			products = []map[string]interface{}{}
		}

		json.NewEncoder(w).Encode(products)
	}
}

// UploadCategoryIcon - загрузка картинки-иконки категории (PNG/SVG), только админ.
// Возвращает {"url": "/uploads/categories/<file>"} для сохранения в поле icon.
func UploadCategoryIcon(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if err := r.ParseMultipartForm(5 << 20); err != nil { // до 5 МБ
			http.Error(w, `{"error": "File too large or invalid form"}`, http.StatusBadRequest)
			return
		}

		file, header, err := r.FormFile("file")
		if err != nil {
			http.Error(w, `{"error": "No file uploaded"}`, http.StatusBadRequest)
			return
		}
		defer file.Close()

		// Разрешаем только картинки
		ext := strings.ToLower(filepath.Ext(header.Filename))
		allowed := map[string]bool{".png": true, ".svg": true, ".jpg": true, ".jpeg": true, ".webp": true, ".gif": true}
		if !allowed[ext] {
			http.Error(w, `{"error": "Allowed: png, svg, jpg, jpeg, webp, gif"}`, http.StatusBadRequest)
			return
		}

		uploadDir := "./uploads/categories"
		if err := os.MkdirAll(uploadDir, 0755); err != nil {
			http.Error(w, `{"error": "Failed to create upload dir"}`, http.StatusInternalServerError)
			return
		}

		filename := fmt.Sprintf("cat_%d%s", time.Now().UnixNano(), ext)
		savePath := filepath.Join(uploadDir, filename)

		dst, err := os.Create(savePath)
		if err != nil {
			http.Error(w, `{"error": "Failed to save file"}`, http.StatusInternalServerError)
			return
		}
		defer dst.Close()
		if _, err := io.Copy(dst, file); err != nil {
			http.Error(w, `{"error": "Failed to write file"}`, http.StatusInternalServerError)
			return
		}

		url := "/uploads/categories/" + filename
		log.Printf("✅ Category icon uploaded: %s", url)
		json.NewEncoder(w).Encode(map[string]string{"url": url})
	}
}
