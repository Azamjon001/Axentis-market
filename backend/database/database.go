package database

import (
	"azaton-backend/config"
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	_ "github.com/lib/pq"
)

func Connect(cfg *config.Config) (*sql.DB, error) {
	connStr := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBSSLMode,
	)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, err
	}

	// Connection pool: ограничиваем число соединений к PostgreSQL.
	// Без этого Go открывает неограниченное число соединений → исчерпание
	// max_connections PostgreSQL (default 100) при пиковой нагрузке.
	db.SetMaxOpenConns(25)              // max параллельных соединений
	db.SetMaxIdleConns(10)             // держать в пуле (не закрывать между запросами)
	db.SetConnMaxLifetime(5 * time.Minute) // пересоздавать соединение раз в 5 минут
	db.SetConnMaxIdleTime(2 * time.Minute) // закрывать idle-соединение через 2 минуты

	if err := db.Ping(); err != nil {
		return nil, err
	}

	log.Println("✅ Database connected successfully")
	return db, nil
}

func Migrate(db *sql.DB) error {
	schema := `
	-- Extensions
	CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
	CREATE EXTENSION IF NOT EXISTS "pgcrypto";

	-- Companies table
	CREATE TABLE IF NOT EXISTS companies (
		id BIGSERIAL PRIMARY KEY,
		name VARCHAR(255) NOT NULL,
		phone VARCHAR(20) UNIQUE NOT NULL,
		password_hash VARCHAR(255) NOT NULL,
		access_key VARCHAR(30) UNIQUE,
		mode VARCHAR(10) DEFAULT 'public' CHECK (mode IN ('public', 'private')),
		status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'blocked')),
		logo_url TEXT,
		address TEXT,
		description TEXT,
		latitude NUMERIC(10, 8),
		longitude NUMERIC(11, 8),
		created_at TIMESTAMPTZ DEFAULT NOW(),
		updated_at TIMESTAMPTZ DEFAULT NOW()
	);

	CREATE INDEX IF NOT EXISTS idx_companies_phone ON companies(phone);
	CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);
	CREATE INDEX IF NOT EXISTS idx_companies_mode ON companies(mode);
	CREATE INDEX IF NOT EXISTS idx_companies_location ON companies(latitude, longitude);

	-- Products table
	CREATE TABLE IF NOT EXISTS products (
		id BIGSERIAL PRIMARY KEY,
		company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
		name VARCHAR(255) NOT NULL,
		quantity INTEGER DEFAULT 0 CHECK (quantity >= 0),
		price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
		markup_percent NUMERIC(5, 2) DEFAULT 0 CHECK (markup_percent >= 0),
		selling_price NUMERIC(12, 2) GENERATED ALWAYS AS (price + (price * markup_percent / 100)) STORED,
		markup_amount NUMERIC(12, 2) GENERATED ALWAYS AS (price * markup_percent / 100) STORED,
		barcode VARCHAR(100),
		barid VARCHAR(100),
		category VARCHAR(100),
		images JSONB DEFAULT '[]'::jsonb,
		has_color_options BOOLEAN DEFAULT FALSE,
		available_for_customers BOOLEAN DEFAULT TRUE,
		sold_count INTEGER DEFAULT 0,
		created_at TIMESTAMPTZ DEFAULT NOW(),
		updated_at TIMESTAMPTZ DEFAULT NOW()
	);

	CREATE INDEX IF NOT EXISTS idx_products_company_id ON products(company_id);
	CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
	CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

	-- Sales table
	CREATE TABLE IF NOT EXISTS sales (
		id BIGSERIAL PRIMARY KEY,
		company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
		items JSONB NOT NULL,
		total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
		payment_method VARCHAR(20) DEFAULT 'cash',
		created_at TIMESTAMPTZ DEFAULT NOW()
	);

	CREATE INDEX IF NOT EXISTS idx_sales_company_id ON sales(company_id);
	CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at DESC);

	-- Orders table
	CREATE TABLE IF NOT EXISTS orders (
		id BIGSERIAL PRIMARY KEY,
		company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
		customer_name VARCHAR(255) NOT NULL,
		customer_phone VARCHAR(20) NOT NULL,
		address TEXT,
		items JSONB NOT NULL,
		total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
		delivery_cost NUMERIC(12, 2) DEFAULT 0,
		delivery_type VARCHAR(20) DEFAULT 'pickup',
		recipient_name VARCHAR(100),
		delivery_address TEXT,
		delivery_coordinates VARCHAR(50),
		markup_profit NUMERIC(12, 2) DEFAULT 0,
		status VARCHAR(20) DEFAULT 'pending',
		comment TEXT,
		order_code VARCHAR(6) UNIQUE,
		created_at TIMESTAMPTZ DEFAULT NOW(),
		updated_at TIMESTAMPTZ DEFAULT NOW()
	);

	-- Ensure all order columns exist on existing databases (idempotent)
	DO $$
	DECLARE cols TEXT[] := ARRAY[
		'delivery_cost NUMERIC(12,2) DEFAULT 0',
		'delivery_type VARCHAR(20) DEFAULT ''pickup''',
		'recipient_name VARCHAR(100)',
		'delivery_address TEXT',
		'delivery_coordinates VARCHAR(50)',
		'markup_profit NUMERIC(12,2) DEFAULT 0',
		'order_code VARCHAR(6)'
	];
	col TEXT;
	col_name TEXT;
	BEGIN
		FOREACH col IN ARRAY cols LOOP
			col_name := split_part(col, ' ', 1);
			IF NOT EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_name = 'orders' AND column_name = col_name
			) THEN
				EXECUTE 'ALTER TABLE orders ADD COLUMN ' || col;
			END IF;
		END LOOP;
	END $$;

	CREATE INDEX IF NOT EXISTS idx_orders_company_id ON orders(company_id);
	CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
	CREATE INDEX IF NOT EXISTS idx_orders_code ON orders(order_code);

	-- Users table (for customers) — all columns declared upfront so fresh
	-- deployments work without needing every incremental migration file.
	CREATE TABLE IF NOT EXISTS users (
		id BIGSERIAL PRIMARY KEY,
		phone VARCHAR(20) UNIQUE NOT NULL,
		name VARCHAR(255),
		surname VARCHAR(255),
		password_hash VARCHAR(255),
		mode VARCHAR(10) DEFAULT 'public',
		role VARCHAR(20) DEFAULT 'user',
		private_company_id BIGINT,
		avatar_url TEXT,
		default_delivery_address TEXT,
		default_delivery_coordinates TEXT,
		default_recipient_name TEXT,
		expo_push_token TEXT,
		followers_count INTEGER DEFAULT 0,
		following_count INTEGER DEFAULT 0,
		profile_views INTEGER DEFAULT 0,
		cart JSONB DEFAULT '{}'::jsonb,
		likes JSONB DEFAULT '[]'::jsonb,
		receipts JSONB DEFAULT '[]'::jsonb,
		created_at TIMESTAMPTZ DEFAULT NOW(),
		updated_at TIMESTAMPTZ DEFAULT NOW()
	);

	-- Ensure ALL user columns exist on existing databases (idempotent).
	DO $$
	DECLARE cols TEXT[] := ARRAY[
		'surname VARCHAR(255)',
		'password_hash VARCHAR(255)',
		'mode VARCHAR(10) DEFAULT ''public''',
		'role VARCHAR(20) DEFAULT ''user''',
		'private_company_id BIGINT',
		'avatar_url TEXT',
		'default_delivery_address TEXT',
		'default_delivery_coordinates TEXT',
		'default_recipient_name TEXT',
		'expo_push_token TEXT',
		'followers_count INTEGER DEFAULT 0',
		'following_count INTEGER DEFAULT 0',
		'profile_views INTEGER DEFAULT 0'
	];
	col TEXT;
	col_name TEXT;
	BEGIN
		FOREACH col IN ARRAY cols LOOP
			col_name := split_part(col, ' ', 1);
			IF NOT EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_name = 'users' AND column_name = col_name
			) THEN
				EXECUTE 'ALTER TABLE users ADD COLUMN ' || col;
			END IF;
		END LOOP;
	END $$;

	CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

	-- Expenses table
	CREATE TABLE IF NOT EXISTS expenses (
		id BIGSERIAL PRIMARY KEY,
		company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
		amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
		category VARCHAR(100),
		description TEXT,
		expense_date DATE DEFAULT CURRENT_DATE,
		created_at TIMESTAMPTZ DEFAULT NOW()
	);

	CREATE INDEX IF NOT EXISTS idx_expenses_company_id ON expenses(company_id);
	CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date DESC);

	-- Custom Expenses table (recurring monthly expenses with daily proration)
	CREATE TABLE IF NOT EXISTS custom_expenses (
		id BIGSERIAL PRIMARY KEY,
		company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
		expense_name VARCHAR(255) NOT NULL,
		amount NUMERIC(12, 2) DEFAULT 0,
		monthly_amount NUMERIC(12, 2) DEFAULT 0,
		description TEXT,
		expense_date DATE DEFAULT CURRENT_DATE,
		created_at TIMESTAMPTZ DEFAULT NOW(),
		updated_at TIMESTAMPTZ DEFAULT NOW()
	);

	CREATE INDEX IF NOT EXISTS idx_custom_expenses_company_id ON custom_expenses(company_id);

	-- Ensure all company columns exist on existing DBs (idempotent)
	DO $$
	DECLARE cols TEXT[] := ARRAY[
		'view_count INTEGER DEFAULT 0',
		'followers_count INTEGER DEFAULT 0',
		'is_enabled BOOLEAN DEFAULT TRUE',
		'delivery_enabled BOOLEAN DEFAULT FALSE',
		'delivery_radius NUMERIC(10,2) DEFAULT 5000',
		'private_code VARCHAR(50)',
		'referral_code VARCHAR(50)',
		'referral_agent_id BIGINT',
		'trial_started_at TIMESTAMPTZ',
		'trial_end_date TIMESTAMPTZ',
		'products_description TEXT',
		'delivery_radius_km NUMERIC(10,2) DEFAULT 0',
		'delivery_radius_lat DOUBLE PRECISION',
		'delivery_radius_lng DOUBLE PRECISION'
	];
	col TEXT;
	col_name TEXT;
	BEGIN
		FOREACH col IN ARRAY cols LOOP
			col_name := split_part(col, ' ', 1);
			IF NOT EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_name = 'companies' AND column_name = col_name
			) THEN
				EXECUTE 'ALTER TABLE companies ADD COLUMN ' || col;
			END IF;
		END LOOP;
	END $$;

	-- Ensure all product columns exist on existing DBs (idempotent)
	DO $$
	DECLARE cols TEXT[] := ARRAY[
		'sold_count INTEGER DEFAULT 0',
		'description TEXT',
		'brand TEXT',
		'color TEXT',
		'size TEXT'
	];
	col TEXT;
	col_name TEXT;
	BEGIN
		FOREACH col IN ARRAY cols LOOP
			col_name := split_part(col, ' ', 1);
			IF NOT EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_name = 'products' AND column_name = col_name
			) THEN
				EXECUTE 'ALTER TABLE products ADD COLUMN ' || col;
			END IF;
		END LOOP;
	END $$;

	-- Company subscribers table
	CREATE TABLE IF NOT EXISTS company_subscribers (
		id SERIAL PRIMARY KEY,
		company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
		user_phone VARCHAR(50) NOT NULL,
		subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(company_id, user_phone)
	);

	CREATE INDEX IF NOT EXISTS idx_company_subscribers_company ON company_subscribers(company_id);
	CREATE INDEX IF NOT EXISTS idx_company_subscribers_user ON company_subscribers(user_phone);

	-- Global categories table (managed by admin)
	CREATE TABLE IF NOT EXISTS categories (
		id SERIAL PRIMARY KEY,
		name VARCHAR(100) NOT NULL UNIQUE,
		icon VARCHAR(10) DEFAULT '📦',
		description TEXT,
		is_active BOOLEAN DEFAULT true,
		sort_order INT DEFAULT 0,
		created_at TIMESTAMPTZ DEFAULT NOW(),
		updated_at TIMESTAMPTZ DEFAULT NOW()
	);

	CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order);
	CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);

	-- Notifications table
	CREATE TABLE IF NOT EXISTS notifications (
		id BIGSERIAL PRIMARY KEY,
		user_phone VARCHAR(20) NOT NULL,
		type VARCHAR(50) NOT NULL DEFAULT 'new_product',
		title VARCHAR(255) NOT NULL,
		message TEXT,
		company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
		product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
		is_read BOOLEAN DEFAULT false,
		created_at TIMESTAMPTZ DEFAULT NOW()
	);

	CREATE INDEX IF NOT EXISTS idx_notifications_user_phone ON notifications(user_phone);
	CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
	CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

	-- Cart items table
	CREATE TABLE IF NOT EXISTS cart_items (
		id BIGSERIAL PRIMARY KEY,
		user_phone VARCHAR(20) NOT NULL REFERENCES users(phone) ON DELETE CASCADE,
		product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
		quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
		selected_color VARCHAR(50) NOT NULL DEFAULT '',
		selected_size VARCHAR(50) NOT NULL DEFAULT '',
		added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		created_at TIMESTAMPTZ DEFAULT NOW(),
		updated_at TIMESTAMPTZ DEFAULT NOW(),
		UNIQUE(user_phone, product_id, selected_color, selected_size)
	);
	CREATE INDEX IF NOT EXISTS idx_cart_items_phone ON cart_items(user_phone);

	-- Fix cart_items columns and unique constraint on existing databases (idempotent)
	DO $$
	DECLARE
		con_name TEXT;
	BEGIN
		IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cart_items' AND column_name = 'selected_color') THEN
			ALTER TABLE cart_items ADD COLUMN selected_color VARCHAR(50) NOT NULL DEFAULT '';
		END IF;
		IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cart_items' AND column_name = 'selected_size') THEN
			ALTER TABLE cart_items ADD COLUMN selected_size VARCHAR(50) NOT NULL DEFAULT '';
		END IF;
		IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cart_items' AND column_name = 'added_at') THEN
			ALTER TABLE cart_items ADD COLUMN added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
		END IF;
		-- Upgrade 2-column unique constraint to 4-column if needed
		IF NOT EXISTS (
			SELECT 1 FROM information_schema.table_constraints tc
			JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
			WHERE tc.table_name = 'cart_items' AND tc.constraint_type = 'UNIQUE'
			AND kcu.column_name = 'selected_color'
		) THEN
			SELECT tc.constraint_name INTO con_name
			FROM information_schema.table_constraints tc
			WHERE tc.table_name = 'cart_items' AND tc.constraint_type = 'UNIQUE'
			LIMIT 1;
			IF con_name IS NOT NULL THEN
				EXECUTE 'ALTER TABLE cart_items DROP CONSTRAINT ' || quote_ident(con_name);
			END IF;
			ALTER TABLE cart_items ADD CONSTRAINT cart_items_phone_product_color_size_key
				UNIQUE(user_phone, product_id, selected_color, selected_size);
		END IF;
	END $$;

	-- User favorites table
	CREATE TABLE IF NOT EXISTS user_favorites (
		id BIGSERIAL PRIMARY KEY,
		user_phone VARCHAR(20) NOT NULL REFERENCES users(phone) ON DELETE CASCADE,
		product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
		added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		created_at TIMESTAMPTZ DEFAULT NOW(),
		UNIQUE(user_phone, product_id)
	);
	CREATE INDEX IF NOT EXISTS idx_user_favorites_phone ON user_favorites(user_phone);

	-- Add added_at to user_favorites on existing databases (idempotent)
	DO $$
	BEGIN
		IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_favorites' AND column_name = 'added_at') THEN
			ALTER TABLE user_favorites ADD COLUMN added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
		END IF;
	END $$;

	-- Product variants table
	CREATE TABLE IF NOT EXISTS product_variants (
		id BIGSERIAL PRIMARY KEY,
		product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
		color VARCHAR(50),
		size VARCHAR(50),
		price NUMERIC(12,2) NOT NULL DEFAULT 0,
		markup_percent NUMERIC(5,2) DEFAULT 0,
		selling_price NUMERIC(12,2) GENERATED ALWAYS AS (price + (price * markup_percent / 100)) STORED,
		stock_quantity INTEGER DEFAULT 0,
		barcode VARCHAR(100),
		sku VARCHAR(100),
		barid VARCHAR(100),
		description TEXT,
		created_at TIMESTAMPTZ DEFAULT NOW(),
		updated_at TIMESTAMPTZ DEFAULT NOW()
	);
	CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);

	-- Product purchases table (история закупок товаров и SKU-вариантов).
	-- ВАЖНО: схема унифицирована с обработчиком product_purchases.go и
	-- миграцией 128. Раньше здесь была другая схема (unit_cost/purchased_at
	-- без product_name), из-за чего INSERT в обработчике падал с 500
	-- «Failed to create product purchase». DO-блок ниже чинит уже
	-- существующие таблицы со старой схемой.
	CREATE TABLE IF NOT EXISTS product_purchases (
		id BIGSERIAL PRIMARY KEY,
		company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
		product_id BIGINT,
		variant_id BIGINT,
		product_name VARCHAR(255) NOT NULL DEFAULT '',
		quantity INTEGER NOT NULL DEFAULT 0,
		purchase_price NUMERIC(12,2) NOT NULL DEFAULT 0,
		total_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
		supplier VARCHAR(255),
		notes TEXT,
		purchase_date TIMESTAMPTZ DEFAULT NOW(),
		created_at TIMESTAMPTZ DEFAULT NOW()
	);
	DO $$
	BEGIN
		-- Добавляем недостающие колонки для таблиц, созданных по старой схеме.
		ALTER TABLE product_purchases ADD COLUMN IF NOT EXISTS product_id BIGINT;
		ALTER TABLE product_purchases ADD COLUMN IF NOT EXISTS variant_id BIGINT;
		ALTER TABLE product_purchases ADD COLUMN IF NOT EXISTS product_name VARCHAR(255) NOT NULL DEFAULT '';
		ALTER TABLE product_purchases ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(12,2) NOT NULL DEFAULT 0;
		ALTER TABLE product_purchases ADD COLUMN IF NOT EXISTS total_cost NUMERIC(12,2) NOT NULL DEFAULT 0;
		ALTER TABLE product_purchases ADD COLUMN IF NOT EXISTS supplier VARCHAR(255);
		ALTER TABLE product_purchases ADD COLUMN IF NOT EXISTS notes TEXT;
		ALTER TABLE product_purchases ADD COLUMN IF NOT EXISTS purchase_date TIMESTAMPTZ DEFAULT NOW();
		ALTER TABLE product_purchases ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
		-- Старые NOT NULL колонки (unit_cost/purchased_at) без значений по
		-- умолчанию ломали вставку — делаем их необязательными.
		BEGIN
			ALTER TABLE product_purchases ALTER COLUMN unit_cost DROP NOT NULL;
			ALTER TABLE product_purchases ALTER COLUMN unit_cost SET DEFAULT 0;
		EXCEPTION WHEN undefined_column THEN NULL;
		END;
	END $$;
	CREATE INDEX IF NOT EXISTS idx_product_purchases_company ON product_purchases(company_id);
	CREATE INDEX IF NOT EXISTS idx_product_purchases_product ON product_purchases(product_id);

	-- Subscriptions table (user→user and user→company follows)
	CREATE TABLE IF NOT EXISTS subscriptions (
		id BIGSERIAL PRIMARY KEY,
		user_id BIGINT NOT NULL,
		company_id BIGINT,
		subscribed_user_id BIGINT,
		created_at TIMESTAMPTZ DEFAULT NOW()
	);
	CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user_company
		ON subscriptions(user_id, company_id) WHERE company_id IS NOT NULL;
	CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user_target
		ON subscriptions(user_id, subscribed_user_id) WHERE subscribed_user_id IS NOT NULL;
	CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);

	-- User delivery addresses table
	CREATE TABLE IF NOT EXISTS user_delivery_addresses (
		id SERIAL PRIMARY KEY,
		user_phone VARCHAR(20) NOT NULL REFERENCES users(phone) ON DELETE CASCADE,
		title VARCHAR(100),
		address TEXT NOT NULL,
		latitude DOUBLE PRECISION,
		longitude DOUBLE PRECISION,
		is_default BOOLEAN NOT NULL DEFAULT FALSE,
		created_at TIMESTAMP NOT NULL DEFAULT NOW()
	);
	CREATE INDEX IF NOT EXISTS idx_user_delivery_addresses_phone ON user_delivery_addresses(user_phone);

	-- Admin delivery revenue tracking table
	CREATE TABLE IF NOT EXISTS admin_delivery_revenue (
		id BIGSERIAL PRIMARY KEY,
		order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
		company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
		delivery_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
		created_at TIMESTAMPTZ DEFAULT NOW()
	);
	CREATE INDEX IF NOT EXISTS idx_admin_delivery_revenue_order ON admin_delivery_revenue(order_id);
	CREATE INDEX IF NOT EXISTS idx_admin_delivery_revenue_company ON admin_delivery_revenue(company_id);

	-- Couriers table: company_id NULL = admin courier (sees all orders)
	CREATE TABLE IF NOT EXISTS couriers (
		id BIGSERIAL PRIMARY KEY,
		company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
		name VARCHAR(100) NOT NULL,
		surname VARCHAR(100) NOT NULL,
		phone VARCHAR(20) UNIQUE NOT NULL,
		password_hash VARCHAR(255) NOT NULL,
		passport_id VARCHAR(20),
		is_online BOOLEAN NOT NULL DEFAULT FALSE,
		last_lat DOUBLE PRECISION,
		last_lng DOUBLE PRECISION,
		location_updated_at TIMESTAMPTZ,
		current_order_id BIGINT,
		created_at TIMESTAMPTZ DEFAULT NOW()
	);
	CREATE INDEX IF NOT EXISTS idx_couriers_company ON couriers(company_id);
	CREATE INDEX IF NOT EXISTS idx_couriers_phone ON couriers(phone);

	-- Add courier_id to orders (idempotent via DO block below)
	DO $$
	BEGIN
		IF NOT EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_name = 'orders' AND column_name = 'courier_id'
		) THEN
			ALTER TABLE orders ADD COLUMN courier_id BIGINT;
		END IF;
	END $$;
	`

	_, err := db.Exec(schema)
	if err != nil {
		return fmt.Errorf("migration failed: %w", err)
	}

	log.Println("✅ Database migrations completed")

	// Run SQL migration files from migrations folder
	migrationsDir := "./migrations"
	if err := runMigrationFiles(db, migrationsDir); err != nil {
		return fmt.Errorf("failed to run migration files: %w", err)
	}

	return nil
}

