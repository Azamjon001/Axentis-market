/**
 * 📊 РАСШИРЕННАЯ АНАЛИТИКА
 * - TOP 10 самых продаваемых товаров
 * - Товары с низким остатком (умная логика)
 */

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, AlertTriangle, Package, Layers, Crown } from 'lucide-react';
import { getCurrentLanguage, useTranslation, type Language } from '../utils/translations';

interface Product {
  id: number;
  name: string;
  quantity: number;
  price: number;
  sellingPrice?: number;
  totalStock?: number;   // 📦 остаток с учётом SKU-вариантов (сумма по вариантам)
  hasVariants?: boolean; // есть ли у товара SKU-варианты
}

// 📦 Фактический остаток товара: если у товара есть SKU-варианты, остаток
// живёт в них (основной quantity часто = 0). Аналитика должна считать
// варианты частью товара, иначе товары «на вариантах» пропадают из отчётов.
const effectiveStock = (p: Product): number => {
  if (typeof p.totalStock === 'number') return p.totalStock;
  return p.quantity || 0;
};

interface SaleItem {
  product_id: number;
  product_name: string;
  quantity: number;
}

// 📦 Продажи в разрезе SKU-варианта (цвет/размер) конкретного товара
interface VariantStat {
  label: string;     // «Синий · 256 ГБ» или «Стандарт»
  totalSold: number;
  revenue: number;
  profit: number;    // наценка: (цена продажи − закупка) × кол-во
}

interface TopProductEntry {
  name: string;
  totalSold: number;
  revenue: number;
  variants: VariantStat[];
}

interface AdvancedInsightsPanelProps {
  products: Product[];
  customerOrders: any[];
  salesHistory: any[]; // 🆕 Кассовые продажи из barcode panel
}

