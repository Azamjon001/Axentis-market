# 🚨 ПОЛНЫЙ ОТЧЕТ О ПРОБЛЕМАХ И ИСПРАВЛЕНИЯХ

## Дата: 10 марта 2026
## Проект: onlineshop2

---

## 📋 НАЙДЕННЫЕ ПРОБЛЕМЫ

### 1. ❌ ИСПОЛЬЗУЮТСЯ ДВЕ РАЗНЫЕ БАЗЫ ДАННЫХ
**Статус:** ✅ ИСПРАВЛЕНО

**Описание:**
- **Docker (localhost):** использует БД `onlineshop2` → показывает 3 компании
- **VPS сервер:** использует БД `azaton` (старое название) → показывает 2 компании

**Причина:**
В файле `backend/config/config.go` были старые дефолтные значения:
```go
DBName:        getEnv("DB_NAME", "azaton"),        // ❌ СТАРОЕ!
DBUser:        getEnv("DB_USER", "azaton_user"),   // ❌ СТАРОЕ!
```

**Исправление:**
```go
DBName:        getEnv("DB_NAME", "onlineshop2"),      // ✅ НОВОЕ!
DBUser:        getEnv("DB_USER", "onlineshop2_user"), // ✅ НОВОЕ!
```

**ЧТО НУЖНО СДЕЛАТЬ НА VPS:**
1. Убедитесь что база данных `onlineshop2` существует
2. Выполните все миграции (см. `VPS_FIX_DATABASE.md`)
3. Перезапустите backend

---

### 2. ❌ ОТПРАВКА СООБЩЕНИЙ КОМПАНИЯМ НЕ РАБОТАЕТ
**Статус:** ⚠️ ТРЕБУЕТСЯ ДЕЙСТВИЕ НА VPS

**Проблема:**
На VPS сервере в базе `onlineshop2` отсутствует таблица `company_messages`!

**Причина:**
Миграции не были выполнены после создания новой базы данных.

**Исправление:**
См. файл `VPS_FIX_DATABASE.md` - инструкция как выполнить миграции на VPS.

После выполнения миграций должна появиться таблица:
```sql
CREATE TABLE company_messages (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES companies(id),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    sender_name VARCHAR(50) DEFAULT 'Axis',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**КАК ПРОВЕРИТЬ:**
```bash
psql -U onlineshop2_user -d onlineshop2 -c "\dt"
```

Должна быть таблица `company_messages` в списке!

---

### 3. ❌ 30-ЗНАЧНЫЙ КЛЮЧ ДОСТУПА (access_key) НЕ ОТОБРАЖАЕТСЯ
**Статус:** ✅ ИСПРАВЛЕНО

**Проблема:**
У существующих компаний поле `access_key` = NULL, поэтому ключ не показывается в админ-панели.

**Причина:**
1. Старые компании были созданы БЕЗ генерации ключа
2. При переносе из базы `azaton` в `onlineshop2` ключи не были созданы

**Исправление:**

**А) Создана миграция для генерации ключей у существующих компаний:**
```
backend/migrations/999_generate_missing_access_keys.sql
```

Эта миграция автоматически создаст 30-значные ключи для ВСЕХ компаний у которых `access_key IS NULL`.

**Б) Добавлена автоматическая генерация ключа при регистрации новых компаний:**

В `backend/routes/handlers/auth.go` добавлена функция `generateAccessKey()`, которая автоматически создает ключ, если он не передан с frontend.

**КАК ВЫПОЛНИТЬ МИГРАЦИЮ НА VPS:**

```bash
# Вариант 1: Через Docker
docker exec -i onlineshop2-postgres psql -U onlineshop2_user -d onlineshop2 < backend/migrations/999_generate_missing_access_keys.sql

# Вариант 2: Напрямую через psql
psql -U onlineshop2_user -d onlineshop2 -f backend/migrations/999_generate_missing_access_keys.sql
```

**ПОСЛЕ ВЫПОЛНЕНИЯ:**
Все компании получат 30-значные ключи доступа и они будут отображаться в админ-панели.

---

### 4. ✅ ЗАГРУЗКА ФОТОГРАФИЙ ТОВАРОВ
**Статус:** ✅ РАБОТАЕТ

Функционал загрузки изображений товаров НЕ СЛОМАН:
- ✅ Frontend: `src/utils/api.tsx` → `uploadImages()`
- ✅ Backend: `backend/routes/handlers/products.go` → `UploadProductImages()`

Файлы сохраняются в директорию `./uploads` и путь записывается в БД как JSON массив.

**ВАЖНО:** Убедитесь что на VPS директория `uploads` существует и имеет права на запись:
```bash
mkdir -p uploads
chmod 755 uploads
```

---

## 🔧 ЧТО НУЖНО СДЕЛАТЬ НА VPS (ИТОГОВЫЙ ЧЕКЛИСТ)

### Шаг 1: Обновите код backend
```bash
cd /path/to/onlineshop2
git pull origin main  # или скопируйте новые файлы
```

### Шаг 2: Пересоберите backend
```bash
cd backend
go build -o main .
```

### Шаг 3: Выполните ВСЕ миграции
```bash
# Если используете Docker:
docker compose down
docker compose up -d postgres
sleep 10

