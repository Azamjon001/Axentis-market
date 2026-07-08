# 🚨 ИНСТРУКЦИЯ ПО ИСПРАВЛЕНИЮ БАЗЫ ДАННЫХ НА VPS

## Проблема
На VPS сервере используется база данных `onlineshop2`, но в ней НЕТ ТАБЛИЦ или не все миграции выполнены!

## Решение

### 1️⃣ Подключитесь к VPS серверу по SSH

```bash
ssh root@ваш_vps_ip
```

### 2️⃣ Перейдите в директорию проекта

```bash
cd /path/to/onlineshop2
```

### 3️⃣ Проверьте состояние базы данных

```bash
# Войдите в PostgreSQL
psql -U onlineshop2_user -d onlineshop2

# Проверьте существующие таблицы
\dt

# Выйдите из psql
\q
```

### 4️⃣ Если таблиц нет или их мало - ВЫПОЛНИТЕ МИГРАЦИИ!

#### Вариант А: Через Docker (если используете Docker на VPS)

```bash
# Остановите контейнеры
docker compose down

# Пересоздайте базу и выполните миграции
docker compose up -d postgres

# Подождите пока postgres запустится (5-10 секунд)
sleep 10

# Скопируйте миграции в контейнер
docker cp ./backend/migrations onlineshop2-postgres:/tmp/

# Выполните миграции
docker exec -i onlineshop2-postgres psql -U onlineshop2_user -d onlineshop2 << 'EOF'
-- Выполняем все SQL файлы миграций
\i /tmp/migrations/001_create_advertisements_table.sql
\i /tmp/migrations/002_create_aggressive_discounts_table.sql
\i /tmp/migrations/003_create_categories_table.sql
-- ... и так далее для ВСЕХ файлов миграций
EOF

# Или используйте скрипт миграций если он есть
docker exec onlineshop2-backend sh -c "go run migrations/*.sql"

# Запустите остальные контейнеры
docker compose up -d
```

#### Вариант Б: Напрямую через psql (если НЕ используете Docker)

```bash
cd backend/migrations

# Выполните каждый файл миграции по порядку
for file in *.sql; do
  echo "Выполняем $file..."
  psql -U onlineshop2_user -d onlineshop2 -f "$file"
done
```

### 5️⃣ Проверьте что таблицы созданы

```bash
psql -U onlineshop2_user -d onlineshop2 -c "\dt"
```

Должны быть таблицы:
- companies
- company_messages
- products
- users
- notifications
- и другие...

### 6️⃣ Перезапустите backend

```bash
# Если используете Docker
docker compose restart backend

# Если используете systemd
sudo systemctl restart onlineshop2-backend

# Если запускаете вручную
cd backend
./main  # или go run main.go
```

### 7️⃣ Проверьте что всё работает

Откройте браузер и зайдите на ваш VPS:
- Попробуйте отправить сообщение компании через админ-панель
- Проверьте что компании отображаются правильно

---

## 🔍 ВАЖНО: Проверка переменных окружения на VPS

Убедитесь что на VPS установлены правильные переменные окружения:

```bash
# Проверьте docker-compose.yml или .env файл
cat docker-compose.yml | grep DB_NAME
cat .env | grep DB_NAME
```

Должно быть:
```
DB_NAME=onlineshop2
DB_USER=onlineshop2_user
DB_PASSWORD=your_secure_password_here
```

**НЕ ДОЛЖНО БЫТЬ:**
```
DB_NAME=azaton  # ❌ СТАРОЕ!
DB_USER=azaton_user  # ❌ СТАРОЕ!
```

---

## 📋 Если нужно перенести данные из старой базы "azaton"

```bash
# 1. Сделайте дамп старой базы
pg_dump -U azaton_user azaton > azaton_backup.sql

# 2. Восстановите в новую базу
psql -U onlineshop2_user onlineshop2 < azaton_backup.sql

# 3. Выполните недостающие миграции (если есть новые таблицы)
```

---

## ✅ После исправления

После выполнения всех шагов:
1. ✅ На VPS и localhost будет ОДНА И ТА ЖЕ база данных `onlineshop2`
2. ✅ Отправка сообщений компаниям заработает
3. ✅ Все функции будут работать одинаково

---

## 🆘 Если что-то не работает

Проверьте логи backend:

```bash
# Если Docker
docker logs onlineshop2-backend --tail=100 -f

# Если systemd
sudo journalctl -u onlineshop2-backend -f

# Если запущено вручную
cat backend.log
```
