import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ReactNode } from 'react';
import * as api from './api';
import { invalidateCache } from './productsCache';
import { ramCache, realtimeManager } from './realtimeCache';

// 🚀 Экспортируем для использования в других модулях
export { ramCache, realtimeManager };

// ========== ГЛОБАЛЬНЫЙ QUERY CLIENT С АГРЕССИВНЫМ КЭШИРОВАНИЕМ ==========
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // Данные свежие 5 минут
      gcTime: 10 * 60 * 1000, // Кэш живёт 10 минут
      refetchOnWindowFocus: false, // Не перезапрашиваем при фокусе
      retry: 1, // Всего 1 повтор при ошибке
    },
  },
});

// ========== ПРОВАЙДЕР ==========
export function CacheProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

// ========== ЛОКАЛЬНОЕ ХРАНИЛИЩЕ (МГНОВЕННОЕ) ==========
const CACHE_VERSION = 'v1';

export const localCache = {
  get: <T,>(key: string): T | null => {
    try {
      const item = localStorage.getItem(`${CACHE_VERSION}_${key}`);
      if (!item) return null;
      const { data, timestamp } = JSON.parse(item);
      // Локальный кэш живёт 15 минут
      if (Date.now() - timestamp > 15 * 60 * 1000) {
        localStorage.removeItem(`${CACHE_VERSION}_${key}`);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  },
  
  set: <T,>(key: string, data: T) => {
    try {
      localStorage.setItem(`${CACHE_VERSION}_${key}`, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('Cache storage failed:', e);
    }
  },
  
  remove: (key: string) => {
    localStorage.removeItem(`${CACHE_VERSION}_${key}`);
  },
  
  clear: () => {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(CACHE_VERSION)) {
        localStorage.removeItem(key);
      }
    });
  }
};

// ========== ОПТИМИЗИРОВАННЫЕ ХУКИ ==========

// Products с мгновенным локальным кэшем
export function useProducts(companyId?: number) {
  const cacheKey = `products_${companyId || 'all'}`;
  
  return useQuery({
    queryKey: ['products', companyId],
    queryFn: async () => {
      // Сначала проверяем локальный кэш (мгновенно!)
      const cached = localCache.get<any[]>(cacheKey);
      if (cached) {
        console.log('⚡ Instant cache hit for products!');
        // Возвращаем кэш, но запрос всё равно идёт в фоне
        setTimeout(() => {
          api.getProducts(companyId).then(products => {
            localCache.set(cacheKey, products);
            queryClient.setQueryData(['products', companyId], products);
          });
        }, 0);
        return cached;
      }
      
      const products = await api.getProducts(companyId);
      localCache.set(cacheKey, products);
      return products;
    },
    staleTime: 3 * 60 * 1000, // 3 минуты для товаров
  });
}

// Paginated Products (для больших списков)
export function useProductsPaginated(params: {
  companyId?: number;
  limit?: number;
  offset?: number;
  search?: string;
  availableOnly?: boolean;
}) {
  return useQuery({
    queryKey: ['products-paginated', params],
    queryFn: () => api.getProductsPaginated(params),
    staleTime: 2 * 60 * 1000,
    keepPreviousData: true, // Показываем старые данные пока загружаются новые
  });
}

// Add Product с оптимистичным обновлением
export function useAddProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: api.addProduct,
    onMutate: async (newProduct) => {
      // Отменяем текущие запросы
      await queryClient.cancelQueries({ queryKey: ['products'] });
      
      // Сохраняем предыдущее состояние
      const previousProducts = queryClient.getQueryData(['products', newProduct.company_id]);
      
      // Оптимистично обновляем UI (мгновенно!)
      queryClient.setQueryData(['products', newProduct.company_id], (old: any) => {
        if (!old) return [newProduct];
        return [...old, { ...newProduct, id: Date.now() }];
      });
      
      return { previousProducts };
    },
    onError: (err, newProduct, context: any) => {
      // Откатываем при ошибке
      queryClient.setQueryData(['products', newProduct.company_id], context.previousProducts);
    },
    onSuccess: (data, variables) => {
      // Обновляем кэш после успеха
      queryClient.invalidateQueries({ queryKey: ['products', variables.company_id] });
      localCache.remove(`products_${variables.company_id}`);
      invalidateCache(); // 🚀 Очищаем супер-кэш для покупателей!
    },
  });
}