# Выполните все SQL файлы миграций по порядку
for file in backend/migrations/*.sql; do
  docker exec -i onlineshop2-postgres psql -U onlineshop2_user -d onlineshop2 < "$file"
done

# Если НЕ используете Docker:
cd backend/migrations
for file in *.sql; do
  echo "Выполняем $file..."
  psql -U onlineshop2_user -d onlineshop2 -f "$file"
done
```

### Шаг 4: Проверьте что таблицы созданы
```bash
psql -U onlineshop2_user -d onlineshop2 -c "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;"
```

Должны быть таблицы:
- ✅ companies
- ✅ company_messages
- ✅ products
- ✅ users
- ✅ orders
- ✅ sales
- ✅ notifications
- и другие...

### Шаг 5: Проверьте что у компаний есть access_key
```bash
psql -U onlineshop2_user -d onlineshop2 -c "SELECT id, name, access_key FROM companies;"
```

Все компании должны иметь 30-значные ключи!

### Шаг 6: Перезапустите backend
```bash
# Docker:
docker compose restart backend

# systemd:
sudo systemctl restart onlineshop2-backend

# Вручную:
cd backend
./main
```

### Шаг 7: Проверьте работу
1. Откройте админ-панель
2. Зайдите в "Управление компаниями"
3. Проверьте что у всех компаний отображаются ключи доступа (30 символов)
4. Попробуйте отправить сообщение компании
5. Попробуйте загрузить фото товара

---

## 📊 ОЖИДАЕМЫЙ РЕЗУЛЬТАТ ПОСЛЕ ИСПРАВЛЕНИЙ

✅ **База данных:** Везде используется ОДНА БД `onlineshop2`  
✅ **Данные:** Одинаковые на localhost и VPS  
✅ **Отправка сообщений:** Работает для одной компании и для всех сразу  
✅ **Ключи доступа:** Отображаются у всех компаний (30 символов)  
✅ **Загрузка фото:** Работает без ошибок  

---

## 🆘 ЕСЛИ ЧТО-ТО НЕ РАБОТАЕТ

### Проблема: "Таблица не найдена"
```bash
# Проверьте что миграции выполнены:
psql -U onlineshop2_user -d onlineshop2 -c "\dt"
```

### Проблема: "Не могу подключиться к БД"
```bash
# Проверьте переменные окружения:
env | grep DB_
# или
docker exec onlineshop2-backend env | grep DB_
```

### Проблема: "Ошибка при отправке сообщения"
```bash
# Проверьте логи backend:
docker logs onlineshop2-backend --tail=100
# или
journalctl -u onlineshop2-backend -f
```

---

## 📝 ФАЙЛЫ КОТОРЫЕ БЫЛИ ИЗМЕНЕНЫ

1. ✅ `backend/config/config.go` - исправлены дефолтные значения БД
2. ✅ `backend/routes/handlers/auth.go` - добавлена автогенерация access_key
3. ✅ `backend/migrations/999_generate_missing_access_keys.sql` - миграция для существующих компаний
4. ✅ `VPS_FIX_DATABASE.md` - инструкция по исправлению БД на VPS
5. ✅ `CRITICAL_FIXES_SUMMARY.md` - этот файл

---

## ✨ ДОПОЛНИТЕЛЬНЫЕ УЛУЧШЕНИЯ

После исправления основных проблем рекомендую:

1. **Настроить автоматический бэкап БД на VPS:**
```bash
# Добавить в crontab:
0 3 * * * pg_dump -U onlineshop2_user onlineshop2 > /backups/onlineshop2_$(date +\%Y\%m\%d).sql
```

2. **Настроить мониторинг логов:**
```bash
# Для отслеживания ошибок в реальном времени
tail -f /var/log/onlineshop2/backend.log
```

3. **Добавить HTTPS (если еще не настроен):**
- Используйте Let's Encrypt для SSL сертификата
- Настройте nginx как reverse proxy

---

**Автор исправлений:** GitHub Copilot  
**Дата:** 10 марта 2026  
**Версия:** onlineshop2 v2.0
