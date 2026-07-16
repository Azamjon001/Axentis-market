import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Search, Barcode, X, Package, ShoppingCart, Trash2, RefreshCw, Plus, Minus, CheckCircle, Receipt, CreditCard, Banknote, Info, TrendingUp } from 'lucide-react';
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

  // 💰 Прибыль за сегодня (для чипа статистики)
  const [todayProfit, setTodayProfit] = useState(0);
  useEffect(() => {
    loadTodayProfit();
  }, [companyId]);
  const loadTodayProfit = async () => {
    try {
      const salesData = await api.sales.list({ companyId: String(companyId) });
      const sales = Array.isArray(salesData) ? salesData : ((salesData as any)?.sales || []);
      const today = new Date().toDateString();
      setTodayProfit(sales.reduce((sum: number, s: any) => {
        const d = new Date(s.createdAt || s.created_at);
        if (isNaN(d.getTime()) || d.toDateString() !== today) return sum;
        return sum + (parseFloat(s.markupProfit) || parseFloat(s.markup_profit) || 0);
      }, 0));
    } catch { /* нет данных — оставляем 0 */ }
  };

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

      // Очищаем корзину и обновляем прибыль за сегодня
      clearCart();
      loadTodayProfit();

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
      {/* ========== ИСТОРИЯ ОФЛАЙН-ПРОДАЖ ========== */}
      {activeView === 'history' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ color: 'var(--ax-text)', fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>
              {t.salesHistory}
            </h2>
            <motion.button whileTap={{ scale: 0.96 }} onClick={() => setActiveView('pos')}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 11, background: 'var(--ax-card)', color: 'var(--ax-text)', border: '1px solid var(--ax-border)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              <ShoppingCart className="w-4 h-4" style={{ color: 'var(--ax-primary)' }} />
              {language === 'uz' ? 'Kassaga qaytish' : 'Назад к кассе'}
            </motion.button>
          </div>
          <PaymentHistoryForCompany companyId={companyId} />
        </>
      )}

      {activeView === 'pos' && (<>
      {/* ========== ШАПКА: OFFLINE REJIM ========== */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ color: 'var(--ax-text)', fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>
              {language === 'uz' ? 'Offline rejim' : 'Офлайн режим'}
            </h2>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 11px', borderRadius: 999, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ADE80', fontSize: 12, fontWeight: 700 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
              Offline
            </span>
          </div>
          <p style={{ color: 'var(--ax-text-2)', fontSize: 13, margin: '5px 0 0' }}>
            {language === 'uz' ? "Mahsulotlarni skanerlang yoki kod orqali qoʻshing" : 'Сканируйте товары или добавляйте по коду'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => setActiveView('history')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 11, background: 'var(--ax-card)', color: 'var(--ax-text)', border: '1px solid var(--ax-border)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <Receipt className="w-4 h-4" style={{ color: 'var(--ax-text-2)' }} />
            {t.salesHistory}
          </motion.button>
          <motion.button whileTap={{ scale: 0.96 }} onClick={cart.length > 0 ? handleNewOrder : clearCart}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 11, background: 'linear-gradient(135deg, #7C5CF0, #5B3DD4)', color: '#FFFFFF', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, boxShadow: '0 6px 16px rgba(124,92,240,0.35)' }}>
            <Plus className="w-4 h-4" />
            {t.newOrder}
          </motion.button>
        </div>
      </div>

      {/* ========== ПОЛЕ СКАНИРОВАНИЯ (герой) ========== */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        style={{ background: 'var(--ax-card)', border: '1px solid var(--ax-border)', borderRadius: 16, padding: 16 }}>
        <div className="flex gap-2.5">
          <div className="flex-1 relative">
            <input
              ref={barcodeInputRef}
              type="text"
              value={searchBarcode}
              onChange={(e) => { setSearchBarcode(e.target.value); setNotFound(false); setLastScannedProduct(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleScan(); } }}
              className="w-full pl-12 pr-4 focus:outline-none"
              style={{ padding: '14px 16px 14px 48px', background: 'var(--ax-input)', color: 'var(--ax-text)', border: '1px solid var(--ax-border)', borderRadius: 12, fontSize: 15, fontWeight: 500 }}
              placeholder={language === 'uz' ? 'Mahsulotni skanerlang yoki shtrix-kod/nomini kiriting' : 'Сканируйте товар или введите штрих-код/название'}
              autoFocus
              disabled={processing}
            />
            <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--ax-primary)' }} />
          </div>
          <motion.button whileTap={{ scale: 0.95 }} onClick={handleScan} disabled={processing}
            className="flex items-center gap-2 font-semibold disabled:opacity-50"
            style={{ padding: '0 24px', borderRadius: 12, background: 'linear-gradient(135deg, #7C5CF0, #5B3DD4)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14.5, boxShadow: '0 6px 18px rgba(124,92,240,0.4)' }}>
            <Search className="w-4 h-4" />
            {language === 'uz' ? 'Qidiruv' : 'Поиск'}
          </motion.button>
        </div>
      </motion.div>

      {/* ========== УВЕДОМЛЕНИЕ: ТОВАР ДОБАВЛЕН ========== */}
      {lastScannedProduct && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3.5"
          style={{ background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 14, padding: '14px 16px' }}>
          <span style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid #22C55E', color: '#22C55E', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CheckCircle className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <div style={{ color: '#4ADE80', fontWeight: 700, fontSize: 14 }}>
              {language === 'uz' ? "Sotuvga qoʻshildi" : 'Добавлено в продажу'}
            </div>
            <div style={{ color: 'var(--ax-text)', fontWeight: 500, fontSize: 13.5, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {lastScannedProduct.name} — {formatPrice(getPriceWithMarkup(lastScannedProduct.price, lastScannedProduct.markupPercent || 0, lastScannedProduct.id))}
            </div>
          </div>
          <button onClick={() => setLastScannedProduct(null)} style={{ color: '#4ADE80', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 4 }} aria-label="close">
            <X className="w-5 h-5" />
          </button>
        </motion.div>
      )}

      {/* ========== УВЕДОМЛЕНИЕ: ТОВАР НЕ НАЙДЕН ========== */}
      {notFound && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3.5"
          style={{ background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 14, padding: '14px 16px' }}>
          <span style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid #F87171', color: '#F87171', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <X className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <div style={{ color: '#F87171', fontWeight: 700, fontSize: 14 }}>{t.productNotFound}</div>
            <div style={{ color: 'var(--ax-text-2)', fontSize: 13, marginTop: 2, fontFamily: 'monospace' }}>{t.search}: {searchBarcode}</div>
          </div>
        </motion.div>
      )}

      {/* ========== КОРЗИНА + ОПЛАТА (две колонки) ========== */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'stretch' }}>

        {/* ── Левая колонка: корзина ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          style={{ flex: '1.2 1 400px', minWidth: 0, background: 'var(--ax-card)', border: '1px solid var(--ax-border)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'var(--ax-text)', fontSize: 16, fontWeight: 700, margin: 0 }}>
              <ShoppingCart className="w-5 h-5" style={{ color: 'var(--ax-text-2)' }} />
              {t.cart} ({getTotalItems()} {t.pieces})
            </h3>
            {cart.length > 0 && (
              <button
                onClick={() => setCart([])}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#F87171', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 4 }}
              >
                <Trash2 className="w-4 h-4" />
                {language === 'uz' ? 'Savatni tozalash' : 'Очистить корзину'}
              </button>
            )}
          </div>

          {/* Товары в корзине */}
          {cart.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {cart.map((item) => {
                const basePrice = item.variantPrice ?? item.product.price;
                const priceWithMarkup = item.variantSellingPrice
                  ?? getPriceWithMarkup(item.product.price, item.product.markupPercent || 0, item.product.id);

                // 🆕 Проверка на скидку
                const discount = discounts.find(d => d.productId === item.product.id);
                const originalPrice = basePrice * (1 + (item.product.markupPercent || 0) / 100);

                return (
                  <div
                    key={`${item.product.id}-${item.variantId ?? 'base'}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 4px', borderBottom: '1px solid var(--ax-border)', flexWrap: 'wrap' }}
                  >
                    {/* Изображение */}
                    <div style={{ width: 58, height: 58, flexShrink: 0, borderRadius: 12, overflow: 'hidden', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {item.product.images && item.product.images.length > 0 ? (
                        <img
                          src={getImageUrl(item.product.images[0]) || item.product.images[0]}
                          alt={item.product.name}
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          loading="lazy"
                        />
                      ) : (
                        <Package className="w-7 h-7" style={{ color: '#5A5A78' }} />
                      )}
                    </div>

                    {/* Информация */}
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div style={{ color: 'var(--ax-text)', fontSize: 14.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product.name}</div>
                      {discount && discount.discountPercent > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                          <span style={{ color: 'var(--ax-text-3)', fontSize: 12, textDecoration: 'line-through' }}>{formatPrice(originalPrice)}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: discount.isAggressive ? 'rgba(248,113,113,0.15)' : 'rgba(56,189,248,0.15)', color: discount.isAggressive ? '#F87171' : '#38BDF8' }}>
                            −{discount.discountPercent}%
                          </span>
                          <span style={{ color: 'var(--ax-primary)', fontSize: 14, fontWeight: 700 }}>{formatPrice(priceWithMarkup)}</span>
                        </div>
                      ) : (
                        <div style={{ color: 'var(--ax-primary)', fontSize: 14, fontWeight: 700, marginTop: 3 }}>
                          {formatPrice(priceWithMarkup)}
                        </div>
                      )}
                    </div>

                    {/* Управление количеством */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1, item.variantId)}
                        aria-label="minus"
                        style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--ax-input)', border: '1px solid var(--ax-border)', color: 'var(--ax-text)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Minus className="w-4 h-4" />
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
                        style={{ width: 44, height: 36, textAlign: 'center', background: 'var(--ax-input)', border: '1px solid var(--ax-border)', borderRadius: 10, color: 'var(--ax-text)', fontSize: 14.5, fontWeight: 700, outline: 'none' }}
                        placeholder="0"
                      />
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1, item.variantId)}
                        aria-label="plus"
                        style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--ax-primary)', border: 'none', color: '#FFFFFF', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeFromCart(item.product.id, item.variantId)}
                        title={language === 'uz' ? "Oʻchirish" : 'Удалить товар'}
                        style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', color: '#F87171', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ flex: 1, border: '1px dashed var(--ax-border)', borderRadius: 14, padding: '36px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 180, marginBottom: 16 }}>
              <span style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--ax-primary-pale)', color: 'var(--ax-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShoppingCart className="w-7 h-7" />
              </span>
              <div>
                <h4 style={{ color: 'var(--ax-text)', fontSize: 15, fontWeight: 600, margin: 0 }}>{t.emptyCart}</h4>
                <p style={{ color: 'var(--ax-text-3)', fontSize: 12.5, marginTop: 4 }}>{t.scanOrEnter}</p>
              </div>
            </div>
          )}

          {/* Итоги корзины */}
          <div style={{ marginTop: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--ax-border)' }}>
              <span style={{ color: 'var(--ax-text-2)', fontSize: 13.5 }}>{language === 'uz' ? 'Mahsulotlar' : 'Товаров'}</span>
              <span style={{ color: 'var(--ax-text)', fontSize: 14, fontWeight: 700 }}>{getTotalItems()} {language === 'uz' ? 'dona' : 'шт'}</span>
            </div>
            {getTotalProfit() > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0 10px' }}>
                <span style={{ color: 'var(--ax-text-2)', fontSize: 13.5 }}>{t.profit}</span>
                <span style={{ color: '#22C55E', fontSize: 14, fontWeight: 700 }}>+{formatPrice(getTotalProfit())}</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--ax-border)' }}>
              <span style={{ color: 'var(--ax-text)', fontSize: 17, fontWeight: 800 }}>{language === 'uz' ? 'Jami summa' : 'Итого'}</span>
              <span style={{ color: 'var(--ax-primary)', fontSize: 24, fontWeight: 800 }}>{formatPrice(getTotalAmount())}</span>
            </div>
          </div>
        </motion.div>

        {/* ── Правая колонка: способ оплаты ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26, delay: 0.06 }}
          style={{ flex: '1 1 300px', minWidth: 0, background: 'var(--ax-card)', border: '1px solid var(--ax-border)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'var(--ax-text)', fontSize: 16, fontWeight: 700, margin: 0 }}>
            <CreditCard className="w-5 h-5" style={{ color: 'var(--ax-text-2)' }} />
            {language === 'uz' ? "Toʻlov usuli" : 'Способ оплаты'}
          </h3>

          {/* Наличные / Карта */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {([
              { key: 'cash' as const, icon: <Banknote className="w-5 h-5" />, label: language === 'uz' ? 'Naqd' : 'Наличные' },
              { key: 'card' as const, icon: <CreditCard className="w-5 h-5" />, label: language === 'uz' ? 'Karta' : 'Карта' },
            ]).map(m => {
              const on = paymentMethod === m.key;
              return (
                <motion.button
                  key={m.key}
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setPaymentMethod(m.key)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '18px 10px', borderRadius: 13, cursor: 'pointer', fontSize: 14, fontWeight: 700,
                    background: on ? 'var(--ax-primary-pale)' : 'var(--ax-input)',
                    border: on ? '1.5px solid var(--ax-primary)' : '1px solid var(--ax-border)',
                    color: on ? 'var(--ax-primary)' : 'var(--ax-text-2)',
                    transition: 'all 0.15s',
                  }}
                >
                  {m.icon}
                  {m.label}
                </motion.button>
              );
            })}
          </div>

          {/* Тип карты */}
          <div style={{ opacity: paymentMethod === 'card' ? 1 : 0.45, pointerEvents: paymentMethod === 'card' ? 'auto' : 'none', transition: 'opacity 0.2s' }}>
            <label style={{ display: 'block', fontSize: 12.5, color: 'var(--ax-text-2)', marginBottom: 8 }}>
              {language === 'uz' ? 'Karta turi' : 'Тип карты'}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {([
                { key: 'humo' as const,   label: 'Humo',      dot: '#22C55E' },
                { key: 'uzcard' as const, label: 'Uzcard',    dot: '#38BDF8' },
                { key: 'visa' as const,   label: 'Visa',      dot: '#FBBF24' },
                { key: 'other' as const,  label: language === 'uz' ? 'Boshqalar' : 'Другие', dot: '#E2E8F0' },
              ]).map(c => {
                const on = cardSubtype === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setCardSubtype(c.key)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '11px 8px', borderRadius: 11, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                      background: on ? 'var(--ax-primary-pale)' : 'var(--ax-input)',
                      border: on ? '1.5px solid var(--ax-primary)' : '1px solid var(--ax-border)',
                      color: on ? 'var(--ax-primary)' : 'var(--ax-text-2)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Инфобокс */}
          <div style={{ background: 'var(--ax-input)', border: '1px solid var(--ax-border)', borderRadius: 13, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Info className="w-4 h-4" style={{ color: 'var(--ax-primary)', flexShrink: 0 }} />
              <span style={{ color: 'var(--ax-text)', fontSize: 13.5, fontWeight: 700 }}>
                {language === 'uz' ? "Maʼlumot" : 'Информация'}
              </span>
            </div>
            <p style={{ color: 'var(--ax-text-2)', fontSize: 12.5, lineHeight: 1.55, margin: 0 }}>
              {language === 'uz'
                ? "Savdo yakunlangach tovarlar ombordan avtomatik ayriladi, foyda esa hisobotga qoʻshiladi."
                : 'После завершения продажи товары автоматически списываются со склада, а прибыль попадает в аналитику.'}
            </p>
          </div>

          {/* Кнопка оформления */}
          <motion.button
            whileTap={{ scale: cart.length > 0 ? 0.97 : 1 }}
            onClick={handleCheckout}
            disabled={processing || cart.length === 0}
            style={{
              marginTop: 'auto',
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '16px 0', borderRadius: 14, border: 'none',
              cursor: processing || cart.length === 0 ? 'not-allowed' : 'pointer',
              background: cart.length > 0 ? 'linear-gradient(135deg, #8B6CF5, #6D48E5)' : 'var(--ax-input)',
              color: cart.length > 0 ? '#FFFFFF' : 'var(--ax-text-3)',
              fontSize: 16.5, fontWeight: 800,
              boxShadow: cart.length > 0 ? '0 10px 26px rgba(124,92,240,0.4)' : 'none',
              opacity: processing ? 0.7 : 1,
            }}
          >
            {processing ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                {t.processing}
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                {language === 'uz' ? 'Sotib olindi' : 'Продано'}
              </>
            )}
          </motion.button>
        </motion.div>
      </div>

      {/* ========== СТАТИСТИКА ТОВАРОВ ========== */}
      <div style={{ background: 'var(--ax-card)', border: '1px solid var(--ax-border)', borderRadius: 16, padding: '16px 18px' }}>
        <h3 style={{ margin: '0 0 12px', color: 'var(--ax-text-2)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {language === 'uz' ? 'Mahsulotlar statistikasi' : 'Статистика товаров'}
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          {[
            { icon: <Package size={16} />,    label: language === 'uz' ? 'Jami mahsulotlar' : 'Всего товаров', value: `${products.length}`, accent: '#7C5CF0' },
            { icon: <Barcode size={16} />,    label: language === 'uz' ? 'Shtrix-kodli' : 'Со штрих-кодом',   value: `${products.filter((p: Product) => p.barcode && p.barcode.trim()).length}`, accent: '#22C55E' },
            { icon: <Package size={16} />,    label: language === 'uz' ? 'Shtrix-kodsiz' : 'Без штрих-кода',  value: `${products.filter((p: Product) => !p.barcode || !p.barcode.trim()).length}`, accent: '#FB923C' },
            { icon: <TrendingUp size={16} />, label: language === 'uz' ? 'Bugungi foyda' : 'Прибыль за сегодня', value: `+${formatPrice(todayProfit)}`, accent: '#38BDF8', small: true },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 13px', borderRadius: 13, background: 'var(--ax-input)', border: `1px solid ${s.accent}26` }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: `${s.accent}1F`, color: s.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.icon}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: (s as any).small ? 14 : 18, fontWeight: 800, color: s.accent, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--ax-text-3)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      </>)}
    </div>
  );
}
