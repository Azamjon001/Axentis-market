-- Добавляем UNIQUE constraint для cart_items
-- Это необходимо для работы ON CONFLICT в SetCartItemQuantity

-- Сначала удаляем существующие дубликаты (если они есть)
DELETE FROM cart_items ci1
USING cart_items ci2
WHERE ci1.user_phone = ci2.user_phone 
  AND ci1.product_id = ci2.product_id
  AND COALESCE(ci1.selected_color, '') = COALESCE(ci2.selected_color, '')
  AND COALESCE(ci1.selected_size, '') = COALESCE(ci2.selected_size, '')
  AND ci1.id < ci2.id;  -- Удаляем старые записи, оставляем новые

-- Теперь добавляем UNIQUE constraint только если не существует
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'cart_items_user_product_variant_unique'
    ) THEN
        ALTER TABLE cart_items 
        ADD CONSTRAINT cart_items_user_product_variant_unique 
        UNIQUE (user_phone, product_id, selected_color, selected_size);
    END IF;
END $$;
