/**
 * 🚀 УМНЫЙ МЕНЕДЖЕР КЭШИРОВАНИЯ
 * 
 * Функции:
 * 1. Кэширование данных в localStorage
 * 2. Автоматическая проверка устаревания данных
 * 3. Поддержка версионирования данных
 */

interface CacheItem<T> {
  data: T;
  timestamp: number;
  version: string;
}

const CACHE_VERSION = '1.0.0'; // Увеличивайте при изменении структуры данных
const DEFAULT_TTL = 5 * 60 * 1000; // 5 минут по умолчанию

export class CacheManager {
  /**
   * Сохранить данные в кэш
   */
  static set<T>(key: string, data: T, customTTL?: number): void {
    try {
      const cacheItem: CacheItem<T> = {
        data,
        timestamp: Date.now(),
        version: CACHE_VERSION
      };
      localStorage.setItem(`cache_${key}`, JSON.stringify(cacheItem));
      console.log(`💾 [Cache] Saved: ${key}`);
    } catch (error) {
      console.error(`❌ [Cache] Error saving ${key}:`, error);
      // Если localStorage переполнен - очищаем старые данные
      this.clearOldest();
    }
  }

  /**
   * Получить данные из кэша
   * @param ttl - время жизни кэша в миллисекундах (по умолчанию 5 минут)
   */
  static get<T>(key: string, ttl: number = DEFAULT_TTL): T | null {
    try {
      const cached = localStorage.getItem(`cache_${key}`);
      if (!cached) {
        console.log(`📭 [Cache] Miss: ${key}`);
        return null;
      }

      const cacheItem: CacheItem<T> = JSON.parse(cached);
      
      // Проверка версии
      if (cacheItem.version !== CACHE_VERSION) {
        console.log(`🔄 [Cache] Version mismatch: ${key}`);
        this.remove(key);
        return null;
      }

      // Проверка устаревания
      const age = Date.now() - cacheItem.timestamp;
      if (age > ttl) {
        console.log(`⏰ [Cache] Expired: ${key} (age: ${Math.round(age / 1000)}s)`);
        this.remove(key);
        return null;
      }

      console.log(`✅ [Cache] Hit: ${key} (age: ${Math.round(age / 1000)}s)`);
      return cacheItem.data;
    } catch (error) {
      console.error(`❌ [Cache] Error reading ${key}:`, error);
      return null;
    }
  }

  /**
   * Удалить данные из кэша
   */
  static remove(key: string): void {
    localStorage.removeItem(`cache_${key}`);
    console.log(`🗑️ [Cache] Removed: ${key}`);
  }

  /**
   * Очистить весь кэш
   */
  static clear(): void {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('cache_')) {
        localStorage.removeItem(key);
      }
    });
    console.log(`🧹 [Cache] Cleared all cache`);
  }

  /**
   * Очистить самые старые записи при переполнении
   */
  private static clearOldest(): void {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('cache_'));
    const items = keys.map(key => {
      try {
        const item = JSON.parse(localStorage.getItem(key) || '{}');
        return { key, timestamp: item.timestamp || 0 };
      } catch {
        return { key, timestamp: 0 };
      }
    });

    // Сортируем по времени и удаляем старейшие 20%
    items.sort((a, b) => a.timestamp - b.timestamp);
    const toRemove = Math.ceil(items.length * 0.2);
    items.slice(0, toRemove).forEach(item => {
      localStorage.removeItem(item.key);
    });
    console.log(`🧹 [Cache] Cleared ${toRemove} oldest items`);
  }

  /**
   * Получить информацию о кэше
   */
  static getStats(): { count: number; size: number } {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('cache_'));
    let size = 0;
    keys.forEach(key => {
      const value = localStorage.getItem(key);
      if (value) size += value.length;
    });
    return {
      count: keys.length,
      size: Math.round(size / 1024) // KB
    };
  }

  /**
   * Проверить, нужно ли обновить данные
   * @param key - ключ кэша
   * @param ttl - время жизни в миллисекундах
   * @returns true если данные нужно обновить
   */
  static shouldRefresh(key: string, ttl: number = DEFAULT_TTL): boolean {
    const cached = this.get(key, ttl);
    return cached === null;
  }

  /**
   * Получить возраст кэша в секундах
   */
  static getAge(key: string): number | null {
    try {
      const cached = localStorage.getItem(`cache_${key}`);
      if (!cached) return null;
      
      const cacheItem = JSON.parse(cached);
      return Math.round((Date.now() - cacheItem.timestamp) / 1000);
    } catch {
      return null;
    }
  }
}

/**
 * 🎣 СПЕЦИАЛЬНЫЕ КЭШИ ДЛЯ РАЗНЫХ ТИПОВ ДАННЫХ
 */

// Время жизни для разных типов данных
export const CACHE_TTL = {
  PRODUCTS: 5 * 60 * 1000,      // 5 минут - товары
  COMPANIES: 10 * 60 * 1000,    // 10 минут - компании
  CATEGORIES: 30 * 60 * 1000,   // 30 минут - категории
  USER_DATA: 15 * 60 * 1000,    // 15 минут - данные пользователя
  STATIC: 24 * 60 * 60 * 1000   // 24 часа - статичные данные
};

// Ключи кэша
export const CACHE_KEYS = {
  ALL_PRODUCTS: 'all_products',
  COMPANY_PRODUCTS: (id: number) => `company_products_${id}`,
  COMPANY_PROFILE: (id: number) => `company_profile_${id}`,
  COMPANIES_LIST: 'companies_list',
  CATEGORIES: 'categories',
  CUSTOMER_DATA: (phone: string) => `customer_${phone}`,
  CART: (customerId: string) => `cart_${customerId}`
};
