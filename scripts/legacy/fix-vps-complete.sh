#!/bin/bash

# ============================================================================
# ПОЛНОЕ ИСПРАВЛЕНИЕ VPS СЕРВЕРА - ВЫПОЛНИТЕ ЭТО ЧЕРЕЗ SSH!
# ============================================================================

set -e  # Остановка при ошибке

echo "🚀 НАЧИНАЕМ ПОЛНОЕ ИСПРАВЛЕНИЕ VPS СЕРВЕРА..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Определяем директорию проекта
PROJECT_DIR=$(pwd)
echo "📁 Директория проекта: $PROJECT_DIR"
echo ""

# ============================================================================
# ШАГ 1: ПРОВЕРКА И СОЗДАНИЕ ДИРЕКТОРИИ UPLOADS
# ============================================================================
echo "1️⃣ СОЗДАНИЕ ДИРЕКТОРИИ UPLOADS..."
mkdir -p uploads
chmod 755 uploads
echo "   ✅ Директория uploads готова"
echo ""

# ============================================================================
# ШАГ 2: ПРОВЕРКА БАЗЫ ДАННЫХ
# ============================================================================
echo "2️⃣ ПРОВЕРКА БАЗЫ ДАННЫХ..."

# Проверяем какая база используется
if command -v docker &> /dev/null && docker ps | grep -q postgres; then
    echo "   🐳 Обнаружен Docker PostgreSQL"
    DB_TYPE="docker"
    DB_CONTAINER="onlineshop2-postgres"
    PSQL_CMD="docker exec -i $DB_CONTAINER psql -U onlineshop2_user -d onlineshop2"
elif command -v psql &> /dev/null; then
    echo "   🗄️  Обнаружен локальный PostgreSQL"
    DB_TYPE="local"
    PSQL_CMD="psql -U onlineshop2_user -d onlineshop2"
else
    echo "   ❌ PostgreSQL не найден!"
    exit 1
fi

# Проверяем существует ли база
echo "   Проверка базы данных onlineshop2..."
if [ "$DB_TYPE" = "docker" ]; then
    DB_EXISTS=$(docker exec $DB_CONTAINER psql -U onlineshop2_user -lqt | cut -d \| -f 1 | grep -w onlineshop2 | wc -l)
else
    DB_EXISTS=$(psql -U postgres -lqt | cut -d \| -f 1 | grep -w onlineshop2 | wc -l)
fi

if [ "$DB_EXISTS" -eq 0 ]; then
    echo "   ❌ База данных onlineshop2 не существует!"
    echo "   📝 Создаем базу данных..."
    if [ "$DB_TYPE" = "docker" ]; then
        docker exec $DB_CONTAINER psql -U postgres -c "CREATE DATABASE onlineshop2;"
        docker exec $DB_CONTAINER psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE onlineshop2 TO onlineshop2_user;"
    else
        psql -U postgres -c "CREATE DATABASE onlineshop2;"
        psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE onlineshop2 TO onlineshop2_user;"
    fi
    echo "   ✅ База данных создана!"
fi
echo ""

# ============================================================================
# ШАГ 3: ВЫПОЛНЕНИЕ МИГРАЦИЙ
# ============================================================================
echo "3️⃣ ВЫПОЛНЕНИЕ МИГРАЦИЙ..."
cd backend/migrations

MIGRATION_COUNT=0
for file in *.sql; do
    echo "   📄 Выполняем: $file"
    if [ "$DB_TYPE" = "docker" ]; then
        cat "$file" | docker exec -i $DB_CONTAINER psql -U onlineshop2_user -d onlineshop2 2>&1 | grep -v "NOTICE" | grep -v "already exists" || true
    else
        psql -U onlineshop2_user -d onlineshop2 -f "$file" 2>&1 | grep -v "NOTICE" | grep -v "already exists" || true
    fi
    MIGRATION_COUNT=$((MIGRATION_COUNT + 1))
done

echo "   ✅ Выполнено миграций: $MIGRATION_COUNT"
cd ../..
echo ""

# ============================================================================
# ШАГ 4: ПРОВЕРКА ТАБЛИЦ
# ============================================================================
echo "4️⃣ ПРОВЕРКА ТАБЛИЦ..."
if [ "$DB_TYPE" = "docker" ]; then
    TABLE_COUNT=$(docker exec $DB_CONTAINER psql -U onlineshop2_user -d onlineshop2 -c "\dt" | grep public | wc -l)
