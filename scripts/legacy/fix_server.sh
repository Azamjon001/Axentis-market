#!/bin/bash
echo "=== Step 1: Creating tables directly ==="
docker exec onlineshop2-postgres psql -U onlineshop2_user -d onlineshop2 << 'EOF'
CREATE TABLE IF NOT EXISTS cart_items (
    id SERIAL PRIMARY KEY,
    user_phone VARCHAR(20) NOT NULL,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    selected_color VARCHAR(50),
    selected_size VARCHAR(50),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_phone, product_id, COALESCE(selected_color,''), COALESCE(selected_size,''))
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

SELECT 'cart_items exists' WHERE EXISTS (SELECT FROM pg_tables WHERE tablename='cart_items');
SELECT 'user_favorites exists' WHERE EXISTS (SELECT FROM pg_tables WHERE tablename='user_favorites');
EOF

echo "=== Step 2: Rebuilding backend Docker image ==="
cd /root/Axentis-market
docker-compose build --no-cache backend
docker-compose up -d backend

echo "=== Step 3: Wait and check logs ==="
sleep 5
docker-compose logs --tail=20 backend
