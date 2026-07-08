# Деплой на сервер (VPS с Docker)

Продакшен работает через `docker-compose.yml`: PostgreSQL + Go-бэкенд +
Nginx-фронтенд (в нём и витрина покупателя, и панели бизнеса).

## Обычное обновление (99% случаев)

На сервере, в папке проекта:

```bash
cd /path/to/Axentis-market          # папка, где лежит docker-compose.yml
git pull origin main                # забрать свежий код (витрина уже собрана в web-customer/)
docker compose up -d --build        # пересобрать и перезапустить контейнеры
```

Всё. Через 1–2 минуты:
- `https://axentis.uz/` — витрина покупателя (это приложение Homepage);
- `https://axentis.uz/business` — вход для продавца / админа / курьера.

> На старых версиях Docker команда пишется через дефис: `docker-compose up -d --build`.

## Проверить, что поднялось

```bash
docker compose ps                   # все сервисы должны быть Up
curl -I https://axentis.uz/                 # 200 — витрина
curl -I https://axentis.uz/business         # 200 — панели
docker compose logs -f backend      # логи бэкенда (Ctrl+C для выхода)
```

## Если менял приложение Homepage (нужно пересобрать витрину)

Витрина сайта = приложение Homepage, собранное для веба. Папка `web-customer/`
в репозитории — это готовая сборка. Если ты изменил код в `Homepage/`,
пересобери витрину и закоммить результат **перед** `git pull` на сервере:

```bash
# на своём компьютере (нужен Node.js)
cd Homepage
npm install
npm run build:web                   # создаёт ../web-customer
cd ..
git add web-customer
git commit -m "rebuild web storefront"
git push origin main
```

Затем на сервере — обычное обновление (`git pull` + `docker compose up -d --build`).

Панели бизнеса (`src/`) пересобираются автоматически внутри Docker — их
собирать вручную не нужно.

## Первый запуск на новом сервере

```bash
git clone <repo> Axentis-market && cd Axentis-market

# 1. Прописать реальные секреты (НЕ коммитить их):
#    backend/.env  → DB_PASSWORD, JWT_SECRET (длинный случайный),
#                    ADMIN_PHONE, ADMIN_CODE (сменить с дефолтных!),
#                    CARD_ENCRYPTION_KEY
nano backend/.env

# 2. TLS-сертификат (если ещё нет) — Let's Encrypt / certbot для axentis.uz.

# 3. Поднять всё:
docker compose up -d --build
```

## Важное после этого деплоя

- **Смени `ADMIN_PHONE` / `ADMIN_CODE`** в `backend/.env` — старые дефолтные
  значения были видны в коде.
- Вход для продавцов/админа/курьера теперь на **`axentis.uz/business`**
  (раньше был в корне) — предупреди тех, у кого сохранена старая ссылка.
- Умные ссылки для соцсетей (`/product/:id`, `/company/:id`) заработают
  автоматически — обновлённый `nginx.conf` уже в образе.
