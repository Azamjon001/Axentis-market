# Перенос Axentis Market на новый сервер

Старый сервер: `109.123.253.238` · Новый сервер: `77.237.242.126` (оба root)

Стек: Docker Compose (PostgreSQL + Go backend:3000 + nginx-frontend:5173) за
host-nginx с TLS для `axentis.uz`.

---

## 0. DNS (сделать ПЕРВЫМ — распространяется до нескольких часов)
В панели регистратора домена `axentis.uz` измените A-записи:
```
axentis.uz       A   77.237.242.126
www.axentis.uz   A   77.237.242.126
```
Проверка (с любого компьютера): `ping axentis.uz` → должен отвечать новый IP.

---

## 1. Старый сервер — сделать бэкап данных (БД + картинки)
```bash
ssh root@109.123.253.238

cd /root/Axentis-market
# дамп базы из контейнера postgres
docker exec axentis-market-postgres pg_dump -U onlineshop2_user onlineshop2 > /root/axentis_db.sql
# архив загруженных картинок товаров
tar czf /root/axentis_uploads.tar.gz -C /root/Axentis-market/backend uploads
ls -lh /root/axentis_db.sql /root/axentis_uploads.tar.gz
exit
```

## 2. Перенести бэкап на новый сервер
С вашего компьютера (или прямо со старого сервера через scp):
```bash
scp root@109.123.253.238:/root/axentis_db.sql        root@77.237.242.126:/root/
scp root@109.123.253.238:/root/axentis_uploads.tar.gz root@77.237.242.126:/root/
```

---

## 3. Новый сервер — установить ПО
```bash
ssh root@77.237.242.126

apt update && apt upgrade -y
apt install -y git nginx certbot python3-certbot-nginx ca-certificates curl

# Docker + Docker Compose plugin
curl -fsSL https://get.docker.com | sh
docker --version && docker compose version
```

## 4. Скачать проект
```bash
cd /root
git clone https://github.com/azamjon1330/Axentis-market.git
cd Axentis-market
```

## 5. Настроить секреты (ОБЯЗАТЕЛЬНО)
Откройте `backend/.env` и задайте реальные значения:
```bash
nano backend/.env
```
- `DB_PASSWORD` — придумайте надёжный пароль
- `JWT_SECRET` — длинная случайная строка (напр. `openssl rand -hex 32`)
- `CARD_ENCRYPTION_KEY` — длинная случайная строка
- `ADMIN_CODE` и `ADMIN_PHONE` — смените на свои секретные значения
- `GIN_MODE=release` (уже стоит)

Тот же пароль БД пропишите в `docker-compose.yml` → `POSTGRES_PASSWORD`
(значения `DB_PASSWORD` и `POSTGRES_PASSWORD` ДОЛЖНЫ совпадать):
```bash
nano docker-compose.yml
```

## 6. Восстановить картинки
```bash
mkdir -p backend/uploads
tar xzf /root/axentis_uploads.tar.gz -C backend
ls backend/uploads | head
```

## 7. Поднять контейнеры
```bash
docker compose up -d --build
docker compose ps          # все 3 контейнера должны быть Up
docker compose logs backend --tail=30   # должно быть "🚀 Server starting on port 3000"
```

## 8. Восстановить данные БД (после того как контейнеры поднялись)
```bash
# заливаем дамп в работающий контейнер postgres
cat /root/axentis_db.sql | docker exec -i axentis-market-postgres psql -U onlineshop2_user -d onlineshop2
# перезапустить backend, чтобы миграции дошли поверх восстановленных данных
docker compose restart backend
```
> Если переносить данные НЕ нужно (чистый старт) — пропустите шаги 1,2,6,8.

## 9. Host-nginx + SSL (HTTPS для axentis.uz)
```bash
# конфиг сайта (он уже в репозитории)
cp nginx_host.conf /etc/nginx/sites-available/axentis.uz
ln -sf /etc/nginx/sites-available/axentis.uz /etc/nginx/sites-enabled/axentis.uz
rm -f /etc/nginx/sites-enabled/default
mkdir -p /var/www/certbot

# ВРЕМЕННО: чтобы certbot выдал сертификат, нужен рабочий 80-й порт.
# Сначала получаем сертификат (standalone), потом включаем полный конфиг:
nginx -t && systemctl restart nginx

# получить сертификат Let's Encrypt (DNS уже должен указывать на новый IP!)
certbot --nginx -d axentis.uz -d www.axentis.uz --non-interactive --agree-tos -m ВАШ_EMAIL@example.com

nginx -t && systemctl reload nginx
```

## 10. Firewall (если включён ufw)
```bash
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable
```

## 11. Проверка
```bash
curl -k https://axentis.uz/health           # {"status":"ok"} — это backend через nginx? нет, это /health backend; для сайта:
curl -I https://axentis.uz                   # 200 OK, страница сайта
curl https://axentis.uz/api/companies/top    # JSON (бэкенд отвечает)
```
Откройте в браузере: **https://axentis.uz** — сайт должен работать.

---

## 12. Будущие обновления (после переноса)
```bash
cd /root/Axentis-market
git pull origin main
docker compose up -d --build
```

## 13. (Опционально) выключить старый сервер
Убедитесь, что всё работает на новом минимум сутки, затем на старом:
```bash
ssh root@109.123.253.238 'cd /root/Axentis-market && docker compose down'
```

---

## Частые проблемы
- **502 Bad Gateway** → контейнеры не подняты: `docker compose ps`, `docker compose logs`.
- **Сертификат не выдаётся** → DNS ещё не указывает на новый IP (`ping axentis.uz`) или 80-й порт занят.
- **Сайт не видит API / CORS** → проверьте, что домен есть в `ALLOWED_ORIGINS` (`backend/.env`) и `docker compose restart backend`.
- **БД не подключается** → `DB_PASSWORD` в `backend/.env` ≠ `POSTGRES_PASSWORD` в `docker-compose.yml`.
- **Мобильное приложение** обновляется отдельно (Expo OTA), к серверу не привязано — кроме API-адреса.
