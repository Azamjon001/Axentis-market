#!/bin/bash
# Скрипт исправления API ошибок на Ubuntu сервере
# Выполните: bash fix-server.sh

echo "🔍 Проверка проекта..."

# Поиск директории проекта
if [ -d "/root/Axentis-market" ]; then
    cd /root/Axentis-market
elif [ -d "$HOME/Axentis-market" ]; then
    cd $HOME/Axentis-market
else
    echo "❌ Проект не найден. Клонирую с GitHub..."
    cd /root
    git clone https://github.com/azamjon1330/Axentis-market.git
    cd Axentis-market
fi

echo "📂 Текущая директория: $(pwd)"

# Обновление кода
echo "📥 Обновление кода с GitHub..."
git pull origin main

# Проверка Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не установлен!"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose не установлен!"
    exit 1
fi

# Остановка старых контейнеров
echo "🛑 Остановка старых контейнеров..."
docker-compose down

# Создание .env.local для dev режима (если нужен)
echo "📝 Создание .env.local..."
cat > .env.local << 'EOF'
VITE_API_URL=/api
VITE_BACKEND_URL=http://backend:3000
VITE_SOCKET_URL=
EOF

# Сборка и запуск через Docker Compose
echo "🐳 Сборка и запуск контейнеров..."
docker-compose up -d --build

# Ожидание запуска
echo "⏳ Ожидание запуска сервисов..."
sleep 10

# Проверка статуса
echo "📊 Статус контейнеров:"
docker-compose ps

echo ""
echo "📋 Логи backend:"
docker-compose logs backend --tail 20

echo ""
echo "📋 Логи frontend:"
docker-compose logs frontend --tail 20

echo ""
echo "✅ Готово!"
echo ""
echo "🌐 Приложение доступно на:"
echo "   Frontend: http://77.237.242.126"
echo "   Backend:  http://77.237.242.126:3000"
echo ""
echo "📝 Для просмотра логов:"
echo "   docker-compose logs -f"
echo ""
echo "🛑 Для остановки:"
echo "   docker-compose down"
