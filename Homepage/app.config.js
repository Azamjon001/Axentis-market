// Два приложения из одной кодовой базы:
//
//   • Публичный маркет (по умолчанию) — обычный Axentis Market.
//   • «Axentis Private» — приложение для покупателей ЗАКРЫТЫХ компаний:
//     вход только по уникальному ID компании, виден только её каталог.
//
// Сборка приватного варианта:
//   APP_VARIANT=private npx expo start
//   APP_VARIANT=private eas build --platform android
//
// app.json остаётся базовой конфигурацией; здесь только переопределения.
module.exports = ({ config }) => {
  const isPrivate = process.env.APP_VARIANT === 'private';
  if (!isPrivate) {
    return {
      ...config,
      extra: { ...(config.extra || {}), appVariant: 'public' },
    };
  }
  return {
    ...config,
    name: 'Axentis Private',
    slug: 'homepage-private',
    scheme: 'axentis-private',
    ios: {
      ...(config.ios || {}),
      bundleIdentifier: 'com.axentis.private',
    },
    android: {
      ...(config.android || {}),
      package: 'com.axentis.private',
    },
    extra: { ...(config.extra || {}), appVariant: 'private' },
  };
};
