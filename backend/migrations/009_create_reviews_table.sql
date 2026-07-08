-- Создание таблицы отзывов (reviews)
CREATE TABLE IF NOT EXISTS reviews (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_phone VARCHAR(20) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для быстрого поиска отзывов
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_user_phone ON reviews(user_phone);

-- Комментарии к таблице
COMMENT ON TABLE reviews IS 'Отзывы пользователей о товарах';
COMMENT ON COLUMN reviews.product_id IS 'ID товара на который оставлен отзыв';
COMMENT ON COLUMN reviews.user_phone IS 'Телефон пользователя оставившего отзыв';
COMMENT ON COLUMN reviews.user_name IS 'Имя пользователя';
COMMENT ON COLUMN reviews.rating IS 'Оценка от 1 до 5 звезд';
COMMENT ON COLUMN reviews.comment IS 'Текст отзыва';
