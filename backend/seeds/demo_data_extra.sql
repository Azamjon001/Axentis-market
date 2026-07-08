-- ══════════════════════════════════════════════════════════════════════════
-- AXENTIS MARKET — DEMO DATA SEED (EXTRA)
-- +5 companies · ~60 products · ~200 variants · 5 000 orders
-- 2 of the 5 companies are registered through referral agents.
-- Idempotent: safe to re-run (companies upserted by phone, orders by code range).
-- Usage:  psql $DATABASE_URL -f backend/seeds/demo_data_extra.sql
-- ══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  -- New company IDs
  cid_gold    BIGINT;  -- GoldLine    — ювелирные изделия (реферал: агент 1)
  cid_book    BIGINT;  -- BookCity    — книги и канцелярия
  cid_pet     BIGINT;  -- PetWorld    — зоотовары
  cid_beauty  BIGINT;  -- BeautyLab   — косметика (реферал: агент 2)
  cid_garden  BIGINT;  -- GreenGarden — сад и дача

  -- Referral agents
  agent1_id   BIGINT;  -- существующий (или создаётся, если агентов нет)
  agent2_id   BIGINT;  -- новый
  agent1_code VARCHAR(7);
  agent2_code VARCHAR(7);

  pid BIGINT;

  -- Name pools
  _male TEXT[] := ARRAY[
    'Sardor','Jasur','Sherzod','Ulugbek','Bobur','Otabek','Kamol','Laziz',
    'Firdavs','Behruz','Sanjar','Doniyor','Mansur','Akbar','Timur','Eldor',
    'Zafar','Bekzod','Jahongir','Shohruh','Anvar','Farrux','Ravshan','Ibrohim',
    'Alisher','Dilshod','Nurbek','Bahodir','Parviz','Aziz'];
  _female TEXT[] := ARRAY[
    'Malika','Nilufar','Gulnora','Mohira','Feruza','Zulfiya','Dilnoza',
    'Maftuna','Shahlo','Iroda','Nargiza','Sarvinoz','Madina','Kamola',
    'Nasiba','Yulduz','Lobar','Ozoda','Umida','Nafisa','Dildora','Zuhra',
    'Sevara','Munira','Adolat','Farzona','Gavhar','Sabohat'];
  _last TEXT[] := ARRAY[
    'Toshmatov','Abdullayev','Karimov','Yusupov','Mirzayev','Rahimov',
    'Hasanov','Nazarov','Ergashev','Xolmatov','Umarov','Azimov','Sultonov',
    'Qodirov','Ismoilov','Tursunov','Sobirov','Jurayev','Normatov','Qosimov',
    'Usmonov','Hamidov','Haydarov','Sharipov','Yunusov','Ortiqov','Pulatov'];

  -- Cities with base coordinates (lat, lng) for realistic delivery markers
  _cities TEXT[] := ARRAY['Toshkent','Toshkent','Toshkent','Toshkent','Toshkent',
                          'Samarqand','Buxoro','Andijon','Namangan','Farg''ona'];
  _streets TEXT[] := ARRAY[
    'Mustaqillik ko''chasi','Amir Temur shoh ko''chasi','Navoiy ko''chasi',
    'Pushkin ko''chasi','Buyuk ipak yo''li','Chilonzor ko''chasi',
    'Yunusobod ko''chasi','Mirzo Ulug''bek ko''chasi','Mirobod ko''chasi',
    'Bobur ko''chasi','Shota Rustaveli ko''chasi','Nizomiy ko''chasi'];

  -- Weighted statuses: completed 30%, delivered 18%, shipped 13%,
  -- processing 9%, pending 11%, confirmed 9%, cancelled 10%
  _statuses TEXT[] := ARRAY[
    'completed','completed','completed','completed','completed','completed',
    'completed','completed','completed','completed','completed','completed',
    'completed','completed','completed','completed','completed','completed',
    'completed','completed','completed','completed','completed','completed',
    'completed','completed','completed','completed','completed','completed',
    'delivered','delivered','delivered','delivered','delivered','delivered',
    'delivered','delivered','delivered','delivered','delivered','delivered',
    'delivered','delivered','delivered','delivered','delivered','delivered',
    'shipped','shipped','shipped','shipped','shipped','shipped','shipped',
    'shipped','shipped','shipped','shipped','shipped','shipped',
    'processing','processing','processing','processing','processing',
    'processing','processing','processing','processing',
    'pending','pending','pending','pending','pending','pending',
    'pending','pending','pending','pending','pending',
    'confirmed','confirmed','confirmed','confirmed','confirmed',
    'confirmed','confirmed','confirmed','confirmed',
    'cancelled','cancelled','cancelled','cancelled','cancelled',
    'cancelled','cancelled','cancelled','cancelled','cancelled'];

  -- Order generation vars
  i          INT;
  blk        INT;
  n_items    INT;
  ii         INT;
  sel_cid    BIGINT;
  sel_pid    BIGINT;
  sel_pname  TEXT;
  sel_price  NUMERIC;
  sel_mkup   NUMERIC;
  sel_sell   NUMERIC;
  sel_color  TEXT;
  sel_size   TEXT;
  sel_qty    INT;
  ord_items  JSONB;
  ord_total  NUMERIC;
  ord_profit NUMERIC;
  deli_cost  NUMERIC;
  deli_type  TEXT;
  ord_status TEXT;
  cust_name  TEXT;
  cust_phone TEXT;
  cust_city  TEXT;
  cust_addr  TEXT;
  deli_addr  TEXT;
  deli_coord TEXT;
  base_lat   NUMERIC;
  base_lng   NUMERIC;
  ord_code   TEXT;
  ord_ts     TIMESTAMPTZ;
  upd_ts     TIMESTAMPTZ;
  r          DOUBLE PRECISION;
  cnt        INT;
  reg        RECORD;
