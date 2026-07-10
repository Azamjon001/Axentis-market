# Axentis Market

E-commerce marketplace for Uzbekistan. Sellers (companies) list products;
customers browse, order, and pay with pickup or delivery. The platform also
provides sellers with a POS (barcode sales), digital warehouse, expense and
profit analytics, discounts, advertising, and a referral-agent program.

---

## Architecture

The repository contains the parts that share one PostgreSQL database:

| Part | Path | Stack | Served at |
|------|------|-------|-----------|
| **Backend API** | [`backend/`](backend/) | Go 1.22 · Gin · PostgreSQL (raw SQL, parameterized) · JWT | `/api` |
| **Customer app** | [`Homepage/`](Homepage/) | Expo / React Native | Android + iOS **and** `axentis.uz/` (Expo Web) |
| **Business panels** (seller / admin / courier / referral agent) | [`src/`](src/) | React 18 · TypeScript · Vite | `axentis.uz/business` |

The customer storefront on the web is the **same** Expo/React Native code as
the mobile app, compiled for the browser (Expo Web) — so `axentis.uz` and the
mobile app are pixel-identical and stay in sync automatically. `src/` is only
the business/admin side.

```
Customer ─▶  Homepage (Expo)  ──▶ Android/iOS  ─┐
                              └──▶ axentis.uz/  ─┤
Seller/Admin/Courier ─▶ Vite panels  axentis.uz/business ─┼─▶ Go API (/api) ─▶ PostgreSQL
```

Nginx terminates TLS for `axentis.uz`, serves the Expo-Web storefront at `/`,
the Vite business panels at `/business`, social share/OG pages at
`/product/:id` & `/company/:id` (bots only), and proxies `/api`, `/uploads`,
`/socket.io` to the Go backend.

### Building the web storefront

```bash
cd Homepage && npm install && npm run build:web   # → ../web-customer
```

`web-customer/` (committed) is deployed to the site root; `src` builds to
`build/` (Vite `base: /business/`) and is deployed under `/business`. The
`Dockerfile.frontend` wires both into the nginx image.

---

## Local development

### 1. Database + backend (Docker)

```bash
docker-compose up -d        # postgres + backend + frontend
```

Or run the backend directly:

```bash
cd backend
cp .env .env.local          # edit values (see "Configuration" below)
go run .                    # serves on :3000, runs DB migrations on startup
```

### 2. Web app

```bash
npm install
npm run dev                 # Vite dev server on :5173, proxies /api to :3000
```

### 3. Mobile app

```bash
cd Homepage
npm install
npx expo start              # Expo Go / dev client
```

---

## Configuration

Backend reads configuration from environment variables (see
[`backend/.env`](backend/.env) for the full list — **it holds placeholders
only**). Set real values via the server environment or a `*.local` file
(git-ignored). Key variables:

| Variable | Purpose |
|----------|---------|
| `PORT` | API port (default `3000`) |
| `GIN_MODE` | `release` in production (avoids leaking debug info) |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | PostgreSQL connection |
| `JWT_SECRET` | **Must** be a long random value in production — it signs auth tokens |
| `JWT_EXPIRATION` | Token lifetime (e.g. `168h`) |
| `ALLOWED_ORIGINS` | Comma-separated CORS allow-list |
| `ANTHROPIC_API_KEY` | Optional — AI product parsing |
| `ESKIZ_EMAIL` / `ESKIZ_PASSWORD` / `ESKIZ_FROM` | Optional — SMS delivery via [Eskiz.uz](https://my.eskiz.uz) (free 100-SMS test package for new accounts) |
| `TELEGRAM_BOT_TOKEN` | Optional — free OTP delivery through a Telegram bot (`/setWebhook` → `https://axentis.uz/api/telegram/webhook`) |

On startup the backend logs loud warnings if `JWT_SECRET` / `DB_PASSWORD` are
left at insecure defaults or `GIN_MODE` is not `release`.

Web/mobile read `VITE_API_URL` / `VITE_SOCKET_URL` (web) and
`Homepage/src/config` (mobile).

---

## Authentication

- **Customers** sign in by phone (optional password, hashed with bcrypt) **or
  by SMS one-time code** (`POST /auth/otp/request` → `POST /auth/otp/verify`;
  verifying the code proves phone ownership, logs the user in and creates the
  account on first use). OTP delivery tries Eskiz.uz → Telegram bot → dev log;
  codes are stored hashed (HMAC-SHA256), live 5 minutes, max 5 attempts and
  3 sends / 10 min per number.
- **Companies / admins** sign in with phone + password and receive a JWT.
- **Referral agents** have their own login.

The API attaches the authenticated principal (`companyId`, `phone`, `role`)
to each request via JWT middleware ([`backend/middleware/auth.go`](backend/middleware/auth.go)).
Auth endpoints are rate-limited per IP.

---

## Private (closed) companies

A seller can switch its mode to **private** (`PUT /companies/:id/privacy`,
seller settings panel). A private company gets a unique access code
(`private_code`) and disappears from the public storefront entirely —
catalog, search, suggestions, categories, similar / frequently-bought,
recommendations, company lists and the personalized feed all filter through
the shared visibility rule in
[`backend/routes/handlers/privacy.go`](backend/routes/handlers/privacy.go).

Customers of a private company sign in with that access code (login screen →
«Закрытая компания», or the dedicated **Axentis Private** app variant:
`APP_VARIANT=private npx expo start` in `Homepage/`). They see **only** that
company's products, and public customers never see theirs. The mobile API
layer scopes every request automatically once a private user is logged in.

---

## Personalized home feed

`GET /products?phone=…` ranks the main feed per user, Instagram/YouTube
style: product views (`product_views`, with 30-day exponential decay) and
purchases (weight 5) build a category/brand affinity profile, which orders
the feed (promoted items stay on top). Composition and pagination are
unchanged — only the ordering is personal.

---

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) builds and vets the Go
backend and builds the web app on every push and pull request.

---

## Deployment

Production runs on a VPS behind Nginx (`axentis.uz`). The `deploy-*.sh` /
`*.ps1` helper scripts in [`scripts/legacy/`](scripts/legacy/) drive the current manual process; the
runbooks and historical notes live in [`docs/`](docs/) — start with
[`docs/DEPLOY_MANUAL.md`](docs/DEPLOY_MANUAL.md) and
[`docs/DEPLOYMENT_NOTES.md`](docs/DEPLOYMENT_NOTES.md).

> The original UI design lives at
> https://www.figma.com/design/hMZ4spaXwvA0UeZpBEWqlo/Azaton
