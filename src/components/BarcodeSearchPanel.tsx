import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Search, Barcode, X, Package, ShoppingCart, Trash2, RefreshCw, Plus, Minus, CheckCircle, DollarSign, Receipt } from 'lucide-react';
import { useProducts, queryClient, localCache } from '../utils/cache';
import api, { getImageUrl } from '../utils/api';
import PaymentHistoryForCompany from './PaymentHistoryForCompany';
import { useResponsive, useResponsiveClasses } from '../hooks/useResponsive';
import { getCurrentLanguage, useTranslation, type Language } from '../utils/translations';

interface Product {
  id: number;
  name: string;
  quantity: number;
  price: number;
  markupPercent?: number;
  availableForCustomers?: boolean;
  images?: string[]; // 📸 Массив путей к изображениям товара
  category?: string;
  barcode?: string;
  barid?: string;
}

interface CartItem {
  product: Product;
  quantity: number;
  variantId?: number;
  variantPrice?: number;        // warehouse cost for the specific variant
  variantSellingPrice?: number; // selling price with markup for the specific variant
}

interface BarcodeSearchPanelProps {
  companyId: number;
}

/**
 * 🏪 Панель штрих-кода (Цифровая касса)
 * 
 * Функционал:
 * - Поиск товаров по штрих-коду, barid или названию
 * - Добавление товаров в корзину
 * - Управление количеством товаров
 * - Кассовая продажа (cash sale) через прямой API endpoint
 * - Автоматическое уменьшение товаров со склада
 * - Запись прибыли в аналитику
 */
