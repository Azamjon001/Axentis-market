/**
 * 🚀 СУПЕР КЭШ для товаров
 * Инвалидация кэша при изменениях
 */

import { queryClient } from './cache';
import { localCache } from './cache';
import { ramCache } from './realtimeCache'; // 🚀 RAM КЭШ

/**
 * Инвалидация всех кэшей товаров
 * Вызывается при любых изменениях (добавление, обновление, удаление)
 */
export function invalidateCache() {
  console.log('🔄 [ProductsCache] Инвалидация всех кэшей...');
  
  try {
    // 1. Инвалидируем React Query кэш
    queryClient.invalidateQueries({ queryKey: ['products'] });
    
    // 2. Очищаем локальный кэш
    localCache.clear();
    
    // 3. Очищаем RAM кэш 🚀
    ramCache.clear();
    
    // 4. Очищаем localStorage кэш
    localStorage.removeItem('products-cache');
    localStorage.removeItem('products-timestamp');
    
    console.log('✅ [ProductsCache] Все кэши очищены (включая RAM)');
  } catch (error) {
    console.error('❌ [ProductsCache] Ошибка очистки кэша:', error);
  }
}

/**
 * Префетч товаров в фоновом режиме
 */
export async function prefetchProducts() {
  try {
    await queryClient.prefetchQuery({
      queryKey: ['products'],
    });
    console.log('✅ [ProductsCache] Префетч выполнен');
  } catch (error) {
    console.error('❌ [ProductsCache] Ошибка префетча:', error);
  }
}

/**
 * Получение данных из кэша без запроса
 */
export function getCachedProducts() {
  return queryClient.getQueryData(['products']) || [];
}

/**
 * Установка данных в кэш вручную
 */
export function setCachedProducts(products: any[]) {
  queryClient.setQueryData(['products'], products);
  console.log(`✅ [ProductsCache] Кэш обновлен (${products.length} товаров)`);
}