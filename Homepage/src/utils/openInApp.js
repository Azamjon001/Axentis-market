import { Platform } from 'react-native';

// 📲 «Умное» открытие приложения с сайта (axentis.uz — это веб-сборка этого
// же приложения). Когда человек открывает расшаренную ссылку
// axentis.uz/product/123 в браузере, а у него установлено приложение —
// переключаемся в приложение.
//
// Android: используем intent:// — он работает БЕЗ верификации App Links
// (assetlinks.json): если приложение установлено, Chrome открывает его;
// если нет — браузер просто остаётся на сайте (fallback не указываем,
// чтобы не перезагружать страницу).
//
// iOS: авто-переход по кастомной схеме показывает системную ошибку, если
// приложения нет, поэтому на iOS ничего не делаем — там ссылку перехватят
// Universal Links после публикации apple-app-site-association.
//
// Пытаемся ровно один раз за сессию браузера, чтобы не мешать тем, кто
// осознанно пользуется сайтом.
const SESSION_KEY = 'axentis_open_in_app_attempted';

export function tryOpenInApp(path) {
  if (Platform.OS !== 'web') return;
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  try {
    if (window.sessionStorage.getItem(SESSION_KEY)) return;
    const ua = navigator.userAgent || '';
    const isAndroid = /android/i.test(ua);
    if (!isAndroid) return;
    window.sessionStorage.setItem(SESSION_KEY, '1');
    const clean = String(path || '').replace(/^\/+/, '');
    window.location.href =
      `intent://${clean}#Intent;scheme=axentis;package=com.axentis.homepage;end`;
  } catch {
    // Приватный режим без sessionStorage и т.п. — молча остаёмся на сайте.
  }
}
