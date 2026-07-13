# 📲 Push-уведомления: что нужно для работы на телефоне

Уведомления идут по цепочке: **бэкенд → Expo Push API → FCM (Google) → телефон**.
Код приложения и бэкенда уже готов. Чтобы push реально приходили на Android-сборку,
нужно один раз подключить Firebase (это бесплатно):

## 1. Файл `google-services.json` (обязательно)

1. Откройте [Firebase Console](https://console.firebase.google.com) → создайте проект
   (или используйте существующий, от которого у вас есть `firebase-admin-sdk.json` на сервере).
2. Добавьте Android-приложение с package name **`com.axentis.homepage`**.
3. Скачайте `google-services.json` и положите его в папку **`Homepage/`**
   (рядом с `app.json` — путь уже прописан: `"googleServicesFile": "./google-services.json"`).

Без этого файла Android-сборка не сможет получить push-токен, и уведомления
не будут приходить вообще (ни звука, ни значка в статус-баре).

## 2. FCM-ключ на серверах Expo (обязательно для EAS-сборок)

```bash
cd Homepage
eas credentials
# Android → Push Notifications → загрузить FCM V1 service account key
```

Ключ берётся в Firebase Console → Project Settings → Service accounts →
Generate new private key.

## 3. Проверка

1. Соберите приложение: `eas build --profile preview --platform android`.
2. Установите APK, войдите в аккаунт — приложение само зарегистрирует
   push-токен (`POST /api/users/push-token`).
3. Отправьте тестовое уведомление из админ-панели («Уведомления» → отправить всем).
4. На телефоне должно появиться уведомление со звуком и белой иконкой-корзиной
   в статус-баре.

## Что уже сделано в коде

- Белая монохромная иконка статус-бара: `Homepage/assets/notification-icon.png`
  (Android требует именно силуэт с прозрачностью — цветная иконка выглядела бы
  серым квадратом).
- Android-канал `default` с важностью MAX, звуком и вибрацией.
- Запрос разрешения POST_NOTIFICATIONS (Android 13+).
- Бэкенд шлёт push при: сообщении от админа, смене статуса заказа,
  новом товаре у магазина (подписчикам), снижении цены и напоминании о корзине.
