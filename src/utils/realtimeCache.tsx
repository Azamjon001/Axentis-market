/**
 * 🚀 RAM КЭШ (БЕЗ SUPABASE)
 * Миграция: Supabase realtime отключен, используем только REST API + polling
 */

import { useState, useEffect, useRef } from 'react';
import { queryClient, localCache } from './cache';

// ========== RAM КЭШ (В ПАМЯТИ) ==========
interface RAMCacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class RAMCache {
  private cache = new Map<string, RAMCacheEntry<any>>();
  
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }
  
  set<T>(key: string, data: T, ttl: number = 5 * 60 * 1000) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }
  
  delete(key: string) {
    this.cache.delete(key);
  }
  
  clear() {
    this.cache.clear();
  }
  
  has(key: string): boolean {
    return this.cache.has(key);
  }
  
  size(): number {
    return this.cache.size;
  }
  
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }
  }
}

export const ramCache = new RAMCache();

// Автоочистка каждые 2 минуты
setInterval(() => {
  ramCache.cleanup();
}, 2 * 60 * 1000);

// ========== REALTIME MANAGER (ЗАГЛУШКА) ==========
class RealtimeManager {
  subscribeToProducts(companyId?: number) {
    // Supabase отключен
  }
  
  subscribeToCompanies() {
    // Supabase отключен
  }
  
  subscribeToAds() {
    // Supabase отключен
  }
  
  subscribeToOrders(companyId?: number, userId?: string) {
    // Supabase отключен
  }
  
  unsubscribe(channelName: string) {
    // Supabase отключен
  }
  
  unsubscribeAll() {
    // Supabase отключен
  }
  
  addListener(channelName: string, callback: (data: any) => void) {
    // Supabase отключен
  }
  
  removeListener(channelName: string, callback: (data: any) => void) {
    // Supabase отключен
  }
}

export const realtimeManager = new RealtimeManager();

// ========== REACT HOOKS (ЗАГЛУШКИ) ==========

export function useRealtimeSubscription(
  channelName: string,
  callback: (data: any) => void
) {
  // Заглушка - ничего не делаем
}

export function useCustomerOrdersRealtime(phoneNumber: string | undefined) {
  // Заглушка - возвращаем 0 чтобы не вызывать лишних обновлений
  return { shouldRefresh: 0 };
}
