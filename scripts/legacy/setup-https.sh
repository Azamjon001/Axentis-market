#!/bin/bash
set -e

DOMAIN="axentis.uz"
EMAIL="info@axentis.uz"
PROJECT_DIR="/root/Axentis-market"

echo "=== Настройка HTTPS для $DOMAIN ==="

# Установка certbot
if ! command -v certbot &>/dev/null; then
    echo ">>> Устанавливаем certbot..."
    apt-get update -qq
    apt-get install -y certbot
fi

# Остановить контейнеры чтобы освободить порт 80
echo ">>> Останавливаем контейнеры..."
cd "$PROJECT_DIR"
docker compose down

# Получить SSL сертификат
echo ">>> Получаем SSL сертификат для $DOMAIN..."
certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    -d "$DOMAIN" \
    -d "www.$DOMAIN"

echo ">>> Сертификат получен!"

# Запустить контейнеры снова
echo ">>> Запускаем контейнеры..."
docker compose up -d --build

echo ""
echo "=== HTTPS настроен! ==="
echo "Сайт доступен на: https://$DOMAIN"
echo ""

# Настроить автообновление через cron
CRON_JOB="0 3 * * * certbot renew --quiet && cd $PROJECT_DIR && docker compose kill -s HUP frontend"
(crontab -l 2>/dev/null | grep -v "certbot renew"; echo "$CRON_JOB") | crontab -
echo ">>> Автообновление сертификата настроено (каждый день в 3:00)"
echo ""
echo "Проверить сертификат: certbot certificates"
echo "Принудительное обновление: certbot renew --force-renewal"
