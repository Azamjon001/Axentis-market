// 🚀 Service Worker для PWA - Склад и Касса
const CACHE_NAME = 'sklad-kassa-v1.0.0';
const RUNTIME_CACHE = 'runtime-cache-v1';

// Критические файлы для offline работы
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// 📦 Install - кэшируем критические файлы
self.addEventListener('install', (event) => {
  console.log('✅ [SW] Installing Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('✅ [SW] Precaching critical files');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
  );
});

// 🔄 Activate - очищаем старые кэши
self.addEventListener('activate', (event) => {
  console.log('✅ [SW] Activating Service Worker...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('🗑️ [SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 🌐 Fetch - стратегия Network First с fallback на Cache
self.addEventListener('fetch', (event) => {
  // Игнорируем запросы не по HTTP/HTTPS
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // Игнорируем Supabase API запросы - они должны всегда быть fresh
  if (event.request.url.includes('supabase.co')) {
    return;
  }

  event.respondWith(
    // Network First Strategy
    fetch(event.request)
      .then(response => {
        // Клонируем response для кэша
        const responseClone = response.clone();
        
        // Кэшируем только успешные GET запросы
        if (event.request.method === 'GET' && response.status === 200) {
          caches.open(RUNTIME_CACHE).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        
        return response;
      })
      .catch(() => {
        // Если сеть недоступна, пытаемся взять из кэша
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            console.log('📦 [SW] Serving from cache:', event.request.url);
            return cachedResponse;
          }
          
          // Если это навигация и нет кэша, показываем offline страницу
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          
          // Иначе возвращаем ошибку
          return new Response('Offline - нет подключения к интернету', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain'
            })
          });
        });
      })
  );
});

// 🔔 Push notifications (для будущего функционала)
self.addEventListener('push', (event) => {
  console.log('🔔 [SW] Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'Новое уведомление',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'sklad-notification',
    requireInteraction: false
  };

  event.waitUntil(
    self.registration.showNotification('Склад и Касса', options)
  );
});

// 🎯 Notification click
self.addEventListener('notificationclick', (event) => {
  console.log('🎯 [SW] Notification clicked');
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/')
  );
});

console.log('🚀 [SW] Service Worker loaded successfully!');
