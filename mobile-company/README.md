# Axentis Business — мобильная панель компании

React Native (Expo) приложение панели компаний маркетплейса **Axentis**.
Повторяет принципы веб-панели компаний (`src/components/CompanyPanel.tsx`),
но в формате нативного приложения для Play Market.

## Что внутри

| Раздел | Принцип из веб-панели | Endpoints |
|---|---|---|
| Вход | `CompanyLogin.tsx` (телефон + пароль + реферальный код + политика) | `POST /auth/login/company` |
| Дашборд | `CompanyDashboardPanel.tsx` | `/analytics/company/:id/dashboard`, `/analytics/company/:id/profit` |
| Склад ↔ Продажи | `DigitalWarehouse.tsx` + `SalesPanel.tsx` (единый раздел с переключателем) | `/products`, `/sales` |
| Заказы | `CompanyOrdersPanel.tsx` (принять → отправить → завершить / отменить) | `/orders`, `/orders/:id/status`, `/orders/:id/confirm`, `/orders/:id/mark-delivered` |
| Аналитика | `AnalyticsPanel.tsx` (период 7/30/90, выручка по дням, топ товаров) | `/analytics/company/:id`, `/sales` |
| Настройки | нижний блок сайдбара (язык uz/ru, тема ☀️/🌙, выход) | `/companies/:id` |

Дизайн-токены (цвета, радиусы) — 1:1 с `--ax-*` переменными из
`src/dark-theme.css` веб-панели (`src/theme.tsx`).

## 🚫 Безопасность: без админ-панели

В приложении **невозможно войти администратором**:

- используется только `POST /auth/login/company` — каскада
  «админ → компания → агент», как в вебе, здесь нет;
- ни один `/admin/*` endpoint и `/auth/login/admin` в клиент не подключены;
- экран входа явно сообщает, что вход администратора доступен только в веб-панели.

## Запуск в разработке

```bash
cd mobile-company
npm install
npx expo start          # QR-код для Expo Go (Android/iOS)
```

API по умолчанию — `https://axentis.uz/api`. Для локального бэкенда:

```bash
EXPO_PUBLIC_API_URL=http://192.168.x.x:3000/api npx expo start
```

## Сборка для Play Market (EAS)

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview      # APK для теста на устройстве
eas build -p android --profile production   # AAB для Google Play Console
eas submit -p android                       # загрузка в Play Market
```

Android package: `uz.axentis.business`.
