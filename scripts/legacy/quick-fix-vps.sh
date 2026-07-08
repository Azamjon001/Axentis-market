#!/bin/bash
# БЫСТРОЕ ИСПРАВЛЕНИЕ VPS - ОДНА КОМАНДА!
# Использование: curl -sSL https://ваш_домен/fix-vps-complete.sh | bash
# Или: bash fix-vps-complete.sh

echo "🚀 Автоматическое исправление VPS сервера..."
mkdir -p uploads && chmod 755 uploads && \
cd backend/migrations && \
for f in *.sql; do psql -U onlineshop2_user -d onlineshop2 -f "$f" 2>&1 | grep -v "already exists" || true; done && \
cd ../.. && \
cd backend && go build -o main . && \
pkill -f "./main" || true && \
nohup ./main > ../backend.log 2>&1 & \
cd .. && \
echo "✅ ГОТОВО! Backend перезапущен, миграции выполнены, uploads создан!"
