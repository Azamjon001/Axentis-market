-- ══════════════════════════════════════════════════════════════════════════
-- AXENTIS MARKET — DEMO DATA SEED
-- 10 companies · ~160 products · ~800 variants · 12 000 orders
-- Usage:  psql $DATABASE_URL -f backend/seeds/demo_data.sql
-- ══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  -- Company IDs
  cid_spm   BIGINT;
  cid_tech  BIGINT;
  cid_moda  BIGINT;
  cid_build BIGINT;
  cid_home  BIGINT;
  cid_sport BIGINT;
  cid_food  BIGINT;
  cid_medi  BIGINT;
  cid_auto  BIGINT;
  cid_kid   BIGINT;

  pid BIGINT;

  -- Random name pools
  _male TEXT[] := ARRAY[
    'Sardor','Jasur','Sherzod','Ulugbek','Bobur','Otabek','Kamol','Laziz',
    'Firdavs','Husanboy','Behruz','Sanjar','Doniyor','Mansur','Akbar',
    'Timur','Hamza','Eldor','Mirzo','Asilbek','Sarvarbek','Nodir',
    'Zafar','Bekzod','Jahongir','Shohruh','Anvar','Farrux','Ravshan','Ibrohim',
    'Alisher','Dilshod','Muzaffar','Nurbek','Tohirjon','Shamsiddin','Bahodir','Parviz'];
  _female TEXT[] := ARRAY[
    'Malika','Nilufar','Gulnora','Mohira','Feruza','Zulfiya','Dilnoza',
    'Maftuna','Shahlo','Barno','Iroda','Nargiza','Sarvinoz','Madina',
    'Kamola','Hulkar','Nasiba','Sabohat','Yulduz','Mohlaroyim',
    'Lobar','Ozoda','Gavhar','Umida','Nafisa','Dildora','Manzura','Zuhra',
    'Dilfuza','Munira','Sevara','Xurmo','Madinabonu','Adolat','Farzona'];
  _last TEXT[] := ARRAY[
    'Toshmatov','Abdullayev','Karimov','Yusupov','Mirzayev','Rahimov',
    'Hasanov','Nazarov','Ergashev','Xolmatov','Umarov','Azimov',
    'Begmatov','Sultonov','Qodirov','Ismoilov','Holiqov','Tursunov',
    'Sobirov','Jurayev','Xasanov','Normatov','Qosimov','Mamatov',
    'Alijonov','Nishonov','Usmonov','Hamidov','Haydarov','Baxtiyorov',
    'Qoraboyev','Sharipov','Fattoyev','Boymurodov','Xudoyberdiyev',
    'Yunusov','Raximov','Tojimatov','Ortiqov','Pulatov'];
  _cities TEXT[] := ARRAY[
    'Toshkent','Toshkent','Toshkent','Toshkent','Toshkent','Toshkent',
    'Samarqand','Buxoro','Farg''ona','Namangan','Andijon',
    'Nukus','Urganch','Qarshi','Termiz','Jizzax',
    'Navoiy','Guliston','Chirchiq','Marg''ilon','Shahrixon','Asaka','Xiva'];
  _streets TEXT[] := ARRAY[
    'Mustaqillik ko''chasi','Amir Temur shoh ko''chasi','Navoiy ko''chasi',
    'Pushkin ko''chasi','Buyuk ipak yo''li','Chilonzor ko''chasi',
    'Yunusobod ko''chasi','Mirzo Ulug''bek ko''chasi','Mirobod ko''chasi',
    'Hamza ko''chasi','Lutfiy ko''chasi','Bobur ko''chasi',
    'Sebzor ko''chasi','Shota Rustaveli ko''chasi','Furqat ko''chasi',
    'Nizomiy ko''chasi','Beruniy ko''chasi','Firdavsiy ko''chasi'];

  -- Weighted statuses (100 entries):
  -- completed 28%, delivered 18%, shipped 15%, processing 10%,
  -- pending 11%, confirmed 8%, cancelled 10%
  _statuses TEXT[] := ARRAY[
    'completed','completed','completed','completed','completed','completed','completed',
    'completed','completed','completed','completed','completed','completed','completed',
    'completed','completed','completed','completed','completed','completed','completed',
    'completed','completed','completed','completed','completed','completed','completed',
    'delivered','delivered','delivered','delivered','delivered','delivered','delivered',
    'delivered','delivered','delivered','delivered','delivered','delivered','delivered',
    'delivered','delivered','delivered','delivered',
    'shipped','shipped','shipped','shipped','shipped','shipped','shipped',
    'shipped','shipped','shipped','shipped','shipped','shipped','shipped','shipped',
    'processing','processing','processing','processing','processing','processing',
    'processing','processing','processing','processing',
    'pending','pending','pending','pending','pending','pending','pending',
    'pending','pending','pending','pending',
    'confirmed','confirmed','confirmed','confirmed','confirmed','confirmed','confirmed','confirmed',
    'cancelled','cancelled','cancelled','cancelled','cancelled','cancelled','cancelled',
    'cancelled','cancelled','cancelled'];

  -- Order generation vars
  i          INT;
  n          INT;
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
  cust_fname TEXT;
  cust_lname TEXT;
  cust_phone TEXT;
  cust_city  TEXT;
  cust_addr  TEXT;
  ord_code   TEXT;
  ord_ts     TIMESTAMPTZ;
  upd_ts     TIMESTAMPTZ;
  r          DOUBLE PRECISION;
  cnt        INT;

