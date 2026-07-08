import { useState, useEffect, type ReactNode } from 'react';
import { TrendingUp, Package, CreditCard, Calendar, Receipt, Wallet, Globe } from 'lucide-react';
import api from '../utils/api';
import ExpensesManager from './ExpensesManager';
import AdvancedInsightsPanel from './AdvancedInsightsPanel';
import PurchaseAnalytics from './PurchaseAnalytics';
import CompactPeriodSelector from './CompactPeriodSelector';
import { ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ComposedChart, Area } from 'recharts';
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

  // 📑 Вкладки: аналитика + закупки (история офлайн-продаж живёт в офлайн-панели)
  const [activeTab, setActiveTab] = useState<'analytics' | 'purchases'>('analytics');
  
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

  // ═══════════════════════════════════════════════════════════
  // ЗАТРАТЫ КОМПАНИИ = себестоимость проданных товаров (COGS)
  //   = выручка за период - прибыль (наценка) за период
  // ═══════════════════════════════════════════════════════════
  const getPeriodCOGS = (period: PeriodType = 'day') => {
    return Math.max(getPeriodRevenue(period) - getPeriodProfit(period), 0);
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
      </div>

      {/* 📦 ВКЛАДКА: Аналитика закупок */}
      {activeTab === 'purchases' && (
        <PurchaseAnalytics companyId={companyId} />
      )}

      {/* 📊 ВКЛАДКА: Аналитика */}
      {activeTab === 'analytics' && (
        <>
          {/* ========== ЗАГОЛОВОК + СЕЛЕКТОР ПЕРИОДА ========== */}
          <div className="flex flex-wrap items-center justify-between gap-3 max-w-7xl mx-auto mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5" style={{ color: 'var(--ax-text-2)' }} />
              <h4 className="text-base font-semibold" style={{ color: 'var(--ax-text)' }}>{t.periodAnalysis}</h4>
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
            const onlineMarkup  = getOnlineMarkup(financialTimePeriod);
            const offlineMarkup = getOfflineMarkup(financialTimePeriod);
            const revenue       = getPeriodRevenue(financialTimePeriod);
            const opEx          = getPeriodOperatingExpenses(financialTimePeriod, revenue);
            const detailed      = getOperatingExpensesDetailed(financialTimePeriod, revenue);
            // 🏬 Стоимость склада — только для наблюдения, В БАЛАНС НЕ ВХОДИТ
            const warehouseCost = inventoryCost;
            // 💸 Расходы компании (операционные) — влияют на баланс
            const companyExpenses = opEx;
            // «Затраты компании» (карточка) = склад (инфо) + расходы компании
            const totalExpenses = warehouseCost + companyExpenses;
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

            return (
              <>
              <div className="max-w-7xl mx-auto mb-6" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* ── ИТОГИ ПЕРИОДА ── */}
                <div>
                  <SectionLabel>{language === 'uz' ? 'Davr yakunlari' : 'Итоги периода'}</SectionLabel>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>

                    {/* 1. ИТОГОВЫЙ БАЛАНС (главный показатель) */}
                    <StatTile
                      icon={<Wallet className="w-4 h-4" style={{ color: balanceColor }} />}
                      iconBg={isPositive ? 'var(--ax-primary-pale)' : 'rgba(248,113,113,0.12)'}
                      label={language === 'uz' ? 'Yakuniy balans' : 'Итоговый баланс'}
                      value={`${isPositive ? '+' : ''}${formatPrice(balance)}`}
                      valueColor={balanceColor}
                      accent={balanceColor}
                      sub={language === 'uz'
                        ? `Foyda (${formatPrice(profit)}) − Xarajatlar (${formatPrice(companyExpenses)})`
                        : `Наценка (${formatPrice(profit)}) − Расходы (${formatPrice(companyExpenses)})`}
                    />

                    {/* 2. ПРИБЫЛЬ (наценка онлайн + офлайн) */}
                    <StatTile
                      icon={<TrendingUp className="w-4 h-4" style={{ color: 'var(--ax-success)' }} />}
                      iconBg="rgba(34,197,94,0.12)"
                      label={language === 'uz' ? 'Foyda (ustama)' : 'Прибыль (наценка)'}
                      value={`+${formatPrice(profit)}`}
                      valueColor="var(--ax-success)"
                      sub={
                        <>
                          <SubRow name={language === 'uz' ? 'Onlayn ustama' : 'Онлайн наценка'} value={formatPrice(onlineMarkup)} />
                          <SubRow name={language === 'uz' ? 'Oflayn ustama' : 'Офлайн наценка'} value={formatPrice(offlineMarkup)} />
                        </>
                      }
                    />

                    {/* 3. ЗАТРАТЫ КОМПАНИИ (итог + раскрытие деталей) */}
                    <StatTile
                      icon={<Package className="w-4 h-4" style={{ color: 'var(--ax-danger)' }} />}
                      iconBg="rgba(248,113,113,0.12)"
                      label={language === 'uz' ? 'Kompaniya xarajatlari' : 'Затраты компании'}
                      value={`−${formatPrice(totalExpenses)}`}
                      valueColor="var(--ax-danger)"
                      sub={
                        <>
                          <SubRow
                            name={language === 'uz' ? 'Ombor (balansga kirmaydi)' : 'Склад (не в балансе)'}
                            value={`−${formatPrice(warehouseCost)}`}
                            valueColor="var(--ax-text-2)"
                          />
                          <SubRow
                            name={language === 'uz' ? 'Xarajatlar' : 'Расходы'}
                            value={`−${formatPrice(companyExpenses)}`}
                            valueColor="var(--ax-danger)"
                          />
                          <button
                            onClick={() => { setShowExpensesModal(true); setShowExtraExpenses(false); }}
                            style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--ax-primary-pale)', border: '1px solid var(--ax-border)', borderRadius: 8, color: 'var(--ax-primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '6px 12px' }}
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            {language === 'uz' ? 'Barcha xarajatlar' : 'Все затраты'}
                          </button>
                        </>
                      }
                    />
                  </div>
                </div>

                {/* ── КАНАЛЫ ПРОДАЖ (наблюдение, не влияют на баланс) ── */}
                <div>
                  <SectionLabel>{language === 'uz' ? 'Savdo kanallari' : 'Каналы продаж'}</SectionLabel>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>

                    {/* 4. ВЫРУЧКА ЗА ПЕРИОД (онлайн + офлайн) */}
                    <StatTile
                      icon={<CreditCard className="w-4 h-4" style={{ color: 'var(--ax-primary)' }} />}
                      iconBg="var(--ax-primary-pale)"
                      label={language === 'uz' ? 'Davr tushumi' : 'Выручка за период'}
                      value={formatPrice(revenue)}
                      sub={language === 'uz'
                        ? `Onlayn + oflayn savdo summasi`
                        : `Онлайн + офлайн продажи`}
                    />

                    {/* 5. ОНЛАЙН ПРОДАЖИ */}
                    <StatTile
                      icon={<Globe className="w-4 h-4" style={{ color: '#38BDF8' }} />}
                      iconBg="rgba(56,189,248,0.12)"
                      label={language === 'uz' ? 'Onlayn savdo' : 'Онлайн продажи'}
                      value={formatPrice(onlineSales)}
                      sub={
                        <>
                          <SubRow name={language === 'uz' ? 'Buyurtmalar' : 'Заказы'} value={`${onlineCount}`} />
                          <SubRow
                            name={language === 'uz' ? `Platforma komissiyasi (${commissionPercent}%)` : `Комиссия платформы (${commissionPercent}%)`}
                            value={formatPrice(onlineCommission)}
                          />
                        </>
                      }
                    />

                    {/* 6. ОФЛАЙН ПРОДАЖИ (касса) */}
                    <StatTile
                      icon={<Receipt className="w-4 h-4" style={{ color: 'var(--ax-warning)' }} />}
                      iconBg="rgba(251,191,36,0.12)"
                      label={language === 'uz' ? 'Oflayn savdo (kassa)' : 'Офлайн продажи (касса)'}
                      value={formatPrice(offlineSales)}
                      sub={
                        <>
                          <SubRow name={language === 'uz' ? 'Kassa sotuvlari' : 'Продажи через кассу'} value={`${offlineCount}`} />
                          <div style={{ opacity: 0.8 }}>
                            {language === 'uz'
                              ? 'Sotuv tarixi — Oflayn panelida'
                              : 'История продаж — в офлайн-панели'}
                          </div>
                        </>
                      }
                    />
                  </div>
                </div>
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
                            {language === 'uz' ? 'Kompaniya xarajatlari' : 'Затраты компании'}
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
                        {language === 'uz' ? 'Balansga taʼsir (xarajatlar)' : 'Влияет на баланс (расходы)'}
                      </span>
                      <span style={{ color: 'var(--ax-danger)', fontWeight: 800, fontSize: 16 }}>−{formatPrice(companyExpenses)}</span>
                    </div>
                  </div>
                </div>
              )}
              </>
            );
          })()}

          {/* 📊 ДИАГРАММА — ДИНАМИКА ВЫРУЧКИ */}
          <div className="max-w-7xl mx-auto mb-6" key={`charts-${financialTimePeriod}`}>
            <SectionLabel>{language === 'uz' ? 'Dinamika' : 'Динамика'}</SectionLabel>
            <div style={{
              background: 'var(--ax-card)',
              borderRadius: 14,
              padding: '22px 24px',
              border: '1px solid var(--ax-border)',
            }}>
              {/* Header + legend — только сумма (заработано), текущий и предыдущий период */}
              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ color: 'var(--ax-text)', fontSize: '17px', fontWeight: 700, margin: '0 0 10px 0' }}>
                    {language === 'uz' ? 'Daromad' : 'Выручка'}
                  </h3>
                  <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--ax-text-2)', fontSize: '13px' }}>
                      <span style={{ width: 24, height: 3, background: '#7C5CF0', display: 'inline-block', borderRadius: 2 }} />
                      {language === 'uz' ? 'Joriy davr' : 'Текущий период'}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--ax-text-2)', fontSize: '13px' }}>
                      <span style={{ width: 24, height: 3, background: '#5B3DD4', display: 'inline-block', borderRadius: 2, borderTop: '2px dashed #5B3DD4' }} />
                      {language === 'uz' ? 'Oldingi davr' : 'Предыдущий период'}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: 'var(--ax-text-3)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                    {language === 'uz' ? 'Davr uchun jami' : 'Итого за период'}
                  </div>
                  <div style={{ color: 'var(--ax-text)', fontSize: 20, fontWeight: 800 }}>
                    {formatPrice(getPeriodRevenue(financialTimePeriod))}
                  </div>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={getCombinedChartData()} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="revCurGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7C5CF0" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#7C5CF0" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="revPrevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5B3DD4" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#5B3DD4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,139,170,0.15)" vertical={false} />
                  <XAxis dataKey="period" tick={{ fill: '#8B8BAA', fontSize: 10 }} axisLine={{ stroke: 'rgba(139,139,170,0.3)' }} tickLine={false} interval="preserveStartEnd" />
                  {/* Единственная шкала — заработанная сумма */}
                  <YAxis yAxisId="rev" orientation="left" tick={{ fill: '#8B8BAA', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatShortPrice(v)} width={58} />
                  <Tooltip
                    contentStyle={{ background: '#13132A', border: '1px solid rgba(124,92,240,0.4)', borderRadius: '12px', color: '#FFFFFF', fontSize: '13px' }}
                    labelStyle={{ color: '#8B8BAA', marginBottom: '6px' }}
                    itemStyle={{ color: '#FFFFFF' }}
                    formatter={(value: number, name: string) => {
                      return [formatPrice(value), name === 'revCurrent' ? (language === 'uz' ? 'Joriy davr' : 'Текущий период') : (language === 'uz' ? 'Oldingi davr' : 'Предыдущий период')];
                    }}
                  />
                  <Area yAxisId="rev" type="monotone" dataKey="revCurrent" stroke="#7C5CF0" strokeWidth={2.5} fill="url(#revCurGrad)"
                    dot={false} activeDot={{ r: 5, fill: '#7C5CF0', stroke: '#FFFFFF', strokeWidth: 2 }}
                    animationDuration={1100} animationEasing="ease-out" legendType="none"
                  />
                  <Area yAxisId="rev" type="monotone" dataKey="revPrevious" stroke="#5B3DD4" strokeWidth={1.5} strokeDasharray="5 4" fill="url(#revPrevGrad)"
                    dot={false} activeDot={{ r: 3, fill: '#5B3DD4' }}
                    animationDuration={1300} animationEasing="ease-out" legendType="none"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 📊 ФИНАНСОВЫЙ РАЗРЕЗ (за всё время) — горизонтальные бары */}
          <div className="max-w-7xl mx-auto mb-6">
            {(() => {
              const totalExpenses = inventoryCost + customExpenses;
              const netProfit = Math.max(companyEarnings - customExpenses, 0);
              const breakdown = [
                { name: language === 'uz' ? 'Jami daromad' : 'Выручка (продажи)', value: totalRevenue, color: 'var(--ax-success)' },
                { name: language === 'uz' ? 'Xarajatlar (ombor)' : 'Затраты (склад)', value: totalExpenses, color: 'var(--ax-danger)' },
                { name: language === 'uz' ? 'Sof foyda' : 'Чистая прибыль', value: netProfit, color: 'var(--ax-primary)' },
              ].filter(d => d.value > 0);
              const maxValue = Math.max(...breakdown.map(d => d.value), 1);

              return (
                <div style={{ background: 'var(--ax-card)', borderRadius: 14, padding: '22px 24px', border: '1px solid var(--ax-border)' }}>
                  <h3 style={{ color: 'var(--ax-text)', fontSize: 17, fontWeight: 700, marginBottom: 4 }}>
                    {language === 'uz' ? 'Moliyaviy tahlil' : 'Финансовый разрез'}
                  </h3>
                  <p style={{ color: 'var(--ax-text-3)', fontSize: 12, marginBottom: 18 }}>
                    {language === 'uz' ? 'Butun davr uchun' : 'За всё время работы'}
                  </p>
                  {breakdown.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {breakdown.map((entry, index) => (
                        <div key={index}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, gap: 8 }}>
                            <span style={{ color: 'var(--ax-text-2)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
                            <span style={{ color: 'var(--ax-text)', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>{formatPrice(entry.value)}</span>
                          </div>
                          <div style={{ height: 8, background: 'var(--ax-input)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${Math.max((entry.value / maxValue) * 100, 2)}%`,
                              background: entry.color,
                              borderRadius: 4,
                              transition: 'width 0.6s ease',
                            }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ height: 140, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--ax-text-3)' }}>
                      <Package style={{ width: 36, height: 36, opacity: 0.3 }} />
                      <span style={{ fontSize: 13 }}>{language === 'uz' ? "Maʼlumot yoʼq" : 'Нет данных'}</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* 💸 УПРАВЛЕНИЕ РАСХОДАМИ (влияет на «Затраты компании» выше) */}
          <div className="max-w-7xl mx-auto mb-6">
            <SectionLabel>{language === 'uz' ? 'Xarajatlarni boshqarish' : 'Управление расходами'}</SectionLabel>
            <ExpensesManager
              companyId={companyId}
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

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ color: 'var(--ax-text-3)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
      {children}
    </div>
  );
}

function SubRow({ name, value, valueColor }: { name: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      <span style={{ color: valueColor || 'var(--ax-text)', fontWeight: 600, flexShrink: 0 }}>{value}</span>
    </div>
  );
}

function StatTile({ icon, iconBg, label, value, valueColor, accent, sub }: {
  icon: ReactNode;
  iconBg: string;
  label: string;
  value: string;
  valueColor?: string;
  accent?: string;
  sub?: ReactNode;
}) {
  return (
    <div style={{
      position: 'relative',
      background: 'var(--ax-card)',
      border: '1px solid var(--ax-border)',
      borderRadius: 14,
      padding: '18px 18px 16px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      {accent && (
        <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent }} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 9, background: iconBg, flexShrink: 0 }}>
          {icon}
        </span>
        <span style={{ color: 'var(--ax-text-2)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.15, color: valueColor || 'var(--ax-text)', wordBreak: 'break-word' }}>
        {value}
      </div>
      {sub && <div style={{ color: 'var(--ax-text-2)', fontSize: 12, lineHeight: 1.6 }}>{sub}</div>}
    </div>
  );
}