export default function BarcodeSearchPanel({ companyId }: BarcodeSearchPanelProps) {
  const { data: products = [], isLoading, refetch } = useProducts(companyId);
  
  // 🌍 Переводы
  const [language, setLanguage] = useState<Language>(getCurrentLanguage());
  const t = useTranslation(language);
  
  // 📱 Адаптивность
  const { isMobile, isTablet } = useResponsive();
  const responsive = useResponsiveClasses();
  
  // Состояния
  const [activeView, setActiveView] = useState<'pos' | 'history'>('pos'); // 🧾 Касса / История продаж
  const [searchBarcode, setSearchBarcode] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [lastScannedProduct, setLastScannedProduct] = useState<Product | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [discounts, setDiscounts] = useState<any[]>([]); // 🆕 Скидки
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash'); // 💳 Способ оплаты
  const [cardSubtype, setCardSubtype] = useState<'uzcard' | 'humo' | 'visa' | 'other'>('uzcard'); // 💳 Подтип карты
  
  // Refs
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // 🔄 Слушаем изменения языка
  useEffect(() => {
    const handleLanguageChange = (e: CustomEvent) => {
      setLanguage(e.detail);
    };
    
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    
    return () => {
      window.removeEventListener('languageChange', handleLanguageChange as EventListener);
    };
  }, []);

  // 🎯 Автофокус на поле ввода
  useEffect(() => {
    barcodeInputRef.current?.focus();
    loadDiscounts(); // 🆕 Загрузка скидок
  }, []);

  // 🆕 Загрузка скидок (обычные + агрессивные)
  const loadDiscounts = async () => {
    try {
      const [regular, aggressive] = await Promise.all([
        api.discounts.listApproved(),
        api.aggressiveDiscounts.listApproved()
      ]);
      
      const combined = [
        ...(Array.isArray(regular) ? regular : []),
        ...(Array.isArray(aggressive) ? aggressive.map((ad: any) => ({
          productId: ad.productId || ad.product_id,
          discountPercent: ad.discountPercent || ad.discount_percent,
          isAggressive: true,
          title: ad.title,
          description: ad.description
        })) : [])
      ];
      
      setDiscounts(combined);
      console.log('🏷️ [Barcode] Loaded discounts:', combined.length);
    } catch (error) {
      console.error('❌ [Barcode] Error loading discounts:', error);
    }
  };

  // 🎯 Возврат фокуса после уведомлений
  useEffect(() => {
    if (lastScannedProduct || notFound) {
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 100);
    }
  }, [lastScannedProduct, notFound]);

  /**
   * Расчёт цены с наценкой И СКИДКОЙ
   */
  const getPriceWithMarkup = (price: number, markupPercent: number = 0, productId?: number): number => {
    const priceWithMarkup = price * (1 + markupPercent / 100);
    
    // 🆕 Применяем скидку если есть
    if (productId) {
      const discount = discounts.find(d => d.productId === productId);
      if (discount && discount.discountPercent > 0) {
        if (discount.isAggressive) {
          // 🔥 Агрессивная скидка: на полную цену
          const discountedPrice = priceWithMarkup * (1 - discount.discountPercent / 100);
          console.log(`🔥 Aggressive discount ${discount.discountPercent}%: ${priceWithMarkup} → ${discountedPrice}`);
          return discountedPrice;
        } else {
          // 🏷️ Обычная скидка: только на наценку
          const markup = priceWithMarkup - price;
          const discountAmount = markup * (discount.discountPercent / 100);
          const discountedPrice = priceWithMarkup - discountAmount;
          console.log(`🏷️ Regular discount ${discount.discountPercent}%: ${priceWithMarkup} → ${discountedPrice}`);
          return discountedPrice;
        }
      }
    }
    
    return priceWithMarkup;
  };

  /**
   * Форматирование цены
   */
  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('uz-UZ').format(Math.round(price)) + ' ' + t.currency;
  };

  /**
   * Поиск товара по штрих-коду/barid/названию (включая варианты)
   */
  const handleScan = async () => {
    if (!searchBarcode.trim()) return;

    const trimmedBarcode = searchBarcode.trim().toLowerCase();

    // Local search first (fast)
    let foundProduct = products.find((p: Product) => {
      const matchBarcode = p.barcode?.toLowerCase() === trimmedBarcode;
      const matchBarid = p.barid?.toLowerCase() === trimmedBarcode;
      const matchName = p.name.toLowerCase().includes(trimmedBarcode);
      return matchBarcode || matchBarid || matchName;
    });

    // If not found locally, search backend — catches variant barcodes/SKUs
    let pendingVariantId: number | undefined;
    let pendingVariantPrice: number | undefined;
    let pendingVariantSellingPrice: number | undefined;
    if (!foundProduct) {
      try {
        const result = await api.products.findByBarcode(companyId, trimmedBarcode);
        if (result?.found && result?.productId) {
          foundProduct = products.find((p: Product) => p.id === result.productId);
          if (result.variantId) {
            pendingVariantId = result.variantId;
            pendingVariantPrice = result.variantPrice;
            pendingVariantSellingPrice = result.variantSellingPrice;
          }
        }
      } catch {
        // not found in variants either — fall through to notFound state
      }
    }

    if (foundProduct) {
      setLastScannedProduct(foundProduct);
      setNotFound(false);
      addToCart(foundProduct, pendingVariantId, pendingVariantPrice, pendingVariantSellingPrice);
      setSearchBarcode('');
    } else {
      setLastScannedProduct(null);
      setNotFound(true);

      setTimeout(() => {
        setNotFound(false);
        setSearchBarcode('');
      }, 2500);
    }
  };

  /**
   * Добавление товара в корзину (с поддержкой SKU-вариантов)
   */
  const addToCart = (product: Product, variantId?: number, variantPrice?: number, variantSellingPrice?: number) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item =>
        variantId
          ? item.product.id === product.id && item.variantId === variantId
          : item.product.id === product.id && !item.variantId
      );

      if (existingItem) {
        return prevCart.map(item => {
          const matches = variantId
            ? item.product.id === product.id && item.variantId === variantId
            : item.product.id === product.id && !item.variantId;
          return matches ? { ...item, quantity: item.quantity + 1 } : item;
        });
      }

      return [...prevCart, { product, quantity: 1, variantId, variantPrice, variantSellingPrice }];
    });
  };

  /**
   * Обновление количества товара (поддерживает variantId)
   */
  const updateQuantity = (productId: number, newQuantity: number, variantId?: number) => {
    if (newQuantity < 0) return;

    setCart(prevCart =>
      prevCart.map(item => {
        const matches = variantId
          ? item.product.id === productId && item.variantId === variantId
          : item.product.id === productId;
        return matches ? { ...item, quantity: newQuantity } : item;
      })
    );
  };

  /**
   * Удаление товара из корзины (поддерживает variantId)
   */
  const removeFromCart = (productId: number, variantId?: number) => {
    setCart(prevCart =>
      prevCart.filter(item => {
        if (variantId) return !(item.product.id === productId && item.variantId === variantId);
        return item.product.id !== productId;
      })
    );
  };

  /**
   * Очистка корзины (новый заказ)
   */
  const handleNewOrder = () => {
    if (cart.length === 0) return;
    
    if (confirm(`🔄 ${t.newOrderConfirm}\n\n${t.cartWillBeCleared}`)) {
      clearCart();
    }
  };

  const clearCart = () => {
    setCart([]);
    setLastScannedProduct(null);
    setNotFound(false);
    setSearchBarcode('');
    barcodeInputRef.current?.focus();
  };

  /**
   * Расчёт итогов (использует цены варианта если доступны)
   */
  const getTotalAmount = (): number => {
    return cart.reduce((sum, item) => {
      const sellingPrice = item.variantSellingPrice
        ?? getPriceWithMarkup(item.product.price, item.product.markupPercent || 0, item.product.id);
      return sum + (sellingPrice * item.quantity);
    }, 0);
  };

  const getTotalItems = (): number => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  };

  const getTotalProfit = (): number => {
    return cart.reduce((sum, item) => {
      if (item.variantPrice !== undefined && item.variantSellingPrice !== undefined) {
        return sum + ((item.variantSellingPrice - item.variantPrice) * item.quantity);
      }
      const basePrice = item.product.price;
      const priceWithMarkup = getPriceWithMarkup(basePrice, item.product.markupPercent || 0, item.product.id);
      return sum + ((priceWithMarkup - basePrice) * item.quantity);
    }, 0);
  };

  /**
   * 💵 Обработка кассовой продажи
   */
  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert(`❌ ${t.cartEmpty}`);
      return;
    }

    // Проверяем что все товары имеют количество > 0
    const hasInvalidQuantities = cart.some(item => !item.quantity || item.quantity <= 0);
    if (hasInvalidQuantities) {
      alert(`❌ ${t.quantityError}`);
      return;
    }

    // Валидация количества
    const invalidItems = cart.filter(item => item.quantity < 1);
    if (invalidItems.length > 0) {
      const itemsList = invalidItems.map(item => `• ${item.product.name}: ${item.quantity}`).join('\n');
      alert(`❌ ${t.invalidQuantity}\n\n${itemsList}\n\n${t.quantityMustBeGreater}`);
      return;
    }

    // Проверка наличия на складе
    for (const item of cart) {
      if (item.product.quantity < item.quantity) {
        alert(`❌ ${t.notEnoughStock}\n\n${item.product.name}\n${t.required}: ${item.quantity} ${t.pieces}\n${t.available}: ${item.product.quantity} ${t.pieces}`);
        return;
      }
    }

    const totalAmount = getTotalAmount();
    const totalProfit = getTotalProfit();

    if (!confirm(
      `✅ ${t.confirmCheckout}\n\n` +
      `${t.itemsCount}: ${getTotalItems()} ${t.pieces}\n` +
      `${t.totalAmount}: ${formatPrice(totalAmount)}\n` +
      `${t.profit}: ${formatPrice(totalProfit)}\n\n` +
      `${t.itemsWillBeRemoved}`
    )) {
      return;
    }

    setProcessing(true);

    try {
      console.log('💵 [CASH SALE] Starting checkout...');
      
      // Подготовка данных для API (с поддержкой SKU-вариантов)
      const items = cart.map(item => {
        const basePrice = item.variantPrice ?? item.product.price;
        const sellingPrice = item.variantSellingPrice
          ?? getPriceWithMarkup(item.product.price, item.product.markupPercent || 0, item.product.id);
        const imageUrl = item.product.images && item.product.images.length > 0
          ? (getImageUrl(item.product.images[0]) || item.product.images[0])
          : undefined;

        return {
          id: item.product.id,
          product_id: item.product.id,
          variant_id: item.variantId,
          name: item.product.name,
          productName: item.product.name,
          quantity: item.quantity,
          price: basePrice,
          price_with_markup: sellingPrice,
          priceWithMarkup: sellingPrice,
          image_url: imageUrl,
        };
      });

      console.log('💵 [CASH SALE] Items:', items);
      console.log('💵 [CASH SALE] Payment method:', paymentMethod);

      // ✅ Один запрос - создать кассовую продажу
      const result = await api.cashSales.create({
        companyId: companyId,
        items: items,
        paymentMethod: paymentMethod, // 💳 Передаем способ оплаты
        cardSubtype: paymentMethod === 'card' ? cardSubtype : undefined, // 💳 Подтип карты
      });

      console.log('✅ [CASH SALE] Success:', result);

      // Обновляем кэш
      localCache.clear();
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['company-revenue'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      await refetch();

      // Очищаем корзину
      clearCart();

      alert(
        `✅ ${t.saleSuccess}\n\n` +
        `${t.saleId}: #${result.saleId}\n` +
        `${t.itemsCount}: ${result.itemsCount} ${t.pieces}\n` +
        `${t.totalAmount}: ${formatPrice(result.totalAmount)}\n` +
        `${t.profit}: ${formatPrice(result.totalMarkup)}\n\n` +
        `${t.itemsRemoved}\n` +
        `${t.profitAdded}`
      );

    } catch (error) {
      console.error('❌ [CASH SALE] Error:', error);
      
      let errorMessage = `❌ ${t.saleError}\n\n`;
      
      if (error instanceof Error) {
        errorMessage += `${error.message}\n\n`;
      }
      
      errorMessage += t.tryAgainOrContactAdmin;
      
      alert(errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-lg text-gray-600">{t.loadingProducts}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* ========== ПЕРЕКЛЮЧАТЕЛЬ: КАССА / ИСТОРИЯ ПРОДАЖ ========== */}
      <div style={{ background: 'var(--ax-card)', border: '1px solid var(--ax-border)', borderRadius: 14, padding: 6, display: 'flex', gap: 6 }}>
        <button
          onClick={() => setActiveView('pos')}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
            transition: 'all 0.2s', fontSize: 14, fontWeight: 600,
            ...(activeView === 'pos'
              ? { background: 'var(--ax-primary)', color: '#FFFFFF' }
              : { background: 'transparent', color: 'var(--ax-text-2)' })
          }}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>{t.offline}</span>
        </button>
        <button
          onClick={() => setActiveView('history')}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
            transition: 'all 0.2s', fontSize: 14, fontWeight: 600,
            ...(activeView === 'history'
              ? { background: 'var(--ax-primary)', color: '#FFFFFF' }
              : { background: 'transparent', color: 'var(--ax-text-2)' })
          }}
        >
          <Receipt className="w-4 h-4" />
          <span>{t.salesHistory}</span>
        </button>
      </div>

      {/* ========== ИСТОРИЯ ОФЛАЙН-ПРОДАЖ ========== */}
      {activeView === 'history' && (
        <PaymentHistoryForCompany companyId={companyId} />
      )}

      {activeView === 'pos' && (<>
      {/* ========== ПОЛЕ СКАНИРОВАНИЯ (герой) ========== */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        style={{ background: 'linear-gradient(150deg, rgba(124,92,240,0.18), var(--ax-card) 62%)', border: '1px solid rgba(124,92,240,0.3)', borderRadius: 18, padding: 18 }}>
        <div className="flex items-center justify-between mb-3.5" style={{ gap: 12 }}>
          <h2 className="flex items-center gap-2.5 font-bold" style={{ color: 'var(--ax-text)', fontSize: 18 }}>
            <span style={{ width: 36, height: 36, borderRadius: 11, background: 'var(--ax-primary)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingCart className="w-5 h-5" />
            </span>
            {t.offline}
          </h2>
          {cart.length > 0 && (
            <motion.button whileTap={{ scale: 0.95 }} onClick={handleNewOrder}
              className="flex items-center gap-2 font-medium" style={{ padding: '9px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.08)', color: 'var(--ax-text)', border: '1px solid var(--ax-border)', cursor: 'pointer', fontSize: 13 }}>
              <RefreshCw className="w-4 h-4" />
              {t.newOrder}
            </motion.button>
          )}
        </div>

        <div className="flex gap-2.5">
          <div className="flex-1 relative">
            <input
              ref={barcodeInputRef}
              type="text"
              value={searchBarcode}
              onChange={(e) => { setSearchBarcode(e.target.value); setNotFound(false); setLastScannedProduct(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleScan(); } }}
              className="w-full pl-12 pr-4 focus:outline-none"
              style={{ padding: '14px 16px 14px 48px', background: 'var(--ax-input)', color: 'var(--ax-text)', border: '1px solid var(--ax-border)', borderRadius: 12, fontSize: 16, fontWeight: 500 }}
              placeholder={t.scanOrEnter}
              autoFocus
              disabled={processing}
            />
            <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--ax-primary)' }} />
          </div>
          <motion.button whileTap={{ scale: 0.95 }} onClick={handleScan} disabled={processing}
            className="flex items-center gap-2 font-semibold disabled:opacity-50"
            style={{ padding: '0 22px', borderRadius: 12, background: 'linear-gradient(135deg, #7C5CF0, #5B3DD4)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 15, boxShadow: '0 6px 18px rgba(124,92,240,0.4)' }}>
            <Search className="w-5 h-5" />
            {t.search}
          </motion.button>
        </div>

        <p style={{ color: 'var(--ax-text-3)', fontSize: 12.5, marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          💡 {t.scanOrEnter}
        </p>
      </motion.div>

      {/* ========== УВЕДОМЛЕНИЕ: ТОВАР ДОБАВЛЕН ========== */}
      {lastScannedProduct && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3.5"
          style={{ background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.35)', borderRadius: 14, padding: 14 }}>
          <span style={{ background: '#22C55E', color: '#fff', borderRadius: 12, padding: 10, display: 'inline-flex', flexShrink: 0 }}>
            <Package className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <div style={{ color: '#4ADE80', fontWeight: 700, fontSize: 14 }}>✅ {t.barcodeFound}!</div>
            <div style={{ color: 'var(--ax-text)', fontWeight: 500, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {lastScannedProduct.name} — {formatPrice(getPriceWithMarkup(lastScannedProduct.price, lastScannedProduct.markupPercent || 0, lastScannedProduct.id))}
            </div>
          </div>
          <button onClick={() => setLastScannedProduct(null)} style={{ color: '#4ADE80', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
            <X className="w-5 h-5" />
          </button>
        </motion.div>
      )}

      {/* ========== УВЕДОМЛЕНИЕ: ТОВАР НЕ НАЙДЕН ========== */}
      {notFound && (
        <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4 flex items-center gap-4 shadow-md animate-pulse">
          <div className="bg-red-500 text-white rounded-full p-3">
            <X className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="text-red-800 font-semibold text-lg">❌ {t.productNotFound}!</div>
            <div className="text-red-700 font-mono font-medium">{t.search}: {searchBarcode}</div>
          </div>
        </div>
      )}

      {/* ========== КОРЗИНА С ТОВАРАМИ ========== */}
      {cart.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
              {t.cart} ({getTotalItems()} {t.pieces})
            </h3>
            <button
              onClick={() => setCart([])}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-semibold transition-colors shadow-md"
            >
              <Trash2 className="w-5 h-5" />
              {t.clearCart}
            </button>
          </div>

          <div className="space-y-3 mb-6">
            {cart.map((item) => {
              const basePrice = item.variantPrice ?? item.product.price;
              const priceWithMarkup = item.variantSellingPrice
                ?? getPriceWithMarkup(item.product.price, item.product.markupPercent || 0, item.product.id);
              const totalPrice = priceWithMarkup * item.quantity;
              
              // 🆕 Проверка на скидку
              const discount = discounts.find(d => d.productId === item.product.id);
              const originalPrice = basePrice * (1 + (item.product.markupPercent || 0) / 100);

              return (
                <div
                  key={item.product.id}
                  className="border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-300 dark:hover:border-blue-500 transition-colors bg-white dark:bg-gray-800"
                >
                  <div className="flex items-center gap-4">
                    {/* Изображение */}
                    <div className="w-20 h-20 flex-shrink-0">
                      {item.product.images && item.product.images.length > 0 ? (
                        <img
                          src={getImageUrl(item.product.images[0]) || item.product.images[0]}
                          alt={item.product.name}
                          className="w-full h-full object-cover rounded-lg"
                          style={{
                            imageRendering: 'auto',
                            maxWidth: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                          <Package className="w-10 h-10 text-gray-400" />
                        </div>
                      )}
                    </div>

                    {/* Информация */}
                    <div className="flex-1">
                      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{item.product.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">{item.product.barcode || item.product.barid}</div>
                      
                      {/* 🆕 Отображение скидки */}
                      {discount && discount.discountPercent > 0 ? (
                        <div className="mt-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-400 line-through">{formatPrice(originalPrice)}</span>
                            <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                              discount.isAggressive 
                                ? 'bg-red-100 text-red-700' 
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {discount.isAggressive ? '🔥' : '🏷️'} -{discount.discountPercent}%
                            </span>
                          </div>
                          <div className="text-green-600 font-semibold">
                            {formatPrice(priceWithMarkup)} × {item.quantity} = {formatPrice(totalPrice)}
                          </div>
                        </div>
                      ) : (
                        <div className="text-green-600 font-semibold mt-1">
                          {formatPrice(priceWithMarkup)} × {item.quantity} = {formatPrice(totalPrice)}
                        </div>
                      )}
                    </div>

                    {/* Управление */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1, item.variantId)}
                        className="bg-red-100 text-red-600 p-2 rounded-lg hover:bg-red-200 transition-colors"
                      >
                        <Minus className="w-5 h-5" />
                      </button>

                      <input
                        type="text"
                        value={item.quantity === 0 ? '' : item.quantity}
                        onChange={(e) => {
                          const text = e.target.value.trim();
                          if (text === '') {
                            updateQuantity(item.product.id, 0, item.variantId);
                          } else {
                            const val = parseInt(text);
                            if (!isNaN(val) && val >= 0) {
                              updateQuantity(item.product.id, val, item.variantId);
                            }
                          }
                        }}
                        onBlur={(e) => {
                          if (e.target.value.trim() === '' || item.quantity === 0) {
                            updateQuantity(item.product.id, 1, item.variantId);
                          }
                        }}
                        className="w-20 text-center border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg py-2 font-semibold text-lg focus:border-blue-500 focus:outline-none"
                        placeholder="0"
                      />

                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1, item.variantId)}
                        className="bg-green-100 text-green-600 p-2 rounded-lg hover:bg-green-200 transition-colors"
                      >
                        <Plus className="w-5 h-5" />
                      </button>

                      <button
                        onClick={() => removeFromCart(item.product.id, item.variantId)}
                        className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition-colors ml-2"
                        title="Удалить товар"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ========== ИТОГИ ========== */}
          <div className="border-t-2 border-gray-300 dark:border-gray-600 pt-6 space-y-3">
            <div className="flex items-center justify-between text-lg">
              <span className="text-gray-600 dark:text-gray-400 font-medium">{t.itemsCount}:</span>
              <span className="text-gray-900 dark:text-gray-100 font-semibold">{getTotalItems()} {t.pieces}</span>
            </div>
            
            <div className="flex items-center justify-between text-lg">
              <span className="text-gray-600 dark:text-gray-400 font-medium flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                {t.profit}:
              </span>
              <span className="text-green-600 dark:text-green-400 font-semibold">{formatPrice(getTotalProfit())}</span>
            </div>
            
            <div className="flex items-center justify-between pt-3 border-t-2 border-gray-200 dark:border-gray-600">
              <span className="text-2xl font-bold text-gray-800 dark:text-gray-100">{t.totalLabel}:</span>
              <span className="text-4xl font-bold text-blue-600 dark:text-blue-400">{formatPrice(getTotalAmount())}</span>
            </div>
          </div>

          {/* ========== СПОСОБ ОПЛАТЫ ========== */}
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl border-2 border-gray-200 dark:border-gray-600">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              💳 {t.paymentMethodLabel}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`
                  flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all
                  ${paymentMethod === 'cash' 
                    ? 'bg-green-500 text-white shadow-lg scale-105' 
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-2 border-gray-300 dark:border-gray-600 hover:border-green-400'
                  }
                `}
              >
                💵 {t.cash}
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`
                  flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all
                  ${paymentMethod === 'card' 
                    ? 'bg-blue-500 text-white shadow-lg scale-105' 
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-2 border-gray-300 dark:border-gray-600 hover:border-blue-400'
                  }
                `}
              >
                💳 {t.card}
              </button>
            </div>

            {/* 💳 Выбор типа карты */}
            {paymentMethod === 'card' && (
              <div className="mt-3">
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">{t.cardType}:</label>
                <div className="grid grid-cols-4 gap-2">
                  <button type="button" onClick={() => setCardSubtype('humo')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      cardSubtype === 'humo' ? 'bg-green-500 text-white shadow-lg scale-105' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:border-green-400'
                    }`}>🟢 Humo</button>
                  <button type="button" onClick={() => setCardSubtype('uzcard')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      cardSubtype === 'uzcard' ? 'bg-blue-500 text-white shadow-lg scale-105' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:border-blue-400'
                    }`}>🔵 Uzcard</button>
                  <button type="button" onClick={() => setCardSubtype('visa')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      cardSubtype === 'visa' ? 'bg-yellow-500 text-white shadow-lg scale-105' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:border-yellow-400'
                    }`}>🟡 Visa</button>
                  <button type="button" onClick={() => setCardSubtype('other')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      cardSubtype === 'other' ? 'bg-gray-500 text-white shadow-lg scale-105' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:border-gray-400'
                    }`}>⚪ {t.other}</button>
                </div>
              </div>
            )}
          </div>

          {/* ========== КНОПКА ОФОРМЛЕНИЯ ========== */}
          <div className="mt-6">
            <button
              onClick={handleCheckout}
              disabled={processing}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white px-8 py-5 rounded-xl hover:from-green-600 hover:to-green-700 transition-all flex items-center justify-center gap-3 shadow-lg text-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? (
                <>
                  <RefreshCw className="w-6 h-6 animate-spin" />
                  {t.processing}
                </>
              ) : (
                <>
                  <CheckCircle className="w-6 h-6" />
                  ✅ {t.purchased}
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
          style={{ background: 'var(--ax-card)', border: '1px dashed var(--ax-border)', borderRadius: 16, padding: '44px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, minHeight: 220, justifyContent: 'center' }}>
          <span style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--ax-primary-pale)', color: 'var(--ax-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShoppingCart className="w-8 h-8" />
          </span>
          <div>
            <h3 style={{ color: 'var(--ax-text)', fontSize: 16, fontWeight: 600, margin: 0 }}>{t.emptyCart}</h3>
            <p style={{ color: 'var(--ax-text-3)', fontSize: 13, marginTop: 4 }}>{t.scanOrEnter}</p>
          </div>
        </motion.div>
      )}

      {/* ========== СТАТИСТИКА — компактные чипы ========== */}
      <div>
        <h3 style={{ margin: '0 0 10px', color: 'var(--ax-text-2)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t.productStats}</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { icon: <Package size={15} />, label: t.totalProducts, value: products.length, accent: '#7C5CF0' },
            { icon: <Barcode size={15} />, label: t.withBarcode,   value: products.filter((p: Product) => p.barcode && p.barcode.trim()).length, accent: '#22C55E' },
            { icon: <Barcode size={15} />, label: t.withoutBarcode, value: products.filter((p: Product) => !p.barcode || !p.barcode.trim()).length, accent: '#FB923C' },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              style={{ flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', borderRadius: 12, background: 'var(--ax-card)', border: `1px solid ${s.accent}2A` }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, background: `${s.accent}1F`, color: s.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.icon}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ax-text)', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 10.5, color: 'var(--ax-text-3)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      </>)}
    </div>
  );
}
