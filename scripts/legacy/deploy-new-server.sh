#!/bin/bash
# ============================================================================
# Axentis Market — развёртывание с нуля на новом сервере (Ubuntu/Debian)
# ============================================================================
# Поднимает весь стек (postgres + backend + frontend) под доменом с HTTPS.
#
# Использование на ЧИСТОМ сервере (под root):
#   1) Направьте DNS axentis.uz (и www) на IP этого сервера ЗАРАНЕЕ.
#   2) bash deploy-new-server.sh
#
# Можно переопределить параметры через переменные окружения, например:
#   DOMAIN=shop.example.com EMAIL=admin@example.com bash deploy-new-server.sh
# ============================================================================
set -euo pipefail

# ---------------------------------------------------------------------------
# Настройки (можно переопределить через переменные окружения)
# ---------------------------------------------------------------------------
DOMAIN="${DOMAIN:-axentis.uz}"
EMAIL="${EMAIL:-info@axentis.uz}"
REPO_URL="${REPO_URL:-https://github.com/azamjon1330/axentis-market.git}"
BRANCH="${BRANCH:-main}"
PROJECT_DIR="${PROJECT_DIR:-/root/Axentis-market}"

echo "============================================================"
echo " Axentis Market — деплой на новый сервер"
echo "   Домен:      $DOMAIN"
echo "   Email:      $EMAIL"
echo "   Репозиторий:$REPO_URL ($BRANCH)"
echo "   Каталог:    $PROJECT_DIR"
echo "============================================================"

# ---------------------------------------------------------------------------
# 1. Системные пакеты
# ---------------------------------------------------------------------------
echo ">>> [1/7] Обновляем систему и ставим базовые пакеты..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl git ufw openssl >/dev/null

# ---------------------------------------------------------------------------
# 2. Docker + Docker Compose
# ---------------------------------------------------------------------------
if ! command -v docker &>/dev/null; then
    echo ">>> [2/7] Устанавливаем Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
else
    echo ">>> [2/7] Docker уже установлен — пропускаем."
fi

# Определяем команду compose (плагин v2 предпочтителен)
if docker compose version &>/dev/null; then
    DC="docker compose"
elif command -v docker-compose &>/dev/null; then
    DC="docker-compose"
else
    echo ">>> Ставим docker compose plugin..."
    apt-get install -y -qq docker-compose-plugin >/dev/null
    DC="docker compose"
fi
echo "    Compose: $DC"

# ---------------------------------------------------------------------------
# 3. Клонируем / обновляем репозиторий
# ---------------------------------------------------------------------------
if [ ! -d "$PROJECT_DIR/.git" ]; then
    echo ">>> [3/7] Клонируем репозиторий в $PROJECT_DIR..."
    git clone --branch "$BRANCH" "$REPO_URL" "$PROJECT_DIR"
else
    echo ">>> [3/7] Репозиторий найден — обновляем ветку $BRANCH..."
    git -C "$PROJECT_DIR" fetch origin "$BRANCH"
    git -C "$PROJECT_DIR" checkout "$BRANCH"
    git -C "$PROJECT_DIR" pull origin "$BRANCH"
fi
cd "$PROJECT_DIR"

# ---------------------------------------------------------------------------
# 4. Генерируем секреты и патчим конфиги (только если ещё плейсхолдеры)
# ---------------------------------------------------------------------------
echo ">>> [4/7] Настраиваем секреты..."
if grep -q "your_secure_password_here" backend/.env; then
    DB_PASS="$(openssl rand -hex 24)"
    JWT_SECRET="$(openssl rand -hex 48)"
    CARD_KEY="$(openssl rand -hex 32)"

    # Пароль БД должен совпадать в backend/.env и docker-compose.yml
    sed -i "s|your_secure_password_here|${DB_PASS}|g" backend/.env docker-compose.yml
    sed -i "s|your_very_strong_jwt_secret_key_here_change_in_production|${JWT_SECRET}|g" backend/.env
    sed -i "s|^CARD_ENCRYPTION_KEY=.*|CARD_ENCRYPTION_KEY=${CARD_KEY}|" backend/.env

    # Добавим домен в список разрешённых CORS-источников, если его там нет
    if ! grep -q "https://${DOMAIN}" backend/.env; then
        sed -i "s|^ALLOWED_ORIGINS=.*|&,https://${DOMAIN},https://www.${DOMAIN}|" backend/.env
    fi

    echo "    Сгенерированы новые DB_PASSWORD / JWT_SECRET / CARD_ENCRYPTION_KEY."
    echo "    Сохраните их (они уже в backend/.env):"
    echo "      DB_PASSWORD=${DB_PASS}"
else
    echo "    Секреты уже настроены ранее — пропускаем генерацию."
fi

echo ""
echo "    ВАЖНО: при необходимости задайте вручную в backend/.env:"
echo "      ADMIN_PHONE / ADMIN_CODE  — логин платформенного админа"
echo "      ANTHROPIC_API_KEY         — для AI-парсинга товаров (опционально)"
echo ""

# ---------------------------------------------------------------------------
# 5. Открываем порты в фаерволе
# ---------------------------------------------------------------------------
echo ">>> [5/7] Открываем порты 22/80/443..."
ufw allow 22/tcp  >/dev/null 2>&1 || true
ufw allow 80/tcp  >/dev/null 2>&1 || true
ufw allow 443/tcp >/dev/null 2>&1 || true

# ---------------------------------------------------------------------------
# 6. SSL-сертификат (Let's Encrypt, standalone — порт 80 должен быть свободен)
# ---------------------------------------------------------------------------
echo ">>> [6/7] Получаем SSL-сертификат для $DOMAIN..."
if ! command -v certbot &>/dev/null; then
    apt-get install -y -qq certbot >/dev/null
fi

# Освобождаем порт 80, чтобы certbot (standalone) смог его занять.
# Останавливаем системные веб-серверы и любые docker-контейнеры на этом порту.
echo "    Освобождаем порт 80..."
systemctl stop nginx apache2 2>/dev/null || true
$DC down 2>/dev/null || true
# Останавливаем любые посторонние контейнеры, публикующие порт 80
OLD_80="$(docker ps -q --filter "publish=80" 2>/dev/null || true)"
[ -n "$OLD_80" ] && docker stop $OLD_80 2>/dev/null || true
# Последний рубеж: снимаем процесс, всё ещё держащий порт 80
if command -v fuser &>/dev/null; then
    fuser -k 80/tcp 2>/dev/null || true
fi

if [ ! -d "/etc/letsencrypt/live/${DOMAIN}" ]; then
    certbot certonly --standalone --non-interactive --agree-tos \
        --email "$EMAIL" -d "$DOMAIN" -d "www.${DOMAIN}"
    echo "    Сертификат получен."
else
    echo "    Сертификат уже существует — пропускаем."
fi

# Автообновление сертификата
CRON_JOB="0 3 * * * certbot renew --quiet && cd ${PROJECT_DIR} && ${DC} kill -s HUP frontend"
( crontab -l 2>/dev/null | grep -v "certbot renew"; echo "$CRON_JOB" ) | crontab -

# ---------------------------------------------------------------------------
# 7. Сборка и запуск
# ---------------------------------------------------------------------------
echo ">>> [7/7] Собираем и запускаем контейнеры (это займёт несколько минут)..."
$DC up -d --build

echo ""
echo "============================================================"
echo " Готово! Контейнеры:"
$DC ps
echo ""
echo " Сайт:    https://${DOMAIN}"
echo " Логи:    cd ${PROJECT_DIR} && ${DC} logs -f --tail=100"
echo "============================================================"
