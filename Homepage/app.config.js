// Динамический конфиг поверх app.json.
//
// Зачем: сборка APK дважды падала из-за google-services.json (ключи Firebase
// для push-уведомлений):
//   1) файла не было в git — prebuild падал с ENOENT;
//   2) файл передали через EAS, но внутри него Firebase-клиент зарегистрирован
//      на ДРУГОЙ package name — gradle падал на :app:processReleaseGoogleServices
//      «No matching client found for package name 'com.axentis.homepage'».
// Поэтому файл подключается ТОЛЬКО если он существует И содержит клиент именно
// для нашего пакета. Во всех остальных случаях собираем без него (приложение
// работает, просто нет FCM-пушей) и пишем понятное предупреждение в лог сборки.
//
// Как правильно включить push-уведомления:
//   1. В Firebase Console → Project settings → Your apps → Add app → Android,
//      укажите package name ровно `com.axentis.homepage`.
//   2. Скачайте новый google-services.json ИМЕННО этого приложения.
//   3. Передайте его в EAS:
//      eas env:create --scope project --name GOOGLE_SERVICES_JSON \
//        --type file --value ./google-services.json
//   (или просто положите файл в Homepage/ и закоммитьте)
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
  const android = { ...(config.android || {}) };
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

  return { ...config, android };
};