export default function AdvancedInsightsPanel({ products, customerOrders, salesHistory }: AdvancedInsightsPanelProps) {
  const [language, setLanguage] = useState<Language>(getCurrentLanguage());
  const t = useTranslation(language);

  // 🌍 Слушаем смену языка так же, как остальные компоненты приложения.
  // Раньше слушалось событие 'storage' (оно срабатывает только в других
  // вкладках), поэтому текст внутри панели не переводился в текущей вкладке.
  useEffect(() => {
    const handleLanguageChange = (e: Event) => setLanguage((e as CustomEvent).detail as Language);
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    return () => window.removeEventListener('languageChange', handleLanguageChange as EventListener);
  }, []);

  const [isOpen, setIsOpen] = useState(false);
  const [topProducts, setTopProducts] = useState<TopProductEntry[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Array<{ name: string; quantity: number; price: number; threshold: number }>>([]);
  const [rankingMode, setRankingMode] = useState<'quantity' | 'revenue' | 'expensive' | 'cheap' | 'leastSold'>('quantity'); // 🆕 Режим рейтинга
  const [topCount, setTopCount] = useState(20); // 🆕 TOP-20
  // 🔎 Раскрытые товары: показываем SKU-варианты по кнопке «Подробнее»
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  useEffect(() => {
    calculateTopProducts();
    calculateLowStockProducts();
  }, [products, customerOrders, salesHistory, rankingMode]); // 🆕 Пересчитываем при изменении режима и кассовых продаж

  // 🏆 TOP 10 самых продаваемых товаров
  const calculateTopProducts = () => {
    // 🔥 Группируем по НАЗВАНИЮ, а не ID; внутри копим продажи по SKU-вариантам
    const salesMap = new Map<string, { name: string; totalSold: number; revenue: number; variants: Map<string, VariantStat> }>();

    // Подпись SKU-варианта из позиции заказа/чека: цвет · размер
    const variantLabelOf = (item: any): string => {
      const rawColor = String(item.color || item.selected_color || '').trim();
      const rawSize = String(item.size || item.selected_size || '').trim();
      const color = rawColor && !['любой', 'any', 'istalgan'].includes(rawColor.toLowerCase()) ? rawColor : '';
      const parts = [color, rawSize].filter(Boolean);
      return parts.length > 0 ? parts.join(' · ') : (language === 'uz' ? 'Standart' : 'Стандарт');
    };

    // Копим количество/выручку/прибыль по варианту внутри товара
    const addVariantSale = (entry: { variants: Map<string, VariantStat> }, item: any, itemPrice: number, quantity: number) => {
      const label = variantLabelOf(item);
      const key = label.toLowerCase();
      const basePrice = Number(item.price) || 0;
      const sellingPrice = Number(item.price_with_markup || item.priceWithMarkup) || itemPrice || 0;
      const profit = sellingPrice > basePrice && basePrice > 0 ? (sellingPrice - basePrice) * quantity : 0;
      const v = entry.variants.get(key);
      if (v) {
        v.totalSold += quantity;
        v.revenue += itemPrice * quantity;
        v.profit += profit;
      } else {
        entry.variants.set(key, { label, totalSold: quantity, revenue: itemPrice * quantity, profit });
      }
    };

    console.log('\n' + '🏆'.repeat(40));
    console.log('🏆 [TOP Products] Начало подсчета TOP продаваемых товаров');
    console.log('🏆 Заказов получено:', customerOrders.length);
    console.log('🏆 Кассовых продаж:', salesHistory.length);
    console.log('🏆 Товаров в базе:', products.length);
    console.log('🏆'.repeat(40));

    // 1️⃣ Собираем продажи из обычных заказов (delivered, paid, completed)
    customerOrders.forEach((order, idx) => {
      console.log(`\n📦 Заказ ${idx + 1}/${customerOrders.length}:`, {
        order_code: order.order_code,
        status: order.status,
        has_items: !!order.items,
        items_is_array: Array.isArray(order.items),
        items_length: order.items?.length || 0,
        full_order: order
      });

      // ✅ Считаем любой реальный заказ, КРОМЕ отменённых/отклонённых.
      // ⚠️ 'completed' НЕ исключаем: подтверждённые онлайн-заказы получают именно
      //    статус 'completed' (см. order_confirm.go) и НЕ дублируются в кассовые
      //    продажи (sales) — раньше они ошибочно выпадали из ТОПа онлайн-товаров.
      //    Бэкенд (GetCompanyAnalytics) и так отдаёт только delivered/completed.
      const excludedStatuses = ['cancelled', 'canceled', 'rejected', 'declined', 'returned'];
      if (excludedStatuses.includes((order.status || '').toLowerCase())) {
        console.log(`  ❌ Пропускаем: статус "${order.status}" (исключён)`);
        return;
      }

      console.log(`  ✅ Статус подходит: ${order.status}`);

      if (!order.items) {
        console.log(`  ❌ У заказа НЕТ поля items!`);
        return;
      }

      if (!Array.isArray(order.items)) {
        console.log(`  ❌ items не является массивом! Тип:`, typeof order.items);
        return;
      }

      if (order.items.length === 0) {
        console.log(`  ❌ items пустой массив`);
        return;
      }

      console.log(`  ✅ items массив с ${order.items.length} товарами`);

      order.items.forEach((item: any, itemIdx) => {
        console.log(`    📦 Товар ${itemIdx + 1}:`, item);
        
        // ✅ ИСПРАВЛЕНИЕ: Поддерживаем все возможные варианты полей
        const productId = item.product_id || item.productId || item.id;
        const productName = item.product_name || item.productName || item.name;
        
        // 🔥 НОВОЕ: Если нет названия в items, берем из products по ID
        let finalProductName = productName;
        let product = products.find(p => p.id === productId);
        
        if (!finalProductName && product) {
          finalProductName = product.name;
          console.log(`      ℹ️ Название взято из каталога: ${finalProductName}`);
        }
        
        if (!finalProductName) {
          console.log(`      ❌ Товар без названия (ID: ${productId})`);
          return;
        }
        
        // 🔥 ИСПРАВЛЕНИЕ: Группируем по названию (регистронезависимо)
        const normalizedName = finalProductName.toLowerCase().trim();
        
        const existing = salesMap.get(normalizedName);
        if (!product) {
          product = products.find(p => p.name.toLowerCase().trim() === normalizedName);
        }
        
        // ✅ ИСПРАВЛЕНИЕ: Используем цену из заказа (price_with_markup, price, или из product)
        const itemPrice = item.price_with_markup || item.price || product?.sellingPrice || product?.price || 0;
        const itemRevenue = itemPrice * item.quantity;

        if (existing) {
          existing.totalSold += item.quantity;
          existing.revenue += itemRevenue;
          addVariantSale(existing, item, itemPrice, item.quantity);
          console.log(`      ➕ ${finalProductName}: +${item.quantity} шт (всего: ${existing.totalSold} шт, выручка: ${existing.revenue.toLocaleString()} сум)`);
        } else {
          const newEntry = {
            name: finalProductName, // Сохраняем оригинальное название (с заглавными буквами)
            totalSold: item.quantity,
            revenue: itemRevenue,
            variants: new Map<string, VariantStat>(),
          };
          addVariantSale(newEntry, item, itemPrice, item.quantity);
          salesMap.set(normalizedName, newEntry);
          console.log(`      🆕 ${finalProductName}: ${item.quantity} шт (новый товар в топе, выручка: ${itemRevenue.toLocaleString()} сум)`);
        }
      });
    });

    // 2️⃣ Собираем продажи из кассовых продаж (barcode panel)
    console.log('\n🏪 Обработка кассовых продаж...');
    salesHistory.forEach((sale, idx) => {
      console.log(`\n💵 Кассовая продажа ${idx + 1}/${salesHistory.length}:`, {
        id: sale.id,
        has_items: !!sale.items,
        items_is_array: Array.isArray(sale.items),
        items_length: sale.items?.length || 0
      });

      if (!sale.items || !Array.isArray(sale.items) || sale.items.length === 0) {
        console.log('  ❌ Нет товаров в кассовой продаже');
        return;
      }

      sale.items.forEach((item: any, itemIdx) => {
        console.log(`    💰 Товар ${itemIdx + 1}:`, item);
        
        const productId = item.productId || item.product_id || item.id;
        const productName = item.name || item.productName || item.product_name;
        
        let finalProductName = productName;
        let product = products.find(p => p.id === productId);
        
        if (!finalProductName && product) {
          finalProductName = product.name;
          console.log(`      ℹ️ Название взято из каталога: ${finalProductName}`);
        }
        
        if (!finalProductName) {
          console.log(`      ❌ Товар без названия (ID: ${productId})`);
          return;
        }
        
        const normalizedName = finalProductName.toLowerCase().trim();
        const existing = salesMap.get(normalizedName);
        
        if (!product) {
          product = products.find(p => p.name.toLowerCase().trim() === normalizedName);
        }
        
        const itemPrice = item.priceWithMarkup || item.price_with_markup || item.price || product?.sellingPrice || product?.price || 0;
        const itemRevenue = itemPrice * item.quantity;

        if (existing) {
          existing.totalSold += item.quantity;
          existing.revenue += itemRevenue;
          addVariantSale(existing, item, itemPrice, item.quantity);
          console.log(`      ➕ ${finalProductName}: +${item.quantity} шт (всего: ${existing.totalSold} шт, выручка: ${existing.revenue.toLocaleString()} сум)`);
        } else {
          const newEntry = {
            name: finalProductName,
            totalSold: item.quantity,
            revenue: itemRevenue,
            variants: new Map<string, VariantStat>(),
          };
          addVariantSale(newEntry, item, itemPrice, item.quantity);
          salesMap.set(normalizedName, newEntry);
          console.log(`      🆕 ${finalProductName}: ${item.quantity} шт (новый товар в топе, выручка: ${itemRevenue.toLocaleString()} сум)`);
        }
      });
    });

    console.log('\n📊 Всего уникальных товаров в топе:', salesMap.size);

    // 🧹 Показываем в ТОПе только товары, которые сейчас есть на цифровом складе.
    // Так удалённые/несуществующие товары (например, старая кассовая продажа
    // давно удалённого товара) не засоряют рейтинг.
    const existingNames = new Set(products.map(p => p.name.toLowerCase().trim()));
    const liveEntries: TopProductEntry[] = Array.from(salesMap.entries())
      .filter(([key]) => existingNames.has(key))
      .map(([, value]) => ({
        name: value.name,
        totalSold: value.totalSold,
        revenue: value.revenue,
        // SKU-варианты: самые прибыльные сверху
        variants: Array.from(value.variants.values()).sort((a, b) => b.profit - a.profit || b.revenue - a.revenue),
      }));

    console.log('📊 Из них есть на складе:', liveEntries.length);

    // ✅ Сортировка по выбранному режиму
    let sorted: TopProductEntry[] = [];

    if (rankingMode === 'expensive' || rankingMode === 'cheap') {
      // 💰 Сортировка по цене
      const productsWithSales = liveEntries.map((value) => {
        const product = products.find(p => p.name.toLowerCase().trim() === value.name.toLowerCase().trim());
        const price = product?.sellingPrice || product?.price || 0;
        return { ...value, price };
      });

      sorted = productsWithSales
        .sort((a, b) => rankingMode === 'expensive' ? b.price - a.price : a.price - b.price)
        .slice(0, topCount);
    } else if (rankingMode === 'leastSold') {
      // 🐌 Наименее продаваемые
      sorted = liveEntries
        .sort((a, b) => a.totalSold - b.totalSold)
        .slice(0, topCount);
    } else {
      // 🏆 Лидеры продаж / Прибыли
      sorted = liveEntries
        .sort((a, b) => rankingMode === 'quantity' ? b.totalSold - a.totalSold : b.revenue - a.revenue)
        .slice(0, topCount);
    }

    console.log(`\n🏆 TOP ${topCount} товаров (режим: ${rankingMode}):`);
    sorted.forEach((item, idx) => {
      console.log(`  ${idx + 1}. ${item.name} - ${item.totalSold} шт (выручка: ${item.revenue.toLocaleString()} сум)`);
    });
    console.log('🏆'.repeat(40) + '\n');

    setTopProducts(sorted);
  };

  // ⚠️ Товары с низким остатком (умная логика)
  const calculateLowStockProducts = () => {
    if (products.length === 0) {
      setLowStockProducts([]);
      return;
    }

    // 1. Рассчитываем среднюю цену
    const totalPrice = products.reduce((sum, p) => sum + p.price, 0);
    const averagePrice = totalPrice / products.length;

    console.log('📊 [Low Stock] Средняя цена товаров:', averagePrice.toLocaleString(), 'сум');

    // 2. Фильтруем товары с низким остатком
    // 🔥 УВЕЛИЧЕНЫ ПОРОГИ: Дешевые ≤20 шт, Дорогие ≤10 шт (было 15/7)
    // 📦 Остаток берём с учётом SKU-вариантов (effectiveStock), чтобы товары,
    // у которых остаток лежит в вариантах, тоже попадали в отчёт.
    const lowStock = products
      .filter(product => {
        const stock = effectiveStock(product);
        const threshold = product.price < averagePrice ? 20 : 10; // 🔥 ИСПРАВЛЕНО
        const isLowStock = stock <= threshold && stock > 0;

        if (isLowStock) {
          console.log(`  ⚠️ "${product.name}": ${stock} шт ≤ ${threshold} (цена: ${product.price.toLocaleString()} сум)`);
        }

        return isLowStock;
      })
      .map(product => ({
        name: product.name,
        quantity: effectiveStock(product),
        price: product.price,
        threshold: product.price < averagePrice ? 20 : 10 // 🔥 ИСПРАВЛЕНО
      }))
      .sort((a, b) => a.quantity - b.quantity); // Сортируем по возрастанию количества

    setLowStockProducts(lowStock);
    
    console.log(`⚠️ [Low Stock] Найдено ${lowStock.length} товаров с низким остатком`);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('uz-UZ').format(price) + ' ' + t.currency;
  };

  const modeButton = (mode: typeof rankingMode, label: string) => (
    <button
      onClick={() => setRankingMode(mode)}
      style={{
        flex: 1,
        padding: '7px 10px',
        borderRadius: 8,
        border: '1px solid var(--ax-border)',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
        background: rankingMode === mode ? 'var(--ax-primary)' : 'var(--ax-input)',
        color: rankingMode === mode ? '#FFFFFF' : 'var(--ax-text-2)',
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="mt-6 max-w-7xl mx-auto">
      {/* Кнопка раскрытия/скрытия */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between transition-all duration-300"
        style={{
          background: 'var(--ax-card)',
          border: '1px solid var(--ax-border)',
          borderRadius: 14,
          padding: '14px 20px',
          cursor: 'pointer',
          color: 'var(--ax-text)',
        }}
      >
        <div className="flex items-center gap-3">
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 9, background: 'var(--ax-primary-pale)' }}>
            <TrendingUp className="w-4 h-4" style={{ color: 'var(--ax-primary)' }} />
          </span>
          <span style={{ fontSize: 16, fontWeight: 700 }}>
            {t.advancedInsights}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {!isOpen && (
            <span style={{ fontSize: 13, color: 'var(--ax-text-2)' }}>
              {topProducts.length > 0 ? `${topProducts.length} TOP` : ''}
              {lowStockProducts.length > 0 ? ` • ${lowStockProducts.length} ${t.lowStockProducts}` : ''}
            </span>
          )}
          {isOpen ? (
            <ChevronUp className="w-5 h-5" style={{ color: 'var(--ax-text-2)' }} />
          ) : (
            <ChevronDown className="w-5 h-5" style={{ color: 'var(--ax-text-2)' }} />
          )}
        </div>
      </button>

      {/* Содержимое панели */}
      {isOpen && (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* 🏆 TOP 20 самых продаваемых товаров */}
          <div style={{ background: 'var(--ax-card)', border: '1px solid var(--ax-border)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--ax-border)' }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
                <TrendingUp className="w-4 h-4" style={{ color: 'var(--ax-primary)' }} />
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ax-text)', margin: 0 }}>{t.top20products}</h3>
              </div>

              {/* 🆕 Кнопки переключения режима рейтинга */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  {modeButton('quantity', `📦 ${t.salesLeaders}`)}
                  {modeButton('revenue', `💰 ${t.mostProfitable}`)}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {modeButton('expensive', `💎 ${t.expensive}`)}
                  {modeButton('cheap', `💵 ${t.cheap}`)}
                  {modeButton('leastSold', `🐌 ${t.leastSold}`)}
                </div>
              </div>
            </div>
            <div className="p-4">
              {topProducts.length === 0 ? (
                <div className="text-center py-8" style={{ color: 'var(--ax-text-3)' }}>
                  <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>{t.noSalesYet}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {topProducts.map((product, index) => {
                    const productKey = product.name.toLowerCase().trim();
                    const isExpanded = expandedProducts.has(productKey);
                    const hasVariants = product.variants.length > 0;
                    // Лучший по прибыли SKU (варианты уже отсортированы по прибыли)
                    const bestProfit = hasVariants ? product.variants[0].profit : 0;
                    return (
                      <div
                        key={index}
                        className="rounded-lg overflow-hidden transition-colors"
                        style={{ background: 'var(--ax-input)' }}
                      >
                        <div className="flex items-center justify-between p-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ${
                              index === 0 ? 'bg-yellow-500' :
                              index === 1 ? 'bg-gray-400' :
                              index === 2 ? 'bg-orange-600' :
                              'bg-purple-500'
                            }`}>
                              {index + 1}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate" style={{ fontWeight: 500, color: 'var(--ax-text)' }}>{product.name}</div>
                              <div style={{ fontSize: 13, color: 'var(--ax-text-2)' }}>
                                {rankingMode === 'quantity' ? (
                                  <>{t.revenue}: {formatPrice(product.revenue)}</>
                                ) : (
                                  <>{t.productsSold}: {product.totalSold} {t.pcs}</>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-2">
                            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ax-primary)' }}>
                              {rankingMode === 'quantity' ? (
                                <>{product.totalSold} {t.pcs}</>
                              ) : (
                                <>{formatPrice(product.revenue)}</>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--ax-text-3)' }}>
                              {rankingMode === 'quantity' ? t.productsSold : t.revenue}
                            </div>
                          </div>
                        </div>

                        {/* 🔎 «Подробнее»: продажи в разрезе SKU-вариантов */}
                        {hasVariants && (
                          <div className="px-3 pb-3">
                            <button
                              onClick={() => {
                                setExpandedProducts(prev => {
                                  const next = new Set(prev);
                                  next.has(productKey) ? next.delete(productKey) : next.add(productKey);
                                  return next;
                                });
                              }}
                              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg active:scale-95 transition-transform"
                              style={{ background: 'var(--ax-primary-pale)', border: '1px solid var(--ax-border)', color: 'var(--ax-primary)' }}
                            >
                              <Layers className="w-3.5 h-3.5" />
                              {isExpanded
                                ? (language === 'uz' ? 'Yashirish' : 'Скрыть')
                                : `${language === 'uz' ? 'Batafsil' : 'Подробнее'} · ${product.variants.length} SKU`}
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>

                            {isExpanded && (
                              <div className="mt-2 rounded-lg p-2.5 space-y-1.5" style={{ background: 'var(--ax-card)', border: '1px solid var(--ax-border)' }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ax-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                                  {language === 'uz' ? 'SKU variantlari boʻyicha sotuvlar' : 'Продажи по SKU-вариантам'}
                                </div>
                                {product.variants.map((v, vi) => {
                                  const isBest = v.profit > 0 && v.profit === bestProfit;
                                  return (
                                    <div key={vi} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md" style={isBest ? { background: 'var(--ax-primary-pale)' } : undefined}>
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        {isBest && <Crown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#F59E0B' }} />}
                                        <span className="truncate" style={{ fontSize: 13, color: 'var(--ax-text)', fontWeight: isBest ? 600 : 400 }}>
                                          {v.label}
                                        </span>
                                        {isBest && (
                                          <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.16)', color: '#F59E0B' }}>
                                            {language === 'uz' ? 'Eng foydali' : 'Самый прибыльный'}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-3 flex-shrink-0 text-right">
                                        <span style={{ fontSize: 12, color: 'var(--ax-text-2)', whiteSpace: 'nowrap' }}>
                                          {v.totalSold} {t.pcs}
                                        </span>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ax-text)', whiteSpace: 'nowrap' }}>
                                          {formatPrice(v.revenue)}
                                        </span>
                                        {v.profit > 0 && (
                                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ax-success, #22C55E)', whiteSpace: 'nowrap' }}>
                                            +{formatPrice(v.profit)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ⚠️ Товары с низким остатком */}
          <div style={{ background: 'var(--ax-card)', border: '1px solid var(--ax-border)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--ax-border)' }}>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" style={{ color: 'var(--ax-warning)' }} />
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ax-text)', margin: 0 }}>{t.lowStockProducts}</h3>
              </div>
              <p style={{ fontSize: 13, color: 'var(--ax-text-2)', margin: '6px 0 0' }}>
                {t.lowStockDescription}
              </p>
            </div>
            <div className="p-4">
              {lowStockProducts.length === 0 ? (
                <div className="text-center py-8" style={{ color: 'var(--ax-text-3)' }}>
                  <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>{t.allInStockMessage}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {lowStockProducts.map((product, index) => {
                    const urgencyLevel =
                      product.quantity <= 3 ? 'critical' :
                      product.quantity <= 5 ? 'warning' :
                      'normal';
                    const urgencyColor =
                      urgencyLevel === 'critical' ? 'var(--ax-danger)' :
                      urgencyLevel === 'warning' ? '#F59E0B' :
                      'var(--ax-warning)';

                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 rounded-lg transition-colors"
                        style={{ background: 'var(--ax-input)', borderLeft: `3px solid ${urgencyColor}` }}
                      >
                        <div className="flex-1">
                          <div style={{ fontWeight: 500, color: 'var(--ax-text)' }}>{product.name}</div>
                          <div style={{ fontSize: 13, color: 'var(--ax-text-2)' }}>
                            {t.price}: {formatPrice(product.price)} • {t.threshold}: {product.threshold} {t.pcs}
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <div style={{ fontSize: 22, fontWeight: 700, color: urgencyColor }}>
                            {product.quantity}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--ax-text-3)' }}>{t.remaining}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}