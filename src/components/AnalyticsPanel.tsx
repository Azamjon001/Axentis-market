import { useState, useEffect, useRef, useMemo, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, Package, Receipt, Landmark, Plus, ShoppingBag, Users, XCircle, Zap, Crown, CalendarDays, Coins, Gem } from 'lucide-react';
import api from '../utils/api';
import ExpensesManager from './ExpensesManager';
import CompanyPayoutsPanel from './CompanyPayoutsPanel';
import AdvancedInsightsPanel from './AdvancedInsightsPanel';
import PurchaseAnalytics from './PurchaseAnalytics';
import CompactPeriodSelector from './CompactPeriodSelector';
import MerchantCalculator from './MerchantCalculator';
import AxAreaChart from './charts/AxAreaChart';
import { getCurrentLanguage, useTranslation, type Language } from '../utils/translations';

interface Product {
  id: number;
  name: string;
  quantity: number;
  price: number;
  availableForCustomers?: boolean;
  markupPercent?: number;
  markupAmount?: number; // 💰 НОВОЕ: Сумма наценки в деньгах
  sellingPrice?: number; // 💰 НОВОЕ: Цена продажи с наценкой
  category?: string;
}

interface AnalyticsPanelProps {
  companyId: number;
}

export default function AnalyticsPanel({ companyId }: AnalyticsPanelProps) {
  // 🌍 Переводы
  const [language, setLanguage] = useState<Language>(getCurrentLanguage());
  const t = useTranslation(language);
  
  // 🔄 Слушаем изменения языка
  useEffect(() => {
    const handleLanguageChange = (e: CustomEvent) => {
      setLanguage(e.detail);
    };
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    return () => window.removeEventListener('languageChange', handleLanguageChange as EventListener);
  }, []);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [salesHistory, setSalesHistory] = useState<any[]>([]);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [ordersWithItems, setOrdersWithItems] = useState<any[]>([]); // 🆕 Заказы с items для аналитики
  const [loading, setLoading] = useState(true);
  const [companyEarnings, setCompanyEarnings] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0); // 💰 НОВОЕ: Общая выручка (вся сумма с наценкой)

  // 📑 Вкладки: аналитика + закупки + вывод средств
  const [activeTab, setActiveTab] = useState<'analytics' | 'purchases' | 'payouts'>('analytics');
  
  const [operatingExpensesList, setOperatingExpensesList] = useState<any[]>([]);
  const [customExpenses, setCustomExpenses] = useState(0);
  const [inventoryCost, setInventoryCost] = useState(0); // Себестоимость склада из вариантов

  // 🔻 Мини-панель (модальное окно) детализации «Затраты компании»
  const [showExpensesModal, setShowExpensesModal] = useState(false);
  // 🔻 Раскрытие разовых/процентных расходов внутри мини-панели
  const [showExtraExpenses, setShowExtraExpenses] = useState(false);
  // 💳 Комиссия платформы (%) за онлайн-продажи — берём из профиля компании
  const [commissionPercent, setCommissionPercent] = useState(3);

  type PeriodType = 'day' | 'week' | 'month' | 'year' | 'custom';

  const [financialTimePeriod, setFinancialTimePeriod] = useState<PeriodType>('day');

  // 📅 Dates for custom period (added to fix ReferenceError)
  const [financialStartDate, setFinancialStartDate] = useState<Date | null>(null);
  const [financialEndDate, setFinancialEndDate] = useState<Date | null>(null);
  
  useEffect(() => {
    loadData();
    // 💳 Подтягиваем процент комиссии платформы за онлайн-продажи
    api.companies.get(companyId.toString())
      .then((c: any) => {
        if (c && typeof c.platformCommissionPercent === 'number') {
          setCommissionPercent(c.platformCommissionPercent);
        }
      })
      .catch(() => { /* оставляем дефолт 3% */ });
  }, [companyId]);

  // 🔄 НОВОЕ: Автообновление данных каждые 30 секунд для решения AFK проблемы
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('🔄 [Analytics Panel] Auto-refresh data (every 30s)');
      loadData();
    }, 30000); // 30 секунд

    return () => clearInterval(interval);
  }, [companyId]);

  const loadData = async () => {
    try {
      console.log('\n' + '='.repeat(80));
      console.log('📊 [Analytics Panel] НАЧАЛО ЗАГРУЗКИ ДАННЫХ');
      console.log('='.repeat(80));
      console.log('🏢 Company ID:', companyId);
      console.log('🕒 Время загрузки:', new Date().toLocaleString('uz-UZ'));
      
      const [
        productsData,
        salesData,
        ordersData,
        financialStatsData,
        expensesData
      ] = await Promise.all([
        api.products.list({ companyId }),
        api.sales.list({ companyId }).catch(() => []),
        api.orders.list({ companyId }).catch(() => []),
        api.analytics.company(companyId).catch(() => ({})),
        api.expenses.list({ companyId }).catch(() => [])
      ]);

      // Normalize responses
      const products = Array.isArray(productsData) ? productsData : (productsData?.products || []);
      const sales = Array.isArray(salesData) ? salesData : (salesData?.sales || []);
      const orders = Array.isArray(ordersData) ? ordersData : (ordersData?.orders || []);
      const expenses = Array.isArray(expensesData) ? expensesData : (expensesData?.expenses || []);
      
      console.log('\n' + '='.repeat(80));
      console.log('📦 [Analytics Panel] ЗАГРУЖЕННЫЕ ДАННЫЕ:');
      console.log('='.repeat(80));
      console.log('📦 Товаров на складе:', products.length);
      console.log('📊 Продаж в истории:', sales.length);
      console.log('📋 Заказов покупателей:', orders.length);
      console.log('💰 Финансовая статистика:', financialStatsData);
      console.log('💸 Данные расходов:', expenses.length);
      
      if (sales.length > 0) {
        console.log('\n🔍 [Analytics Panel] ДЕТАЛЬНЫЙ АНАЛИЗ ПРОДАЖ (онлайн режимы):');
        sales.forEach((sale, index) => {
          console.log(`\n  📦 Продажа ${index + 1}:`, sale);
        });
      } else {
        console.log('\nℹ️ [Analytics Panel] sales_history пустая (это нормально для режима "Чеки/Коды")');
        console.log('   📊 Используются данные из customer_orders вместо sales_history');
      }
      
      console.log('\n' + '='.repeat(80));
      console.log('💰 [Analytics Panel] ФИНАНСОВЫЕ ПОКАЗАТЕЛИ ИЗ customer_orders:');
      console.log('='.repeat(80));
      console.log('💰 Общая выручка (вся сумма с наценкой):', financialStatsData.totalRevenue, 'сум');
      console.log('💵 Прибыль от наценок:', financialStatsData.totalMarkupProfit, 'сум');
      console.log('📊 Количество продаж:', financialStatsData.salesCount);
      
      // 🔍 ДЕТАЛЬНАЯ ПРОВЕРКА КАЖДОГО ЗАКАЗА
      if (financialStatsData.orders && financialStatsData.orders.length > 0) {
        console.log('\n🔍 [Analytics Panel] ПРОВЕРКА КАЖДОГО ЗАКАЗА:');
        financialStatsData.orders.forEach((order: any, idx: number) => {
          const totalAmount = parseFloat(order.total_amount) || 0;
          const markupProfit = parseFloat(order.markup_profit) || 0;
          
          console.log(`\n  ${idx + 1}. Заказ #${order.order_code}:`);
          console.log(`     - total_amount: ${totalAmount.toLocaleString()} сум`);
          console.log(`     - markup_profit: ${markupProfit.toLocaleString()} сум`);
          console.log(`     - status: ${order.status}`);
          
          if (order.items && Array.isArray(order.items)) {
            let calculatedTotal = 0;
            console.log(`     📦 Товары (${order.items.length} шт):`);
            
            order.items.forEach((item: any) => {
              const basePrice = item.price || 0;
              const priceWithMarkup = item.price_with_markup || 0;
              const markupAmount = item.markupAmount || 0;
              const quantity = item.quantity || 0;
              
              // Вычисляем selling_price
              const sellingPrice = priceWithMarkup > 0 ? priceWithMarkup : (basePrice + markupAmount);
              const itemTotal = sellingPrice * quantity;
              calculatedTotal += itemTotal;
              
              console.log(`        - ${item.name}: base=${basePrice}, selling=${sellingPrice.toFixed(0)}, qty=${quantity}, total=${itemTotal.toFixed(0)}`);
            });
            
            console.log(`     ✅ Пересчитанный total: ${calculatedTotal.toLocaleString()} сум`);
            console.log(`     ${calculatedTotal === totalAmount ? '✅ СОВПАДАЕТ' : '❌ НЕ СОВПАДАЕТ!'} с сохраненным: ${totalAmount.toLocaleString()} сум`);
            
            if (Math.abs(calculatedTotal - totalAmount) > 1) {
              console.error(`     ⚠️⚠️⚠️ ПРОБЛЕМА! Разница: ${(totalAmount - calculatedTotal).toLocaleString()} сум`);
              console.error(`     📋 Этот заказ был создан до исправлений. Откройте /FIX_INSTRUCTIONS.md`);
            }
          }
        });
      }
      
      console.log('='.repeat(80) + '\n');
      
      // Calculate custom expenses from expenses table
      const customExp = expenses.filter((e: any) => e.category === 'custom' || e.category === 'other').reduce((sum: number, e: any) => sum + (e.amount || 0), 0);

      // Calculate purchase costs from products inventory (variant-level prices if available)
      const purchaseCost = products.reduce((sum: number, p: any) => {
        return sum + (p.inventoryCost || (p.quantity || 0) * (p.price || 0));
      }, 0);

      setProducts(products);
      setSalesHistory(sales);
      setCustomerOrders(orders);
      setOrdersWithItems(financialStatsData.orders || []);
      setTotalRevenue(financialStatsData.totalRevenue);
      setCompanyEarnings(financialStatsData.totalMarkupProfit);
      setCustomExpenses(customExp);
      setInventoryCost(financialStatsData.inventoryCost || financialStatsData.inventoryValue || purchaseCost);

      console.log('✅ [Analytics Panel] Данные успешно загружены и установлены в state');
      console.log('🔍 [Analytics Panel] ordersWithItems установлено:', financialStatsData.orders?.length || 0, 'заказов');
      console.log('   🛒 Закупки (стоимость товаров на складе):', purchaseCost);
      console.log('   🛍️ Пользовательские затраты (всего):', customExp);
    } catch (error) {
      console.error('❌❌❌ [Analytics Panel] КРИТИЧЕСКАЯ ОШИБКА:', error);
      alert(t.analyticsLoadError);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('uz-UZ').format(price) + ' ' + t.sum;
  };

  // 🔢 Короткий формат чисел (для больших сумм)
  const formatShortPrice = (price: number) => {
    if (price >= 1_000_000_000) {
      return `${(price / 1_000_000_000).toFixed(1)} ${language === 'uz' ? 'mlrd' : 'м лрд'}`;
    } else if (price >= 1_000_000) {
      return `${(price / 1_000_000).toFixed(1)} ${language === 'uz' ? 'mln' : 'млн'}`;
    } else if (price >= 1_000) {
      return `${(price / 1_000).toFixed(1)} ${language === 'uz' ? 'ming' : 'тыс'}`;
    }
    return price.toString();
  };

  // 🆕 ФИЛЬТРАЦИЯ ЗАКАЗОВ ПО ПЕРИОДУ (с параметром периода)
  // Вернуть диапазон дат для периода
  const getPeriodRange = (period: PeriodType): { start: Date; end: Date } => {
    const now = new Date();
    const start = new Date();
    const end = new Date();
    if (period === 'day') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (period === 'week') {
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
      start.setMonth(now.getMonth() - 1);
      start.setHours(0, 0, 0, 0);
    } else if (period === 'year') {
      start.setFullYear(now.getFullYear() - 1);
      start.setHours(0, 0, 0, 0);
    } else if (period === 'custom') {
      if (financialStartDate) { start.setTime(financialStartDate.getTime()); start.setHours(0,0,0,0); }
      if (financialEndDate)   { end.setTime(financialEndDate.getTime());   end.setHours(23,59,59,999); }
    }
    return { start, end };
  };

  const getFilteredOrders = (period: PeriodType = 'day') => {
    const { start, end } = getPeriodRange(period);
    return ordersWithItems.filter(order => {
      const dateStr = order.created_at || order.createdAt;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return false;
      return d >= start && d <= end;
    });
  };

  const getFilteredSales = (period: PeriodType = 'day') => {
    const { start, end } = getPeriodRange(period);
    return salesHistory.filter(sale => {
      const dateStr = sale.createdAt || sale.created_at;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return false;
      return d >= start && d <= end;
    });
  };

  const getPreviousPeriodOrders = (period: PeriodType = 'day') => {
    const now = new Date();
    let start = new Date();
    let end = new Date();
    if (period === 'day') {
      start.setDate(now.getDate() - 1); start.setHours(0,0,0,0);
      end.setDate(now.getDate() - 1);   end.setHours(23,59,59,999);
    } else if (period === 'week') {
      start.setDate(now.getDate() - 14); start.setHours(0,0,0,0);
      end.setDate(now.getDate() - 7);
    } else if (period === 'month') {
      start.setMonth(now.getMonth() - 2); start.setHours(0,0,0,0);
      end.setMonth(now.getMonth() - 1);
    } else if (period === 'year') {
      start.setFullYear(now.getFullYear() - 2); start.setHours(0,0,0,0);
      end.setFullYear(now.getFullYear() - 1);
    } else {
      return [];
    }
    return ordersWithItems.filter(order => {
      const dateStr = order.created_at || order.createdAt;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return false;
      return d >= start && d <= end;
    });
  };

  // ═══════════════════════════════════════════════════════════
  // ПРИБЫЛЬ = наценка с проданных заказов + кассовых продаж
  //   markup_profit = selling_price - purchase_price (per item × qty)
  // ═══════════════════════════════════════════════════════════
  const getPeriodProfit = (period: PeriodType = 'day') => {
    return getOnlineMarkup(period) + getOfflineMarkup(period);
  };

  // ═══════════════════════════════════════════════════════════
  // НАЦЕНКА ОТДЕЛЬНО: онлайн-заказы (приложение) и офлайн-касса
  // ═══════════════════════════════════════════════════════════
  const getOnlineMarkup = (period: PeriodType = 'day') =>
    getFilteredOrders(period).reduce((sum, o) => sum + (parseFloat(o.markup_profit) || 0), 0);

  const getOfflineMarkup = (period: PeriodType = 'day') =>
    getFilteredSales(period).reduce((sum, s) => sum + (parseFloat(s.markupProfit) || parseFloat(s.markup_profit) || 0), 0);

  // ═══════════════════════════════════════════════════════════
  // ПРОДАЖИ (вся проданная сумма, без вычета себестоимости)
  //   онлайн = сумма заказов из приложения
  //   офлайн = сумма продаж через кассу
  // Эти карточки только для наблюдения и НЕ влияют на итоговый баланс.
  // ═══════════════════════════════════════════════════════════
  const getOnlineSales = (period: PeriodType = 'day') =>
    getFilteredOrders(period).reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0);

  const getOfflineSales = (period: PeriodType = 'day') =>
    getFilteredSales(period).reduce((s, x) => s + (parseFloat(x.total_amount || x.totalAmount) || 0), 0);

  // ═══════════════════════════════════════════════════════════
  // ВЫРУЧКА ЗА ПЕРИОД
  // ═══════════════════════════════════════════════════════════
  const getPeriodRevenue = (period: PeriodType = 'day') => {
    const ordRev = getFilteredOrders(period).reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0);
    const saleRev = getFilteredSales(period).reduce((s, s2) => s + (parseFloat(s2.total_amount || s2.totalAmount) || 0), 0);
    return ordRev + saleRev;
  };

  // Кассовые продажи предыдущего периода (для дельты «офлайн» и прибыли)
  const getPreviousPeriodSales = (period: PeriodType = 'day') => {
    const now = new Date();
    const start = new Date();
    const end = new Date();
    if (period === 'day') {
      start.setDate(now.getDate() - 1); start.setHours(0, 0, 0, 0);
      end.setDate(now.getDate() - 1);   end.setHours(23, 59, 59, 999);
    } else if (period === 'week') {
      start.setDate(now.getDate() - 14); start.setHours(0, 0, 0, 0);
      end.setDate(now.getDate() - 7);
    } else if (period === 'month') {
      start.setMonth(now.getMonth() - 2); start.setHours(0, 0, 0, 0);
      end.setMonth(now.getMonth() - 1);
    } else if (period === 'year') {
      start.setFullYear(now.getFullYear() - 2); start.setHours(0, 0, 0, 0);
      end.setFullYear(now.getFullYear() - 1);
    } else {
      return [];
    }
    return salesHistory.filter(sale => {
      const dateStr = sale.createdAt || sale.created_at;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return false;
      return d >= start && d <= end;
    });
  };

  // Изменение метрики к прошлому периоду, %
  const pctChange = (current: number, previous: number): number | null => {
    if (previous > 0) return ((current - previous) / previous) * 100;
    if (current > 0) return 100;
    return null;
  };

  // Мини-серия для спарклайна: суммы метрики по N корзинам текущего периода
  const getMetricSeries = (metric: 'profit' | 'online' | 'offline' | 'expenses', buckets = 16): number[] => {
    const { start, end } = getPeriodRange(financialTimePeriod);
    const span = Math.max(end.getTime() - start.getTime(), 1);
    const series = new Array(buckets).fill(0);
    const put = (dateStr: string | undefined, value: number) => {
      if (!dateStr || !value) return;
      const t = new Date(dateStr).getTime();
      if (isNaN(t) || t < start.getTime() || t > end.getTime()) return;
      const idx = Math.min(Math.floor(((t - start.getTime()) / span) * buckets), buckets - 1);
      series[idx] += value;
    };
    if (metric === 'profit' || metric === 'online') {
      getFilteredOrders(financialTimePeriod).forEach(o => put(
        o.created_at || o.createdAt,
        metric === 'profit' ? (parseFloat(o.markup_profit) || 0) : (parseFloat(o.total_amount) || 0)
      ));
    }
    if (metric === 'profit' || metric === 'offline') {
      getFilteredSales(financialTimePeriod).forEach(s => put(
        s.createdAt || s.created_at,
        metric === 'profit'
          ? (parseFloat(s.markupProfit) || parseFloat(s.markup_profit) || 0)
          : (parseFloat(s.total_amount || s.totalAmount) || 0)
      ));
    }
    if (metric === 'expenses') {
      // Разовые расходы — по своей дате; ежемесячные — равномерно по периоду.
      let multiplier = 1;
      if (financialTimePeriod === 'day') multiplier = 1 / 30;
      else if (financialTimePeriod === 'week') multiplier = 7 / 30;
      else if (financialTimePeriod === 'month') multiplier = 1;
      else if (financialTimePeriod === 'year') multiplier = 12;
      else if (financialTimePeriod === 'custom' && financialStartDate && financialEndDate) {
        multiplier = (Math.ceil((financialEndDate.getTime() - financialStartDate.getTime()) / 86400000) + 1) / 30;
      }
      operatingExpensesList.forEach((exp) => {
        const type: string = exp.expense_type || 'monthly';
        if (type === 'one_time') {
          put(exp.expense_date || exp.created_at, exp.amount || 0);
        } else if (type === 'monthly') {
          const perBucket = ((exp.monthly_amount || 0) * multiplier) / buckets;
          for (let i = 0; i < buckets; i++) series[i] += perBucket;
        }
      });
    }
    return series;
  };

  // Диапазон дат ПРЕДЫДУЩЕГО периода (для дельт и расходов прошлого периода)
  const getPreviousPeriodRange = (period: PeriodType): { start: Date; end: Date } | null => {
    const now = new Date();
    const start = new Date();
    const end = new Date();
    if (period === 'day') {
      start.setDate(now.getDate() - 1); start.setHours(0, 0, 0, 0);
      end.setDate(now.getDate() - 1);   end.setHours(23, 59, 59, 999);
    } else if (period === 'week') {
      start.setDate(now.getDate() - 14); start.setHours(0, 0, 0, 0);
      end.setDate(now.getDate() - 7);
    } else if (period === 'month') {
      start.setMonth(now.getMonth() - 2); start.setHours(0, 0, 0, 0);
      end.setMonth(now.getMonth() - 1);
    } else if (period === 'year') {
      start.setFullYear(now.getFullYear() - 2); start.setHours(0, 0, 0, 0);
      end.setFullYear(now.getFullYear() - 1);
    } else {
      return null;
    }
    return { start, end };
  };

  // Операционные расходы ПРЕДЫДУЩЕГО периода — чтобы дельта «Общей прибыли»
  // сравнивала сопоставимые величины (наценка − расходы в обоих периодах)
  const getPreviousOperatingExpenses = (period: PeriodType, prevRevenue: number) => {
    const range = getPreviousPeriodRange(period);
    if (!range) return 0;
    let multiplier = 1;
    if (period === 'day') multiplier = 1 / 30;
    else if (period === 'week') multiplier = 7 / 30;
    else if (period === 'month') multiplier = 1;
    else if (period === 'year') multiplier = 12;
    return operatingExpensesList.reduce((total, exp) => {
      const type: string = exp.expense_type || 'monthly';
      if (type === 'monthly') return total + (exp.monthly_amount || 0) * multiplier;
      if (type === 'percentage') return total + prevRevenue * ((exp.percentage_value || 0) / 100);
      if (type === 'one_time') {
        const d = new Date(exp.expense_date || exp.created_at);
        if (!isNaN(d.getTime()) && d >= range.start && d <= range.end) return total + (exp.amount || 0);
      }
      return total;
    }, 0);
  };

  // ═══════════════════════════════════════════════════════════
  // РАСХОДЫ КОМПАНИИ за период (операционные)
  //   monthly    → пропорционально периоду
  //   percentage → % от выручки периода
  //   one_time   → только если дата расхода попадает в период
  // ═══════════════════════════════════════════════════════════
  const getPeriodOperatingExpenses = (period: PeriodType = 'day', periodRevenue: number = 0) => {
    const { start, end } = getPeriodRange(period);

    let multiplier = 1;
    if (period === 'day') multiplier = 1 / 30;
    else if (period === 'week') multiplier = 7 / 30;
    else if (period === 'month') multiplier = 1;
    else if (period === 'year') multiplier = 12;
    else if (period === 'custom' && financialStartDate && financialEndDate) {
      const days = Math.ceil((financialEndDate.getTime() - financialStartDate.getTime()) / 86400000) + 1;
      multiplier = days / 30;
    }

    return operatingExpensesList.reduce((total, exp) => {
      const type: string = exp.expense_type || 'monthly';
      if (type === 'monthly') {
        return total + (exp.monthly_amount || 0) * multiplier;
      } else if (type === 'percentage') {
        return total + periodRevenue * ((exp.percentage_value || 0) / 100);
      } else if (type === 'one_time') {
        const d = new Date(exp.expense_date || exp.created_at);
        if (!isNaN(d.getTime()) && d >= start && d <= end) {
          return total + (exp.amount || 0);
        }
      }
      return total;
    }, 0);
  };

  // Детализация операционных расходов по типам (для мини-панели «Затраты компании»)
  //   monthly    → основной список (показывается всегда)
  //   percentage → скрыт за кнопкой «Показать ещё»
  //   one_time   → скрыт за кнопкой «Показать ещё» (только попавшие в период)
  const getOperatingExpensesDetailed = (period: PeriodType = 'day', periodRevenue: number = 0) => {
    const { start, end } = getPeriodRange(period);
    let multiplier = 1;
    if (period === 'day') multiplier = 1 / 30;
    else if (period === 'week') multiplier = 7 / 30;
    else if (period === 'month') multiplier = 1;
    else if (period === 'year') multiplier = 12;
    else if (period === 'custom' && financialStartDate && financialEndDate) {
      const days = Math.ceil((financialEndDate.getTime() - financialStartDate.getTime()) / 86400000) + 1;
      multiplier = days / 30;
    }

    const monthly: Array<{ name: string; amount: number }> = [];
    const percentage: Array<{ name: string; amount: number; rate: number }> = [];
    const oneTime: Array<{ name: string; amount: number; date?: string }> = [];

    operatingExpensesList.forEach((exp) => {
      const type: string = exp.expense_type || 'monthly';
      const name = exp.expense_name || exp.description || (language === 'uz' ? 'Xarajat' : 'Расход');
      if (type === 'monthly') {
        const amount = (exp.monthly_amount || 0) * multiplier;
        if (amount > 0) monthly.push({ name, amount });
      } else if (type === 'percentage') {
        const amount = periodRevenue * ((exp.percentage_value || 0) / 100);
        percentage.push({ name, amount, rate: exp.percentage_value || 0 });
      } else if (type === 'one_time') {
        const d = new Date(exp.expense_date || exp.created_at);
        if (!isNaN(d.getTime()) && d >= start && d <= end) {
          oneTime.push({ name, amount: exp.amount || 0, date: exp.expense_date || exp.created_at });
        }
      }
    });
    return { monthly, percentage, oneTime };
  };

  // 🆕 НОВОЕ: Получить РЕАЛЬНЫЕ данные для линейной диаграммы (БЕЗ случайности)
  const getRealLineChartData = () => {
    const currentOrders = getFilteredOrders(financialTimePeriod);
    const previousOrders = getPreviousPeriodOrders(financialTimePeriod);
    
    // Функция группировки заказов по временным интервалам
    const groupOrdersByTime = (orders: any[], intervalType: string, intervalsCount: number) => {
      const grouped: number[] = new Array(intervalsCount).fill(0);
      
      orders.forEach(order => {
        const dateStr = order.confirmed_date || order.order_date || order.created_at || order.createdAt;
        if (!dateStr) return;
        
        const orderDate = new Date(dateStr);
        if (isNaN(orderDate.getTime())) return;
        
        const amount = parseFloat(order.total_amount) || 0;
        
        if (intervalType === 'hour') {
          const hour = orderDate.getHours();
          grouped[hour] += amount;
        } else if (intervalType === 'halfDay') {
          // Week view: 7 days × 2 half-days = 14 points
          const dayOfWeek = orderDate.getDay() === 0 ? 6 : orderDate.getDay() - 1; // Mon=0
          const half = orderDate.getHours() < 12 ? 0 : 1;
          const idx = dayOfWeek * 2 + half;
          if (idx >= 0 && idx < intervalsCount) grouped[idx] += amount;
        } else if (intervalType === 'day') {
          const day = orderDate.getDay(); // 0-6 (Воскресенье-Суббота)
          const dayIndex = day === 0 ? 6 : day - 1; // Конвертируем в Пн=0, Вс=6
          if (dayIndex >= 0 && dayIndex < intervalsCount) {
            grouped[dayIndex] += amount;
          }
        } else if (intervalType === 'dayOfMonth') {
          const dayIdx = orderDate.getDate() - 1; // 0-30
          if (dayIdx >= 0 && dayIdx < intervalsCount) grouped[dayIdx] += amount;
        } else if (intervalType === 'weekOfYear') {
          const startOfYear = new Date(orderDate.getFullYear(), 0, 1);
          const weekIdx = Math.floor((orderDate.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000));
          if (weekIdx >= 0 && weekIdx < intervalsCount) grouped[weekIdx] += amount;
        } else if (intervalType === 'week') {
          // Для недель - определяем номер недели в месяце
          const dayOfMonth = orderDate.getDate();
          const weekIndex = Math.min(Math.floor((dayOfMonth - 1) / 7), intervalsCount - 1);
          grouped[weekIndex] += amount;
        } else if (intervalType === 'month') {
          const month = orderDate.getMonth(); // 0-11
          if (month >= 0 && month < intervalsCount) {
            grouped[month] += amount;
          }
        } else if (intervalType === 'dayNumber') {
          // Для пользовательского периода - по дням
          if (financialStartDate) {
            const startDate = new Date(financialStartDate);
            const daysDiff = Math.floor((orderDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            if (daysDiff >= 0 && daysDiff < intervalsCount) {
              grouped[daysDiff] += amount;
            }
          }
        } else if (intervalType === 'weekNumber') {
          // Для пользовательского периода - по неделям
          if (financialStartDate) {
            const startDate = new Date(financialStartDate);
            const daysDiff = Math.floor((orderDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            const weekIndex = Math.min(Math.floor(daysDiff / 7), intervalsCount - 1);
            if (weekIndex >= 0) {
              grouped[weekIndex] += amount;
            }
          }
        } else if (intervalType === 'monthNumber') {
          // Для пользовательского периода - по месяцам
          if (financialStartDate) {
            const startDate = new Date(financialStartDate);
            const daysDiff = Math.floor((orderDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            const monthIndex = Math.min(Math.floor(daysDiff / 30), intervalsCount - 1);
            if (monthIndex >= 0) {
              grouped[monthIndex] += amount;
            }
          }
        }
      });
      
      return grouped;
    };
    
    let dataPoints: any[] = [];
    
    if (financialTimePeriod === 'day') {
      const currentData = groupOrdersByTime(currentOrders, 'hour', 24);
      const previousData = groupOrdersByTime(previousOrders, 'hour', 24);
      for (let hour = 0; hour < 24; hour++) {
        dataPoints.push({ period: `${hour}:00`, current: currentData[hour], previous: previousData[hour] });
      }
    } else if (financialTimePeriod === 'week') {
      // 📅 НЕДЕЛЯ = 14 ТОЧЕК (КАЖДЫЕ 12 ЧАСОВ)
      const currentData = groupOrdersByTime(currentOrders, 'halfDay', 14);
      const previousData = groupOrdersByTime(previousOrders, 'halfDay', 14);
      const days = t.daysOfWeek as string[];

      for (let i = 0; i < 14; i++) {
        const dayIdx = Math.floor(i / 2);
        const half = i % 2;
        dataPoints.push({
          period: `${days[dayIdx]} ${half === 0 ? '00' : '12'}`,
          current: currentData[i],
          previous: previousData[i],
        });
      }
    } else if (financialTimePeriod === 'month') {
      // 📆 МЕСЯЦ = КАЖДЫЙ ДЕНЬ
      const now = new Date();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const currentData = groupOrdersByTime(currentOrders, 'dayOfMonth', daysInMonth);
      const previousData = groupOrdersByTime(previousOrders, 'dayOfMonth', daysInMonth);

      for (let day = 1; day <= daysInMonth; day++) {
        dataPoints.push({
          period: `${day}`,
          current: currentData[day - 1],
          previous: previousData[day - 1],
        });
      }
    } else if (financialTimePeriod === 'year') {
      // 📅 ГОД = КАЖДАЯ НЕДЕЛЯ (52 ТОЧКИ)
      const currentData = groupOrdersByTime(currentOrders, 'weekOfYear', 52);
      const previousData = groupOrdersByTime(previousOrders, 'weekOfYear', 52);

      for (let week = 1; week <= 52; week++) {
        dataPoints.push({
          period: `W${week}`,
          current: currentData[week - 1],
          previous: previousData[week - 1],
        });
      }
    } else if (financialTimePeriod === 'custom') {
      // 🎯 СВОЙ ПЕРИОД (РЕАЛЬНЫЕ ДАННЫЕ)
      if (financialStartDate && financialEndDate) {
        const start = new Date(financialStartDate);
        const end = new Date(financialEndDate);
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        
        if (days <= 1) {
          // 1 день = 24 часа
          const currentData = groupOrdersByTime(currentOrders, 'hour', 24);
          const previousData = groupOrdersByTime(previousOrders, 'hour', 24);
          
          for (let hour = 0; hour < 24; hour++) {
            dataPoints.push({
              period: `${hour}:00`,
              current: currentData[hour],
              previous: previousData[hour],
            });
          }
        } else if (days <= 7) {
          // До 7 дней = по дням
          const currentData = groupOrdersByTime(currentOrders, 'dayNumber', days);
          const previousData = groupOrdersByTime(previousOrders, 'dayNumber', days);
          
          for (let day = 1; day <= days; day++) {
            dataPoints.push({
              period: `${t.dayLabel} ${day}`,
              current: currentData[day - 1],
              previous: previousData[day - 1],
            });
          }
        } else if (days <= 31) {
          // До 31 дня = по неделям
          const weeks = Math.ceil(days / 7);
          const currentData = groupOrdersByTime(currentOrders, 'weekNumber', weeks);
          const previousData = groupOrdersByTime(previousOrders, 'weekNumber', weeks);
          
          for (let week = 1; week <= weeks; week++) {
            dataPoints.push({
              period: `${t.weekLabel} ${week}`,
              current: currentData[week - 1],
              previous: previousData[week - 1],
            });
          }
        } else {
          // Больше 31 дня = по месяцам
          const months = Math.ceil(days / 30);
          const currentData = groupOrdersByTime(currentOrders, 'monthNumber', months);
          const previousData = groupOrdersByTime(previousOrders, 'monthNumber', months);
          
          for (let month = 1; month <= months; month++) {
            dataPoints.push({
              period: `${t.monthLabel} ${month}`,
              current: currentData[month - 1],
              previous: previousData[month - 1],
            });
          }
        }
      }
    }
    
    console.log('📊 [Real Line Chart Data]:');
    console.log('   📅 Период:', financialTimePeriod);
    console.log('   📈 Точек данных:', dataPoints.length);
    console.log('   ✅ РЕАЛЬНЫЕ ДАННЫЕ (без случайности)');
    
    return dataPoints;
  };

  const getOrderCountData = () => {
    const currentOrders = getFilteredOrders(financialTimePeriod);
    const previousOrders = getPreviousPeriodOrders(financialTimePeriod);

    const countByTime = (orders: any[], type: string, n: number) => {
      const arr = new Array(n).fill(0);
      orders.forEach(o => {
        const ds = o.confirmed_date || o.order_date || o.created_at || o.createdAt;
        if (!ds) return;
        const d = new Date(ds);
        if (isNaN(d.getTime())) return;
        if (type === 'hour') arr[d.getHours()]++;
        else if (type === 'halfDay') {
          const dayIdx = d.getDay() === 0 ? 6 : d.getDay() - 1;
          const half = d.getHours() < 12 ? 0 : 1;
          const idx = dayIdx * 2 + half;
          if (idx < n) arr[idx]++;
        }
        else if (type === 'day') { const i = d.getDay() === 0 ? 6 : d.getDay() - 1; if (i < n) arr[i]++; }
        else if (type === 'dayOfMonth') { const i = d.getDate() - 1; if (i >= 0 && i < n) arr[i]++; }
        else if (type === 'weekOfYear') {
          const soy = new Date(d.getFullYear(), 0, 1);
          const wk = Math.floor((d.getTime() - soy.getTime()) / (7 * 24 * 60 * 60 * 1000));
          if (wk >= 0 && wk < n) arr[wk]++;
        }
        else if (type === 'week') arr[Math.min(Math.floor((d.getDate() - 1) / 7), n - 1)]++;
        else if (type === 'month') { if (d.getMonth() < n) arr[d.getMonth()]++; }
      });
      return arr;
    };

    if (financialTimePeriod === 'day') {
      const cur = countByTime(currentOrders, 'hour', 24);
      const prev = countByTime(previousOrders, 'hour', 24);
      return Array.from({ length: 24 }, (_, i) => ({ period: `${i}:00`, current: cur[i], previous: prev[i] }));
    } else if (financialTimePeriod === 'week') {
      const cur = countByTime(currentOrders, 'halfDay', 14);
      const prev = countByTime(previousOrders, 'halfDay', 14);
      const days = t.daysOfWeek as string[];
      return Array.from({ length: 14 }, (_, i) => ({
        period: `${days[Math.floor(i / 2)]} ${i % 2 === 0 ? '00' : '12'}`,
        current: cur[i], previous: prev[i],
      }));
    } else if (financialTimePeriod === 'month') {
      const now = new Date();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const cur = countByTime(currentOrders, 'dayOfMonth', daysInMonth);
      const prev = countByTime(previousOrders, 'dayOfMonth', daysInMonth);
      return Array.from({ length: daysInMonth }, (_, i) => ({ period: `${i + 1}`, current: cur[i], previous: prev[i] }));
    } else if (financialTimePeriod === 'year') {
      const cur = countByTime(currentOrders, 'weekOfYear', 52);
      const prev = countByTime(previousOrders, 'weekOfYear', 52);
      return Array.from({ length: 52 }, (_, i) => ({ period: `W${i + 1}`, current: cur[i], previous: prev[i] }));
    }
    return [];
  };

  const getCombinedChartData = () => {
    const rev = getRealLineChartData();
    const ord = getOrderCountData();
    const len = Math.max(rev.length, ord.length);
    return Array.from({ length: len }, (_, i) => ({
      period: rev[i]?.period ?? ord[i]?.period ?? '',
      revCurrent: rev[i]?.current ?? 0,
      revPrevious: rev[i]?.previous ?? 0,
      ordCurrent: ord[i]?.current ?? 0,
      ordPrevious: ord[i]?.previous ?? 0,
    }));
  };

  // 📌 «+ Добавить расход» открывает форму добавления в ExpensesManager
  // напрямую (счётчик-сигнал пробрасывается пропом openAddFormSignal)
  const expensesRef = useRef<HTMLDivElement>(null);
  const [addExpenseSignal, setAddExpenseSignal] = useState(0);
  const openAddExpenseForm = () => setAddExpenseSignal(n => n + 1);

  // ⚡ Быстрая статистика за период: заказы приложения (с клиентами и статусами)
  const getPeriodCustomerOrders = () => {
    const { start, end } = getPeriodRange(financialTimePeriod);
    return customerOrders.filter(o => {
      const dateStr = o.createdAt || o.created_at || o.order_date;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return false;
      return d >= start && d <= end;
    });
  };

  // 🏆 Ключевые показатели «Расширенной аналитики» (за всё время)
  const advancedHighlights = useMemo(() => {
    const qtyByProduct = new Map<string, { name: string; qty: number; profit: number }>();
    const dayCounts = new Array(7).fill(0);
    let ordersTotal = 0;
    let ordersCount = 0;

    const addItems = (items: any[]) => {
      items.forEach((item: any) => {
        const name = String(item.productName || item.product_name || item.name || '').trim();
        if (!name) return;
        const qty = Number(item.quantity) || 1;
        const base = Number(item.price) || 0;
        const selling = Number(item.price_with_markup || item.priceWithMarkup) || base;
        const markup = Number(item.markupAmount || item.markup_amount) || Math.max(selling - base, 0);
        const key = name.toLowerCase();
        const entry = qtyByProduct.get(key) || { name, qty: 0, profit: 0 };
        entry.qty += qty;
        entry.profit += markup * qty;
        qtyByProduct.set(key, entry);
      });
    };

    const addRecord = (dateStr: string | undefined, amount: number, rawItems: any) => {
      let items: any[] = [];
      try { items = typeof rawItems === 'string' ? JSON.parse(rawItems) : (rawItems || []); } catch { items = []; }
      if (Array.isArray(items)) addItems(items);
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) dayCounts[d.getDay() === 0 ? 6 : d.getDay() - 1]++;
      }
      ordersTotal += amount;
      ordersCount++;
    };

    ordersWithItems.forEach(o => addRecord(
      o.created_at || o.createdAt,
      parseFloat(o.total_amount) || 0,
      o.items
    ));
    salesHistory.forEach(s => addRecord(
      s.createdAt || s.created_at,
      parseFloat(s.total_amount || s.totalAmount) || 0,
      s.items
    ));

    const products = Array.from(qtyByProduct.values());
    const bestSeller = products.reduce((a, b) => (b.qty > (a?.qty || 0) ? b : a), null as null | { name: string; qty: number; profit: number });
    const topProfit = products.reduce((a, b) => (b.profit > (a?.profit || 0) ? b : a), null as null | { name: string; qty: number; profit: number });
    const bestDayIdx = dayCounts.some(c => c > 0) ? dayCounts.indexOf(Math.max(...dayCounts)) : -1;

    return {
      bestSeller,
      topProfit,
      bestDayIdx,
      avgOrder: ordersCount > 0 ? ordersTotal / ordersCount : 0,
    };
  }, [ordersWithItems, salesHistory]);

  if (loading) {
    return <div className="text-center py-12">{t.loadingAnalytics}</div>;
  }

  return (
    <div>
      {/* 📑 Вкладки: Финансы и аналитика | Закупки */}
      <div style={{ background: 'var(--ax-card)', border: '1px solid var(--ax-border)', borderRadius: 14, marginBottom: 20, padding: 6, display: 'flex', gap: 6 }}>
        <button
          onClick={() => setActiveTab('analytics')}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '10px 20px',
            borderRadius: 10, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
            fontSize: 14, fontWeight: 600,
            ...(activeTab === 'analytics'
              ? { background: 'var(--ax-primary)', color: '#FFFFFF' }
              : { background: 'transparent', color: 'var(--ax-text-2)' })
          }}
        >
          <TrendingUp className="w-4 h-4" />
          <span>{t.financesAndAnalytics}</span>
        </button>

        <button
          onClick={() => setActiveTab('purchases')}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '10px 20px',
            borderRadius: 10, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
            fontSize: 14, fontWeight: 600,
            ...(activeTab === 'purchases'
              ? { background: 'var(--ax-primary)', color: '#FFFFFF' }
              : { background: 'transparent', color: 'var(--ax-text-2)' })
          }}
        >
          <Package className="w-4 h-4" />
          <span>{t.purchasesExpense}</span>
        </button>

        {/* 💸 Вывод онлайн-заработка на карту */}
        <button
          onClick={() => setActiveTab('payouts')}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '10px 20px',
            borderRadius: 10, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
            fontSize: 14, fontWeight: 600,
            ...(activeTab === 'payouts'
              ? { background: 'var(--ax-primary)', color: '#FFFFFF' }
              : { background: 'transparent', color: 'var(--ax-text-2)' })
          }}
        >
          <Landmark className="w-4 h-4" />
          <span>{language === 'uz' ? 'Pul yechish' : 'Вывод средств'}</span>
        </button>
      </div>

      {/* 📦 ВКЛАДКА: Аналитика закупок */}
      {activeTab === 'purchases' && (
        <PurchaseAnalytics companyId={companyId} />
      )}

      {/* 💸 ВКЛАДКА: Вывод средств */}
      {activeTab === 'payouts' && (
        <CompanyPayoutsPanel companyId={companyId} />
      )}

      {/* 📊 ВКЛАДКА: Аналитика */}
      {activeTab === 'analytics' && (
        <>
          {/* ========== ШАПКА СТРАНИЦЫ: ЗАГОЛОВОК + СЕЛЕКТОР ПЕРИОДА ========== */}
          <div className="flex flex-wrap items-center justify-between gap-3 max-w-7xl mx-auto mb-5">
            <div>
              <h2 style={{ color: 'var(--ax-text)', fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>
                {language === 'uz' ? 'Analitika' : 'Аналитика'}
              </h2>
              <p style={{ color: 'var(--ax-text-2)', fontSize: 13, margin: '4px 0 0' }}>
                {language === 'uz' ? 'Moliyaviy koʻrsatkichlar va savdo dinamikasi' : 'Финансовые показатели и динамика продаж'}
              </p>
            </div>
            <CompactPeriodSelector
              value={financialTimePeriod}
              onChange={setFinancialTimePeriod}
            />
          </div>

          {/* 🎯 Выбор произвольного периода (от одного дня до нескольких лет) */}
          {financialTimePeriod === 'custom' && (
            <div className="max-w-7xl mx-auto mb-4" style={{ background: 'var(--ax-card)', border: '1px solid var(--ax-border)', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, color: 'var(--ax-text-2)', fontWeight: 600 }}>
                    {language === 'uz' ? 'Boshlanish sanasi' : 'Дата начала'}
                  </label>
                  <input
                    type="date"
                    value={financialStartDate ? financialStartDate.toISOString().slice(0, 10) : ''}
                    max={financialEndDate ? financialEndDate.toISOString().slice(0, 10) : undefined}
                    onChange={(e) => setFinancialStartDate(e.target.value ? new Date(e.target.value) : null)}
                    style={{ background: 'var(--ax-input)', border: '1px solid var(--ax-border)', borderRadius: 8, padding: '8px 10px', color: 'var(--ax-text)', fontSize: 14, colorScheme: 'dark' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, color: 'var(--ax-text-2)', fontWeight: 600 }}>
                    {language === 'uz' ? 'Tugash sanasi' : 'Дата конца'}
                  </label>
                  <input
                    type="date"
                    value={financialEndDate ? financialEndDate.toISOString().slice(0, 10) : ''}
                    min={financialStartDate ? financialStartDate.toISOString().slice(0, 10) : undefined}
                    onChange={(e) => setFinancialEndDate(e.target.value ? new Date(e.target.value) : null)}
                    style={{ background: 'var(--ax-input)', border: '1px solid var(--ax-border)', borderRadius: 8, padding: '8px 10px', color: 'var(--ax-text)', fontSize: 14, colorScheme: 'dark' }}
                  />
                </div>
                {(financialStartDate || financialEndDate) && (
                  <button
                    onClick={() => { setFinancialStartDate(null); setFinancialEndDate(null); }}
                    style={{ background: 'var(--ax-input)', border: '1px solid var(--ax-border)', borderRadius: 8, padding: '8px 14px', color: 'var(--ax-text-2)', fontSize: 13, cursor: 'pointer' }}
                  >
                    {language === 'uz' ? 'Tozalash' : 'Сбросить'}
                  </button>
                )}
              </div>
              {!(financialStartDate && financialEndDate) && (
                <p style={{ fontSize: 12, color: 'var(--ax-text-2)', marginTop: 10 }}>
                  {language === 'uz'
                    ? 'Bir kundan bir necha yilgacha — boshlanish va tugash sanasini tanlang.'
                    : 'Выберите дату начала и конца — можно один день или несколько лет.'}
                </p>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
               KPI-ПЛИТКИ: БАЛАНС / ПРИБЫЛЬ / ЗАТРАТЫ + КАНАЛЫ ПРОДАЖ
          ═══════════════════════════════════════════════════════ */}
          {(() => {
            const profit        = getPeriodProfit(financialTimePeriod);
            const revenue       = getPeriodRevenue(financialTimePeriod);
            const opEx          = getPeriodOperatingExpenses(financialTimePeriod, revenue);
            const detailed      = getOperatingExpensesDetailed(financialTimePeriod, revenue);
            // 🏬 Стоимость склада — только для наблюдения, В БАЛАНС НЕ ВХОДИТ
            const warehouseCost = inventoryCost;
            // 💸 Расходы компании (операционные) — влияют на баланс
            const companyExpenses = opEx;
            // Итоговый баланс = наценка (онлайн + офлайн) − расходы компании. Склад НЕ вычитается.
            const balance       = profit - companyExpenses;
            const isPositive    = balance >= 0;
            // Онлайн/офлайн продажи — только для наблюдения, не влияют на баланс
            const onlineSales   = getOnlineSales(financialTimePeriod);
            const offlineSales  = getOfflineSales(financialTimePeriod);
            const onlineCount   = getFilteredOrders(financialTimePeriod).length;
            const offlineCount  = getFilteredSales(financialTimePeriod).length;
            const onlineCommission = Math.round(onlineSales * (commissionPercent / 100));
            const balanceColor  = isPositive ? 'var(--ax-primary)' : 'var(--ax-danger)';

            // Дельты к предыдущему периоду + серии для спарклайнов
            const prevOrders  = getPreviousPeriodOrders(financialTimePeriod);
            const prevSales   = getPreviousPeriodSales(financialTimePeriod);
            const prevProfit  = prevOrders.reduce((s, o) => s + (parseFloat(o.markup_profit) || 0), 0)
                              + prevSales.reduce((s, x) => s + (parseFloat(x.markupProfit) || parseFloat(x.markup_profit) || 0), 0);
            const prevOnline  = prevOrders.reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0);
            const prevOffline = prevSales.reduce((s, x) => s + (parseFloat(x.total_amount || x.totalAmount) || 0), 0);
            // «Общая прибыль» = наценка − расходы компании; дельту считаем к
            // такому же «чистому» показателю прошлого периода
            const prevOpEx     = getPreviousOperatingExpenses(financialTimePeriod, prevOnline + prevOffline);
            const prevBalance  = prevProfit - prevOpEx;
            const profitDelta  = pctChange(balance, prevBalance);
            const onlineDelta  = pctChange(onlineSales, prevOnline);
            const offlineDelta = pctChange(offlineSales, prevOffline);
            // Дельта расходов к прошлому периоду — как у остальных карточек
            const expensesDelta = pctChange(companyExpenses, prevOpEx);
            const profitSeries  = getMetricSeries('profit');
            const onlineSeries  = getMetricSeries('online');
            const offlineSeries = getMetricSeries('offline');
            const expensesSeries = getMetricSeries('expenses');

            // Быстрая статистика за период
            const periodCustomerOrders = getPeriodCustomerOrders();
            const uniqueClients = new Set(
              periodCustomerOrders
                .map(o => o.customerPhone || o.customer_phone || o.user_phone || o.customerName || o.customer_name)
                .filter(Boolean)
            ).size;
            const cancelledCount = periodCustomerOrders.filter(o =>
              ['cancelled', 'canceled', 'rejected'].includes(String(o.status || '').toLowerCase())
            ).length;
            const expensePercent = revenue > 0 ? Math.min(100, Math.round((companyExpenses / revenue) * 100)) : 0;
            const unit = language === 'uz' ? 'ta' : 'шт';
            const dayNames = language === 'uz' ? DAY_NAMES_UZ : DAY_NAMES_RU;

            return (
              <>
              <div className="max-w-7xl mx-auto mb-6" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* ── СТАТ-КАРТЫ: ПРИБЫЛЬ / РАСХОДЫ / ОНЛАЙН / ОФЛАЙН ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(225px, 1fr))', gap: 14 }}>
                  {/* Общая прибыль = наценка (онлайн + офлайн) − расходы компании.
                      Добавленный расход сразу уменьшает эту цифру; формула
                      расшифрована в подписи под значением. */}
                  <MetricCard
                    index={0}
                    label={language === 'uz' ? 'Jami foyda' : 'Общая прибыль'}
                    value={`${isPositive ? '+' : '−'}${formatPrice(Math.abs(balance))}`}
                    accent={isPositive ? '#22C55E' : '#F87171'}
                    delta={profitDelta}
                    series={profitSeries}
                    sub={language === 'uz'
                      ? `Ustama ${formatPrice(profit)} − xarajat ${formatPrice(companyExpenses)}`
                      : `Наценка ${formatPrice(profit)} − расходы ${formatPrice(companyExpenses)}`}
                  />
                  <MetricCard
                    index={1}
                    label={language === 'uz' ? 'Jami xarajat' : 'Расходы'}
                    value={`−${formatPrice(companyExpenses)}`}
                    accent="#F87171"
                    delta={expensesDelta}
                    deltaGoodWhenDown
                    series={expensesSeries}
                    sub={language === 'uz'
                      ? 'Oldingi davrga nisbatan'
                      : 'К прошлому периоду'}
                    footer={
                      <button
                        onClick={() => { setShowExpensesModal(true); setShowExtraExpenses(false); }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 8, color: '#F87171', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', padding: '5px 10px' }}
                      >
                        <Receipt style={{ width: 13, height: 13 }} />
                        {language === 'uz' ? 'Batafsil' : 'Подробно'}
                      </button>
                    }
                  />
                  <MetricCard
                    index={2}
                    label={language === 'uz' ? 'Onlayn savdo' : 'Онлайн продажи'}
                    value={formatPrice(onlineSales)}
                    accent="#38BDF8"
                    delta={onlineDelta}
                    series={onlineSeries}
                    sub={language === 'uz'
                      ? `${onlineCount} buyurtma · komissiya ${formatPrice(onlineCommission)}`
                      : `${onlineCount} заказов · комиссия ${formatPrice(onlineCommission)}`}
                  />
                  <MetricCard
                    index={3}
                    label={language === 'uz' ? 'Offline savdo (kassa)' : 'Офлайн продажи (касса)'}
                    value={formatPrice(offlineSales)}
                    accent="#FBBF24"
                    delta={offlineDelta}
                    series={offlineSeries}
                    sub={language === 'uz' ? `${offlineCount} kassa sotuvi` : `${offlineCount} продаж через кассу`}
                  />
                </div>

                {/* ── ГРАФИК ВЫРУЧКИ + ПРАВАЯ КОЛОНКА ── */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'stretch' }}>

                  {/* График «Динамика выручки» */}
                  <motion.div
                    key={`chart-${financialTimePeriod}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 26 }}
                    style={{ flex: '2 1 460px', minWidth: 0, background: 'var(--ax-card)', border: '1px solid var(--ax-border)', borderRadius: 16, padding: '20px 22px' }}
                  >
                    <div style={{ marginBottom: 14, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <h3 style={{ color: 'var(--ax-text)', fontSize: 16, fontWeight: 700, margin: 0 }}>
                        {language === 'uz' ? 'Daromad statistikasi' : 'Статистика выручки'}
                      </h3>
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ax-text-2)', fontSize: 12.5 }}>
                          <span style={{ width: 22, height: 3, background: '#7C5CF0', display: 'inline-block', borderRadius: 2 }} />
                          {language === 'uz' ? 'Joriy davr' : 'Текущий период'}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ax-text-2)', fontSize: 12.5 }}>
                          <span style={{ width: 22, height: 0, display: 'inline-block', borderTop: '3px dashed #0284C7', borderRadius: 2 }} />
                          {language === 'uz' ? 'Oldingi davr' : 'Предыдущий период'}
                        </span>
                      </div>
                    </div>

                    {/* Единый стиль линейных диаграмм: monotone-кривая, тихая
                        сетка, crosshair и общий тултип — см. AxAreaChart */}
                    <AxAreaChart
                      data={getCombinedChartData()}
                      xKey="period"
                      height={290}
                      series={[
                        { key: 'revCurrent', name: language === 'uz' ? 'Joriy davr' : 'Текущий период', color: '#7C5CF0', fill: true },
                        { key: 'revPrevious', name: language === 'uz' ? 'Oldingi davr' : 'Предыдущий период', color: '#0284C7', dashed: true },
                      ]}
                      valueFormatter={formatPrice}
                      yTickFormatter={formatShortPrice}
                    />
                  </motion.div>

                  {/* Правая колонка: расходы компании + быстрая статистика */}
                  <div style={{ flex: '1 1 290px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

                    {/* Карточка «Расходы компании» с донатом */}
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 280, damping: 26, delay: 0.05 }}
                      style={{ background: 'var(--ax-card)', border: '1px solid var(--ax-border)', borderRadius: 16, padding: 18 }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <h3 style={{ color: 'var(--ax-text)', fontSize: 15, fontWeight: 700, margin: 0 }}>
                            {language === 'uz' ? 'Kompaniya xarajatlari' : 'Расходы компании'}
                          </h3>
                          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--ax-text-2)' }}>
                            {language === 'uz' ? 'Davr jami:' : 'За период:'}{' '}
                            <span style={{ color: 'var(--ax-danger)', fontWeight: 700 }}>−{formatPrice(companyExpenses)}</span>
                          </div>
                          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--ax-text-3)', wordBreak: 'break-word' }}>
                            {formatPrice(companyExpenses)} / {formatPrice(revenue)}
                          </div>
                          <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--ax-text-2)' }}>
                            {language === 'uz' ? 'Sof qoldiq:' : 'Чистый остаток:'}{' '}
                            <span style={{ color: balanceColor, fontWeight: 700 }}>{isPositive ? '+' : ''}{formatPrice(balance)}</span>
                          </div>
                        </div>
                        <Donut percent={expensePercent} />
                      </div>
                      <button
                        onClick={openAddExpenseForm}
                        style={{ marginTop: 14, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px 0', borderRadius: 11, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #7C5CF0, #5B3DD4)', color: '#FFFFFF', fontSize: 13.5, fontWeight: 700, boxShadow: '0 6px 16px rgba(124,92,240,0.35)' }}
                      >
                        <Plus style={{ width: 15, height: 15 }} />
                        {language === 'uz' ? 'Xarajat qoʻshish' : 'Добавить расход'}
                      </button>
                    </motion.div>

                    {/* Карточка «Быстрая статистика» */}
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 280, damping: 26, delay: 0.1 }}
                      style={{ flex: 1, background: 'var(--ax-card)', border: '1px solid var(--ax-border)', borderRadius: 16, padding: 18 }}
                    >
                      <h3 style={{ color: 'var(--ax-text)', fontSize: 15, fontWeight: 700, margin: '0 0 14px' }}>
                        {language === 'uz' ? 'Tezkor statistika' : 'Быстрая статистика'}
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <QuickStatRow
                          icon={<ShoppingBag style={{ width: 15, height: 15 }} />}
                          accent="#7C5CF0"
                          label={language === 'uz' ? 'Jami buyurtmalar' : 'Всего продаж'}
                          value={`${onlineCount + offlineCount} ${language === 'uz' ? 'dona' : 'шт'}`}
                        />
                        <QuickStatRow
                          icon={<Users style={{ width: 15, height: 15 }} />}
                          accent="#22C55E"
                          label={language === 'uz' ? 'Yangi mijozlar' : 'Новые клиенты'}
                          value={`${uniqueClients} ${unit}`}
                        />
                        <QuickStatRow
                          icon={<XCircle style={{ width: 15, height: 15 }} />}
                          accent="#F87171"
                          label={language === 'uz' ? 'Bekor qilingan buyurtmalar' : 'Отменённые заказы'}
                          value={`${cancelledCount} ${unit}`}
                        />
                      </div>
                    </motion.div>
                  </div>
                </div>

                {/* ── KENGAYTIRILGAN ANALITIKA ── */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 26, delay: 0.12 }}
                  style={{ background: 'var(--ax-card)', border: '1px solid var(--ax-border)', borderRadius: 16, padding: '18px 20px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Zap style={{ width: 16, height: 16, color: 'var(--ax-primary)' }} />
                    <h3 style={{ color: 'var(--ax-text)', fontSize: 15, fontWeight: 700, margin: 0 }}>
                      {language === 'uz' ? 'Kengaytirilgan analitika' : 'Расширенная аналитика'}
                    </h3>
                  </div>
                  <p style={{ color: 'var(--ax-text-3)', fontSize: 12.5, margin: '0 0 14px' }}>
                    {language === 'uz' ? 'Tizimdagi asosiy koʻrsatkichlar' : 'Ключевые показатели системы'}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))', gap: 12 }}>
                    <HighlightCard
                      icon={<Crown style={{ width: 15, height: 15 }} />}
                      accent="#7C5CF0"
                      label={language === 'uz' ? 'Eng koʻp sotilgan mahsulot' : 'Самый продаваемый товар'}
                      value={advancedHighlights.bestSeller?.name || '—'}
                      valueColor="#A78BFA"
                    />
                    <HighlightCard
                      icon={<CalendarDays style={{ width: 15, height: 15 }} />}
                      accent="#22C55E"
                      label={language === 'uz' ? 'Eng koʻp savdo kuni' : 'Самый активный день'}
                      value={advancedHighlights.bestDayIdx >= 0 ? dayNames[advancedHighlights.bestDayIdx] : '—'}
                    />
                    <HighlightCard
                      icon={<Coins style={{ width: 15, height: 15 }} />}
                      accent="#38BDF8"
                      label={language === 'uz' ? 'Oʻrtacha buyurtma qiymati' : 'Средний чек'}
                      value={advancedHighlights.avgOrder > 0 ? formatPrice(Math.round(advancedHighlights.avgOrder)) : '—'}
                    />
                    <HighlightCard
                      icon={<Gem style={{ width: 15, height: 15 }} />}
                      accent="#FBBF24"
                      label={language === 'uz' ? 'Eng koʻp foyda keltirgan tovar' : 'Самый прибыльный товар'}
                      value={advancedHighlights.topProfit ? formatPrice(Math.round(advancedHighlights.topProfit.profit)) : '—'}
                      sub={advancedHighlights.topProfit?.name}
                    />
                  </div>
                </motion.div>

                {/* 🧮 Калькулятор торговца: дал / купил / продал с наценкой —
                    цепочка расчётов с памятью и живым остатком */}
                <MerchantCalculator companyId={companyId} language={language} />
              </div>

              {/* 🔻 МИНИ-ПАНЕЛЬ: детализация «Затраты компании» */}
              {showExpensesModal && (
                <div
                  onClick={() => setShowExpensesModal(false)}
                  style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{ background: 'var(--ax-card)', border: '1px solid var(--ax-border)', borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.45)' }}
                  >
                    {/* Заголовок */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '18px 20px', borderBottom: '1px solid var(--ax-border)', flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 10, background: 'rgba(248,113,113,0.12)' }}>
                          <Package className="w-4 h-4" style={{ color: 'var(--ax-danger)' }} />
                        </span>
                        <div>
                          <div style={{ color: 'var(--ax-text)', fontWeight: 800, fontSize: 16 }}>
                            {language === 'uz' ? 'Xarajatlar' : 'Расходы'}
                          </div>
                          <div style={{ color: 'var(--ax-text-3)', fontSize: 12 }}>
                            {language === 'uz' ? 'Tanlangan davr uchun' : 'За выбранный период'}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowExpensesModal(false)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: 'var(--ax-input)', border: '1px solid var(--ax-border)', color: 'var(--ax-text-2)', cursor: 'pointer', flexShrink: 0 }}
                        aria-label="close"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Прокручиваемое содержимое */}
                    <div style={{ overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {/* Стоимость склада — только для наблюдения */}
                      <div style={{ background: 'var(--ax-input)', border: '1px solid var(--ax-border)', borderRadius: 12, padding: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                          <span style={{ color: 'var(--ax-text-2)', fontSize: 13, fontWeight: 600 }}>
                            {language === 'uz' ? 'Ombor qiymati' : 'Стоимость склада'}
                          </span>
                          <span style={{ color: 'var(--ax-text)', fontWeight: 700, fontSize: 14 }}>−{formatPrice(warehouseCost)}</span>
                        </div>
                        <div style={{ color: 'var(--ax-text-3)', fontSize: 11, marginTop: 4 }}>
                          {language === 'uz'
                            ? 'Yakuniy balansga qoʼshilmaydi (faqat maʼlumot uchun)'
                            : 'Не входит в итоговый баланс (только для наблюдения)'}
                        </div>
                      </div>

                      {/* Ежемесячные расходы — основной список */}
                      <div>
                        <div style={{ color: 'var(--ax-text-3)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                          {language === 'uz' ? 'Oylik xarajatlar' : 'Ежемесячные расходы'}
                        </div>
                        {detailed.monthly.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {detailed.monthly.map((it, i) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '10px 12px', background: 'var(--ax-input)', borderRadius: 10 }}>
                                <span style={{ color: 'var(--ax-text)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</span>
                                <span style={{ color: 'var(--ax-danger)', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>−{formatPrice(it.amount)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ color: 'var(--ax-text-3)', fontSize: 13, padding: '10px 12px', background: 'var(--ax-input)', borderRadius: 10 }}>
                            {language === 'uz' ? 'Oylik xarajatlar yoʼq' : 'Ежемесячных расходов нет'}
                          </div>
                        )}
                      </div>

                      {/* Кнопка: показать разовые и процентные */}
                      {(detailed.oneTime.length > 0 || detailed.percentage.length > 0) && !showExtraExpenses && (
                        <button
                          onClick={() => setShowExtraExpenses(true)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 14px', background: 'var(--ax-primary-pale)', border: '1px solid var(--ax-border)', borderRadius: 10, color: 'var(--ax-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                        >
                          {language === 'uz'
                            ? `Bir martalik va foizli xarajatlar (${detailed.oneTime.length + detailed.percentage.length}) ▼`
                            : `Разовые и процентные расходы (${detailed.oneTime.length + detailed.percentage.length}) ▼`}
                        </button>
                      )}

                      {/* Разовые и процентные — по кнопке */}
                      {showExtraExpenses && (
                        <>
                          {detailed.oneTime.length > 0 && (
                            <div>
                              <div style={{ color: 'var(--ax-text-3)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                                {language === 'uz' ? 'Bir martalik xarajatlar' : 'Разовые расходы'}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {detailed.oneTime.map((it, i) => (
                                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '10px 12px', background: 'var(--ax-input)', borderRadius: 10 }}>
                                    <span style={{ color: 'var(--ax-text)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</span>
                                    <span style={{ color: 'var(--ax-danger)', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>−{formatPrice(it.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {detailed.percentage.length > 0 && (
                            <div>
                              <div style={{ color: 'var(--ax-text-3)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                                {language === 'uz' ? 'Foizli xarajatlar' : 'Процентные расходы'}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {detailed.percentage.map((it, i) => (
                                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '10px 12px', background: 'var(--ax-input)', borderRadius: 10 }}>
                                    <span style={{ color: 'var(--ax-text)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name} ({it.rate}%)</span>
                                    <span style={{ color: 'var(--ax-danger)', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>−{formatPrice(it.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {detailed.oneTime.length === 0 && detailed.percentage.length === 0 && (
                            <div style={{ color: 'var(--ax-text-3)', fontSize: 13 }}>
                              {language === 'uz' ? 'Qoʼshimcha xarajatlar yoʼq' : 'Дополнительных расходов нет'}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Итог по расходам (влияет на баланс) */}
                    <div style={{ borderTop: '1px solid var(--ax-border)', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ color: 'var(--ax-text-2)', fontSize: 13, fontWeight: 600 }}>
                        {language === 'uz' ? 'Foydadan ayriladi' : 'Вычитается из прибыли'}
                      </span>
                      <span style={{ color: 'var(--ax-danger)', fontWeight: 800, fontSize: 16 }}>−{formatPrice(companyExpenses)}</span>
                    </div>
                  </div>
                </div>
              )}
              </>
            );
          })()}

          {/* 💸 ВАШИ РАСХОДЫ (влияет на «Расходы» выше). Общие итоги за всё время
               живут на Дашборде — здесь их не дублируем. */}
          <div className="max-w-7xl mx-auto mb-6" ref={expensesRef} style={{ scrollMarginTop: 16 }}>
            <SectionLabel>{language === 'uz' ? 'Xarajatlaringiz' : 'Ваши расходы'}</SectionLabel>
            <ExpensesManager
              companyId={companyId}
              openAddFormSignal={addExpenseSignal}
              onCustomExpensesUpdate={(totalCustomExpenses, expensesList) => {
                setCustomExpenses(totalCustomExpenses);
                setOperatingExpensesList(expensesList || []);
              }}
            />
          </div>

          <AdvancedInsightsPanel
            products={products}
            customerOrders={ordersWithItems} // 🆕 ВСЕ заказы (не за период): ТОП-товаров — рейтинг за всё время, консистентно с кассой
            salesHistory={salesHistory} // 🆕 Кассовые продажи из barcode panel
          />
        </>
      )}
    </div>
  );
}

// ── UI-примитивы аналитики ──────────────────────────────────

const DAY_NAMES_UZ = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
const DAY_NAMES_RU = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ color: 'var(--ax-text-3)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
      {children}
    </div>
  );
}

// Мини-график тренда внутри стат-карты (чистый SVG, без библиотек)
function Sparkline({ data, color, width = 96, height = 30 }: { data: number[]; color: string; width?: number; height?: number }) {
  const max = Math.max(...data, 1);
  const stepX = width / Math.max(data.length - 1, 1);
  const pad = 2;
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = pad + (1 - v / max) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = points.join(' ');
  const area = `0,${height} ${line} ${width},${height}`;
  const gradId = `spark-${color.replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', flexShrink: 0 }} aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gradId})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Стат-карта верхнего ряда: подпись, крупное значение, дельта и спарклайн
function MetricCard({ index, label, value, accent, delta, deltaGoodWhenDown, series, sub, footer }: {
  index: number;
  label: string;
  value: string;
  accent: string;
  delta?: number | null;
  // Для расходов рост — плохо: красим «+» в красный, «−» в зелёный
  deltaGoodWhenDown?: boolean;
  series?: number[];
  sub?: string;
  footer?: ReactNode;
}) {
  const deltaText = delta === null || delta === undefined
    ? null
    : `${delta >= 0 ? '+' : ''}${Math.abs(delta) >= 100 ? Math.round(delta) : delta.toFixed(1)}%`;
  const deltaUp = (delta ?? 0) >= 0;
  const deltaColor = (deltaGoodWhenDown ? !deltaUp : deltaUp) ? '#22C55E' : '#F87171';
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26, delay: index * 0.05 }}
      whileHover={{ y: -3 }}
      style={{
        background: `linear-gradient(160deg, ${accent}0F, var(--ax-card) 58%)`,
        border: `1px solid ${accent}26`,
        borderRadius: 16,
        padding: '16px 18px 14px',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <span style={{ color: 'var(--ax-text-2)', fontSize: 12.5, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.15, color: accent, wordBreak: 'break-word' }}>{value}</span>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, minHeight: 30 }}>
        <div style={{ minWidth: 0 }}>
          {deltaText && (
            <span style={{ fontSize: 12, fontWeight: 700, color: deltaColor }}>{deltaText}</span>
          )}
          {sub && (
            <div style={{ fontSize: 11, color: 'var(--ax-text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>
          )}
          {footer}
        </div>
        {series && series.some(v => v > 0) && <Sparkline data={series} color={accent} />}
      </div>
    </motion.div>
  );
}

// Кольцевой индикатор доли расходов
function Donut({ percent, size = 82, stroke = 9 }: { percent: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, percent)) / 100) * c;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(139,139,170,0.18)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="var(--ax-primary)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${filled} ${c - filled}`}
          initial={{ strokeDasharray: `0 ${c}` }}
          animate={{ strokeDasharray: `${filled} ${c - filled}` }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </svg>
      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: 'var(--ax-text)' }}>
        {Math.round(percent)}%
      </span>
    </div>
  );
}

// Строка «Быстрой статистики»: иконка + подпись слева, значение справа
function QuickStatRow({ icon, accent, label, value }: { icon: ReactNode; accent: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 9, background: `${accent}1F`, color: accent, flexShrink: 0 }}>
        {icon}
      </span>
      <span style={{ flex: 1, minWidth: 0, color: 'var(--ax-text-2)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ color: 'var(--ax-text)', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>{value}</span>
    </div>
  );
}

// Мини-карта «Расширенной аналитики»
function HighlightCard({ icon, accent, label, value, valueColor, sub }: {
  icon: ReactNode; accent: string; label: string; value: string; valueColor?: string; sub?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '13px 14px', borderRadius: 13, background: 'var(--ax-input)', border: `1px solid ${accent}26`, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 8, background: `${accent}1F`, color: accent, flexShrink: 0 }}>
          {icon}
        </span>
        <span style={{ color: 'var(--ax-text-3)', fontSize: 11, fontWeight: 600, lineHeight: 1.3 }}>{label}</span>
      </div>
      <span style={{ color: valueColor || 'var(--ax-text)', fontSize: 15, fontWeight: 700, lineHeight: 1.25, wordBreak: 'break-word' }}>{value}</span>
      {sub && <span style={{ color: 'var(--ax-text-3)', fontSize: 11, marginTop: -4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</span>}
    </div>
  );
}