// Update Product с оптимистичным обновлением
export function useUpdateProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: any }) => 
      api.updateProduct(id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['products'] });
      
      const previousProducts = queryClient.getQueryData(['products']);
      
      // Оптимистично обновляем
      queryClient.setQueriesData({ queryKey: ['products'] }, (old: any) => {
        if (!old) return old;
        return old.map((p: any) => p.id === id ? { ...p, ...updates } : p);
      });
      
      return { previousProducts };
    },
    onError: (err, variables, context: any) => {
      queryClient.setQueryData(['products'], context.previousProducts);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      localCache.clear();
    },
  });
}

// Delete Product с оптимистичным обновлением
export function useDeleteProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: api.deleteProduct,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['products'] });
      
      const previousProducts = queryClient.getQueryData(['products']);
      
      // Оптимистично удаляем
      queryClient.setQueriesData({ queryKey: ['products'] }, (old: any) => {
        if (!old) return old;
        return old.filter((p: any) => p.id !== id);
      });
      
      return { previousProducts };
    },
    onError: (err, id, context: any) => {
      queryClient.setQueryData(['products'], context.previousProducts);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      localCache.clear();
      invalidateCache(); // 🚀 Очищаем супер-кэш для покупателей!
    },
  });
}

// Bulk Toggle с оптимизацией
export function useBulkToggleAvailability() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ productIds, setAvailable }: { productIds: number[]; setAvailable: boolean }) =>
      api.bulkToggleCustomerAvailability(productIds, setAvailable),
    onMutate: async ({ productIds, setAvailable }) => {
      await queryClient.cancelQueries({ queryKey: ['products'] });
      
      const previousProducts = queryClient.getQueryData(['products']);
      
      // Оптимистично обновляем все товары
      queryClient.setQueriesData({ queryKey: ['products'] }, (old: any) => {
        if (!old) return old;
        return old.map((p: any) => 
          productIds.includes(p.id) 
            ? { ...p, customer_available: setAvailable }
            : p
        );
      });
      
      return { previousProducts };
    },
    onError: (err, variables, context: any) => {
      queryClient.setQueryData(['products'], context.previousProducts);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      localCache.clear();
    },
  });
}

// Sales History
export function useSalesHistory(companyId: number) {
  const cacheKey = `sales_${companyId}`;
  
  return useQuery({
    queryKey: ['sales-history', companyId],
    queryFn: async () => {
      const cached = localCache.get<any[]>(cacheKey);
      if (cached) {
        console.log('⚡ Instant cache hit for sales!');
        return cached;
      }
      
      const sales = await api.getSalesHistory(companyId);
      localCache.set(cacheKey, sales);
      return sales;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Customer Orders
export function useCustomerOrders(companyId: number) {
  const cacheKey = `orders_${companyId}`;
  
  return useQuery({
    queryKey: ['customer-orders', companyId],
    queryFn: async () => {
      const cached = localCache.get<any[]>(cacheKey);
      if (cached) {
        console.log('⚡ Instant cache hit for orders!');
        return cached;
      }
      
      const orders = await api.getCustomerOrders(companyId);
      localCache.set(cacheKey, orders);
      return orders;
    },
    staleTime: 2 * 60 * 1000,
  });
}

// Add Order с оптимистичным обновлением
export function useAddOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: api.addCustomerOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-orders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      localCache.clear();
    },
  });
}

// Companies
export function useCompanies() {
  return useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const cached = localCache.get<any[]>('companies');
      if (cached) {
        console.log('⚡ Instant cache hit for companies!');
        return cached;
      }
      
      const companies = await api.getCompanies();
      localCache.set('companies', companies);
      return companies;
    },
    staleTime: 10 * 60 * 1000, // Компании меняются редко
  });
}

// Company Revenue
export function useCompanyRevenue(companyId: number) {
  return useQuery({
    queryKey: ['company-revenue', companyId],
    queryFn: () => api.getCompanyRevenue(companyId),
    staleTime: 1 * 60 * 1000, // Обновляем чаще
  });
}

// User Cart (локальный кэш + синхронизация)
export function useUserCart(phoneNumber: string | null) {
  return useQuery({
    queryKey: ['user-cart', phoneNumber],
    queryFn: () => phoneNumber ? api.getUserCart(phoneNumber) : {},
    enabled: !!phoneNumber,
    staleTime: 30 * 1000, // Корзина обновляется часто
  });
}