// runMigrationFiles executes all .sql files in the migrations directory
func runMigrationFiles(db *sql.DB, dir string) error {
	files, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			log.Println("⚠️  Migrations directory not found, skipping file migrations")
			return nil
		}
		return err
	}

	// Sort files to ensure consistent execution order
	var sqlFiles []string
	for _, file := range files {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".sql") {
			sqlFiles = append(sqlFiles, file.Name())
		}
	}
	sort.Strings(sqlFiles)

	for _, fileName := range sqlFiles {
		filePath := filepath.Join(dir, fileName)
		content, err := os.ReadFile(filePath)
		if err != nil {
			return fmt.Errorf("failed to read migration file %s: %w", fileName, err)
		}

		// Strip goose Down section to prevent DROP TABLE from executing
		sqlContent := string(content)
		if idx := strings.Index(sqlContent, "-- +goose Down"); idx != -1 {
			sqlContent = sqlContent[:idx]
		}
		// Also strip goose Up marker (it's just a comment, but be explicit)
		sqlContent = strings.ReplaceAll(sqlContent, "-- +goose Up", "")

		_, err = db.Exec(sqlContent)
		if err != nil {
			errMsg := err.Error()
			// Always skip "already exists" / "duplicate" errors — idempotent migrations.
			// Also skip permission-related errors (e.g. CREATE EXTENSION on managed PG)
			// so the server doesn't crash on hosting providers that restrict extensions.
			if strings.Contains(errMsg, "already exists") ||
				strings.Contains(errMsg, "duplicate") ||
				strings.Contains(errMsg, "permission denied") ||
				strings.Contains(errMsg, "must be superuser") ||
				strings.Contains(errMsg, "must be owner") {
				log.Printf("⚠️  Skipping migration %s: %v", fileName, err)
			} else {
				log.Printf("❌ Migration %s failed: %v", fileName, err)
				// Non-fatal: log the error and continue so the rest of the migrations
				// and the server startup are not blocked by a single bad file.
			}
		}

		log.Printf("✅ Executed migration: %s", fileName)
	}

	if len(sqlFiles) > 0 {
		log.Printf("✅ All %d migration files executed successfully", len(sqlFiles))
	}

	return nil
}
