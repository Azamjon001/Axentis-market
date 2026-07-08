-- ══════════════════════════════════════════════════════════════════════════
-- AXENTIS MARKET — авто-подстановка фото товаров
-- Ставит каждому товару БЕЗ фото подходящее по типу изображение предмета.
-- Источник: loremflickr.com (реальное фото по ключевому слову),
-- ?lock=<id> закрепляет конкретное изображение за товаром (стабильно).
-- Реальные (уже загруженные) фото НЕ затирает.
-- Запуск:
--   docker exec -i axentis-market-postgres \
--     psql -U onlineshop2_user -d onlineshop2 < backend/seeds/product_images.sql
-- ══════════════════════════════════════════════════════════════════════════

UPDATE products p
SET images = jsonb_build_array(
  'https://loremflickr.com/600/600/' ||
  CASE
    -- Электроника / техника
    WHEN t ILIKE '%смартфон%' OR t ILIKE '%iphone%' OR t ILIKE '%galaxy%' OR t ILIKE '%redmi%' THEN 'smartphone'
    WHEN t ILIKE '%ноутбук%' OR t ILIKE '%laptop%' OR t ILIKE '%macbook%' THEN 'laptop'
    WHEN t ILIKE '%планшет%' OR t ILIKE '%ipad%' THEN 'tablet'
    WHEN t ILIKE '%телевизор%' OR t ILIKE '%tv%' OR t ILIKE '%oled%' THEN 'television'
    WHEN t ILIKE '%кондиционер%' THEN 'air,conditioner'
    WHEN t ILIKE '%холодильник%' THEN 'refrigerator'
    WHEN t ILIKE '%стиральн%' THEN 'washing,machine'
    WHEN t ILIKE '%наушник%' OR t ILIKE '%airpods%' THEN 'headphones'
    WHEN t ILIKE '%роутер%' OR t ILIKE '%сеть%' OR t ILIKE '%связь%' THEN 'router'
    WHEN t ILIKE '%накопител%' OR t ILIKE '%hdd%' OR t ILIKE '%ssd%' OR t ILIKE '%флеш%' THEN 'harddrive'
    WHEN t ILIKE '%калькулятор%' THEN 'calculator'
    WHEN t ILIKE '%бытов%техник%' OR t ILIKE '%техника%' THEN 'appliance'
    -- Ювелирка / часы
    WHEN t ILIKE '%кольц%' THEN 'ring,jewelry'
    WHEN t ILIKE '%серьг%' OR t ILIKE '%серёг%' OR t ILIKE '%гвоздик%' THEN 'earrings'
    WHEN t ILIKE '%цепочк%' OR t ILIKE '%колье%' OR t ILIKE '%подвеск%' OR t ILIKE '%крестик%' THEN 'necklace'
    WHEN t ILIKE '%браслет%' THEN 'bracelet'
    WHEN t ILIKE '%часы%' THEN 'wristwatch'
    WHEN t ILIKE '%ювелир%' OR t ILIKE '%украшен%' THEN 'jewelry'
    -- Книги / канцелярия
    WHEN t ILIKE '%книга%' OR t ILIKE '%учебник%' THEN 'book'
    WHEN t ILIKE '%ручк%' THEN 'pen'
    WHEN t ILIKE '%ежедневник%' OR t ILIKE '%тетрад%' THEN 'notebook'
    WHEN t ILIKE '%маркер%' OR t ILIKE '%карандаш%' OR t ILIKE '%краск%' THEN 'art,supplies'
    WHEN t ILIKE '%рюкзак%' OR t ILIKE '%сумк%' THEN 'backpack'
    WHEN t ILIKE '%глобус%' THEN 'globe'
    WHEN t ILIKE '%канцеляр%' THEN 'stationery'
    -- Зоотовары
    WHEN t ILIKE '%корм%' THEN 'petfood'
    WHEN t ILIKE '%аквариум%' THEN 'aquarium'
    WHEN t ILIKE '%когтеточк%' OR t ILIKE '%лежанк%' OR t ILIKE '%переноск%' THEN 'cat'
    WHEN t ILIKE '%поводок%' THEN 'dog,leash'
    WHEN t ILIKE '%наполнител%' OR t ILIKE '%миск%' OR t ILIKE '%шампунь для%' THEN 'pet'
    WHEN t ILIKE '%игрушк%' THEN 'toy'
    -- Косметика
    WHEN t ILIKE '%парфюм%' OR t ILIKE '%dior%' OR t ILIKE '%chanel%' THEN 'perfume'
    WHEN t ILIKE '%крем%' OR t ILIKE '%сыворотк%' OR t ILIKE '%уход за лиц%' THEN 'skincare'
    WHEN t ILIKE '%помад%' OR t ILIKE '%тушь%' OR t ILIKE '%тен%' OR t ILIKE '%тональн%' OR t ILIKE '%макияж%' OR t ILIKE '%кист%' THEN 'makeup'
    WHEN t ILIKE '%шампунь%' OR t ILIKE '%маска для волос%' OR t ILIKE '%волос%' THEN 'shampoo'
    WHEN t ILIKE '%витамин%' OR t ILIKE '%здоров%' THEN 'vitamins'
    -- Сад / дача / инструменты
    WHEN t ILIKE '%газонокосилк%' THEN 'lawnmower'
    WHEN t ILIKE '%теплиц%' OR t ILIKE '%парник%' THEN 'greenhouse'
    WHEN t ILIKE '%шланг%' OR t ILIKE '%опрыскиват%' OR t ILIKE '%полив%' THEN 'garden,hose'
    WHEN t ILIKE '%удобрен%' OR t ILIKE '%грунт%' THEN 'soil'
    WHEN t ILIKE '%семена%' OR t ILIKE '%трав%' THEN 'seeds'
    WHEN t ILIKE '%горшок%' OR t ILIKE '%горшк%' THEN 'flowerpot'
    WHEN t ILIKE '%секатор%' OR t ILIKE '%инструмент%' THEN 'tools'
    WHEN t ILIKE '%фонтан%' OR t ILIKE '%декор%' THEN 'garden'
    -- Мебель
    WHEN t ILIKE '%кресло%' OR t ILIKE '%стул%' THEN 'chair'
    WHEN t ILIKE '%диван%' THEN 'sofa'
    WHEN t ILIKE '%стол%' THEN 'table'
    WHEN t ILIKE '%мебель%' THEN 'furniture'
    -- Одежда / обувь
    WHEN t ILIKE '%обувь%' OR t ILIKE '%кроссовк%' OR t ILIKE '%ботин%' THEN 'shoes'
    WHEN t ILIKE '%одежд%' OR t ILIKE '%куртк%' OR t ILIKE '%футболк%' OR t ILIKE '%плать%' THEN 'clothes'
    -- Прочее по широким группам
    WHEN t ILIKE '%спорт%' OR t ILIKE '%тренаж%' THEN 'sport'
    WHEN t ILIKE '%авто%' OR t ILIKE '%масло%' OR t ILIKE '%запчаст%' OR t ILIKE '%шин%' THEN 'car,part'
    WHEN t ILIKE '%продукт%' OR t ILIKE '%бакале%' OR t ILIKE '%напит%' OR t ILIKE '%еда%' THEN 'grocery'
    WHEN t ILIKE '%дет%' OR t ILIKE '%игр%' THEN 'kids,toys'
    WHEN t ILIKE '%строй%' OR t ILIKE '%инструмент%' OR t ILIKE '%отделочн%' THEN 'construction'
    WHEN t ILIKE '%аптек%' OR t ILIKE '%медиз%' OR t ILIKE '%бад%' THEN 'pharmacy'
    ELSE 'product'
  END || '?lock=' || p.id
)
FROM (
  SELECT id, COALESCE(category,'') || ' ' || COALESCE(name,'') AS t
  FROM products
) src
WHERE p.id = src.id
  AND (p.images IS NULL OR p.images = '[]'::jsonb OR jsonb_array_length(p.images) = 0);
