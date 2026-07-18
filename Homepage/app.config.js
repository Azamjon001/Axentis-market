// Динамический конфиг поверх app.json. Делает две вещи:
//
// 1) 🔀 Два приложения из одной кодовой базы:
//    • Публичный маркет (по умолчанию) — обычный Axentis Market.
//    • «Axentis Private» — приложение для покупателей ЗАКРЫТЫХ компаний:
//      вход только по уникальному ID компании, виден только её каталог.
//    Сборка приватного варианта:
//      APP_VARIANT=private npx expo start
//      APP_VARIANT=private eas build --platform android
//
// 2) 🔥 Безопасное подключение google-services.json (ключи Firebase для
//    push-уведомлений). Сборка APK дважды падала из-за него:
//      • файла не было в git — prebuild падал с ENOENT;
//      • файл был, но Firebase-клиент в нём зарегистрирован на ДРУГОЙ
//        package name — gradle падал на :app:processReleaseGoogleServices.
//    Поэтому файл подключается ТОЛЬКО если он существует И содержит клиент
//    именно для собираемого пакета. Иначе собираем без него (приложение
//    работает, просто нет FCM-пушей) и пишем предупреждение в лог сборки.
//
//    Как включить push-уведомления:
//      1. Firebase Console → Project settings → Add app → Android,
//         package name ровно как у собираемого варианта
//         (com.axentis.homepage или com.axentis.private).
//      2. Скачайте google-services.json ИМЕННО этого приложения.
//      3. Передайте его в EAS:
//         eas env:create --scope project --name GOOGLE_SERVICES_JSON \
//           --type file --value ./google-services.json
//      (или просто положите файл в Homepage/ и закоммитьте)
const fs = require('fs');
const path = require('path');

// Файл подходит, только если содержит клиент с нашим package name — иначе
// gradle-плагин Google Services всё равно уронит сборку.
function matchesPackage(filePath, pkg) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const clients = Array.isArray(parsed?.client) ? parsed.client : [];
    return clients.some(
      (c) => c?.client_info?.android_client_info?.package_name === pkg,
    );
  } catch {
    return false;
  }
}

module.exports = ({ config }) => {
  const isPrivate = process.env.APP_VARIANT === 'private';

  // ── Вариант приложения (публичный / закрытый) ──
  let merged = {
    ...config,
    extra: { ...(config.extra || {}), appVariant: isPrivate ? 'private' : 'public' },
  };
  if (isPrivate) {
    merged = {
      ...merged,
      name: 'Axentis Private',
      slug: 'homepage-private',
      scheme: 'axentis-private',
      ios: {
        ...(merged.ios || {}),
        bundleIdentifier: 'com.axentis.private',
      },
      android: {
        ...(merged.android || {}),
        package: 'com.axentis.private',
      },
    };
  }

  // ── google-services.json: подключаем только валидный для этого пакета ──
  const android = { ...(merged.android || {}) };
  delete android.googleServicesFile;

  const pkg = android.package;
  const candidates = [
    process.env.GOOGLE_SERVICES_JSON,
    path.join(__dirname, 'google-services.json'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    if (matchesPackage(candidate, pkg)) {
      android.googleServicesFile =
        candidate === process.env.GOOGLE_SERVICES_JSON ? candidate : './google-services.json';
      break;
    }
    console.warn(
      `⚠️  ${candidate} не содержит Firebase-клиента для пакета "${pkg}" — ` +
      'файл пропущен, сборка продолжится без push-уведомлений. ' +
      'Добавьте Android-приложение с этим package name в Firebase Console и скачайте новый google-services.json.',
    );
  }

  return { ...merged, android };
};
