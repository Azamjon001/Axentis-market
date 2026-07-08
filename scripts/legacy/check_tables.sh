#!/bin/bash
echo "=== Checking tables ==="
docker exec onlineshop2-postgres psql -U onlineshop2_user -d onlineshop2 -c "SELECT tablename FROM pg_tables WHERE tablename IN ('cart_items','user_favorites');"

echo "=== Creating tables if not exist ==="
docker exec onlineshop2-postgres psql -U onlineshop2_user -d onlineshop2 -c "
CREATE TABLE IF NOT EXISTS cart_items (
    id SERIAL PRIMARY KEY,
    user_phone VARCHAR(20) NOT NULL,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    selected_color VARCHAR(50),
    selected_size VARCHAR(50),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_phone, product_id, selected_color, selected_size)
);
CREATE INDEX IF NOT EXISTS idx_cart_items_user ON cart_items(user_phone);
CREATE INDEX IF NOT EXISTS idx_cart_items_product ON cart_items(product_id);

CREATE TABLE IF NOT EXISTS user_favorites (
    id SERIAL PRIMARY KEY,
    user_phone VARCHAR(20) NOT NULL,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_phone, product_id)
);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON user_favorites(user_phone);
CREATE INDEX IF NOT EXISTS idx_favorites_product ON user_favorites(product_id);
"

echo "=== Tables after creation ==="
docker exec onlineshop2-postgres psql -U onlineshop2_user -d onlineshop2 -c "SELECT tablename FROM pg_tables WHERE tablename IN ('cart_items','user_favorites');"
