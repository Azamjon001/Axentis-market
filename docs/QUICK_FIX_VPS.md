# 🚀 БЫСТРОЕ ИСПРАВЛЕНИЕ - СЛЕДУЙТЕ ЭТИМ ШАГАМ

## 🎯 ЧТО БЫЛО ИСПРАВЛЕНО ЛОКАЛЬНО (НА ЭТОМ КОМПЬЮТЕРЕ):
✅ Исправлена конфигурация базы данных в `backend/config/config.go`  
✅ Добавлена автоматическая генерация ключей доступа в `backend/routes/handlers/auth.go`  
✅ Создана миграция для генерации ключей существующим компаниям  

---

## ⚡ ЧТО НУЖНО СДЕЛАТЬ НА VPS СЕРВЕРЕ:

### 1️⃣ Обновите код на VPS
Скопируйте эти файлы на VPS сервер:
- `backend/config/config.go`
- `backend/routes/handlers/auth.go`
- `backend/migrations/999_generate_missing_access_keys.sql`

Или используйте git:
```bash
cd /path/to/onlineshop2
git pull origin main
```

---

### 2️⃣ Пересоберите backend
```bash
cd backend
go build -o main .
```

---

### 3️⃣ Выполните миграцию для генерации ключей доступа
```bash
psql -U onlineshop2_user -d onlineshop2 -f backend/migrations/999_generate_missing_access_keys.sql
```

Или через Docker:
```bash
docker exec -i onlineshop2-postgres psql -U onlineshop2_user -d onlineshop2 < backend/migrations/999_generate_missing_access_keys.sql
```

---

### 4️⃣ Выполните ВСЕ миграции (если база данных новая)
```bash
cd backend/migrations
for file in *.sql; do
  psql -U onlineshop2_user -d onlineshop2 -f "$file"
done
```

Или через Docker:
```bash
for file in backend/migrations/*.sql; do
  docker exec -i onlineshop2-postgres psql -U onlineshop2_user -d onlineshop2 < "$file"
done
```

---

### 5️⃣ Перезапустите backend
```bash
# Если используете Docker:
docker compose restart backend

# Если systemd:
sudo systemctl restart onlineshop2-backend

# Если вручную:
cd backend
./main
```

---

### 6️⃣ Проверьте что всё работает

**Проверка 1:** Ключи доступа созданы
```bash
psql -U onlineshop2_user -d onlineshop2 -c "SELECT id, name, access_key FROM companies;"
```
Все компании должны иметь 30-значные ключи!

**Проверка 2:** Таблица сообщений существует
```bash
psql -U onlineshop2_user -d onlineshop2 -c "\dt" | grep company_messages
```
Должна быть таблица `company_messages`!

**Проверка 3:** Откройте админ-панель
1. Зайдите в "Управление компаниями"
2. Убедитесь что у всех компаний показывается "Ключ доступа (30 символов)"
3. Попробуйте отправить сообщение компании через "Сообщения компаниям"

---

## ❓ ЕСЛИ ВОЗНИКЛИ ОШИБКИ

### Ошибка: "relation "company_messages" does not exist"
**Решение:** Выполните ВСЕ миграции (шаг 4)

### Ошибка: "database "onlineshop2" does not exist"
**Решение:** Создайте базу данных:
```bash
psql -U postgres -c "CREATE DATABASE onlineshop2;"
psql -U postgres -c "CREATE USER onlineshop2_user WITH PASSWORD 'your_secure_password_here';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE onlineshop2 TO onlineshop2_user;"
```

### Проблема: У компаний всё ещё нет ключей
**Решение:** Выполните миграцию из шага 3 ещё раз

### Проблема: Разные данные на localhost и VPS
**Решение:** Убедитесь что используется ОДНА база данных `onlineshop2`, а не `azaton`:
```bash
env | grep DB_NAME
# Должно быть: DB_NAME=onlineshop2
```

---

## 📞 ТЕХПОДДЕРЖКА

Если проблемы остались:
1. Проверьте логи backend: `docker logs onlineshop2-backend --tail=100`
2. Проверьте подключение к БД: `psql -U onlineshop2_user -d onlineshop2 -c "SELECT 1;"`
3. Убедитесь что backend использует правильную БД: `env | grep DB_`

---

**ВАЖНО:** После выполнения всех шагов на VPS сервере, localhost и VPS будут использовать ОДНУ И ТУ ЖЕ базу данных с ОДИНАКОВЫМИ данными!
