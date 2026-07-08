-- Удаляем старые дубликаты в корзине (оставляем только записи с пустыми color/size)
-- Это нужно если есть старые записи с заполненными color/size, но мы больше их не используем

DO $$
BEGIN
    -- Удаляем все записи где color или size НЕ пустые
    DELETE FROM cart_items 
    WHERE selected_color != '' OR selected_size != '';
    
    RAISE NOTICE 'Cleaned up cart items with non-empty color/size';
    
    -- Оставляем только одну запись для каждого (user_phone, product_id)
    -- Если есть несколько записей с пустыми color/size, оставляем самую свежую
    DELETE FROM cart_items ci1
    USING cart_items ci2
    WHERE ci1.user_phone = ci2.user_phone 
      AND ci1.product_id = ci2.product_id
      AND ci1.selected_color = ''
      AND ci1.selected_size = ''
      AND ci2.selected_color = ''
      AND ci2.selected_size = ''
      AND ci1.id < ci2.id;  -- Удаляем старые, оставляем новые
    
    RAISE NOTICE 'Removed duplicate cart items';
END $$;
