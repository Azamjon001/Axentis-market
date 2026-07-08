-- Таблица для корзины покупателей
CREATE TABLE IF NOT EXISTS cart_items (
    id SERIAL PRIMARY KEY,
    user_phone VARCHAR(20) NOT NULL,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    selected_color VARCHAR(50) NOT NULL DEFAULT '',
    selected_size VARCHAR(50) NOT NULL DEFAULT '',
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_phone, product_id, selected_color, selected_size)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_user ON cart_items(user_phone);
CREATE INDEX IF NOT EXISTS idx_cart_items_product ON cart_items(product_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_added_at ON cart_items(added_at DESC);

-- Таблица для избранных товаров (лайков)
CREATE TABLE IF NOT EXISTS user_favorites (
    id SERIAL PRIMARY KEY,
    user_phone VARCHAR(20) NOT NULL,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_phone, product_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON user_favorites(user_phone);
CREATE INDEX IF NOT EXISTS idx_favorites_product ON user_favorites(product_id);
CREATE INDEX IF NOT EXISTS idx_favorites_added_at ON user_favorites(added_at DESC);