BEGIN
  RAISE NOTICE '[1/5] Creating companies...';

  -- ════════════════════════════════════════════════════════════════
  -- 1. COMPANIES
  -- ════════════════════════════════════════════════════════════════

  SELECT id INTO cid_spm FROM companies ORDER BY id LIMIT 1;
  IF cid_spm IS NULL THEN
    INSERT INTO companies (name,phone,password_hash,mode,status,address,description)
    VALUES ('SPM','914751330',crypt('15051',gen_salt('bf',8)),'public','approved',
            'Ташкент, Мирзо-Улугбек р-н','Универсальный интернет-магазин')
    RETURNING id INTO cid_spm;
  END IF;

  INSERT INTO companies (name,phone,password_hash,access_key,mode,status,address,description)
  VALUES ('TechZone','901112233',crypt('demo123',gen_salt('bf',8)),'TECH2024','public','approved',
          'Ташкент, Чиланзар р-н, Назарбека 7а','Смартфоны, ноутбуки, планшеты, аксессуары')
  ON CONFLICT (phone) DO UPDATE SET status='approved' RETURNING id INTO cid_tech;

  INSERT INTO companies (name,phone,password_hash,access_key,mode,status,address,description)
  VALUES ('ModaStyle','902223344',crypt('demo123',gen_salt('bf',8)),'MODA2024','public','approved',
          'Ташкент, Юнусобод р-н, Амира Темура 3','Мужская и женская одежда, обувь, аксессуары')
  ON CONFLICT (phone) DO UPDATE SET status='approved' RETURNING id INTO cid_moda;

  INSERT INTO companies (name,phone,password_hash,access_key,mode,status,address,description)
  VALUES ('BuildMart','903334455',crypt('demo123',gen_salt('bf',8)),'BILD2024','public','approved',
          'Ташкент, Сергели р-н, Сергели шоссе 12','Стройматериалы, инструменты, отделочные материалы')
  ON CONFLICT (phone) DO UPDATE SET status='approved' RETURNING id INTO cid_build;

  INSERT INTO companies (name,phone,password_hash,access_key,mode,status,address,description)
  VALUES ('HomeNest','904445566',crypt('demo123',gen_salt('bf',8)),'HOME2024','public','approved',
          'Ташкент, Мирзо-Улугбек р-н, Амира Темура 5','Мебель, бытовая техника, декор для дома')
  ON CONFLICT (phone) DO UPDATE SET status='approved' RETURNING id INTO cid_home;

  INSERT INTO companies (name,phone,password_hash,access_key,mode,status,address,description)
  VALUES ('SportPro','905556677',crypt('demo123',gen_salt('bf',8)),'SPRT2024','public','approved',
          'Ташкент, Яккасарай р-н, Спортивная 8','Спорттовары, тренажёры, активный отдых')
  ON CONFLICT (phone) DO UPDATE SET status='approved' RETURNING id INTO cid_sport;

  INSERT INTO companies (name,phone,password_hash,access_key,mode,status,address,description)
  VALUES ('FreshFood','906667788',crypt('demo123',gen_salt('bf',8)),'FOOD2024','public','approved',
          'Ташкент, Шайхантохур р-н, Бозор 2','Продукты питания, бакалея, напитки')
  ON CONFLICT (phone) DO UPDATE SET status='approved' RETURNING id INTO cid_food;

  INSERT INTO companies (name,phone,password_hash,access_key,mode,status,address,description)
  VALUES ('MediCare','907778899',crypt('demo123',gen_salt('bf',8)),'MEDI2024','public','approved',
          'Ташкент, Бектемир р-н, Медицинская 1','Аптека, медизделия, БАД, витамины')
  ON CONFLICT (phone) DO UPDATE SET status='approved' RETURNING id INTO cid_medi;

  INSERT INTO companies (name,phone,password_hash,access_key,mode,status,address,description)
  VALUES ('AutoMaster','908889900',crypt('demo123',gen_salt('bf',8)),'AUTO2024','public','approved',
          'Ташкент, Учтепа р-н, Автозаводская 9','Автозапчасти, масла, аксессуары для авто')
  ON CONFLICT (phone) DO UPDATE SET status='approved' RETURNING id INTO cid_auto;

  INSERT INTO companies (name,phone,password_hash,access_key,mode,status,address,description)
  VALUES ('KidZone','909990011',crypt('demo123',gen_salt('bf',8)),'KIDZ2024','public','approved',
          'Ташкент, Алмазар р-н, Детская 4','Игрушки, одежда и товары для детей')
  ON CONFLICT (phone) DO UPDATE SET status='approved' RETURNING id INTO cid_kid;

  RAISE NOTICE '[1/5] Companies ready: SPM=%, Tech=%, Moda=%, Build=%, Home=%, Sport=%, Food=%, Medi=%, Auto=%, Kid=%',
    cid_spm,cid_tech,cid_moda,cid_build,cid_home,cid_sport,cid_food,cid_medi,cid_auto,cid_kid;

  -- ════════════════════════════════════════════════════════════════
  -- 2. PRODUCT CATALOG TEMP TABLE
  -- ════════════════════════════════════════════════════════════════
  RAISE NOTICE '[2/5] Inserting products and variants...';

  CREATE TEMP TABLE IF NOT EXISTS _dc (
    cid   BIGINT,
    pid   BIGINT,
    pname TEXT,
    price NUMERIC,
    mkup  NUMERIC,
    col   TEXT DEFAULT '',
    sz    TEXT DEFAULT ''
  );
  TRUNCATE _dc;

  -- ────────────────────────────────────────────────────────────────
  -- SPM — техника, электроника (mixed)
  -- ────────────────────────────────────────────────────────────────

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_spm,'Телевизор LG OLED 55"',9800000,10,'Телевизоры',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Чёрный','55"',9800000,10,18),(pid,'Чёрный','65"',13500000,10,10),(pid,'Чёрный','75"',18200000,10,4);
  INSERT INTO _dc VALUES (cid_spm,pid,'Телевизор LG OLED',9800000,10,'Чёрный','55"');
  INSERT INTO _dc VALUES (cid_spm,pid,'Телевизор LG OLED',13500000,10,'Чёрный','65"');
  INSERT INTO _dc VALUES (cid_spm,pid,'Телевизор LG OLED',18200000,10,'Чёрный','75"');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_spm,'Кондиционер Samsung WindFree 18K',5800000,12,'Кондиционеры',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Белый','18000 BTU',5800000,12,14),(pid,'Белый','24000 BTU',7200000,12,8),(pid,'Белый','36000 BTU',9500000,12,3);
  INSERT INTO _dc VALUES (cid_spm,pid,'Кондиционер Samsung WindFree',5800000,12,'Белый','18000 BTU');
  INSERT INTO _dc VALUES (cid_spm,pid,'Кондиционер Samsung WindFree',7200000,12,'Белый','24000 BTU');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_spm,'Стиральная машина LG 9кг',5200000,10,'Бытовая техника',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Белый','7кг',4200000,10,20),(pid,'Белый','9кг',5200000,10,16),(pid,'Белый','11кг',6500000,10,7);
  INSERT INTO _dc VALUES (cid_spm,pid,'Стиральная машина LG',4200000,10,'Белый','7кг');
  INSERT INTO _dc VALUES (cid_spm,pid,'Стиральная машина LG',5200000,10,'Белый','9кг');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_spm,'Холодильник Samsung 300л',7200000,10,'Бытовая техника',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Серебристый','256л',5800000,10,12),(pid,'Серебристый','300л',7200000,10,9),(pid,'Серебристый','360л',9100000,10,5);
  INSERT INTO _dc VALUES (cid_spm,pid,'Холодильник Samsung',5800000,10,'Серебристый','256л');
  INSERT INTO _dc VALUES (cid_spm,pid,'Холодильник Samsung',7200000,10,'Серебристый','300л');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_spm,'Роутер TP-Link Archer AX3000',380000,22,'Сеть и связь',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Белый','AX1800',280000,22,32),(pid,'Белый','AX3000',380000,22,25),(pid,'Чёрный','AX5400',580000,22,12);
  INSERT INTO _dc VALUES (cid_spm,pid,'Роутер TP-Link Archer',280000,22,'Белый','AX1800');
  INSERT INTO _dc VALUES (cid_spm,pid,'Роутер TP-Link Archer',380000,22,'Белый','AX3000');
  INSERT INTO _dc VALUES (cid_spm,pid,'Роутер TP-Link Archer',580000,22,'Чёрный','AX5400');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_spm,'Кресло игровое DXRacer Formula',2100000,22,'Мебель',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Чёрный/Красный','Standard',2100000,22,16),(pid,'Чёрный/Синий','Standard',2100000,22,12),
    (pid,'Белый/Розовый','Standard',2100000,22,8),(pid,'Чёрный','King',2800000,22,5);
  INSERT INTO _dc VALUES (cid_spm,pid,'Кресло DXRacer Formula',2100000,22,'Чёрный/Красный','Standard');
  INSERT INTO _dc VALUES (cid_spm,pid,'Кресло DXRacer Formula',2100000,22,'Чёрный/Синий','Standard');
  INSERT INTO _dc VALUES (cid_spm,pid,'Кресло DXRacer Formula',2800000,22,'Чёрный','King');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_spm,'Внешний HDD Seagate 2TB',620000,20,'Накопители',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Чёрный','1TB',380000,20,42),(pid,'Чёрный','2TB',620000,20,28),(pid,'Чёрный','4TB',1100000,20,14);
  INSERT INTO _dc VALUES (cid_spm,pid,'Внешний HDD Seagate',380000,20,'Чёрный','1TB');
  INSERT INTO _dc VALUES (cid_spm,pid,'Внешний HDD Seagate',620000,20,'Чёрный','2TB');
  INSERT INTO _dc VALUES (cid_spm,pid,'Внешний HDD Seagate',1100000,20,'Чёрный','4TB');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_spm,'Флеш-накопитель Samsung USB 3.2',115000,30,'Накопители',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Чёрный','32GB',55000,30,75),(pid,'Чёрный','64GB',82000,30,60),
    (pid,'Чёрный','128GB',115000,30,50),(pid,'Чёрный','256GB',195000,30,30);
  INSERT INTO _dc VALUES (cid_spm,pid,'Флеш-накопитель Samsung',55000,30,'Чёрный','32GB');
  INSERT INTO _dc VALUES (cid_spm,pid,'Флеш-накопитель Samsung',82000,30,'Чёрный','64GB');
  INSERT INTO _dc VALUES (cid_spm,pid,'Флеш-накопитель Samsung',115000,30,'Чёрный','128GB');

  -- ────────────────────────────────────────────────────────────────
  -- TechZone — смартфоны, ноутбуки, гаджеты
  -- ────────────────────────────────────────────────────────────────

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_tech,'Apple iPhone 15 Pro',9800000,8.5,'Смартфоны',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Чёрный','128GB',9800000,8.5,42),(pid,'Чёрный','256GB',10900000,8.5,28),
    (pid,'Чёрный','512GB',12500000,8.5,14),(pid,'Белый','128GB',9800000,8.5,35),
    (pid,'Белый','256GB',10900000,8.5,22),(pid,'Синий','256GB',10900000,8.5,0),
    (pid,'Титановый','256GB',10900000,8.5,10);
  INSERT INTO _dc VALUES (cid_tech,pid,'Apple iPhone 15 Pro',9800000,8.5,'Чёрный','128GB');
  INSERT INTO _dc VALUES (cid_tech,pid,'Apple iPhone 15 Pro',10900000,8.5,'Чёрный','256GB');
  INSERT INTO _dc VALUES (cid_tech,pid,'Apple iPhone 15 Pro',12500000,8.5,'Чёрный','512GB');
  INSERT INTO _dc VALUES (cid_tech,pid,'Apple iPhone 15 Pro',9800000,8.5,'Белый','128GB');
  INSERT INTO _dc VALUES (cid_tech,pid,'Apple iPhone 15 Pro',10900000,8.5,'Белый','256GB');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_tech,'Apple iPhone 14',7200000,7,'Смартфоны',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Синий','128GB',7200000,7,55),(pid,'Синий','256GB',8200000,7,38),
    (pid,'Красный','128GB',7200000,7,45),(pid,'Чёрный','128GB',7200000,7,40),
    (pid,'Жёлтый','128GB',7200000,7,0);
  INSERT INTO _dc VALUES (cid_tech,pid,'Apple iPhone 14',7200000,7,'Синий','128GB');
  INSERT INTO _dc VALUES (cid_tech,pid,'Apple iPhone 14',8200000,7,'Синий','256GB');
  INSERT INTO _dc VALUES (cid_tech,pid,'Apple iPhone 14',7200000,7,'Красный','128GB');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_tech,'Samsung Galaxy S24 Ultra',11500000,8,'Смартфоны',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Чёрный','256GB',11500000,8,25),(pid,'Чёрный','512GB',13800000,8,12),
    (pid,'Серый','256GB',11500000,8,20),(pid,'Фиолетовый','256GB',11500000,8,8);
  INSERT INTO _dc VALUES (cid_tech,pid,'Samsung Galaxy S24 Ultra',11500000,8,'Чёрный','256GB');
  INSERT INTO _dc VALUES (cid_tech,pid,'Samsung Galaxy S24 Ultra',13800000,8,'Чёрный','512GB');
  INSERT INTO _dc VALUES (cid_tech,pid,'Samsung Galaxy S24 Ultra',11500000,8,'Серый','256GB');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_tech,'Samsung Galaxy A55 5G',3800000,10,'Смартфоны',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Синий','128GB',3800000,10,65),(pid,'Лиловый','128GB',3800000,10,48),
    (pid,'Тёмно-синий','256GB',4600000,10,32);
  INSERT INTO _dc VALUES (cid_tech,pid,'Samsung Galaxy A55',3800000,10,'Синий','128GB');
  INSERT INTO _dc VALUES (cid_tech,pid,'Samsung Galaxy A55',3800000,10,'Лиловый','128GB');
  INSERT INTO _dc VALUES (cid_tech,pid,'Samsung Galaxy A55',4600000,10,'Тёмно-синий','256GB');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_tech,'Xiaomi Redmi Note 13 Pro',3100000,10,'Смартфоны',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Чёрный','128GB',3100000,10,70),(pid,'Чёрный','256GB',3600000,10,45),
    (pid,'Лавандовый','256GB',3600000,10,38),(pid,'Синий','256GB',3600000,10,0);
  INSERT INTO _dc VALUES (cid_tech,pid,'Xiaomi Redmi Note 13 Pro',3100000,10,'Чёрный','128GB');
  INSERT INTO _dc VALUES (cid_tech,pid,'Xiaomi Redmi Note 13 Pro',3600000,10,'Чёрный','256GB');
  INSERT INTO _dc VALUES (cid_tech,pid,'Xiaomi Redmi Note 13 Pro',3600000,10,'Лавандовый','256GB');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_tech,'Apple MacBook Air M3 13"',17500000,7,'Ноутбуки',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Серебристый','8GB/256GB',17500000,7,15),(pid,'Серебристый','16GB/512GB',22000000,7,8),
    (pid,'Космос','8GB/256GB',17500000,7,12),(pid,'Полночь','8GB/256GB',17500000,7,0);
  INSERT INTO _dc VALUES (cid_tech,pid,'MacBook Air M3',17500000,7,'Серебристый','8GB/256GB');
  INSERT INTO _dc VALUES (cid_tech,pid,'MacBook Air M3',22000000,7,'Серебристый','16GB/512GB');
  INSERT INTO _dc VALUES (cid_tech,pid,'MacBook Air M3',17500000,7,'Космос','8GB/256GB');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_tech,'Apple iPad Pro 11" M4',12500000,7.5,'Планшеты',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Серебристый','256GB Wi-Fi',12500000,7.5,18),(pid,'Серебристый','512GB Wi-Fi',15800000,7.5,10),
    (pid,'Космос','256GB Wi-Fi',12500000,7.5,14),(pid,'Серебристый','256GB Wi-Fi+Cellular',14500000,7.5,6);
  INSERT INTO _dc VALUES (cid_tech,pid,'iPad Pro 11" M4',12500000,7.5,'Серебристый','256GB Wi-Fi');
  INSERT INTO _dc VALUES (cid_tech,pid,'iPad Pro 11" M4',15800000,7.5,'Серебристый','512GB Wi-Fi');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_tech,'Apple AirPods Pro 2',2800000,12,'Аудио',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Белый','USB-C',2800000,12,55),(pid,'Белый','Lightning',2500000,12,30);
  INSERT INTO _dc VALUES (cid_tech,pid,'AirPods Pro 2',2800000,12,'Белый','USB-C');
  INSERT INTO _dc VALUES (cid_tech,pid,'AirPods Pro 2',2500000,12,'Белый','Lightning');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_tech,'Sony WH-1000XM5 Наушники',2600000,12,'Аудио',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Чёрный','One Size',2600000,12,35),(pid,'Серебристый','One Size',2600000,12,22);
  INSERT INTO _dc VALUES (cid_tech,pid,'Sony WH-1000XM5',2600000,12,'Чёрный','One Size');
  INSERT INTO _dc VALUES (cid_tech,pid,'Sony WH-1000XM5',2600000,12,'Серебристый','One Size');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_tech,'Apple Watch Series 9 45mm',3500000,10,'Смарт-часы',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Полночь','41mm',3200000,10,28),(pid,'Полночь','45mm',3500000,10,22),
    (pid,'Серебристый','41mm',3200000,10,25),(pid,'Розовый','41mm',3200000,10,0);
  INSERT INTO _dc VALUES (cid_tech,pid,'Apple Watch Series 9',3200000,10,'Полночь','41mm');
  INSERT INTO _dc VALUES (cid_tech,pid,'Apple Watch Series 9',3500000,10,'Полночь','45mm');
  INSERT INTO _dc VALUES (cid_tech,pid,'Apple Watch Series 9',3200000,10,'Серебристый','41mm');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_tech,'Anker PowerBank 26800mAh',380000,25,'Аксессуары',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Чёрный','10000mAh',180000,25,80),(pid,'Чёрный','20000mAh',280000,25,65),
    (pid,'Чёрный','26800mAh',380000,25,50);
  INSERT INTO _dc VALUES (cid_tech,pid,'Anker PowerBank',180000,25,'Чёрный','10000mAh');
  INSERT INTO _dc VALUES (cid_tech,pid,'Anker PowerBank',280000,25,'Чёрный','20000mAh');
  INSERT INTO _dc VALUES (cid_tech,pid,'Anker PowerBank',380000,25,'Чёрный','26800mAh');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_tech,'GoPro HERO12 Black',3800000,9,'Фото/Видео',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Чёрный','Стандарт',3800000,9,20),(pid,'Чёрный','Creator Edition',4500000,9,8);
  INSERT INTO _dc VALUES (cid_tech,pid,'GoPro HERO12 Black',3800000,9,'Чёрный','Стандарт');
  INSERT INTO _dc VALUES (cid_tech,pid,'GoPro HERO12 Black',4500000,9,'Чёрный','Creator Edition');

  -- ────────────────────────────────────────────────────────────────
  -- ModaStyle — одежда, обувь, аксессуары
  -- ────────────────────────────────────────────────────────────────

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_moda,'Рубашка классическая мужская',185000,35,'Мужская одежда',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Белый','S',185000,35,30),(pid,'Белый','M',185000,35,45),(pid,'Белый','L',185000,35,50),
    (pid,'Белый','XL',185000,35,38),(pid,'Белый','XXL',185000,35,20),
    (pid,'Голубой','M',185000,35,35),(pid,'Голубой','L',185000,35,40),
    (pid,'Чёрный','M',185000,35,28),(pid,'Чёрный','L',185000,35,32),(pid,'Чёрный','XL',185000,35,18);
  INSERT INTO _dc VALUES (cid_moda,pid,'Рубашка классическая мужская',185000,35,'Белый','M');
  INSERT INTO _dc VALUES (cid_moda,pid,'Рубашка классическая мужская',185000,35,'Белый','L');
  INSERT INTO _dc VALUES (cid_moda,pid,'Рубашка классическая мужская',185000,35,'Голубой','L');
  INSERT INTO _dc VALUES (cid_moda,pid,'Рубашка классическая мужская',185000,35,'Чёрный','L');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_moda,'Джинсы Slim Fit мужские Levi''s 511',320000,30,'Мужская одежда',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Синий','28x30',320000,30,25),(pid,'Синий','30x32',320000,30,40),(pid,'Синий','32x32',320000,30,45),
    (pid,'Синий','34x32',320000,30,35),(pid,'Чёрный','30x32',320000,30,30),(pid,'Чёрный','32x32',320000,30,28),
    (pid,'Серый','30x32',360000,30,0);
  INSERT INTO _dc VALUES (cid_moda,pid,'Джинсы Levi''s 511 Slim Fit',320000,30,'Синий','32x32');
  INSERT INTO _dc VALUES (cid_moda,pid,'Джинсы Levi''s 511 Slim Fit',320000,30,'Синий','34x32');
  INSERT INTO _dc VALUES (cid_moda,pid,'Джинсы Levi''s 511 Slim Fit',320000,30,'Чёрный','32x32');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_moda,'Платье летнее женское миди',280000,40,'Женская одежда',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Белый','XS',280000,40,20),(pid,'Белый','S',280000,40,32),(pid,'Белый','M',280000,40,38),
    (pid,'Цветочный принт','S',280000,40,25),(pid,'Цветочный принт','M',280000,40,30),
    (pid,'Бежевый','S',280000,40,22),(pid,'Бежевый','M',280000,40,28),(pid,'Бежевый','L',280000,40,15);
  INSERT INTO _dc VALUES (cid_moda,pid,'Платье летнее женское миди',280000,40,'Белый','S');
  INSERT INTO _dc VALUES (cid_moda,pid,'Платье летнее женское миди',280000,40,'Белый','M');
  INSERT INTO _dc VALUES (cid_moda,pid,'Платье летнее женское миди',280000,40,'Цветочный принт','M');
  INSERT INTO _dc VALUES (cid_moda,pid,'Платье летнее женское миди',280000,40,'Бежевый','M');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_moda,'Кроссовки Nike Air Force 1',850000,25,'Обувь',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Белый','38',850000,25,18),(pid,'Белый','39',850000,25,22),(pid,'Белый','40',850000,25,28),
    (pid,'Белый','41',850000,25,32),(pid,'Белый','42',850000,25,25),(pid,'Белый','43',850000,25,20),
    (pid,'Чёрный','40',880000,25,15),(pid,'Чёрный','41',880000,25,18),(pid,'Чёрный','42',880000,25,12),
    (pid,'Белый/Красный','40',880000,25,0),(pid,'Белый/Красный','41',880000,25,0);
  INSERT INTO _dc VALUES (cid_moda,pid,'Nike Air Force 1',850000,25,'Белый','40');
  INSERT INTO _dc VALUES (cid_moda,pid,'Nike Air Force 1',850000,25,'Белый','41');
  INSERT INTO _dc VALUES (cid_moda,pid,'Nike Air Force 1',850000,25,'Белый','42');
  INSERT INTO _dc VALUES (cid_moda,pid,'Nike Air Force 1',880000,25,'Чёрный','41');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_moda,'Кроссовки Adidas Ultraboost 22',950000,22,'Обувь',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Белый','38',950000,22,15),(pid,'Белый','39',950000,22,18),(pid,'Белый','40',950000,22,22),
    (pid,'Белый','41',950000,22,20),(pid,'Серый','40',950000,22,16),(pid,'Чёрный','40',950000,22,14),
    (pid,'Чёрный','41',950000,22,12),(pid,'Чёрный','42',950000,22,0);
  INSERT INTO _dc VALUES (cid_moda,pid,'Adidas Ultraboost 22',950000,22,'Белый','40');
  INSERT INTO _dc VALUES (cid_moda,pid,'Adidas Ultraboost 22',950000,22,'Белый','41');
  INSERT INTO _dc VALUES (cid_moda,pid,'Adidas Ultraboost 22',950000,22,'Чёрный','40');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_moda,'Футболка базовая унисекс',89000,45,'Базовая одежда',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Белый','XS',89000,45,55),(pid,'Белый','S',89000,45,70),(pid,'Белый','M',89000,45,85),
    (pid,'Белый','L',89000,45,75),(pid,'Белый','XL',89000,45,60),
    (pid,'Чёрный','S',89000,45,65),(pid,'Чёрный','M',89000,45,80),(pid,'Чёрный','L',89000,45,70),
    (pid,'Серый меланж','M',89000,45,60),(pid,'Серый меланж','L',89000,45,55);
  INSERT INTO _dc VALUES (cid_moda,pid,'Футболка базовая унисекс',89000,45,'Белый','M');
  INSERT INTO _dc VALUES (cid_moda,pid,'Футболка базовая унисекс',89000,45,'Белый','L');
  INSERT INTO _dc VALUES (cid_moda,pid,'Футболка базовая унисекс',89000,45,'Чёрный','M');
  INSERT INTO _dc VALUES (cid_moda,pid,'Футболка базовая унисекс',89000,45,'Серый меланж','M');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_moda,'Худи оверсайз Premium',250000,40,'Базовая одежда',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Чёрный','S',250000,40,35),(pid,'Чёрный','M',250000,40,45),(pid,'Чёрный','L',250000,40,40),
    (pid,'Белый','M',250000,40,38),(pid,'Белый','L',250000,40,32),
    (pid,'Серый','M',250000,40,30),(pid,'Зелёный хаки','M',250000,40,25),(pid,'Зелёный хаки','L',250000,40,0);
  INSERT INTO _dc VALUES (cid_moda,pid,'Худи оверсайз Premium',250000,40,'Чёрный','M');
  INSERT INTO _dc VALUES (cid_moda,pid,'Худи оверсайз Premium',250000,40,'Чёрный','L');
  INSERT INTO _dc VALUES (cid_moda,pid,'Худи оверсайз Premium',250000,40,'Белый','M');
  INSERT INTO _dc VALUES (cid_moda,pid,'Худи оверсайз Premium',250000,40,'Серый','M');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_moda,'Костюм деловой мужской',1200000,28,'Мужская одежда',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Тёмно-синий','46',1200000,28,12),(pid,'Тёмно-синий','48',1200000,28,15),
    (pid,'Тёмно-синий','50',1200000,28,18),(pid,'Тёмно-синий','52',1200000,28,10),
    (pid,'Серый','48',1200000,28,14),(pid,'Серый','50',1200000,28,16),(pid,'Чёрный','48',1300000,28,0);
  INSERT INTO _dc VALUES (cid_moda,pid,'Костюм деловой мужской',1200000,28,'Тёмно-синий','48');
  INSERT INTO _dc VALUES (cid_moda,pid,'Костюм деловой мужской',1200000,28,'Тёмно-синий','50');
  INSERT INTO _dc VALUES (cid_moda,pid,'Костюм деловой мужской',1200000,28,'Серый','50');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_moda,'Пальто женское демисезонное',980000,30,'Женская одежда',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Бежевый','XS',980000,30,12),(pid,'Бежевый','S',980000,30,16),(pid,'Бежевый','M',980000,30,14),
    (pid,'Чёрный','S',980000,30,18),(pid,'Чёрный','M',980000,30,15),(pid,'Серый','M',1050000,30,8);
  INSERT INTO _dc VALUES (cid_moda,pid,'Пальто женское демисезонное',980000,30,'Бежевый','S');
  INSERT INTO _dc VALUES (cid_moda,pid,'Пальто женское демисезонное',980000,30,'Чёрный','M');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_moda,'Сумка женская кожаная Tote',450000,45,'Аксессуары',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Бежевый','S',450000,45,22),(pid,'Чёрный','S',450000,45,28),(pid,'Коричневый','S',450000,45,18),
    (pid,'Бежевый','L',580000,45,15),(pid,'Чёрный','L',580000,45,20);
  INSERT INTO _dc VALUES (cid_moda,pid,'Сумка женская кожаная Tote',450000,45,'Бежевый','S');
  INSERT INTO _dc VALUES (cid_moda,pid,'Сумка женская кожаная Tote',450000,45,'Чёрный','S');
  INSERT INTO _dc VALUES (cid_moda,pid,'Сумка женская кожаная Tote',580000,45,'Чёрный','L');

  -- ────────────────────────────────────────────────────────────────
  -- BuildMart — стройматериалы, инструменты
  -- ────────────────────────────────────────────────────────────────

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_build,'Цемент Portland M400 50кг',68000,15,'Цемент и смеси',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Серый','50кг M400',68000,15,200),(pid,'Серый','50кг M500',82000,15,150);
  INSERT INTO _dc VALUES (cid_build,pid,'Цемент Portland M400',68000,15,'Серый','50кг M400');
  INSERT INTO _dc VALUES (cid_build,pid,'Цемент Portland M500',82000,15,'Серый','50кг M500');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_build,'Плитка керамическая 60x60 (1м²)',180000,20,'Отделочные материалы',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Белый','60x60',180000,20,120),(pid,'Серый','60x60',185000,20,100),
    (pid,'Бежевый','60x60',185000,20,90),(pid,'Чёрный','60x60',195000,20,60),
    (pid,'Мрамор белый','60x60',220000,20,40),(pid,'Белый','30x60',120000,20,150);
  INSERT INTO _dc VALUES (cid_build,pid,'Плитка керамическая 60x60',180000,20,'Белый','60x60');
  INSERT INTO _dc VALUES (cid_build,pid,'Плитка керамическая 60x60',185000,20,'Серый','60x60');
  INSERT INTO _dc VALUES (cid_build,pid,'Плитка керамическая 60x60',185000,20,'Бежевый','60x60');
  INSERT INTO _dc VALUES (cid_build,pid,'Плитка керамическая 60x60',220000,20,'Мрамор белый','60x60');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_build,'Краска фасадная водоэмульсионная 20кг',320000,20,'Краски и лаки',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Белый','5кг',95000,20,80),(pid,'Белый','10кг',175000,20,65),(pid,'Белый','20кг',320000,20,50),
    (pid,'Бежевый','10кг',185000,20,40),(pid,'Серый','10кг',180000,20,35);
  INSERT INTO _dc VALUES (cid_build,pid,'Краска фасадная белая',95000,20,'Белый','5кг');
  INSERT INTO _dc VALUES (cid_build,pid,'Краска фасадная белая',175000,20,'Белый','10кг');
  INSERT INTO _dc VALUES (cid_build,pid,'Краска фасадная белая',320000,20,'Белый','20кг');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_build,'Ламинат Quick-Step 33 класс (1м²)',95000,22,'Напольные покрытия',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Дуб натуральный','8мм 33кл',95000,22,300),(pid,'Дуб серый','8мм 33кл',98000,22,250),
    (pid,'Дуб тёмный','8мм 33кл',98000,22,200),(pid,'Ясень белый','10мм 34кл',115000,22,150),
    (pid,'Дуб натуральный','10мм 34кл',115000,22,180);
  INSERT INTO _dc VALUES (cid_build,pid,'Ламинат Quick-Step Дуб натуральный',95000,22,'Дуб натуральный','8мм 33кл');
  INSERT INTO _dc VALUES (cid_build,pid,'Ламинат Quick-Step Дуб серый',98000,22,'Дуб серый','8мм 33кл');
  INSERT INTO _dc VALUES (cid_build,pid,'Ламинат Quick-Step Ясень',115000,22,'Ясень белый','10мм 34кл');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_build,'Шпаклёвка финишная Knauf 25кг',85000,18,'Смеси',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Белый','25кг финиш',85000,18,180),(pid,'Белый','25кг старт',72000,18,160);
  INSERT INTO _dc VALUES (cid_build,pid,'Шпаклёвка финишная Knauf',85000,18,'Белый','25кг финиш');
  INSERT INTO _dc VALUES (cid_build,pid,'Шпаклёвка стартовая Knauf',72000,18,'Белый','25кг старт');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_build,'Дрель-шуруповёрт Bosch GSR 12V',890000,18,'Инструменты',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Синий','12V 1 акб',890000,18,25),(pid,'Синий','12V 2 акб',1100000,18,18),
    (pid,'Синий','18V 1 акб',1350000,18,12),(pid,'Синий','18V 2 акб',1650000,18,8);
  INSERT INTO _dc VALUES (cid_build,pid,'Bosch GSR шуруповёрт 12V',890000,18,'Синий','12V 1 акб');
  INSERT INTO _dc VALUES (cid_build,pid,'Bosch GSR шуруповёрт 18V',1350000,18,'Синий','18V 1 акб');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_build,'Гипсокартон Knauf 12.5мм (лист)',95000,18,'Перегородки',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Серый','2500x1200x12.5',95000,18,500),(pid,'Зелёный (влагостойкий)','2500x1200x12.5',115000,18,300),
    (pid,'Розовый (огнестойкий)','2500x1200x12.5',125000,18,200);
  INSERT INTO _dc VALUES (cid_build,pid,'Гипсокартон Knauf обычный',95000,18,'Серый','2500x1200x12.5');
  INSERT INTO _dc VALUES (cid_build,pid,'Гипсокартон Knauf влагостойкий',115000,18,'Зелёный (влагостойкий)','2500x1200x12.5');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_build,'Обои виниловые на флизелине (рулон)',85000,25,'Отделочные материалы',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Бежевый геометрия','1.06x10м',85000,25,60),(pid,'Серый геометрия','1.06x10м',85000,25,55),
    (pid,'Белый рельеф','1.06x10м',78000,25,70),(pid,'Голубой цветы','1.06x10м',90000,25,45);
  INSERT INTO _dc VALUES (cid_build,pid,'Обои виниловые бежевые',85000,25,'Бежевый геометрия','1.06x10м');
  INSERT INTO _dc VALUES (cid_build,pid,'Обои виниловые серые',85000,25,'Серый геометрия','1.06x10м');
  INSERT INTO _dc VALUES (cid_build,pid,'Обои виниловые белые',78000,25,'Белый рельеф','1.06x10м');

  -- ────────────────────────────────────────────────────────────────
  -- HomeNest — мебель, техника, декор
  -- ────────────────────────────────────────────────────────────────

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_home,'Диван угловой Comfort L-образный',4200000,22,'Диваны',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Серый','250x160см',4200000,22,8),(pid,'Бежевый','250x160см',4200000,22,6),
    (pid,'Тёмно-синий','250x160см',4500000,22,5),(pid,'Зелёный','270x180см',5200000,22,3);
  INSERT INTO _dc VALUES (cid_home,pid,'Диван угловой Comfort',4200000,22,'Серый','250x160см');
  INSERT INTO _dc VALUES (cid_home,pid,'Диван угловой Comfort',4200000,22,'Бежевый','250x160см');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_home,'Кровать двуспальная Classic 160x200',3500000,20,'Кровати',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Белый','140x200',3000000,20,12),(pid,'Белый','160x200',3500000,20,10),
    (pid,'Орех','160x200',3800000,20,8),(pid,'Белый','180x200',4200000,20,6),
    (pid,'Орех','180x200',4500000,20,4);
  INSERT INTO _dc VALUES (cid_home,pid,'Кровать Classic',3000000,20,'Белый','140x200');
  INSERT INTO _dc VALUES (cid_home,pid,'Кровать Classic',3500000,20,'Белый','160x200');
  INSERT INTO _dc VALUES (cid_home,pid,'Кровать Classic',3800000,20,'Орех','160x200');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_home,'Шкаф-купе 3-дверный Infinity',2800000,22,'Шкафы',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Белый','150x220см',2800000,22,10),(pid,'Белый','180x220см',3200000,22,8),
    (pid,'Белый','210x220см',3800000,22,6),(pid,'Венге','180x220см',3500000,22,5);
  INSERT INTO _dc VALUES (cid_home,pid,'Шкаф-купе Infinity',2800000,22,'Белый','150x220см');
  INSERT INTO _dc VALUES (cid_home,pid,'Шкаф-купе Infinity',3200000,22,'Белый','180x220см');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_home,'Постельное бельё сатин 2-спальное',280000,40,'Текстиль',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Белый','1.5 спальное',220000,40,35),(pid,'Белый','2 спальное',280000,40,45),
    (pid,'Серый','2 спальное',280000,40,38),(pid,'Бежевый','2 спальное',280000,40,30),
    (pid,'Синий','2 спальное',280000,40,25),(pid,'Белый','Евро',320000,40,28);
  INSERT INTO _dc VALUES (cid_home,pid,'Постельное бельё сатин',220000,40,'Белый','1.5 спальное');
  INSERT INTO _dc VALUES (cid_home,pid,'Постельное бельё сатин',280000,40,'Белый','2 спальное');
  INSERT INTO _dc VALUES (cid_home,pid,'Постельное бельё сатин',280000,40,'Серый','2 спальное');
  INSERT INTO _dc VALUES (cid_home,pid,'Постельное бельё сатин',320000,40,'Белый','Евро');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_home,'Робот-пылесос Xiaomi Mi Robot Vacuum',2200000,18,'Бытовая техника',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Белый','S10',1800000,18,20),(pid,'Белый','S10+',2200000,18,15),(pid,'Чёрный','S20+',3500000,18,8);
  INSERT INTO _dc VALUES (cid_home,pid,'Xiaomi Robot Vacuum S10',1800000,18,'Белый','S10');
  INSERT INTO _dc VALUES (cid_home,pid,'Xiaomi Robot Vacuum S10+',2200000,18,'Белый','S10+');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_home,'Люстра потолочная LED 120Вт',450000,35,'Освещение',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Хром','48Вт 60см',280000,35,30),(pid,'Хром','80Вт 80см',380000,35,22),
    (pid,'Хром','120Вт 100см',450000,35,15),(pid,'Золото','80Вт 80см',420000,35,18),
    (pid,'Чёрный','80Вт 80см',390000,35,12);
  INSERT INTO _dc VALUES (cid_home,pid,'Люстра LED 48Вт',280000,35,'Хром','48Вт 60см');
  INSERT INTO _dc VALUES (cid_home,pid,'Люстра LED 80Вт',380000,35,'Хром','80Вт 80см');
  INSERT INTO _dc VALUES (cid_home,pid,'Люстра LED 120Вт',450000,35,'Хром','120Вт 100см');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_home,'Ковёр шерстяной 2x3м',650000,28,'Текстиль',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Бежевый','1.5x2м',480000,28,15),(pid,'Бежевый','2x3м',650000,28,12),
    (pid,'Серый','2x3м',650000,28,10),(pid,'Красный','2x3м',680000,28,8);
  INSERT INTO _dc VALUES (cid_home,pid,'Ковёр шерстяной',480000,28,'Бежевый','1.5x2м');
  INSERT INTO _dc VALUES (cid_home,pid,'Ковёр шерстяной',650000,28,'Бежевый','2x3м');
  INSERT INTO _dc VALUES (cid_home,pid,'Ковёр шерстяной',650000,28,'Серый','2x3м');

  -- ────────────────────────────────────────────────────────────────
  -- SportPro — спорттовары, тренажёры
  -- ────────────────────────────────────────────────────────────────

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_sport,'Велосипед горный Cube Aim 29"',3500000,18,'Велосипеды',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Чёрный/Серый','16"',3500000,18,8),(pid,'Чёрный/Серый','18"',3500000,18,10),
    (pid,'Синий/Белый','18"',3700000,18,7),(pid,'Зелёный','20"',3800000,18,5);
  INSERT INTO _dc VALUES (cid_sport,pid,'Велосипед Cube Aim 29"',3500000,18,'Чёрный/Серый','18"');
  INSERT INTO _dc VALUES (cid_sport,pid,'Велосипед Cube Aim 29"',3700000,18,'Синий/Белый','18"');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_sport,'Гантели разборные 20кг (пара)',380000,25,'Тренажёры',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Чёрный','10кг пара',220000,25,25),(pid,'Чёрный','20кг пара',380000,25,20),
    (pid,'Чёрный','30кг пара',520000,25,12);
  INSERT INTO _dc VALUES (cid_sport,pid,'Гантели разборные 10кг',220000,25,'Чёрный','10кг пара');
  INSERT INTO _dc VALUES (cid_sport,pid,'Гантели разборные 20кг',380000,25,'Чёрный','20кг пара');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_sport,'Коврик для йоги NBR 10мм',85000,45,'Фитнес',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Фиолетовый','183x61x10мм',85000,45,50),(pid,'Синий','183x61x10мм',85000,45,48),
    (pid,'Зелёный','183x61x10мм',85000,45,42),(pid,'Серый','183x80x10мм',110000,45,30);
  INSERT INTO _dc VALUES (cid_sport,pid,'Коврик для йоги',85000,45,'Фиолетовый','183x61x10мм');
  INSERT INTO _dc VALUES (cid_sport,pid,'Коврик для йоги',85000,45,'Синий','183x61x10мм');
  INSERT INTO _dc VALUES (cid_sport,pid,'Коврик для йоги',85000,45,'Зелёный','183x61x10мм');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_sport,'Боксёрские перчатки Everlast Pro',220000,35,'Единоборства',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Красный','8 oz',220000,35,20),(pid,'Красный','10 oz',220000,35,25),(pid,'Красный','12 oz',220000,35,22),
    (pid,'Синий','10 oz',220000,35,18),(pid,'Чёрный','10 oz',220000,35,15),(pid,'Чёрный','12 oz',220000,35,12);
  INSERT INTO _dc VALUES (cid_sport,pid,'Боксёрские перчатки Everlast',220000,35,'Красный','10 oz');
  INSERT INTO _dc VALUES (cid_sport,pid,'Боксёрские перчатки Everlast',220000,35,'Синий','10 oz');
  INSERT INTO _dc VALUES (cid_sport,pid,'Боксёрские перчатки Everlast',220000,35,'Чёрный','12 oz');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_sport,'Мяч футбольный Nike Premier League',280000,30,'Командные виды спорта',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Белый/Синий','3',250000,30,30),(pid,'Белый/Синий','4',265000,30,35),(pid,'Белый/Синий','5',280000,30,45);
  INSERT INTO _dc VALUES (cid_sport,pid,'Мяч футбольный Nike',265000,30,'Белый/Синий','4');
  INSERT INTO _dc VALUES (cid_sport,pid,'Мяч футбольный Nike',280000,30,'Белый/Синий','5');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_sport,'Протеин сывороточный Optimum Gold Standard 1кг',280000,35,'Спортивное питание',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Шоколад','1кг 30 порций',280000,35,40),(pid,'Ваниль','1кг 30 порций',280000,35,38),
    (pid,'Клубника','1кг 30 порций',280000,35,30),(pid,'Шоколад','2.27кг 72 порции',580000,35,25);
  INSERT INTO _dc VALUES (cid_sport,pid,'Протеин Optimum Gold Standard',280000,35,'Шоколад','1кг 30 порций');
  INSERT INTO _dc VALUES (cid_sport,pid,'Протеин Optimum Gold Standard',280000,35,'Ваниль','1кг 30 порций');
  INSERT INTO _dc VALUES (cid_sport,pid,'Протеин Optimum Gold Standard',580000,35,'Шоколад','2.27кг 72 порции');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_sport,'Рюкзак туристический Osprey Talon 33л',650000,30,'Туризм',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Серый','22л',480000,30,15),(pid,'Серый','33л',650000,30,12),(pid,'Синий','33л',650000,30,10),
    (pid,'Чёрный','44л',850000,30,8);
  INSERT INTO _dc VALUES (cid_sport,pid,'Рюкзак туристический Osprey',480000,30,'Серый','22л');
  INSERT INTO _dc VALUES (cid_sport,pid,'Рюкзак туристический Osprey',650000,30,'Серый','33л');

  -- ────────────────────────────────────────────────────────────────
  -- FreshFood — продукты питания
  -- ────────────────────────────────────────────────────────────────

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_food,'Рис Лазер Premium',65000,15,'Крупы и злаки',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'—','1кг',15000,15,300),(pid,'—','5кг',65000,15,250),(pid,'—','10кг',125000,15,180);
  INSERT INTO _dc VALUES (cid_food,pid,'Рис Лазер Premium',15000,15,'—','1кг');
  INSERT INTO _dc VALUES (cid_food,pid,'Рис Лазер Premium',65000,15,'—','5кг');
  INSERT INTO _dc VALUES (cid_food,pid,'Рис Лазер Premium',125000,15,'—','10кг');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_food,'Масло подсолнечное «Олейна» рафинированное',85000,12,'Масло и соусы',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'—','1л',22000,12,400),(pid,'—','3л',60000,12,300),(pid,'—','5л',85000,12,250);
  INSERT INTO _dc VALUES (cid_food,pid,'Масло подсолнечное Олейна',22000,12,'—','1л');
  INSERT INTO _dc VALUES (cid_food,pid,'Масло подсолнечное Олейна',60000,12,'—','3л');
  INSERT INTO _dc VALUES (cid_food,pid,'Масло подсолнечное Олейна',85000,12,'—','5л');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_food,'Мука пшеничная высший сорт',48000,12,'Мука и выпечка',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'—','2кг',22000,12,350),(pid,'—','5кг',48000,12,300),(pid,'—','10кг',90000,12,200);
  INSERT INTO _dc VALUES (cid_food,pid,'Мука пшеничная в/с',22000,12,'—','2кг');
  INSERT INTO _dc VALUES (cid_food,pid,'Мука пшеничная в/с',48000,12,'—','5кг');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_food,'Говядина охлаждённая (1кг)',120000,12,'Мясо и птица',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'—','Вырезка 1кг',120000,12,80),(pid,'—','Лопатка 1кг',98000,12,100),
    (pid,'—','Рёбрышки 1кг',85000,12,90);
  INSERT INTO _dc VALUES (cid_food,pid,'Говядина вырезка',120000,12,'—','Вырезка 1кг');
  INSERT INTO _dc VALUES (cid_food,pid,'Говядина лопатка',98000,12,'—','Лопатка 1кг');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_food,'Куриное филе охлаждённое (1кг)',68000,15,'Мясо и птица',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'—','Филе 1кг',68000,15,150),(pid,'—','Бедро 1кг',55000,15,180),
    (pid,'—','Крылья 1кг',45000,15,200);
  INSERT INTO _dc VALUES (cid_food,pid,'Куриное филе',68000,15,'—','Филе 1кг');
  INSERT INTO _dc VALUES (cid_food,pid,'Куриное бедро',55000,15,'—','Бедро 1кг');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_food,'Яйца куриные C1 (30шт)',78000,10,'Молочное и яйца',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'—','10шт C1',28000,10,200),(pid,'—','30шт C1',78000,10,180),(pid,'—','30шт C0',92000,10,120);
  INSERT INTO _dc VALUES (cid_food,pid,'Яйца C1',28000,10,'—','10шт C1');
  INSERT INTO _dc VALUES (cid_food,pid,'Яйца C1',78000,10,'—','30шт C1');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_food,'Чай Lipton Yellow Label 100 пак',65000,20,'Чай и кофе',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'—','25 пак',22000,20,300),(pid,'—','50 пак',40000,20,250),(pid,'—','100 пак',65000,20,200);
  INSERT INTO _dc VALUES (cid_food,pid,'Чай Lipton Yellow',22000,20,'—','25 пак');
  INSERT INTO _dc VALUES (cid_food,pid,'Чай Lipton Yellow',65000,20,'—','100 пак');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_food,'Молоко «Parmalat» 3.5% (1л)',18500,15,'Молочное и яйца',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'—','1л 2.5%',16000,15,400),(pid,'—','1л 3.5%',18500,15,380),(pid,'—','2л 3.5%',34000,15,200);
  INSERT INTO _dc VALUES (cid_food,pid,'Молоко Parmalat 2.5%',16000,15,'—','1л 2.5%');
  INSERT INTO _dc VALUES (cid_food,pid,'Молоко Parmalat 3.5%',18500,15,'—','1л 3.5%');

  -- ────────────────────────────────────────────────────────────────
  -- MediCare — аптека, медтовары, БАД
  -- ────────────────────────────────────────────────────────────────

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_medi,'Тонометр автоматический Omron M3',380000,25,'Медоборудование',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Белый','Запястный',250000,25,30),(pid,'Белый','Плечевой M3',380000,25,25),
    (pid,'Белый','Плечевой M6',520000,25,15);
  INSERT INTO _dc VALUES (cid_medi,pid,'Тонометр Omron запястный',250000,25,'Белый','Запястный');
  INSERT INTO _dc VALUES (cid_medi,pid,'Тонометр Omron M3',380000,25,'Белый','Плечевой M3');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_medi,'Небулайзер компрессорный Little Doctor',450000,22,'Медоборудование',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Белый','LD-212C',380000,22,20),(pid,'Белый','LD-221C',450000,22,15),(pid,'Белый','LD-250U',680000,22,8);
  INSERT INTO _dc VALUES (cid_medi,pid,'Небулайзер Little Doctor',380000,22,'Белый','LD-212C');
  INSERT INTO _dc VALUES (cid_medi,pid,'Небулайзер Little Doctor',450000,22,'Белый','LD-221C');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_medi,'Термометр электронный Braun',65000,35,'Медоборудование',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Белый','Подмышечный',65000,35,60),(pid,'Белый','Инфракрасный лоб',185000,35,35),
    (pid,'Белый','Инфракрасный ушной',220000,35,25);
  INSERT INTO _dc VALUES (cid_medi,pid,'Термометр Braun подмышечный',65000,35,'Белый','Подмышечный');
  INSERT INTO _dc VALUES (cid_medi,pid,'Термометр Braun инфракрасный',185000,35,'Белый','Инфракрасный лоб');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_medi,'Витамин С 1000мг Naturalis 30шт',65000,30,'Витамины и БАД',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'—','500мг 30шт',45000,30,80),(pid,'—','1000мг 30шт',65000,30,70),
    (pid,'—','1000мг 60шт',115000,30,55);
  INSERT INTO _dc VALUES (cid_medi,pid,'Витамин С 500мг',45000,30,'—','500мг 30шт');
  INSERT INTO _dc VALUES (cid_medi,pid,'Витамин С 1000мг',65000,30,'—','1000мг 30шт');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_medi,'Омега-3 рыбий жир 1000мг 60 капсул',120000,28,'Витамины и БАД',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'—','30 капс',72000,28,55),(pid,'—','60 капс',120000,28,48),(pid,'—','120 капс',210000,28,35);
  INSERT INTO _dc VALUES (cid_medi,pid,'Омега-3 рыбий жир',72000,28,'—','30 капс');
  INSERT INTO _dc VALUES (cid_medi,pid,'Омега-3 рыбий жир',120000,28,'—','60 капс');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_medi,'Маски медицинские 3-слойные 50шт',45000,30,'Средства защиты',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Белый','50шт 3-слойные',45000,30,200),(pid,'Синий','50шт 3-слойные',45000,30,180),
    (pid,'—','10шт FFP2',55000,30,120);
  INSERT INTO _dc VALUES (cid_medi,pid,'Маски медицинские 3-слойные',45000,30,'Белый','50шт 3-слойные');
  INSERT INTO _dc VALUES (cid_medi,pid,'Маски FFP2',55000,30,'—','10шт FFP2');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_medi,'Антисептик кожный 500мл',58000,25,'Средства защиты',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'—','100мл',18000,25,150),(pid,'—','250мл',32000,25,120),(pid,'—','500мл',58000,25,100);
  INSERT INTO _dc VALUES (cid_medi,pid,'Антисептик 100мл',18000,25,'—','100мл');
  INSERT INTO _dc VALUES (cid_medi,pid,'Антисептик 500мл',58000,25,'—','500мл');

  -- ────────────────────────────────────────────────────────────────
  -- AutoMaster — автозапчасти, масла, аксессуары
  -- ────────────────────────────────────────────────────────────────

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_auto,'Моторное масло Mobil 1 5W-30 4л',280000,18,'Масла и жидкости',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'—','4л 5W-30',280000,18,60),(pid,'—','4л 5W-40',295000,18,55),(pid,'—','4л 0W-40',320000,18,40),
    (pid,'—','1л 5W-30',82000,18,100);
  INSERT INTO _dc VALUES (cid_auto,pid,'Mobil 1 5W-30 4л',280000,18,'—','4л 5W-30');
  INSERT INTO _dc VALUES (cid_auto,pid,'Mobil 1 5W-40 4л',295000,18,'—','4л 5W-40');
  INSERT INTO _dc VALUES (cid_auto,pid,'Mobil 1 1л',82000,18,'—','1л 5W-30');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_auto,'Тормозные колодки Bosch передние',180000,22,'Тормозная система',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Серый','Cobalt/Lacetti',145000,22,30),(pid,'Серый','Nexia 2/3',140000,22,25),
    (pid,'Серый','Malibu/Cruze',180000,22,20),(pid,'Серый','Tracker/Captiva',195000,22,15);
  INSERT INTO _dc VALUES (cid_auto,pid,'Тормозные колодки Cobalt/Lacetti',145000,22,'Серый','Cobalt/Lacetti');
  INSERT INTO _dc VALUES (cid_auto,pid,'Тормозные колодки Malibu',180000,22,'Серый','Malibu/Cruze');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_auto,'Аккумулятор Bosch S4 60Ah',950000,15,'Электрика',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Чёрный','45Ah 400A',680000,15,18),(pid,'Чёрный','60Ah 540A',950000,15,14),
    (pid,'Чёрный','74Ah 680A',1200000,15,8),(pid,'Чёрный','88Ah 740A',1450000,15,5);
  INSERT INTO _dc VALUES (cid_auto,pid,'Аккумулятор Bosch 45Ah',680000,15,'Чёрный','45Ah 400A');
  INSERT INTO _dc VALUES (cid_auto,pid,'Аккумулятор Bosch 60Ah',950000,15,'Чёрный','60Ah 540A');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_auto,'Свечи зажигания NGK Iridium (4шт)',85000,25,'Двигатель',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'—','BKR6EIX (4шт)',85000,25,40),(pid,'—','BKR5EIX (4шт)',85000,25,38),
    (pid,'—','IFR6T11 (4шт)',120000,25,25);
  INSERT INTO _dc VALUES (cid_auto,pid,'Свечи NGK BKR6EIX',85000,25,'—','BKR6EIX (4шт)');
  INSERT INTO _dc VALUES (cid_auto,pid,'Свечи NGK BKR5EIX',85000,25,'—','BKR5EIX (4шт)');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_auto,'Шины Bridgestone Ecopia 205/55 R16 (1шт)',550000,15,'Шины и диски',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'—','185/65 R15',420000,15,24),(pid,'—','205/55 R16',550000,15,20),
    (pid,'—','215/55 R17',620000,15,15),(pid,'—','225/45 R18',720000,15,10);
  INSERT INTO _dc VALUES (cid_auto,pid,'Шина Bridgestone 185/65 R15',420000,15,'—','185/65 R15');
  INSERT INTO _dc VALUES (cid_auto,pid,'Шина Bridgestone 205/55 R16',550000,15,'—','205/55 R16');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_auto,'Видеорегистратор Xiaomi 70mai Pro+',580000,22,'Аксессуары',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Чёрный','A500S без GPS',450000,22,25),(pid,'Чёрный','A500S с GPS',580000,22,20),
    (pid,'Чёрный','A800 4K',980000,22,12);
  INSERT INTO _dc VALUES (cid_auto,pid,'70mai A500S без GPS',450000,22,'Чёрный','A500S без GPS');
  INSERT INTO _dc VALUES (cid_auto,pid,'70mai A500S с GPS',580000,22,'Чёрный','A500S с GPS');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_auto,'Автосигнализация Pandect X-1800',1200000,20,'Безопасность',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'—','X-800 без реле',680000,20,15),(pid,'—','X-1800 с реле',1200000,20,12),(pid,'—','X-3110 GSM',1800000,20,6);
  INSERT INTO _dc VALUES (cid_auto,pid,'Pandect X-800',680000,20,'—','X-800 без реле');
  INSERT INTO _dc VALUES (cid_auto,pid,'Pandect X-1800',1200000,20,'—','X-1800 с реле');

  -- ────────────────────────────────────────────────────────────────
  -- KidZone — игрушки, товары для детей
  -- ────────────────────────────────────────────────────────────────

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_kid,'Конструктор LEGO Classic Large Creative',850000,25,'Конструкторы',false,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'—','500 дет. 5+',580000,25,20),(pid,'—','900 дет. 6+',850000,25,15),(pid,'—','1500 дет. 8+',1300000,25,10);
  INSERT INTO _dc VALUES (cid_kid,pid,'LEGO Classic 500 дет',580000,25,'—','500 дет. 5+');
  INSERT INTO _dc VALUES (cid_kid,pid,'LEGO Classic 900 дет',850000,25,'—','900 дет. 6+');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_kid,'Кукла Barbie Fashionista + аксессуары',180000,35,'Куклы',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Блондинка','Базовая',180000,35,30),(pid,'Брюнетка','Базовая',180000,35,28),
    (pid,'Рыжая','Базовая',180000,35,22),(pid,'Блондинка','DreamHouse + куколка',580000,35,8);
  INSERT INTO _dc VALUES (cid_kid,pid,'Barbie Fashionista блондинка',180000,35,'Блондинка','Базовая');
  INSERT INTO _dc VALUES (cid_kid,pid,'Barbie Fashionista брюнетка',180000,35,'Брюнетка','Базовая');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_kid,'Самокат детский складной Globber',450000,28,'Самокаты',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Красный','2-3 колеса 2-5 лет',350000,28,18),(pid,'Синий','2-3 колеса 2-5 лет',350000,28,16),
    (pid,'Зелёный','2 колеса 5-12 лет',450000,28,14),(pid,'Чёрный','2 колеса 8+',580000,28,10);
  INSERT INTO _dc VALUES (cid_kid,pid,'Самокат Globber 2-5 лет',350000,28,'Красный','2-3 колеса 2-5 лет');
  INSERT INTO _dc VALUES (cid_kid,pid,'Самокат Globber 2-5 лет',350000,28,'Синий','2-3 колеса 2-5 лет');
  INSERT INTO _dc VALUES (cid_kid,pid,'Самокат Globber 5-12 лет',450000,28,'Зелёный','2 колеса 5-12 лет');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_kid,'Велосипед детский 16" Stels',1200000,22,'Велосипеды',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Красный','12" 3-5 лет',850000,22,12),(pid,'Синий','14" 4-6 лет',1000000,22,10),
    (pid,'Зелёный','16" 5-8 лет',1200000,22,8),(pid,'Чёрный','20" 7-10 лет',1600000,22,6);
  INSERT INTO _dc VALUES (cid_kid,pid,'Велосипед Stels 12"',850000,22,'Красный','12" 3-5 лет');
  INSERT INTO _dc VALUES (cid_kid,pid,'Велосипед Stels 16"',1200000,22,'Зелёный','16" 5-8 лет');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_kid,'Детский планшет обучающий Turbo Kids',1500000,22,'Электроника',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Розовый','7" 16GB',1200000,22,15),(pid,'Синий','7" 16GB',1200000,22,12),
    (pid,'Зелёный','10" 32GB',1500000,22,10);
  INSERT INTO _dc VALUES (cid_kid,pid,'Турбо Kids планшет 7"',1200000,22,'Розовый','7" 16GB');
  INSERT INTO _dc VALUES (cid_kid,pid,'Турбо Kids планшет 7"',1200000,22,'Синий','7" 16GB');
  INSERT INTO _dc VALUES (cid_kid,pid,'Турбо Kids планшет 10"',1500000,22,'Зелёный','10" 32GB');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_kid,'Мягкая игрушка медведь Gund Teddy 40см',185000,45,'Мягкие игрушки',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Бежевый','25см',120000,45,35),(pid,'Бежевый','40см',185000,45,30),
    (pid,'Коричневый','40см',185000,45,25),(pid,'Белый','60см',280000,45,15);
  INSERT INTO _dc VALUES (cid_kid,pid,'Мишка Gund 25см',120000,45,'Бежевый','25см');
  INSERT INTO _dc VALUES (cid_kid,pid,'Мишка Gund 40см',185000,45,'Бежевый','40см');
  INSERT INTO _dc VALUES (cid_kid,pid,'Мишка Gund белый 60см',280000,45,'Белый','60см');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_kid,'Автокресло детское Britax Römer группа 0-1',1800000,18,'Автотовары',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Чёрный','0-1 (0-18кг)',1800000,18,8),(pid,'Серый','0-1 (0-18кг)',1800000,18,7),
    (pid,'Красный/Чёрный','1-3 (9-36кг)',2200000,18,5);
  INSERT INTO _dc VALUES (cid_kid,pid,'Автокресло Britax Römer',1800000,18,'Чёрный','0-1 (0-18кг)');
  INSERT INTO _dc VALUES (cid_kid,pid,'Автокресло Britax Römer',1800000,18,'Серый','0-1 (0-18кг)');

  INSERT INTO products (company_id,name,price,markup_percent,category,has_color_options,available_for_customers)
  VALUES (cid_kid,'Рюкзак школьный Erich Krause',320000,35,'Школьные товары',true,true) RETURNING id INTO pid;
  INSERT INTO product_variants(product_id,color,size,price,markup_percent,stock_quantity) VALUES
    (pid,'Синий','1-4 класс',280000,35,25),(pid,'Розовый','1-4 класс',280000,35,22),
    (pid,'Зелёный','5-11 класс',320000,35,20),(pid,'Чёрный','5-11 класс',320000,35,18);
  INSERT INTO _dc VALUES (cid_kid,pid,'Рюкзак школьный синий',280000,35,'Синий','1-4 класс');
  INSERT INTO _dc VALUES (cid_kid,pid,'Рюкзак школьный розовый',280000,35,'Розовый','1-4 класс');
  INSERT INTO _dc VALUES (cid_kid,pid,'Рюкзак школьный зелёный',320000,35,'Зелёный','5-11 класс');

  -- Sync product.quantity from sum of variants stock
  UPDATE products p
  SET quantity = (
    SELECT COALESCE(SUM(stock_quantity),0) FROM product_variants WHERE product_id = p.id
  )
  WHERE p.company_id IN (cid_spm,cid_tech,cid_moda,cid_build,cid_home,cid_sport,cid_food,cid_medi,cid_auto,cid_kid);

  SELECT COUNT(*) INTO cnt FROM _dc;
  RAISE NOTICE '[2/5] Products and variants inserted. Catalog rows: %', cnt;

  -- ════════════════════════════════════════════════════════════════
  -- 3. GENERATE 12 000 ORDERS
  -- ════════════════════════════════════════════════════════════════
  RAISE NOTICE '[3/5] Generating 12 000 orders...';

  FOR i IN 1..12000 LOOP

    -- Pick company (round-robin weighted so all companies get orders)
    n := ((i - 1) % 10) + 1;
    sel_cid := CASE n
      WHEN 1  THEN cid_spm
      WHEN 2  THEN cid_tech
      WHEN 3  THEN cid_moda
      WHEN 4  THEN cid_build
      WHEN 5  THEN cid_home
      WHEN 6  THEN cid_sport
      WHEN 7  THEN cid_food
      WHEN 8  THEN cid_medi
      WHEN 9  THEN cid_auto
      ELSE         cid_kid
    END;
    -- Add some randomness to company selection every 3rd order
    IF i % 3 = 0 THEN
      r := RANDOM();
      IF r < 0.2 THEN sel_cid := cid_tech;
      ELSIF r < 0.35 THEN sel_cid := cid_moda;
      ELSIF r < 0.45 THEN sel_cid := cid_food;
      ELSIF r < 0.55 THEN sel_cid := cid_auto;
      END IF;
    END IF;

    -- Number of items: 1-4 (weighted towards 1-2)
    r := RANDOM();
    IF r < 0.45 THEN n_items := 1;
    ELSIF r < 0.75 THEN n_items := 2;
    ELSIF r < 0.90 THEN n_items := 3;
    ELSE n_items := 4;
    END IF;

    ord_items  := '[]'::jsonb;
    ord_total  := 0;
    ord_profit := 0;

    FOR ii IN 1..n_items LOOP
      -- Pick random product+variant from this company
      SELECT dc.pid, dc.pname, dc.price, dc.mkup, dc.col, dc.sz
      INTO   sel_pid, sel_pname, sel_price, sel_mkup, sel_color, sel_size
      FROM   _dc dc
      WHERE  dc.cid = sel_cid
      ORDER  BY RANDOM()
      LIMIT  1;

      IF sel_pid IS NULL THEN CONTINUE; END IF;

      sel_sell := ROUND(sel_price * (1 + sel_mkup / 100.0), -2);
      sel_qty  := (RANDOM() * 3 + 1)::INT;  -- 1..4

      ord_total  := ord_total  + sel_sell  * sel_qty;
      ord_profit := ord_profit + (sel_sell - sel_price) * sel_qty;

      ord_items := ord_items || jsonb_build_object(
        'productId',        sel_pid,
        'name',             sel_pname,
        'color',            sel_color,
        'size',             sel_size,
        'quantity',         sel_qty,
        'price',            sel_price,
        'price_with_markup',sel_sell,
        'priceWithMarkup',  sel_sell
      );
    END LOOP;

    -- Customer
    IF RANDOM() > 0.5 THEN
      cust_fname := _male  [1 + (RANDOM() * (array_length(_male,  1)-1))::INT];
    ELSE
      cust_fname := _female[1 + (RANDOM() * (array_length(_female,1)-1))::INT];
    END IF;
    cust_lname := _last[1 + (RANDOM() * (array_length(_last,1)-1))::INT];
    -- Phone: 9xxxxxxxxx (9 digits, valid UZ format)
    cust_phone := '9' || LPAD(((RANDOM() * 89999999) + 10000000)::BIGINT::TEXT, 8, '0');
    cust_city  := _cities [1 + (RANDOM() * (array_length(_cities, 1)-1))::INT];
    cust_addr  := cust_city || ', ' ||
                  _streets[1 + (RANDOM() * (array_length(_streets,1)-1))::INT] || ', д.' ||
                  (1 + (RANDOM()*120)::INT)::TEXT ||
                  CASE WHEN RANDOM() > 0.5 THEN ', кв.' || (1+(RANDOM()*80)::INT)::TEXT ELSE '' END;

    -- Delivery
    IF RANDOM() < 0.38 THEN
      deli_type := 'delivery';
      deli_cost := CASE WHEN cust_city = 'Toshkent' THEN 15000 ELSE 30000 END;
      ord_total := ord_total + deli_cost;
    ELSE
      deli_type := 'pickup';
      deli_cost := 0;
    END IF;

    -- Status (weighted array pick)
    ord_status := _statuses[1 + (RANDOM() * (array_length(_statuses,1)-1))::INT];

    -- Timestamp: spread across past 18 months
    ord_ts := NOW() - (RANDOM() * INTERVAL '548 days');
    -- For completed/delivered orders, updated_at is some hours after
    IF ord_status IN ('completed','delivered') THEN
      upd_ts := ord_ts + (RANDOM() * INTERVAL '72 hours');
    ELSIF ord_status = 'cancelled' THEN
      upd_ts := ord_ts + (RANDOM() * INTERVAL '24 hours');
    ELSE
      upd_ts := ord_ts + (RANDOM() * INTERVAL '48 hours');
    END IF;

    -- Unique order code: seed range 500001..512000
    ord_code := LPAD((500000 + i)::TEXT, 6, '0');

    -- Comment (25% chance)
    INSERT INTO orders (
      company_id, customer_name, customer_phone, address,
      items, total_amount, delivery_cost, delivery_type, markup_profit,
      status, order_code, comment, created_at, updated_at
    ) VALUES (
      sel_cid,
      cust_lname || ' ' || cust_fname,
      cust_phone,
      cust_addr,
      ord_items,
      ROUND(ord_total, -2),
      deli_cost,
      deli_type,
      ROUND(ord_profit, -2),
      ord_status,
      ord_code,
      CASE WHEN RANDOM() < 0.25 THEN
        (ARRAY[
          'Позвоните перед доставкой',
          'Оставьте у двери',
          'Домофон не работает, звоните по телефону',
          'Срочно нужен товар',
          'Подъезд 2, этаж 5',
          'Пожалуйста, упакуйте аккуратно',
          'Оплата картой при получении',
          'Нужна инструкция на русском',
          'Уточните время доставки заранее',
          NULL
        ])[1 + (RANDOM()*9)::INT]
      ELSE NULL END,
      ord_ts,
      upd_ts
    );

  END LOOP;

  SELECT COUNT(*) INTO cnt FROM orders
  WHERE order_code BETWEEN '500001' AND '512000';
  RAISE NOTICE '[3/5] Orders generated: %', cnt;

  -- ════════════════════════════════════════════════════════════════
  -- 4. UPDATE SOLD_COUNT on products
  -- ════════════════════════════════════════════════════════════════
  RAISE NOTICE '[4/5] Updating sold_count...';

  UPDATE products p
  SET sold_count = (
    SELECT COALESCE(SUM((item->>'quantity')::INT), 0)
    FROM orders o,
         jsonb_array_elements(o.items) AS item
    WHERE (item->>'productId')::BIGINT = p.id
      AND o.status IN ('completed','delivered','shipped','processing','confirmed')
  )
  WHERE p.company_id IN (cid_spm,cid_tech,cid_moda,cid_build,cid_home,
                          cid_sport,cid_food,cid_medi,cid_auto,cid_kid);

  -- ════════════════════════════════════════════════════════════════
  -- 5. PERFORMANCE INDEXES (from performance audit)
  -- ════════════════════════════════════════════════════════════════
  RAISE NOTICE '[5/5] Creating performance indexes...';

  -- These use IF NOT EXISTS so re-runs are safe
  -- CONCURRENTLY not available inside transactions; created as regular indexes here
  CREATE INDEX IF NOT EXISTS idx_orders_customer_phone_id
      ON orders(customer_phone, id DESC);
  CREATE INDEX IF NOT EXISTS idx_orders_company_id_id
      ON orders(company_id, id DESC);

  RAISE NOTICE '✅ Demo seed complete! 10 companies, ~160 products, ~800 variants, 12 000 orders.';
  RAISE NOTICE '   Logins: phone/pass — TechZone:901112233/demo123  ModaStyle:902223344/demo123';
  RAISE NOTICE '   BuildMart:903334455  HomeNest:904445566  SportPro:905556677  FreshFood:906667788';
  RAISE NOTICE '   MediCare:907778899  AutoMaster:908889900  KidZone:909990011';

END $$;