// Save Cart с дебаунсингом
let saveCartTimeout: any = null;
export function useSaveCart() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ phoneNumber, cartData }: { phoneNumber: string; cartData: any }) => {
      // Дебаунсинг - сохраняем только через 1 секунду после последнего изменения
      return new Promise<void>((resolve) => {
        clearTimeout(saveCartTimeout);
        saveCartTimeout = setTimeout(async () => {
          await api.saveUserCart(phoneNumber, cartData);
          resolve();
        }, 1000);
      });
    },
    onSuccess: (_, variables) => {
      queryClient.setQueryData(['user-cart', variables.phoneNumber], variables.cartData);
    },
  });
}

// User Likes
export function useUserLikes(phoneNumber: string | null) {
  return useQuery({
    queryKey: ['user-likes', phoneNumber],
    queryFn: () => phoneNumber ? api.getUserLikes(phoneNumber) : [],
    enabled: !!phoneNumber,
    staleTime: 5 * 60 * 1000,
  });
}

// Save Likes с дебаунсингом
let saveLikesTimeout: any = null;
export function useSaveLikes() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ phoneNumber, likes }: { phoneNumber: string; likes: number[] }) => {
      return new Promise<void>((resolve) => {
        clearTimeout(saveLikesTimeout);
        saveLikesTimeout = setTimeout(async () => {
          await api.saveUserLikes(phoneNumber, likes);
          resolve();
        }, 1000);
      });
    },
    onSuccess: (_, variables) => {
      queryClient.setQueryData(['user-likes', variables.phoneNumber], variables.likes);
    },
  });
}

// User Receipts
export function useUserReceipts(phoneNumber: string | null) {
  return useQuery({
    queryKey: ['user-receipts', phoneNumber],
    queryFn: () => phoneNumber ? api.getUserReceipts(phoneNumber) : [],
    enabled: !!phoneNumber,
    staleTime: 5 * 60 * 1000,
  });
}

// ========== УТИЛИТЫ ==========

// 🏢 ПРОФИЛЬ КОМПАНИИ (с агрессивным кэшированием)
export function useCompanyProfile(companyId: number) {
  const cacheKey = `company_profile_${companyId}`;
  
  return useQuery({
    queryKey: ['company-profile', companyId],
    queryFn: async () => {
      // 1️⃣ Сначала проверяем localStorage (МГНОВЕННО!)
      const cached = localCache.get<any>(cacheKey);
      if (cached) {
        console.log(`⚡ [CACHE HIT] Мгновенная загрузка профиля компании ${companyId} из localStorage!`);
        
        // Запускаем фоновое обновление для актуальности данных
        setTimeout(() => {
          api.getCompanyProfile(companyId).then(freshData => {
            localCache.set(cacheKey, freshData);
            queryClient.setQueryData(['company-profile', companyId], freshData);
            console.log(`🔄 [CACHE UPDATE] Фоновое обновление профиля компании ${companyId}`);
          }).catch(err => {
            console.warn('Не удалось обновить профиль в фоне:', err);
          });
        }, 0);
        
        return cached;
      }
      
      // 2️⃣ Если кэша нет - загружаем из API
      console.log(`📡 [API CALL] Загрузка профиля компании ${companyId} с сервера...`);
      const freshData = await api.getCompanyProfile(companyId);
      localCache.set(cacheKey, freshData);
      console.log(`💾 [CACHE SAVE] Профиль компании ${companyId} сохранен в localStorage`);
      return freshData;
    },
    staleTime: 10 * 60 * 1000, // 10 минут - профили меняются редко
    gcTime: 30 * 60 * 1000, // 30 минут в памяти
  });
}

