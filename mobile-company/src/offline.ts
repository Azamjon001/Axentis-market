import AsyncStorage from '@react-native-async-storage/async-storage';
import { cashSales, CashSalePayload } from './api';

// ============================================================================
// 📴 Офлайн-режим кассы.
//
// Если продажа не ушла на сервер (нет сети / сервер недоступен), она
// сохраняется в локальную очередь AsyncStorage и автоматически
// досылается: при старте приложения, при открытии кассы и по таймеру.
// Продавец на базаре может пробивать чеки весь день без интернета.
// ============================================================================

const QUEUE_KEY = 'axentis_pending_cash_sales';

export interface PendingSale extends CashSalePayload {
  localId: string;
  queuedAt: string;
}

export async function getPendingSales(): Promise<PendingSale[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function savePendingSales(list: PendingSale[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(list));
}

export async function queueCashSale(sale: CashSalePayload): Promise<PendingSale> {
  const pending: PendingSale = {
    ...sale,
    localId: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: new Date().toISOString(),
  };
  const list = await getPendingSales();
  list.push(pending);
  await savePendingSales(list);
  return pending;
}

/**
 * Продажа с офлайн-страховкой: пробуем отправить сразу; при сетевой ошибке —
 * кладём в очередь. Возвращает 'sent' или 'queued'.
 */
export async function submitCashSale(sale: CashSalePayload): Promise<'sent' | 'queued'> {
  try {
    await cashSales.create(sale);
    return 'sent';
  } catch (e) {
    // Серверная ошибка валидации (4xx) — не прячем в очередь, пробрасываем.
    // В очередь уходят только сетевые сбои (fetch кидает TypeError).
    if (e instanceof TypeError || /Network|network|Failed to fetch|timeout/i.test(String(e))) {
      await queueCashSale(sale);
      return 'queued';
    }
    throw e;
  }
}

/** Досылка очереди. Возвращает число успешно отправленных продаж. */
export async function syncPendingSales(): Promise<number> {
  const list = await getPendingSales();
  if (list.length === 0) return 0;
  const remaining: PendingSale[] = [];
  let sent = 0;
  for (const sale of list) {
    try {
      const { localId, queuedAt, ...payload } = sale;
      void localId;
      void queuedAt;
      await cashSales.create(payload);
      sent++;
    } catch {
      remaining.push(sale); // сеть всё ещё лежит — оставляем в очереди
    }
  }
  await savePendingSales(remaining);
  return sent;
}