else
    TABLE_COUNT=$(psql -U onlineshop2_user -d onlineshop2 -c "\dt" | grep public | wc -l)
fi
echo "   ✅ Найдено таблиц: $TABLE_COUNT"

# Проверяем важные таблицы
echo "   Проверка важных таблиц:"
for table in companies products users company_messages orders sales notifications; do
    if [ "$DB_TYPE" = "docker" ]; then
        EXISTS=$(docker exec $DB_CONTAINER psql -U onlineshop2_user -d onlineshop2 -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='$table');" -t | xargs)
    else
        EXISTS=$(psql -U onlineshop2_user -d onlineshop2 -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='$table');" -t | xargs)
    fi
    
    if [ "$EXISTS" = "t" ]; then
        echo "      ✅ $table"
    else
        echo "      ❌ $table - НЕТ!"
    fi
done
echo ""

# ============================================================================
# ШАГ 5: ГЕНЕРАЦИЯ ACCESS_KEY ДЛЯ КОМПАНИЙ
# ============================================================================
echo "5️⃣ ГЕНЕРАЦИЯ КЛЮЧЕЙ ДОСТУПА..."
if [ "$DB_TYPE" = "docker" ]; then
    cat backend/migrations/999_generate_missing_access_keys.sql | docker exec -i $DB_CONTAINER psql -U onlineshop2_user -d onlineshop2 2>&1 | grep "Generated access keys"
else
    psql -U onlineshop2_user -d onlineshop2 -f backend/migrations/999_generate_missing_access_keys.sql 2>&1 | grep "Generated access keys"
fi
echo ""

# ============================================================================
# ШАГ 6: ПЕРЕСБОРКА BACKEND
# ============================================================================
echo "6️⃣ ПЕРЕСБОРКА BACKEND..."
cd backend

if command -v docker &> /dev/null && [ -f "../docker-compose.yml" ]; then
    echo "   🐳 Пересборка Docker образа..."
    cd ..
    docker compose down
    docker compose build --no-cache backend
    docker compose up -d
    echo "   ⏳ Ожидание запуска (10 сек)..."
    sleep 10
    cd backend
else
    echo "   🔨 Компиляция Go binary..."
    go build -o main .
    echo "   🔄 Перезапуск backend..."
    # Остановка старого процесса
    pkill -f "./main" || true
    # Запуск нового
    nohup ./main > ../backend.log 2>&1 &
    echo "   ⏳ Ожидание запуска (5 сек)..."
    sleep 5
fi

cd ..
echo "   ✅ Backend перезапущен"
echo ""

# ============================================================================
# ШАГ 7: ПРОВЕРКА NGINX (ЕСЛИ ЕСТЬ)
# ============================================================================
echo "7️⃣ ПРОВЕРКА NGINX..."
if command -v nginx &> /dev/null; then
    echo "   Перезагрузка nginx..."
    sudo nginx -t && sudo systemctl reload nginx
    echo "   ✅ Nginx перезагружен"
else
    echo "   ℹ️  Nginx не установлен (используется Docker frontend)"
fi
echo ""

# ============================================================================
# ФИНАЛЬНАЯ ПРОВЕРКА
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ВСЕ ИСПРАВЛЕНИЯ ПРИМЕНЕНЫ!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 ИТОГОВАЯ ПРОВЕРКА:"
echo ""

# Проверка компаний и ключей
echo "🏢 Компании и их ключи доступа:"
if [ "$DB_TYPE" = "docker" ]; then
    docker exec $DB_CONTAINER psql -U onlineshop2_user -d onlineshop2 -c "SELECT id, name, LEFT(access_key, 10) || '...' as key FROM companies;"
else
    psql -U onlineshop2_user -d onlineshop2 -c "SELECT id, name, LEFT(access_key, 10) || '...' as key FROM companies;"
fi
echo ""

# Проверка директории uploads
echo "📁 Директория uploads:"
ls -lh uploads/ | head -5
echo "   Всего файлов: $(find uploads -type f 2>/dev/null | wc -l)"
echo ""

# Проверка backend
echo "🚀 Статус backend:"
if command -v docker &> /dev/null && docker ps | grep -q backend; then
    docker ps | grep backend
elif pgrep -f "./main" > /dev/null; then
    echo "   ✅ Backend процесс запущен (PID: $(pgrep -f "./main"))"
else
    echo "   ⚠️  Backend процесс не найден!"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 ГОТОВО! Проверьте работу через браузер!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
