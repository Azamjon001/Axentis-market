/**
 * 📊 РАСШИРЕННАЯ АНАЛИТИКА
 * - TOP 10 самых продаваемых товаров
 * - Товары с низким остатком (умная логика)
 */

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, AlertTriangle, Package } from 'lucide-react';
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
  const [topProducts, setTopProducts] = useState<Array<{ name: string; totalSold: number; revenue: number }>>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Array<{ name: string; quantity: number; price: number; threshold: number }>>([]);
  const [rankingMode, setRankingMode] = useState<'quantity' | 'revenue' | 'expensive' | 'cheap' | 'leastSold'>('quantity'); // 🆕 Режим рейтинга
  const [topCount, setTopCount] = useState(20); // 🆕 TOP-20

  useEffect(() => {
    calculateTopProducts();
    calculateLowStockProducts();
  }, [products, customerOrders, salesHistory, rankingMode]); // 🆕 Пересчитываем при изменении режима и кассовых продаж

  // 🏆 TOP 10 самых продаваемых товаров
  const calculateTopProducts = () => {
    const salesMap = new Map<string, { name: string; totalSold: number; revenue: number }>(); // 🔥 Группируем по НАЗВАНИЮ, а не ID

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

      // ✅ Считаем любой реальный заказ, КРОМЕ отменённых/отклонённых и 'completed'.
      // ⚠️ 'completed' исключаем — такие заказы зеркалятся в кассовые продажи
      //    (salesHistory) и были бы посчитаны дважды.
      // Раньше был узкий белый список (confirmed/shipped/delivered/paid), из-за
      // которого новые заказы (pending/new и т.п.) не попадали в ТОП.
      const excludedStatuses = ['cancelled', 'canceled', 'rejected', 'declined', 'returned', 'completed'];
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
          console.log(`      ➕ ${finalProductName}: +${item.quantity} шт (всего: ${existing.totalSold} шт, выручка: ${existing.revenue.toLocaleString()} сум)`);
        } else {
          const newEntry = {
            name: finalProductName, // Сохраняем оригинальное название (с заглавными буквами)
            totalSold: item.quantity,
            revenue: itemRevenue
          };
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
          console.log(`      ➕ ${finalProductName}: +${item.quantity} шт (всего: ${existing.totalSold} шт, выручка: ${existing.revenue.toLocaleString()} сум)`);
        } else {
          const newEntry = {
            name: finalProductName,
            totalSold: item.quantity,
            revenue: itemRevenue
          };
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
    const liveEntries = Array.from(salesMap.entries())
      .filter(([key]) => existingNames.has(key))
      .map(([, value]) => value);

    console.log('📊 Из них есть на складе:', liveEntries.length);

    // ✅ Сортировка по выбранному режиму
    let sorted: Array<{ name: string; totalSold: number; revenue: number }> = [];

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
                  {topProducts.map((product, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg transition-colors"
                      style={{ background: 'var(--ax-input)' }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                          index === 0 ? 'bg-yellow-500' :
                          index === 1 ? 'bg-gray-400' :
                          index === 2 ? 'bg-orange-600' :
                          'bg-purple-500'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, color: 'var(--ax-text)' }}>{product.name}</div>
                          <div style={{ fontSize: 13, color: 'var(--ax-text-2)' }}>
                            {rankingMode === 'quantity' ? (
                              <>{t.revenue}: {formatPrice(product.revenue)}</>
                            ) : (
                              <>{t.productsSold}: {product.totalSold} {t.pcs}</>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
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
                  ))}
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