BEGIN
  RAISE NOTICE '[1/6] Setting up referral agents...';

  -- ════════════════════════════════════════════════════════════════
  -- 1. REFERRAL AGENTS — one existing (or created), one new
  -- ════════════════════════════════════════════════════════════════
  SELECT id, unique_code INTO agent1_id, agent1_code
  FROM referral_agents ORDER BY id LIMIT 1;

  IF agent1_id IS NULL THEN
    INSERT INTO referral_agents (phone, password_hash, password, unique_code, name, surname, commission_percent, is_active)
    VALUES ('700100100', crypt('agent123', gen_salt('bf',8)), 'agent123', '7100100',
            'Aziz', 'Karimov', 10, true)
    RETURNING id, unique_code INTO agent1_id, agent1_code;
  ELSE
    -- Existing agent: make sure it's active (a company will be attached)
    UPDATE referral_agents SET is_active = true WHERE id = agent1_id;
  END IF;

  INSERT INTO referral_agents (phone, password_hash, password, unique_code, name, surname, commission_percent, is_active)
  VALUES ('700200200', crypt('agent123', gen_salt('bf',8)), 'agent123', '7200200',
          'Dilnoza', 'Yusupova', 12, true)
  ON CONFLICT (phone) DO UPDATE SET is_active = true, name = EXCLUDED.name, surname = EXCLUDED.surname
  RETURNING id, unique_code INTO agent2_id, agent2_code;

  RAISE NOTICE '[1/6] Agents ready: agent1=% (code %), agent2=% (code %)',
    agent1_id, agent1_code, agent2_id, agent2_code;

  -- ════════════════════════════════════════════════════════════════
  -- 2. COMPANIES (2 attached to referral agents)
  -- ════════════════════════════════════════════════════════════════
  RAISE NOTICE '[2/6] Creating companies...';

  -- GoldLine — привлечена реферальным агентом №1
  INSERT INTO companies (name,phone,password_hash,access_key,mode,status,address,description,
                         latitude,longitude,delivery_enabled,delivery_radius_km,
                         platform_commission_percent,referral_agent_id,referral_code,is_enabled,
                         trial_started_at,trial_end_date)
  VALUES ('GoldLine','910011223',crypt('demo123',gen_salt('bf',8)),'GOLD2024','public','approved',
          'Ташкент, Юнусабад р-н, Амира Темура 15','Ювелирные изделия из золота и серебра, часы',
          41.338700,69.286400,true,3,5,agent1_id,agent1_code,true,NOW()-INTERVAL '40 days',NOW()-INTERVAL '10 days')
  ON CONFLICT (phone) DO UPDATE SET status='approved', referral_agent_id=EXCLUDED.referral_agent_id,
          referral_code=EXCLUDED.referral_code RETURNING id INTO cid_gold;

  -- BookCity
  INSERT INTO companies (name,phone,password_hash,access_key,mode,status,address,description,
                         latitude,longitude,delivery_enabled,delivery_radius_km,platform_commission_percent)
  VALUES ('BookCity','911022334',crypt('demo123',gen_salt('bf',8)),'BOOK2024','public','approved',
          'Ташкент, Мирабад р-н, Шахрисабз 4','Книги, учебники, канцелярия и товары для офиса',
          41.299500,69.268000,true,2,3)
  ON CONFLICT (phone) DO UPDATE SET status='approved' RETURNING id INTO cid_book;

  -- PetWorld
  INSERT INTO companies (name,phone,password_hash,access_key,mode,status,address,description,
                         latitude,longitude,delivery_enabled,delivery_radius_km,platform_commission_percent)
  VALUES ('PetWorld','912033445',crypt('demo123',gen_salt('bf',8)),'PETW2024','public','approved',
          'Ташкент, Чиланзар р-н, Бунёдкор 18','Корма, аксессуары и товары для домашних животных',
          41.285000,69.204000,true,4,3)
  ON CONFLICT (phone) DO UPDATE SET status='approved' RETURNING id INTO cid_pet;

  -- BeautyLab — привлечена реферальным агентом №2
  INSERT INTO companies (name,phone,password_hash,access_key,mode,status,address,description,
                         latitude,longitude,delivery_enabled,delivery_radius_km,
                         platform_commission_percent,referral_agent_id,referral_code,is_enabled,
                         trial_started_at,trial_end_date)
  VALUES ('BeautyLab','913044556',crypt('demo123',gen_salt('bf',8)),'BEAU2024','public','approved',
          'Ташкент, Яшнабад р-н, Паркент 22','Косметика, парфюмерия и средства по уходу',
          41.311000,69.330000,true,3,5,agent2_id,agent2_code,true,NOW()-INTERVAL '25 days',NOW()+INTERVAL '5 days')
  ON CONFLICT (phone) DO UPDATE SET status='approved', referral_agent_id=EXCLUDED.referral_agent_id,
          referral_code=EXCLUDED.referral_code RETURNING id INTO cid_beauty;

  -- GreenGarden
  INSERT INTO companies (name,phone,password_hash,access_key,mode,status,address,description,
                         latitude,longitude,delivery_enabled,delivery_radius_km,platform_commission_percent)
  VALUES ('GreenGarden','914055667',crypt('demo123',gen_salt('bf',8)),'GRDN2024','public','approved',
          'Ташкент, Сергели р-н, Янги Сергели 7','Товары для сада, дачи, огорода и растения',
          41.230000,69.220000,true,6,3)
  ON CONFLICT (phone) DO UPDATE SET status='approved' RETURNING id INTO cid_garden;

  RAISE NOTICE '[2/6] Companies: Gold=%, Book=%, Pet=%, Beauty=%, Garden=%',
    cid_gold,cid_book,cid_pet,cid_beauty,cid_garden;

  -- Если эти компании создавались раньше — убираем их старые товары, чтобы не дублировать
  DELETE FROM products WHERE company_id IN (cid_gold,cid_book,cid_pet,cid_beauty,cid_garden);

  -- ════════════════════════════════════════════════════════════════
  -- 3. PRODUCTS + VARIANTS
  -- ════════════════════════════════════════════════════════════════
  RAISE NOTICE '[3/6] Inserting products and variants...';

  CREATE TEMP TABLE IF NOT EXISTS _dc2 (
    cid BIGINT, pid BIGINT, pname TEXT, price NUMERIC, mkup NUMERIC,
    col TEXT DEFAULT '', sz TEXT DEFAULT ''
  );
  TRUNCATE _dc2;

  -- ─────────────── GoldLine — ювелирные изделия ───────────────
  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_gold,'Кольцо золотое 585 пробы',1200000,15,'Кольца',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Жёлтое золото','16',1200000,15,18),(pid,'Жёлтое золото','17',1250000,15,22),
    (pid,'Жёлтое золото','18',1300000,15,16),(pid,'Белое золото','18',1380000,15,11);
  INSERT INTO _dc2 VALUES (cid_gold,pid,'Кольцо золотое 585',1200000,15,'Жёлтое золото','16'),
    (cid_gold,pid,'Кольцо золотое 585',1300000,15,'Жёлтое золото','18');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_gold,'Серьги золотые «Капля»',1800000,12,'Серьги',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Жёлтое золото','One',1800000,12,14),(pid,'Белое золото','One',1950000,12,10);
  INSERT INTO _dc2 VALUES (cid_gold,pid,'Серьги золотые Капля',1800000,12,'Жёлтое золото','One');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_gold,'Цепочка золотая «Бисмарк»',2400000,14,'Цепочки',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Жёлтое золото','45см',2100000,14,15),(pid,'Жёлтое золото','50см',2400000,14,12),
    (pid,'Жёлтое золото','55см',2700000,14,10);
  INSERT INTO _dc2 VALUES (cid_gold,pid,'Цепочка золотая Бисмарк',2400000,14,'Жёлтое золото','50см'),
    (cid_gold,pid,'Цепочка золотая Бисмарк',2100000,14,'Жёлтое золото','45см');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_gold,'Браслет серебряный 925',320000,25,'Браслеты',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Серебро','S',300000,25,30),(pid,'Серебро','M',320000,25,28),(pid,'Серебро','L',350000,25,20);
  INSERT INTO _dc2 VALUES (cid_gold,pid,'Браслет серебряный 925',320000,25,'Серебро','M');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_gold,'Подвеска с бриллиантом 0.1ct',3500000,10,'Подвески',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Белое золото','One',3500000,10,12);
  INSERT INTO _dc2 VALUES (cid_gold,pid,'Подвеска с бриллиантом',3500000,10,'Белое золото','One');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_gold,'Обручальное кольцо классика',900000,12,'Кольца',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Жёлтое золото','17',900000,12,25),(pid,'Жёлтое золото','19',960000,12,20),
    (pid,'Жёлтое золото','21',1020000,12,14);
  INSERT INTO _dc2 VALUES (cid_gold,pid,'Обручальное кольцо',900000,12,'Жёлтое золото','17');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_gold,'Колье жемчужное',1500000,18,'Колье',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Белый жемчуг','40см',1500000,18,12),(pid,'Розовый жемчуг','40см',1650000,18,10);
  INSERT INTO _dc2 VALUES (cid_gold,pid,'Колье жемчужное',1500000,18,'Белый жемчуг','40см');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_gold,'Часы наручные женские',850000,20,'Часы',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Золотистый','One',850000,20,22),(pid,'Серебристый','One',850000,20,18),
    (pid,'Розовое золото','One',920000,20,12);
  INSERT INTO _dc2 VALUES (cid_gold,pid,'Часы наручные женские',850000,20,'Золотистый','One'),
    (cid_gold,pid,'Часы наручные женские',850000,20,'Серебристый','One');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_gold,'Серьги-гвоздики серебро',180000,28,'Серьги',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Серебро','One',180000,28,40),(pid,'Серебро с фианитом','One',220000,28,30);
  INSERT INTO _dc2 VALUES (cid_gold,pid,'Серьги-гвоздики серебро',180000,28,'Серебро','One');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_gold,'Кольцо с изумрудом',2800000,12,'Кольца',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Белое золото','17',2800000,12,10),(pid,'Белое золото','18',2900000,12,12);
  INSERT INTO _dc2 VALUES (cid_gold,pid,'Кольцо с изумрудом',2800000,12,'Белое золото','17');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_gold,'Крестик золотой',650000,15,'Подвески',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Жёлтое золото','Малый',650000,15,24),(pid,'Жёлтое золото','Средний',780000,15,16);
  INSERT INTO _dc2 VALUES (cid_gold,pid,'Крестик золотой',650000,15,'Жёлтое золото','Малый');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_gold,'Набор украшений (кольцо+серьги)',2200000,14,'Наборы',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Жёлтое золото','One',2200000,14,11),(pid,'Белое золото','One',2350000,14,10);
  INSERT INTO _dc2 VALUES (cid_gold,pid,'Набор украшений',2200000,14,'Жёлтое золото','One');

  -- ─────────────── BookCity — книги и канцелярия ───────────────
  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_book,'Книга «Алхимик» П. Коэльо',65000,30,'Книги',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Твёрдый переплёт','One',65000,30,50),(pid,'Мягкий переплёт','One',45000,30,60);
  INSERT INTO _dc2 VALUES (cid_book,pid,'Книга Алхимик',65000,30,'Твёрдый переплёт','One');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_book,'Ручка Parker Jotter',220000,25,'Канцелярия',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Синий','One',220000,25,35),(pid,'Чёрный','One',220000,25,30),(pid,'Серебристый','One',260000,25,20);
  INSERT INTO _dc2 VALUES (cid_book,pid,'Ручка Parker Jotter',220000,25,'Синий','One'),
    (cid_book,pid,'Ручка Parker Jotter',220000,25,'Чёрный','One');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_book,'Ежедневник кожаный А5',145000,35,'Канцелярия',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Чёрный','А5',145000,35,40),(pid,'Коричневый','А5',145000,35,32),(pid,'Бордовый','А5',155000,35,18);
  INSERT INTO _dc2 VALUES (cid_book,pid,'Ежедневник кожаный А5',145000,35,'Чёрный','А5');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_book,'Набор маркеров 24 цвета',95000,40,'Канцелярия',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Мульти','24 цвета',95000,40,45),(pid,'Мульти','36 цветов',135000,40,28);
  INSERT INTO _dc2 VALUES (cid_book,pid,'Набор маркеров',95000,40,'Мульти','24 цвета');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_book,'Учебник английского Oxford',180000,22,'Книги',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Уровень','A1',180000,22,30),(pid,'Уровень','A2',180000,22,28),(pid,'Уровень','B1',195000,22,22);
  INSERT INTO _dc2 VALUES (cid_book,pid,'Учебник английского Oxford',180000,22,'Уровень','A2');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_book,'Тетрадь 96 листов (10 шт)',45000,30,'Канцелярия',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'В клетку','96л',45000,30,60),(pid,'В линию','96л',45000,30,55);
  INSERT INTO _dc2 VALUES (cid_book,pid,'Тетрадь 96 листов',45000,30,'В клетку','96л');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_book,'Рюкзак школьный',280000,28,'Сумки',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Синий','One',280000,28,25),(pid,'Чёрный','One',280000,28,22),(pid,'Розовый','One',280000,28,18);
  INSERT INTO _dc2 VALUES (cid_book,pid,'Рюкзак школьный',280000,28,'Синий','One');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_book,'Калькулятор Citizen',120000,20,'Канцелярия',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Чёрный','12 разрядов',120000,20,30),(pid,'Чёрный','16 разрядов',150000,20,18);
  INSERT INTO _dc2 VALUES (cid_book,pid,'Калькулятор Citizen',120000,20,'Чёрный','12 разрядов');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_book,'Книга «Sapiens» Ю. Харари',110000,28,'Книги',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Твёрдый переплёт','One',110000,28,35);
  INSERT INTO _dc2 VALUES (cid_book,pid,'Книга Sapiens',110000,28,'Твёрдый переплёт','One');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_book,'Цветные карандаши 36 шт',85000,35,'Канцелярия',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Мульти','36 цветов',85000,35,40),(pid,'Мульти','48 цветов',115000,35,25);
  INSERT INTO _dc2 VALUES (cid_book,pid,'Цветные карандаши',85000,35,'Мульти','36 цветов');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_book,'Глобус политический 32см',240000,18,'Канцелярия',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Стандарт','32см',240000,18,18),(pid,'С подсветкой','32см',320000,18,12);
  INSERT INTO _dc2 VALUES (cid_book,pid,'Глобус политический',240000,18,'Стандарт','32см');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_book,'Краски акварельные 24 цвета',75000,30,'Канцелярия',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Мульти','24 цвета',75000,30,35),(pid,'Мульти','36 цветов',105000,30,22);
  INSERT INTO _dc2 VALUES (cid_book,pid,'Краски акварельные',75000,30,'Мульти','24 цвета');

  -- ─────────────── PetWorld — зоотовары ───────────────
  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_pet,'Корм для собак Royal Canin 3кг',280000,22,'Корма',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Для взрослых','3кг',280000,22,35),(pid,'Для щенков','3кг',300000,22,28),(pid,'Для взрослых','7.5кг',580000,22,16);
  INSERT INTO _dc2 VALUES (cid_pet,pid,'Корм Royal Canin',280000,22,'Для взрослых','3кг');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_pet,'Корм для кошек Whiskas 1.9кг',95000,25,'Корма',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Курица','1.9кг',95000,25,40),(pid,'Рыба','1.9кг',95000,25,38),(pid,'Говядина','1.9кг',95000,25,30);
  INSERT INTO _dc2 VALUES (cid_pet,pid,'Корм Whiskas',95000,25,'Курица','1.9кг'),
    (cid_pet,pid,'Корм Whiskas',95000,25,'Рыба','1.9кг');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_pet,'Лежанка для питомца',180000,30,'Аксессуары',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Серый','S',150000,30,30),(pid,'Серый','M',180000,30,25),(pid,'Бежевый','M',180000,30,20),(pid,'Бежевый','L',230000,30,14);
  INSERT INTO _dc2 VALUES (cid_pet,pid,'Лежанка для питомца',180000,30,'Серый','M');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_pet,'Когтеточка с домиком',350000,20,'Аксессуары',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Бежевый','Стандарт',350000,20,20),(pid,'Серый','Большой',480000,20,12);
  INSERT INTO _dc2 VALUES (cid_pet,pid,'Когтеточка с домиком',350000,20,'Бежевый','Стандарт');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_pet,'Поводок-рулетка 5м',120000,28,'Аксессуары',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Чёрный','S (до 15кг)',120000,28,28),(pid,'Чёрный','M (до 25кг)',140000,28,24),(pid,'Чёрный','L (до 50кг)',170000,28,16);
  INSERT INTO _dc2 VALUES (cid_pet,pid,'Поводок-рулетка',120000,28,'Чёрный','M (до 25кг)');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_pet,'Аквариум 30л с крышкой',420000,15,'Аквариумы',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Прозрачный','30л',420000,15,15),(pid,'Прозрачный','60л',680000,15,10);
  INSERT INTO _dc2 VALUES (cid_pet,pid,'Аквариум',420000,15,'Прозрачный','30л');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_pet,'Наполнитель для туалета 10л',65000,30,'Гигиена',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Комкующийся','10л',65000,30,50),(pid,'Древесный','10л',55000,30,40);
  INSERT INTO _dc2 VALUES (cid_pet,pid,'Наполнитель для туалета',65000,30,'Комкующийся','10л');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_pet,'Игрушки для кошек (набор)',55000,40,'Игрушки',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Мульти','Набор 5шт',55000,40,45),(pid,'Мульти','Набор 10шт',85000,40,30);
  INSERT INTO _dc2 VALUES (cid_pet,pid,'Игрушки для кошек',55000,40,'Мульти','Набор 5шт');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_pet,'Переноска для животных',260000,22,'Аксессуары',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Серый','M',260000,22,22),(pid,'Синий','M',260000,22,18),(pid,'Серый','L',330000,22,12);
  INSERT INTO _dc2 VALUES (cid_pet,pid,'Переноска для животных',260000,22,'Серый','M');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_pet,'Шампунь для собак 500мл',75000,30,'Гигиена',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Универсальный','500мл',75000,30,35),(pid,'От блох','500мл',95000,30,25);
  INSERT INTO _dc2 VALUES (cid_pet,pid,'Шампунь для собак',75000,30,'Универсальный','500мл');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_pet,'Миска двойная нержавейка',90000,35,'Аксессуары',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Серебристый','One',90000,35,40),(pid,'Чёрный','One',90000,35,30);
  INSERT INTO _dc2 VALUES (cid_pet,pid,'Миска двойная',90000,35,'Серебристый','One');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_pet,'Витамины для кошек',110000,25,'Здоровье',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Мультивитамины','120 таб',110000,25,30),(pid,'Для шерсти','120 таб',125000,25,22);
  INSERT INTO _dc2 VALUES (cid_pet,pid,'Витамины для кошек',110000,25,'Мультивитамины','120 таб');

  -- ─────────────── BeautyLab — косметика и парфюмерия ───────────────
  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_beauty,'Парфюм Dior Sauvage 100мл',1250000,18,'Парфюмерия',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'EDT','60мл',850000,18,20),(pid,'EDT','100мл',1250000,18,16),(pid,'EDP','100мл',1450000,18,10);
  INSERT INTO _dc2 VALUES (cid_beauty,pid,'Парфюм Dior Sauvage',1250000,18,'EDT','100мл');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_beauty,'Крем для лица увлажняющий',240000,30,'Уход за лицом',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Для сухой кожи','50мл',240000,30,35),(pid,'Для жирной кожи','50мл',240000,30,30);
  INSERT INTO _dc2 VALUES (cid_beauty,pid,'Крем для лица',240000,30,'Для сухой кожи','50мл');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_beauty,'Палетка теней 12 цветов',320000,28,'Макияж',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Нюд','12 цветов',320000,28,28),(pid,'Smoky','12 цветов',320000,28,22);
  INSERT INTO _dc2 VALUES (cid_beauty,pid,'Палетка теней',320000,28,'Нюд','12 цветов');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_beauty,'Тушь для ресниц',145000,25,'Макияж',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Чёрный','One',145000,25,40),(pid,'Коричневый','One',145000,25,25);
  INSERT INTO _dc2 VALUES (cid_beauty,pid,'Тушь для ресниц',145000,25,'Чёрный','One');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_beauty,'Помада матовая',110000,30,'Макияж',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Красный','One',110000,30,35),(pid,'Розовый','One',110000,30,32),
    (pid,'Бордовый','One',110000,30,24),(pid,'Нюд','One',110000,30,28);
  INSERT INTO _dc2 VALUES (cid_beauty,pid,'Помада матовая',110000,30,'Красный','One'),
    (cid_beauty,pid,'Помада матовая',110000,30,'Нюд','One');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_beauty,'Набор кистей для макияжа 10шт',280000,22,'Аксессуары',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Розовый','10шт',280000,22,22),(pid,'Чёрный','10шт',280000,22,18);
  INSERT INTO _dc2 VALUES (cid_beauty,pid,'Набор кистей',280000,22,'Розовый','10шт');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_beauty,'Сыворотка с витамином C',360000,26,'Уход за лицом',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Концентрат','30мл',360000,26,26);
  INSERT INTO _dc2 VALUES (cid_beauty,pid,'Сыворотка вит C',360000,26,'Концентрат','30мл');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_beauty,'Шампунь профессиональный 1л',180000,28,'Уход за волосами',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Для окрашенных','1л',180000,28,30),(pid,'Для объёма','1л',180000,28,25);
  INSERT INTO _dc2 VALUES (cid_beauty,pid,'Шампунь профессиональный',180000,28,'Для окрашенных','1л');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_beauty,'Маска для волос',150000,30,'Уход за волосами',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Восстанавливающая','500мл',150000,30,30),(pid,'Увлажняющая','500мл',150000,30,26);
  INSERT INTO _dc2 VALUES (cid_beauty,pid,'Маска для волос',150000,30,'Восстанавливающая','500мл');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_beauty,'Парфюм Chanel Coco 50мл',980000,16,'Парфюмерия',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'EDP','50мл',980000,16,14),(pid,'EDP','100мл',1380000,16,10);
  INSERT INTO _dc2 VALUES (cid_beauty,pid,'Парфюм Chanel Coco',980000,16,'EDP','50мл');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_beauty,'Тональный крем',220000,25,'Макияж',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Тон 01','30мл',220000,25,30),(pid,'Тон 02','30мл',220000,25,28),(pid,'Тон 03','30мл',220000,25,20);
  INSERT INTO _dc2 VALUES (cid_beauty,pid,'Тональный крем',220000,25,'Тон 02','30мл');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_beauty,'Набор по уходу за кожей',540000,20,'Уход за лицом',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Дневной','Набор',540000,20,18),(pid,'Антивозрастной','Набор',680000,20,12);
  INSERT INTO _dc2 VALUES (cid_beauty,pid,'Набор по уходу за кожей',540000,20,'Дневной','Набор');

  -- ─────────────── GreenGarden — сад и дача ───────────────
  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_garden,'Газонокосилка электрическая',1800000,15,'Садовая техника',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'1200Вт','32см',1800000,15,15),(pid,'1600Вт','38см',2300000,15,10);
  INSERT INTO _dc2 VALUES (cid_garden,pid,'Газонокосилка',1800000,15,'1200Вт','32см');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_garden,'Набор садовых инструментов',320000,25,'Инструменты',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Базовый','5 предметов',320000,25,28),(pid,'Расширенный','9 предметов',480000,25,18);
  INSERT INTO _dc2 VALUES (cid_garden,pid,'Набор садовых инструментов',320000,25,'Базовый','5 предметов');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_garden,'Семена овощей (набор 20 пак)',85000,35,'Семена',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Овощи','20 пакетов',85000,35,40),(pid,'Зелень','15 пакетов',65000,35,35);
  INSERT INTO _dc2 VALUES (cid_garden,pid,'Семена овощей',85000,35,'Овощи','20 пакетов');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_garden,'Шланг садовый',180000,28,'Полив',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Зелёный','15м',130000,28,30),(pid,'Зелёный','25м',180000,28,25),(pid,'Зелёный','50м',290000,28,14);
  INSERT INTO _dc2 VALUES (cid_garden,pid,'Шланг садовый',180000,28,'Зелёный','25м');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_garden,'Удобрение универсальное 5кг',95000,30,'Удобрения',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Универсальное','5кг',95000,30,40),(pid,'Для цветов','2кг',55000,30,35);
  INSERT INTO _dc2 VALUES (cid_garden,pid,'Удобрение',95000,30,'Универсальное','5кг');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_garden,'Горшок керамический',75000,35,'Горшки',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Терракот','S',60000,35,40),(pid,'Терракот','M',75000,35,35),
    (pid,'Белый','M',75000,35,28),(pid,'Белый','L',105000,35,18);
  INSERT INTO _dc2 VALUES (cid_garden,pid,'Горшок керамический',75000,35,'Терракот','M');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_garden,'Теплица-парник 4м',1200000,12,'Конструкции',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Поликарбонат','4м',1200000,12,12),(pid,'Поликарбонат','6м',1650000,12,10);
  INSERT INTO _dc2 VALUES (cid_garden,pid,'Теплица-парник',1200000,12,'Поликарбонат','4м');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_garden,'Опрыскиватель 5л',140000,25,'Полив',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Ручной','5л',140000,25,30),(pid,'Аккумуляторный','8л',320000,25,15);
  INSERT INTO _dc2 VALUES (cid_garden,pid,'Опрыскиватель',140000,25,'Ручной','5л');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_garden,'Семена газонной травы 1кг',110000,30,'Семена',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Спортивный','1кг',110000,30,35),(pid,'Универсальный','1кг',95000,30,30);
  INSERT INTO _dc2 VALUES (cid_garden,pid,'Семена газонной травы',110000,30,'Универсальный','1кг');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_garden,'Секатор профессиональный',160000,22,'Инструменты',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Стандарт','21см',160000,22,28),(pid,'Усиленный','25см',220000,22,18);
  INSERT INTO _dc2 VALUES (cid_garden,pid,'Секатор',160000,22,'Стандарт','21см');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_garden,'Грунт для растений 50л',65000,30,'Удобрения',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Универсальный','50л',65000,30,45),(pid,'Для рассады','25л',40000,30,40);
  INSERT INTO _dc2 VALUES (cid_garden,pid,'Грунт для растений',65000,30,'Универсальный','50л');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_garden,'Декоративный фонтан садовый',850000,14,'Декор',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Камень','Средний',850000,14,14),(pid,'Камень','Большой',1250000,14,10);
  INSERT INTO _dc2 VALUES (cid_garden,pid,'Декоративный фонтан',850000,14,'Камень','Средний');

  SELECT COUNT(*) INTO cnt FROM _dc2;
  RAISE NOTICE '[3/6] Catalog rows ready: %', cnt;

  -- ════════════════════════════════════════════════════════════════
  -- 4. REGULAR CUSTOMERS with fixed delivery locations (для «частых мест»)
  -- ════════════════════════════════════════════════════════════════
  RAISE NOTICE '[4/6] Setting up regular customers...';

  CREATE TEMP TABLE IF NOT EXISTS _reg (phone TEXT, name TEXT, addr TEXT, coords TEXT);
  TRUNCATE _reg;
  INSERT INTO _reg (phone,name,addr,coords) VALUES
    ('901234501','Toshmatov Sardor','Ташкент, Чиланзар р-н, Бунёдкор 12, кв.45','41.285300,69.203100'),
    ('901234501','Toshmatov Sardor','Ташкент, Юнусабад р-н, Амира Темура 88 (офис)','41.345200,69.287400'),
    ('901234502','Karimova Malika','Ташкент, Мирабад р-н, Шахрисабз 7, кв.12','41.299900,69.270300'),
    ('901234502','Karimova Malika','Ташкент, Яккасарай р-н, Шота Руставели 30','41.291000,69.245000'),
    ('901234503','Yusupov Bobur','Ташкент, Яшнабад р-н, Паркент 140, кв.88','41.311500,69.331000'),
    ('901234504','Nazarova Nilufar','Ташкент, Мирзо-Улугбек р-н, Буюк ипак йули 55','41.325000,69.335000'),
    ('901234504','Nazarova Nilufar','Ташкент, Мирзо-Улугбек р-н, ТЦ Compass','41.327800,69.340200'),
    ('901234505','Ergashev Jasur','Ташкент, Сергели р-н, Янги Сергели 10, кв.5','41.231000,69.221500'),
    ('901234506','Rahimova Feruza','Ташкент, Шайхантахур р-н, Навои 18, кв.31','41.325600,69.230400'),
    ('901234507','Sultonov Akbar','Ташкент, Учтепа р-н, Чупонота 64','41.295000,69.180000'),
    ('901234508','Hasanova Madina','Ташкент, Алмазар р-н, Себзор 21, кв.9','41.345000,69.210000'),
    ('901234509','Mirzayev Timur','Самарканд, Регистан 4, кв.2','39.654000,66.975000'),
    ('901234510','Abdullayeva Sevara','Ташкент, Бектемир р-н, Темирйулчилар 8','41.230000,69.330000');

  -- ════════════════════════════════════════════════════════════════
  -- 5. GENERATE 5 000 ORDERS (1 000 per company)
  -- ════════════════════════════════════════════════════════════════
  RAISE NOTICE '[5/6] Generating 5 000 orders...';

  -- Чистим прошлый прогон этого сидера, чтобы не плодить дубликаты
  DELETE FROM orders WHERE order_code BETWEEN '600001' AND '605000';

  FOR i IN 1..5000 LOOP
    blk := (i - 1) / 1000;  -- 0..4
    sel_cid := CASE blk
      WHEN 0 THEN cid_gold
      WHEN 1 THEN cid_book
      WHEN 2 THEN cid_pet
      WHEN 3 THEN cid_beauty
      ELSE        cid_garden
    END;

    -- Кол-во позиций: 1-4 (чаще 1-2)
    r := RANDOM();
    IF r < 0.5 THEN n_items := 1;
    ELSIF r < 0.8 THEN n_items := 2;
    ELSIF r < 0.93 THEN n_items := 3;
    ELSE n_items := 4;
    END IF;

    ord_items  := '[]'::jsonb;
    ord_total  := 0;
    ord_profit := 0;

    FOR ii IN 1..n_items LOOP
      SELECT dc.pid, dc.pname, dc.price, dc.mkup, dc.col, dc.sz
      INTO   sel_pid, sel_pname, sel_price, sel_mkup, sel_color, sel_size
      FROM   _dc2 dc WHERE dc.cid = sel_cid ORDER BY RANDOM() LIMIT 1;

      IF sel_pid IS NULL THEN CONTINUE; END IF;

      sel_sell := ROUND(sel_price * (1 + sel_mkup / 100.0), -2);
      sel_qty  := (RANDOM() * 2 + 1)::INT;  -- 1..3

      ord_total  := ord_total  + sel_sell * sel_qty;
      ord_profit := ord_profit + (sel_sell - sel_price) * sel_qty;

      ord_items := ord_items || jsonb_build_object(
        'productId', sel_pid, 'name', sel_pname, 'color', sel_color, 'size', sel_size,
        'quantity', sel_qty, 'price', sel_price,
        'price_with_markup', sel_sell, 'priceWithMarkup', sel_sell
      );
    END LOOP;

    -- Тип доставки
    IF RANDOM() < 0.5 THEN
      deli_type := 'delivery';
    ELSE
      deli_type := 'pickup';
    END IF;

    -- Покупатель + адрес доставки
    IF deli_type = 'delivery' AND RANDOM() < 0.55 THEN
      -- Постоянный клиент с фиксированным адресом → формирует «частые места»
      SELECT phone, name, addr, coords INTO reg
      FROM _reg ORDER BY RANDOM() LIMIT 1;
      cust_phone := reg.phone;
      cust_name  := reg.name;
      deli_addr  := reg.addr;
      deli_coord := reg.coords;
      cust_addr  := reg.addr;
      deli_cost  := 15000;
      ord_total  := ord_total + deli_cost;
    ELSE
      -- Случайный покупатель
      IF RANDOM() > 0.5 THEN
        cust_name := _last[1 + (RANDOM()*(array_length(_last,1)-1))::INT] || ' ' ||
                     _male[1 + (RANDOM()*(array_length(_male,1)-1))::INT];
      ELSE
        cust_name := _last[1 + (RANDOM()*(array_length(_last,1)-1))::INT] || ' ' ||
                     _female[1 + (RANDOM()*(array_length(_female,1)-1))::INT];
      END IF;
      cust_phone := '9' || LPAD(((RANDOM()*89999999)+10000000)::BIGINT::TEXT, 8, '0');
      cust_city  := _cities[1 + (RANDOM()*(array_length(_cities,1)-1))::INT];
      cust_addr  := cust_city || ', ' ||
                    _streets[1 + (RANDOM()*(array_length(_streets,1)-1))::INT] || ', д.' ||
                    (1+(RANDOM()*120)::INT)::TEXT ||
                    CASE WHEN RANDOM() > 0.5 THEN ', кв.'||(1+(RANDOM()*80)::INT)::TEXT ELSE '' END;

      IF deli_type = 'delivery' THEN
        -- Базовые координаты по городу
        CASE cust_city
          WHEN 'Samarqand' THEN base_lat := 39.6542; base_lng := 66.9597;
          WHEN 'Buxoro'    THEN base_lat := 39.7747; base_lng := 64.4286;
          WHEN 'Andijon'   THEN base_lat := 40.7821; base_lng := 72.3442;
          WHEN 'Namangan'  THEN base_lat := 40.9983; base_lng := 71.6726;
          WHEN 'Farg''ona' THEN base_lat := 40.3864; base_lng := 71.7864;
          ELSE                  base_lat := 41.3110; base_lng := 69.2797;
        END CASE;
        deli_addr  := cust_addr;
        deli_coord := ROUND((base_lat + (RANDOM()-0.5)*0.08)::NUMERIC, 6)::TEXT || ',' ||
                      ROUND((base_lng + (RANDOM()-0.5)*0.08)::NUMERIC, 6)::TEXT;
        deli_cost  := CASE WHEN cust_city = 'Toshkent' THEN 15000 ELSE 30000 END;
        ord_total  := ord_total + deli_cost;
      ELSE
        deli_addr  := NULL;
        deli_coord := NULL;
        deli_cost  := 0;
      END IF;
    END IF;

    -- Статус
    ord_status := _statuses[1 + (RANDOM()*(array_length(_statuses,1)-1))::INT];

    -- Время: за последние 14 месяцев
    ord_ts := NOW() - (RANDOM() * INTERVAL '420 days');
    IF ord_status IN ('completed','delivered') THEN
      upd_ts := ord_ts + (RANDOM() * INTERVAL '72 hours');
    ELSIF ord_status = 'cancelled' THEN
      upd_ts := ord_ts + (RANDOM() * INTERVAL '24 hours');
    ELSE
      upd_ts := ord_ts + (RANDOM() * INTERVAL '48 hours');
    END IF;

    ord_code := LPAD((600000 + i)::TEXT, 6, '0');

    INSERT INTO orders (
      company_id, customer_name, customer_phone, address,
      items, total_amount, delivery_cost, delivery_type, recipient_name,
      delivery_address, delivery_coordinates, markup_profit,
      status, order_code, comment, created_at, updated_at
    ) VALUES (
      sel_cid, cust_name, cust_phone, cust_addr,
      ord_items, ROUND(ord_total, -2), deli_cost, deli_type,
      CASE WHEN deli_type = 'delivery' THEN cust_name ELSE NULL END,
      deli_addr, deli_coord, ROUND(ord_profit, -2),
      ord_status, ord_code,
      CASE WHEN RANDOM() < 0.22 THEN
        (ARRAY['Позвоните перед доставкой','Оставьте у двери','Домофон не работает, звоните',
               'Подъезд 2, этаж 5','Упакуйте аккуратно','Оплата картой при получении',
               'Уточните время доставки', NULL])[1 + (RANDOM()*7)::INT]
      ELSE NULL END,
      ord_ts, upd_ts
    );
  END LOOP;

  SELECT COUNT(*) INTO cnt FROM orders WHERE order_code BETWEEN '600001' AND '605000';
  RAISE NOTICE '[5/6] Orders generated: %', cnt;

  -- ════════════════════════════════════════════════════════════════
  -- 6. SYNC product quantity + sold_count
  -- ════════════════════════════════════════════════════════════════
  RAISE NOTICE '[6/6] Syncing stock and sold_count...';

  UPDATE products p
  SET quantity = COALESCE((SELECT SUM(pv.stock_quantity) FROM product_variants pv WHERE pv.product_id = p.id), 0)
  WHERE p.company_id IN (cid_gold,cid_book,cid_pet,cid_beauty,cid_garden);

  UPDATE products p
  SET sold_count = (
    SELECT COALESCE(SUM((item->>'quantity')::INT), 0)
    FROM orders o, jsonb_array_elements(o.items) AS item
    WHERE (item->>'productId')::BIGINT = p.id
      AND o.status IN ('completed','delivered','shipped','processing','confirmed')
  )
  WHERE p.company_id IN (cid_gold,cid_book,cid_pet,cid_beauty,cid_garden);

  RAISE NOTICE '✅ Extra seed complete! 5 new companies, ~60 products, 5 000 orders.';
  RAISE NOTICE '   Companies (phone/pass): GoldLine 910011223/demo123 (реф. агент 1)';
  RAISE NOTICE '                           BookCity 911022334/demo123';
  RAISE NOTICE '                           PetWorld 912033445/demo123';
  RAISE NOTICE '                           BeautyLab 913044556/demo123 (реф. агент 2)';
  RAISE NOTICE '                           GreenGarden 914055667/demo123';
END $$;
