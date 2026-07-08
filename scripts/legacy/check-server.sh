#!/bin/bash
# Быстрая диагностика проблем на сервере

echo "🔍 ДИАГНОСТИКА СЕРВЕРА"
echo "======================"
echo ""

# Проверка директории
echo "📂 Поиск проекта..."
if [ -d "/root/Axentis-market" ]; then
    PROJECT_DIR="/root/Axentis-market"
elif [ -d "$HOME/Axentis-market" ]; then
    PROJECT_DIR="$HOME/Axentis-market"
else
    echo "❌ Проект не найден!"
    echo "Выполните: git clone https://github.com/azamjon1330/Axentis-market.git"
    exit 1
fi

cd $PROJECT_DIR
echo "✅ Проект найден: $PROJECT_DIR"
echo ""

# Проверка Docker
echo "🐳 Проверка Docker..."
if docker --version &> /dev/null; then
    echo "✅ Docker установлен: $(docker --version)"
else
    echo "❌ Docker не установлен!"
fi

if docker-compose --version &> /dev/null; then
    echo "✅ Docker Compose установлен: $(docker-compose --version)"
else
    echo "❌ Docker Compose не установлен!"
fi
echo ""

# Проверка статуса контейнеров
echo "📊 Статус контейнеров:"
docker-compose ps
echo ""

# Проверка портов
echo "🔌 Проверка портов:"
echo "Backend (3000):"
netstat -tulpn | grep :3000 || echo "  ❌ Порт 3000 не слушается"

echo "Frontend (80):"
netstat -tulpn | grep :80 || echo "  ❌ Порт 80 не слушается"

echo "Frontend dev (5173):"
netstat -tulpn | grep :5173 || echo "  ❌ Порт 5173 не слушается"
echo ""

# Проверка backend API
echo "🌐 Проверка backend API:"
if curl -s http://localhost:3000/api/health &> /dev/null; then
    echo "✅ Backend отвечает на localhost:3000"
else
    echo "❌ Backend не отвечает на localhost:3000"
fi
echo ""

# Проверка логов
echo "📋 Последние логи backend:"
docker-compose logs backend --tail 10
echo ""

echo "📋 Последние логи frontend:"
docker-compose logs frontend --tail 10
echo ""

# Проверка .env файлов
echo "📄 Проверка .env файлов:"
if [ -f ".env" ]; then
    echo "✅ .env существует"
    echo "   VITE_API_URL=$(grep VITE_API_URL .env | cut -d'=' -f2)"
else
    echo "❌ .env не найден"
fi

if [ -f ".env.local" ]; then
    echo "✅ .env.local существует"
    echo "   VITE_API_URL=$(grep VITE_API_URL .env.local | cut -d'=' -f2)"
    echo "   VITE_BACKEND_URL=$(grep VITE_BACKEND_URL .env.local | cut -d'=' -f2)"
else
    echo "⚠️  .env.local не найден (необязательно для Docker)"
fi
echo ""

echo "✅ Диагностика завершена!"
