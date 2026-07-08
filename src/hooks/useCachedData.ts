/**
 * 🎣 REACT HOOK ДЛЯ КЭШИРОВАННЫХ ДАННЫХ
 * 
 * Автоматически:
 * - Загружает из кэша при маунте
 * - Проверяет актуальность данных
 * - Обновляет если нужно
 * - Поддерживает pull-to-refresh
 */

import { useState, useEffect, useCallback } from 'react';
import { CacheManager, CACHE_TTL } from '../utils/cacheManager';

interface UseCachedDataOptions<T> {
  cacheKey: string;
  fetchFn: () => Promise<T>;
  ttl?: number;
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: any) => void;
}

interface UseCachedDataResult<T> {
  data: T | null;
  loading: boolean;
  error: any;
  refresh: () => Promise<void>;
  isStale: boolean;
  cacheAge: number | null;
  clearCache: () => void;
}

export function useCachedData<T>({
  cacheKey,
  fetchFn,
  ttl = CACHE_TTL.PRODUCTS,
  enabled = true,
  onSuccess,
  onError
}: UseCachedDataOptions<T>): UseCachedDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [isStale, setIsStale] = useState(false);

  // Загрузка данных
  const loadData = useCallback(async (forceRefresh = false) => {
    if (!enabled) return;

    try {
      setLoading(true);
      setError(null);

      // Проверяем кэш
      if (!forceRefresh) {
        const cached = CacheManager.get<T>(cacheKey, ttl);
        if (cached !== null) {
          console.log(`⚡ [useCachedData] Loaded from cache: ${cacheKey}`);
          setData(cached);
          setLoading(false);
          setIsStale(false);
          onSuccess?.(cached);
          return;
        }
      }

      // Загружаем с сервера
      console.log(`🌐 [useCachedData] Fetching from server: ${cacheKey}`);
      const freshData = await fetchFn();
      
      // Сохраняем в кэш
      CacheManager.set(cacheKey, freshData);
      setData(freshData);
      setIsStale(false);
      onSuccess?.(freshData);

    } catch (err) {
      console.error(`❌ [useCachedData] Error loading ${cacheKey}:`, err);
      setError(err);
      onError?.(err);
      
      // При ошибке пытаемся использовать устаревший кэш
      const staleCache = CacheManager.get<T>(cacheKey, Infinity);
      if (staleCache) {
        console.log(`⚠️ [useCachedData] Using stale cache: ${cacheKey}`);
        setData(staleCache);
        setIsStale(true);
      }
    } finally {
      setLoading(false);
    }
  }, [cacheKey, fetchFn, ttl, enabled, onSuccess, onError]);

  // Обновление данных (pull-to-refresh)
  const refresh = useCallback(async () => {
    await loadData(true);
  }, [loadData]);

  // Очистка кэша
  const clearCache = useCallback(() => {
    CacheManager.remove(cacheKey);
    setData(null);
  }, [cacheKey]);

  // Получить возраст кэша
  const cacheAge = CacheManager.getAge(cacheKey);

  // Загружаем при маунте
  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    data,
    loading,
    error,
    refresh,
    isStale,
    cacheAge,
    clearCache
  };
}

/**
 * 🔄 Hook для Pull-to-Refresh функциональности
 */
export function usePullToRefresh(refreshFn: () => Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);
  const [startY, setStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (window.scrollY === 0) {
      setStartY(e.touches[0].clientY);
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (startY === 0) return;
    
    const currentY = e.touches[0].clientY;
    const distance = currentY - startY;
    
    if (distance > 0 && window.scrollY === 0) {
      setPullDistance(Math.min(distance, 100));
    }
  }, [startY]);

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance > 70 && !refreshing) {
      setRefreshing(true);
      try {
        await refreshFn();
      } finally {
        setRefreshing(false);
      }
    }
    setStartY(0);
    setPullDistance(0);
  }, [pullDistance, refreshing, refreshFn]);

  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    refreshing,
    pullDistance
  };
}
