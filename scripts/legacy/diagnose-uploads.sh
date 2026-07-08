#!/bin/bash

# ============================================================================
# ДИАГНОСТИКА И ИСПРАВЛЕНИЕ ЗАГРУЗКИ ФОТО НА VPS
# ============================================================================

echo "🔍 ДИАГНОСТИКА ПРОБЛЕМЫ С ЗАГРУЗКОЙ ФОТО..."
echo ""

# 1. Проверка директории uploads
echo "1️⃣ Проверка директории uploads..."
if [ -d "./uploads" ]; then
    echo "   ✅ Директория ./uploads существует"
    ls -la ./uploads | head -10
else
    echo "   ❌ Директория ./uploads НЕ существует!"
    echo "   📝 Создаем директорию..."
    mkdir -p ./uploads
    chmod 755 ./uploads
    echo "   ✅ Директория создана!"
fi
echo ""

# 2. Проверка прав доступа
echo "2️⃣ Проверка прав доступа..."
ls -ld ./uploads
echo ""

# 3. Проверка что backend видит директорию
echo "3️⃣ Проверка расположения backend..."
pwd
echo ""

# 4. Если используется Docker - проверка volumes
echo "4️⃣ Проверка Docker volumes (если используется)..."
if command -v docker &> /dev/null; then
    docker volume ls | grep onlineshop2
    docker inspect onlineshop2-backend 2>/dev/null | grep -A 5 "Mounts"
fi
echo ""

# 5. Проверка nginx конфигурации (если есть)
echo "5️⃣ Проверка nginx конфигурации..."
if [ -f "/etc/nginx/sites-enabled/onlineshop2" ]; then
    echo "   Найдена конфигурация nginx:"
    grep -A 5 "location /uploads" /etc/nginx/sites-enabled/onlineshop2
elif [ -f "/etc/nginx/nginx.conf" ]; then
    echo "   Проверяем nginx.conf:"
    grep -A 5 "location /uploads" /etc/nginx/nginx.conf
else
    echo "   ℹ️  Nginx конфигурация не найдена (возможно используется Docker)"
fi
echo ""

# 6. Проверка существующих файлов
echo "6️⃣ Список загруженных файлов (если есть)..."
if [ -d "./uploads" ]; then
    find ./uploads -type f | head -5
    echo "   Всего файлов: $(find ./uploads -type f | wc -l)"
fi
echo ""

# 7. Тест загрузки файла
echo "7️⃣ Тест создания файла..."
touch ./uploads/test_write.txt 2>/dev/null
if [ -f "./uploads/test_write.txt" ]; then
    echo "   ✅ Запись в ./uploads работает!"
    rm ./uploads/test_write.txt
else
    echo "   ❌ НЕТ прав на запись в ./uploads!"
    echo "   📝 Исправляем права..."
    sudo chmod 755 ./uploads
    sudo chown -R $USER:$USER ./uploads
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 РЕКОМЕНДАЦИИ:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "ЕСЛИ ИСПОЛЬЗУЕТЕ DOCKER:"
echo "  - Убедитесь что volume 'uploads_data' монтирован"
echo "  - Проверьте: docker-compose.yml → backend → volumes"
echo "  - Должно быть: uploads_data:/app/uploads"
echo ""
echo "ЕСЛИ НЕ ИСПОЛЬЗУЕТЕ DOCKER:"
echo "  - Backend должен запускаться из корня проекта"
echo "  - Директория ./uploads должна иметь права 755"
echo "  - Nginx должен проксировать /uploads → http://localhost:3000/uploads"
echo ""
echo "NGINX КОНФИГУРАЦИЯ ДОЛЖНА СОДЕРЖАТЬ:"
echo "  location /uploads {"
echo "      proxy_pass http://localhost:3000;"
echo "      # ИЛИ альтернативно:"
echo "      # alias /path/to/onlineshop2/uploads;"
echo "  }"
echo ""
