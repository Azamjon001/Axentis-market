-- Добавление лайков и дизлайков к отзывам
ALTER TABLE reviews 
ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS dislikes INTEGER DEFAULT 0;

-- Создание таблицы для отслеживания кто лайкнул/дизлайкнул отзыв
CREATE TABLE IF NOT EXISTS review_votes (
    id BIGSERIAL PRIMARY KEY,
    review_id BIGINT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    user_phone VARCHAR(20) NOT NULL,
    vote_type VARCHAR(10) NOT NULL CHECK (vote_type IN ('like', 'dislike')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(review_id, user_phone)
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_review_votes_review_id ON review_votes(review_id);
CREATE INDEX IF NOT EXISTS idx_review_votes_user_phone ON review_votes(user_phone);
CREATE INDEX IF NOT EXISTS idx_reviews_likes ON reviews(likes DESC);

-- Комментарии к таблице
COMMENT ON TABLE review_votes IS 'Голоса пользователей за отзывы (лайки/дизлайки)';
COMMENT ON COLUMN review_votes.review_id IS 'ID отзыва';
COMMENT ON COLUMN review_votes.user_phone IS 'Телефон пользователя проголосовавшего';
COMMENT ON COLUMN review_votes.vote_type IS 'Тип голоса: like или dislike';
COMMENT ON COLUMN reviews.likes IS 'Количество лайков';
COMMENT ON COLUMN reviews.dislikes IS 'Количество дизлайков';