// 📦 ТОВАРЫ КОМПАНИИ В ПРОФИЛЕ (для покупателей)
export function useCompanyProducts(companyId: number) {
  const cacheKey = `company_products_${companyId}`;
  
  // 🚀 Включаем Realtime для этой компании
  if (typeof window !== 'undefined') {
    realtimeManager.subscribeToProducts(companyId);
  }
  
  return useQuery({
    queryKey: ['company-products', companyId],
    queryFn: async () => {
      // 1️⃣ Проверяем RAM кэш (САМОЕ БЫСТРОЕ!)
      const ramData = ramCache.get<any[]>(cacheKey);
      if (ramData) {
        console.log(`⚡⚡⚡ [RAM CACHE HIT] Товары компании ${companyId} из RAM!`);
        return ramData;
      }
      
      // 2️⃣ Проверяем localStorage
      const cached = localCache.get<any[]>(cacheKey);
      if (cached) {
        console.log(`⚡ [CACHE HIT] Товары компании ${companyId} из localStorage!`);
        
        // Сохраняем в RAM для следующих вызовов
        ramCache.set(cacheKey, cached, 3 * 60 * 1000); // 3 минуты в RAM
        
        // Фоновое обновление
        setTimeout(() => {
          api.getProducts(companyId).then(products => {
            ramCache.set(cacheKey, products, 3 * 60 * 1000);
            localCache.set(cacheKey, products);
            queryClient.setQueryData(['company-products', companyId], products);
          });
        }, 0);
        
        return cached;
      }
      
      // 3️⃣ Загружаем с сервера
      console.log(`📡 [API CALL] Загрузка товаров компании ${companyId}...`);
      const products = await api.getProducts(companyId);
      
      // Сохраняем во ВСЕ кэши
      ramCache.set(cacheKey, products, 3 * 60 * 1000);
      localCache.set(cacheKey, products);
      
      console.log(`💾💾 [CACHE SAVE] Товары компании ${companyId} сохранены в RAM + localStorage`);
      return products;
    },
    staleTime: 5 * 60 * 1000, // 5 минут
  });
}

// 📸 SMM ПОСТЫ КОМПАНИИ (фото, видео, реклама)
export function useCompanySMMPosts(companyId: number, type?: 'photo' | 'video' | 'ad') {
  const cacheKey = `company_smm_${companyId}_${type || 'all'}`;
  
  return useQuery({
    queryKey: ['company-smm-posts', companyId, type],
    queryFn: async () => {
      const cached = localCache.get<any[]>(cacheKey);
      if (cached) {
        console.log(`⚡ [CACHE HIT] SMM посты компании ${companyId} (${type || 'все'}) из localStorage!`);
        
        // Фоновое обновление SMM контента
        setTimeout(async () => {
          try {
            const response = await fetch(
              `/api/companies/${companyId}/media${type ? `?type=${type}` : ''}`,
              {
                headers: {
                  'Content-Type': 'application/json'
                }
              }
            );
            const data = await response.json();
            if (data.success) {
              localCache.set(cacheKey, data.media);
              queryClient.setQueryData(['company-smm-posts', companyId, type], data.media);
            }
          } catch (err) {
            console.warn('Не удалось обновить SMM посты в фоне:', err);
          }
        }, 0);
        
        return cached;
      }
      
      console.log(`📡 [API CALL] Загрузка SMM постов компании ${companyId}...`);
      const response = await fetch(
        `/api/companies/${companyId}/media${type ? `?type=${type}` : ''}`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to load SMM posts');
      }
      
      localCache.set(cacheKey, data.media);
      console.log(`💾 [CACHE SAVE] SMM посты компании ${companyId} сохранены`);
      return data.media;
    },
    staleTime: 3 * 60 * 1000, // 3 минуты - SMM контент может часто обновляться
  });
}

// 🔄 Функция для инвалидации кэша профиля компании
export function invalidateCompanyProfile(companyId: number) {
  queryClient.invalidateQueries({ queryKey: ['company-profile', companyId] });
  queryClient.invalidateQueries({ queryKey: ['company-products', companyId] });
  queryClient.invalidateQueries({ queryKey: ['company-smm-posts', companyId] });
  
  localCache.remove(`company_profile_${companyId}`);
  localCache.remove(`company_products_${companyId}`);
  // Удаляем все SMM кэши для этой компании
  Object.keys(localStorage).forEach(key => {
    if (key.includes(`company_smm_${companyId}`)) {
      localStorage.removeItem(key);
    }
  });
  
  console.log(`🗑️ [CACHE CLEAR] Кэш профиля компании ${companyId} полностью очищен`);
}

// Предзагрузка данных
export function prefetchProducts(companyId?: number) {
  queryClient.prefetchQuery({
    queryKey: ['products', companyId],
    queryFn: () => api.getProducts(companyId),
  });
}

// Очистка всего кэша
export function clearAllCache() {
  queryClient.clear();
  localCache.clear();
  console.log('🗑️ All cache cleared!');
}

// Обновить данные вручную
export function invalidateAll() {
  queryClient.invalidateQueries();
  localCache.clear();
  console.log('🔄 All data invalidated!');
}