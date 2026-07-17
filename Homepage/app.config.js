// Динамический конфиг поверх app.json.
//
// Зачем: app.json жёстко ссылался на ./google-services.json, но этот файл
// (ключи Firebase для push-уведомлений) не хранится в git — EAS Build видел
// только файлы из git и падал на prebuild с ENOENT. Здесь ссылка на файл
// добавляется ТОЛЬКО если он действительно доступен, поэтому APK собирается
// и без него (просто не будет FCM-пушей).
//
// Как вернуть push-уведомления в сборке:
//   eas env:create --scope project --name GOOGLE_SERVICES_JSON \
//     --type file --value ./google-services.json
// EAS положит файл в билд-машину и передаст его путь в переменной
// GOOGLE_SERVICES_JSON — конфиг подхватит её автоматически.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const android = { ...(config.android || {}) };
  delete android.googleServicesFile;

  const fromEnv = process.env.GOOGLE_SERVICES_JSON;
  if (fromEnv && fs.existsSync(fromEnv)) {
    android.googleServicesFile = fromEnv;
  } else if (fs.existsSync(path.join(__dirname, 'google-services.json'))) {
    android.googleServicesFile = './google-services.json';
  }

  return { ...config, android };
};
