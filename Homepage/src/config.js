const API_HOST = 'https://axentis.uz';

export const API_BASE_URL = `${API_HOST}/api`;
export const UPLOADS_BASE_URL = `${API_HOST}/uploads`;
export const SOCKET_URL = API_HOST;

// 🗺️ Карта выбора адреса использует тайлы Google Maps через Leaflet.
// Для тайлов ключ не нужен. Если указать ключ Google Geocoding API ниже —
// поиск адреса будет работать через Google (точнее, чем OpenStreetMap).
// Без ключа поиск использует OpenStreetMap/Nominatim с привязкой к Узбекистану.
export const GOOGLE_MAPS_API_KEY = 'AIzaSyCKxDzmnrnLTr21SY4BTKAQqegjvNzRbiU';

export const APP_CONFIG = {
  name: 'Axentis Market',
  version: '1.0.0',
  defaultCity: 'Ташкент',
  deliveryCost: 30000,
  freeDeliveryFrom: 0,
  currency: 'сум',
  phonePrefix: '+998',
  supportPhone: '+998712345678',
  supportEmail: 'support@axentis.uz',
};
