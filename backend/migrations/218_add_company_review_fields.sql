-- Отзывы магазинам: к оценке (company_ratings) добавляем текст отзыва и имя автора.
ALTER TABLE company_ratings ADD COLUMN IF NOT EXISTS comment TEXT;
ALTER TABLE company_ratings ADD COLUMN IF NOT EXISTS user_name VARCHAR(255);
