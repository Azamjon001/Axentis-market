import api, { saveUserCart, saveUserLikes, getUserCart, getUserLikes, getImageUrl } from '../utils/api';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import DeliveryLocationPicker from './DeliveryLocationPicker';
import { ShoppingCart, Search, Minus, Plus, Trash2, Check, Receipt, Clock, X, Heart, Camera, BadgeCheck, Menu, Moon, Sun, ShoppingBag, RotateCcw, Truck, Bell, Store } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import CartItemImage from './CartItemImage';
import HitCompanies from './HitCompanies';
import BottomNavigation from './BottomNavigation';
import LoadingAnimation from './LoadingAnimation'; // 🎨 Анимация загрузки
import CompanyProfile from './CompanyProfile'; // 🏢 НОВОЕ: Профиль компании
import CompanyProfilePage from './CompanyProfilePage'; // 🏢 НОВОЕ: Полная страница профиля компании
import UserProfilePage from './UserProfilePage'; // 👤 НОВОЕ: Профиль пользователя
import ApprovedAdsBanner from './ApprovedAdsBanner'; // 📢 Баннер утвержденных реклам
import ProductCard from './ProductCard'; // 🖼️ НОВОЕ: Карточка товара с автоматическим листанием фото
import ProductDetails from './ProductDetails'; // 📄 НОВОЕ: Страница деталей товара
import CatalogPanel from './CatalogPanel'; // 📂 НОВОЕ: Панель каталога
import NotificationsPage from './NotificationsPage'; // 🔔 Уведомления покупателя
import { CategoryNameIcon } from './CategoryIcon'; // 📂 Векторные иконки категорий
import AnimatedCartButton from './AnimatedCartButton'; // 🛒 Анимированная кнопка
import { useProductUpdates } from '../utils/socket'; // 🔥 Socket.io Realtime

import PaymentPage from './PaymentPage';
import DemoPaymentPage from './DemoPaymentPage';
import { 
  getCachedProducts, 
  setCachedProducts,
  shouldRefreshProducts,
  uploadAllDataToRAM,
  isRAMUploadCompleted
} from '../utils/localStorageCache'; // 🚀 НОВЫЙ ЛОКАЛЬНЫЙ КЭШ БРАУЗЕРА!
import { useCustomerOrdersRealtime } from '../utils/realtimeCache'; // 🛒 REALTIME для заказов
import type { DisplayMode } from './SettingsPage';
import { getUzbekistanISOString, formatUzbekistanFullDateTime } from '../utils/uzbekTime';

// 🌦️ Weather types
export type WeatherType = 'sunny' | 'rain' | 'snow' | 'storm';

const UZ_REGIONS = [
  "Barcha viloyatlar",
  "Toshkent shahri",
  "Toshkent viloyati",
  "Andijon viloyati",
  "Namangan viloyati",
  "Farg'ona viloyati",
  "Sirdaryo viloyati",
  "Jizzax viloyati",
  "Samarqand viloyati",
  "Qashqadaryo viloyati",
  "Surxondaryo viloyati",
  "Navoiy viloyati",
  "Buxoro viloyati",
  "Xorazm viloyati",
  "Qoraqalpog'iston Res.",
];

const DEMO_BANNERS = [
  { title: "Chegirmalar 40% gacha", subtitle: "Elektronika bo'limida", bg: "linear-gradient(135deg,#6c3fc7,#3a1b7a)", emoji: "📱" },
  { title: "Yangi kolleksiya", subtitle: "Kiyim-kechak bo'limida", bg: "linear-gradient(135deg,#6D5DFB,#5546E0)", emoji: "👗" },
  { title: "Tez yetkazib berish", subtitle: "Bugun buyurtma — ertaga qo'lingizda", bg: "linear-gradient(135deg,#1a6fb5,#0d3566)", emoji: "🚀" },
  { title: "Sport tovarlari", subtitle: "Sport va faol hayot uchun", bg: "linear-gradient(135deg,#1a9c6b,#0a5940)", emoji: "⚽" },
];

interface Product {
  id: number;
  name: string;
  quantity: number;
  price: number;
  markupPercent?: number;
  markupAmount?: number; // 💰 НОВОЕ: Сумма наценки в деньгах
  sellingPrice?: number; // 💰 НОВОЕ: Цена продажи с наценкой
  availableForCustomers?: boolean;
  images?: string[]; // 📸 Массив путей к изображениям товара
  category?: string; // 📂 Категория товара
  barcode?: string; // 📊 Штрих-код товара
  company_id?: number; // 🏢 НОВОЕ: ID компании
  company_name?: string; // 🏢 НОВОЕ: Название компании
}

interface HomePageProps {
  onLogout: () => void;
  userName?: string;
  userPhone?: string;
  userCompanyId?: string; // 🔒 НОВОЕ: ID компании покупателя (приватный режим)
  userMode?: 'public' | 'private'; // 🔒 НОВОЕ: Режим пользователя (public/private)
  onOpenSettings: () => void;
  onNavigateTo?: (page: 'likes') => void;
  onLikesChange?: (likedProductIds: number[]) => void;
  likedProductIds?: number[];
  setLikedProductIds?: (ids: number[] | ((prev: number[]) => number[])) => void;
  cart?: { [key: number]: number };
  setCart?: (cart: { [key: number]: number } | ((prev: { [key: number]: number }) => { [key: number]: number })) => void;
  selectedColors?: { [key: number]: string }; // 🎨 Выбранные цвета для товаров
  setSelectedColors?: (colors: { [key: number]: string } | ((prev: { [key: number]: string }) => { [key: number]: string })) => void;
}

export default function HomePage({ onLogout, userName, userPhone, userCompanyId, userMode, onOpenSettings, onNavigateTo, onLikesChange, likedProductIds = [], setLikedProductIds, cart: externalCart, setCart: externalSetCart, selectedColors: externalSelectedColors, setSelectedColors: externalSetSelectedColors }: HomePageProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]); // 🏷️ Approved discounts
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [internalCart, setInternalCart] = useState<{ [key: number]: number }>({});
  const [internalSelectedColors, setInternalSelectedColors] = useState<{ [key: number]: string }>({});
  const [selectedSizes, setSelectedSizes] = useState<{ [key: number]: string }>({});
  const [variantStocks, setVariantStocks] = useState<{ [key: number]: number }>({});

  const cart = externalCart !== undefined ? externalCart : internalCart;
  const selectedColors = externalSelectedColors !== undefined ? externalSelectedColors : internalSelectedColors;
  const setSelectedColors = externalSetSelectedColors !== undefined ? externalSetSelectedColors : setInternalSelectedColors;
  const setCart = externalSetCart !== undefined ? externalSetCart : setInternalCart;
  const [showCart, setShowCart] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCatalog, setShowCatalog] = useState(false); // 📂 State for catalog panel
  
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'manual_check' | 'demo_online' | 'real_online'>('manual_check');
  
  const [isUploadingRAM, setIsUploadingRAM] = useState(false); 
  const [uploadProgress, setUploadProgress] = useState({ step: '', progress: 0 }); 
  const [loadingMore, setLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false); 
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const PRODUCTS_PER_PAGE = 50;
  
  const [showOrderConfirmation, setShowOrderConfirmation] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<{ 
    code: string; 
    total: number; 
    itemsCount: number;
    items?: Array<{ name: string; quantity: number; price: number; total: number; color?: string }>;
  } | null>(null);
  const [myOrders, setMyOrders] = useState<Array<{
    code: string;
    total: number;
    itemsCount: number;
    date: string;
    items: Array<{ name: string; quantity: number; price: number; total: number; color?: string }>;
    status?: string; 
    orderId?: number; 
  }>>(() => {
    const saved = localStorage.getItem('myOrders');
    return saved ? JSON.parse(saved) : [];
  });

  const [hiddenReceiptCodes, setHiddenReceiptCodes] = useState<string[]>(() => {
    const saved = localStorage.getItem(`hiddenReceipts_${userPhone}`);
    return saved ? JSON.parse(saved) : [];
  });
  
  const [receiptsTab, setReceiptsTab] = useState<'pending' | 'history'>(() => {
    return (localStorage.getItem('receiptsTab') as 'pending' | 'history') || 'pending';
  });

  const [viewingImage, setViewingImage] = useState<{ url: string; name: string } | null>(null);
  const [viewingImageIndex, setViewingImageIndex] = useState(0); 
  
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null); // 📄 Для открытия панели товара
  const [showNotifications, setShowNotifications] = useState(false); // 🔔 Экран уведомлений
  const [unreadNotifs, setUnreadNotifs] = useState(0); // 🔔 Кол-во непрочитанных

  const [viewingCompanyId, setViewingCompanyId] = useState<number | null>(null);
  const [viewingUserProfile, setViewingUserProfile] = useState<{ phone: string; name: string } | null>(null);
  const [highlightedProductId, setHighlightedProductId] = useState<number | null>(null); 
  
  const [likeAnimation, setLikeAnimation] = useState<{ productId: number; isLiked: boolean } | null>(null);
  
  const [isTogglingLike, setIsTogglingLike] = useState(false);
  
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
    return (localStorage.getItem('displayMode') as DisplayMode) || 'day';
  });
  
  const [weather, setWeather] = useState<WeatherType>(() => {
    const weathers: WeatherType[] = ['sunny', 'rain', 'snow', 'storm'];
    return weathers[Math.floor(Math.random() * weathers.length)];
  });

  const [weatherEnabled, setWeatherEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('weatherEnabled');
    return saved === null ? true : saved === 'true';
  });

  const [colorAnimationEnabled, setColorAnimationEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('colorAnimationEnabled');
    return saved === null ? true : saved === 'true';
  });

  const [selectedRegion, setSelectedRegion] = useState<string>(() => {
    return localStorage.getItem('selectedRegion') || "Barcha viloyatlar";
  });
  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const [bannerIndex, setBannerIndex] = useState(0);

  const [cartTab, setCartTab] = useState<'cart' | 'orders'>('cart');

  // Checkout flow state
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'delivery' | 'payment'>('cart');
  // Самовывоз отключён — заказы оформляются только с доставкой курьером.
  const [checkoutDeliveryType] = useState<'pickup' | 'delivery'>('delivery');
  const [checkoutDeliveryAddress, setCheckoutDeliveryAddress] = useState('');
  const [checkoutDeliveryCoords, setCheckoutDeliveryCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [savedPaymentCards, setSavedPaymentCards] = useState<any[]>([]);
  // 🎟️ Promo code + ⭐ loyalty points at checkout
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{ id: number; code: string; discount: number } | null>(null);
  const [promoChecking, setPromoChecking] = useState(false);
  const [loyaltyBalance, setLoyaltyBalance] = useState(0);
  const [usePoints, setUsePoints] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [showAddCardForm, setShowAddCardForm] = useState(false);
  const [newCard, setNewCard] = useState({ number: '', expiry: '', firstName: '', lastName: '', cvc: '', type: '' });
  const [savingCard, setSavingCard] = useState(false);

  const detectCardType = (num: string): string => {
    const prefix4 = num.slice(0, 4);
    if (prefix4 === '9860') return 'humo';
    if (prefix4 === '8600') return 'uzcard';
    if (num[0] === '4') return 'visa';
    if (num[0] === '5') return 'mastercard';
    return '';
  };

  const loadSavedCards = async () => {
    if (!userPhone) return;
    try {
      const res = await fetch(`/api/payment-cards/${userPhone}`);
      if (res.ok) {
        const data = await res.json();
        setSavedPaymentCards(Array.isArray(data) ? data : []);
        if (Array.isArray(data) && data.length > 0) {
          const defaultCard = data.find((c: any) => c.is_default) || data[0];
          setSelectedCardId(defaultCard.id);
        }
      }
    } catch {}
  };

  const handleSaveNewCard = async () => {
    if (!userPhone || !newCard.number || !newCard.firstName || !newCard.lastName) return;
    setSavingCard(true);
    try {
      const cardType = detectCardType(newCard.number) || newCard.type;
      const res = await fetch('/api/payment-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPhone,
          cardNumber: newCard.number.replace(/\s/g, ''),
          cardExpiry: newCard.expiry,
          cardHolderFirstName: newCard.firstName,
          cardHolderLastName: newCard.lastName,
          cardType,
          isDefault: savedPaymentCards.length === 0
        })
      });
      if (res.ok) {
        await loadSavedCards();
        setShowAddCardForm(false);
        setNewCard({ number: '', expiry: '', firstName: '', lastName: '', cvc: '', type: '' });
      }
    } catch {} finally {
      setSavingCard(false);
    }
  };

  // 🔗 Открыть товар по ID (для deep-link вида #product-123, как делится
  // приложение Homepage). Дотягиваем товар с бэкенда и нормализуем картинки.
  const openProductById = async (id: number) => {
    try {
      const p: any = await api.products.get(String(id));
      if (!p || !p.id) return;
      const normalized: any = {
        ...p,
        company_id: p.company_id ?? p.companyId,
        images: Array.isArray(p.images)
          ? p.images.map((im: any) => (typeof im === 'string' ? { url: getImageUrl(im) || im } : im))
          : [],
      };
      setSelectedProduct(normalized);
      window.history.replaceState({ view: 'product', product: normalized, page: 'home' }, '', `#product-${id}`);
    } catch (error) {
      console.error('❌ [DeepLink] Не удалось открыть товар по ссылке:', error);
    }
  };

  // 📱 Если ссылку на товар/магазин открыли на телефоне — пробуем открыть
  // нативное приложение (axentis://…). Если приложение не установлено, ничего
  // не происходит и пользователь остаётся на сайте (запасной вариант).
  // Когда появится страница в Play Market — сюда добавим редирект на установку.
  const tryOpenInApp = (appPath: string) => {
    try {
      const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
      if (!isMobile) return;
      // Пробуем один раз за сессию, чтобы не дёргать пользователя при каждой навигации
      const flag = `ax_app_try_${appPath}`;
      if (sessionStorage.getItem(flag)) return;
      sessionStorage.setItem(flag, '1');
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = `axentis://${appPath}`;
      document.body.appendChild(iframe);
      setTimeout(() => { try { document.body.removeChild(iframe); } catch { /* ignore */ } }, 1500);
    } catch { /* ignore */ }
  };

  // 🔔 Подгружаем число непрочитанных уведомлений (и обновляем при закрытии экрана)
  useEffect(() => {
    if (!userPhone) { setUnreadNotifs(0); return; }
    let active = true;
    (async () => {
      try {
        const r: any = await api.notifications.unreadCount(userPhone);
        if (active) setUnreadNotifs(typeof r === 'number' ? r : (r?.count ?? r?.unread ?? 0));
      } catch { /* ignore */ }
    })();
    return () => { active = false; };
  }, [userPhone, showNotifications]);

  // 🔄 HISTORY API HANDLER
  useEffect(() => {
    // 🔗 Deep-link: если зашли по ссылке на конкретный товар/компанию
    // (например, https://axentis.uz/#product-123), открываем именно их,
    // а не сбрасываем на главную.
    const initialHash = window.location.hash || '';
    const productMatch = initialHash.match(/^#product-(\d+)/);
    const companyMatch = initialHash.match(/^#company-(\d+)/);
    if (productMatch) {
      tryOpenInApp(`product/${productMatch[1]}`);
      openProductById(Number(productMatch[1]));
    } else if (companyMatch) {
      const cid = Number(companyMatch[1]);
      tryOpenInApp(`company/${cid}`);
      setViewingCompanyId(cid);
      window.history.replaceState({ view: 'company', id: cid, page: 'home' }, '', `#company-${cid}`);
    } else {
      // Initial state - preserve page: 'home' context
      const currentState = window.history.state || {};
      window.history.replaceState({ ...currentState, view: 'home', page: 'home' }, '', '#home');
    }

    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      // Если стейта нет или view=home, сбрасываем всё
      if (!state || state.view === 'home') {
        setShowCart(false);
        setViewingCompanyId(null);
        setSelectedProduct(null);
        setShowCatalog(false);
        return;
      }

      if (state.view === 'cart') {
        setShowCart(true);
        setViewingCompanyId(null);
        setSelectedProduct(null);
        setShowCatalog(false);
      } else if (state.view === 'company') {
        setViewingCompanyId(state.id);
        setShowCart(false);
        setSelectedProduct(null);
        setShowCatalog(false);
      } else if (state.view === 'product') {
        setSelectedProduct(state.product);
        setShowCart(false);
        setViewingCompanyId(null);
        setShowCatalog(false);
      } else if (state.view === 'catalog') {
        setShowCatalog(true);
        setShowCart(false);
        setViewingCompanyId(null);
        setSelectedProduct(null);
        setViewingUserProfile(null);
      } else if (state.view === 'user-profile') {
        setViewingUserProfile({ phone: state.phone, name: state.name });
        setShowCatalog(false);
        setShowCart(false);
        setViewingCompanyId(null);
        setSelectedProduct(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Navigation Helpers
  const handleOpenCart = () => {
    if (showCart) return;
    window.history.pushState({ view: 'cart', page: 'home' }, '', '#cart');
    setShowCart(true);
    setCheckoutStep('cart');
    window.scrollTo(0, 0);
  };

  const handleCloseCart = () => {
    if (!showCart) return;
    
    // Check if current history state matches cart view
    // If we are in 'cart' state, go back. 
    // If not (state desync), just close the modal manually.
    if (window.history.state?.view === 'cart') {
      window.history.back();
    } else {
      console.warn('⚠️ History state desync in cart close. Closing manually.');
      setShowCart(false);
      // Clean up URL if needed
      if (window.location.hash === '#cart') {
         window.history.replaceState({ view: 'home', page: 'home' }, '', '#home');
      }
    }
  };
  
  const handleOpenCatalog = () => {
    if (showCatalog) return;
    window.history.pushState({ view: 'catalog', page: 'home' }, '', '#catalog');
    setShowCatalog(true);
  };

  const handleCloseCatalog = () => {
    if (!showCatalog) return;
    window.history.back();
  };
  
  const handleOpenProduct = (product: Product) => {
    window.history.pushState({ view: 'product', product, page: 'home' }, '', `#product-${product.id}`);
    setSelectedProduct(product);
  };
  
  const handleCloseProduct = () => {
    window.history.back();
  };
  
  const handleOpenCompany = (companyId: number) => {
    window.history.pushState({ view: 'company', id: companyId, page: 'home' }, '', `#company-${companyId}`);
    setViewingCompanyId(companyId);
    setSelectedProduct(null); // Close product to show company profile
    setShowCart(false);
  };
  
  const handleCloseCompany = () => {
    window.history.back();
  };

  const handleOpenUserProfile = (phone: string, name: string) => {
    window.history.pushState({ view: 'user-profile', phone, name, page: 'home' }, '', `#user-${phone}`);
    setViewingUserProfile({ phone, name });
    setSelectedProduct(null); // Close product to show user profile
    setViewingCompanyId(null);
    setShowCart(false);
  };

  const handleCloseUserProfile = () => {
    window.history.back();
  };

  const searchTimeoutRef = useRef<number | null>(null);

  // onLikesChange notifier (no debounce needed — each action calls backend directly)
  useEffect(() => {
    if (onLikesChange) onLikesChange(likedProductIds);
  }, [likedProductIds, onLikesChange]);

  useEffect(() => {
    localStorage.setItem('myOrders', JSON.stringify(myOrders));
  }, [myOrders]);

  const { shouldRefresh: ordersRefreshTrigger } = useCustomerOrdersRealtime(userPhone);

  useEffect(() => {
    const interval = setInterval(() => {
      setBannerIndex(prev => (prev + 1) % DEMO_BANNERS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadUserData = async () => {
      if (userPhone) {
        try {
          // Cart is now loaded once at App level (initializeApp). Skip re-loading here to avoid race conditions.
          console.log('ℹ️ [Cart Sync] Cart managed at App level, skipping re-load from backend.');
          
          // 📦 Заказы загружаются из localStorage
          const savedOrdersLocal = localStorage.getItem('myOrders');
          if (savedOrdersLocal) {
            try {
              const parsedOrders = JSON.parse(savedOrdersLocal);
              if (parsedOrders && parsedOrders.length > 0) {
                console.log('✅ [Orders Sync] Orders loaded from localStorage:', parsedOrders.length, 'orders');
                const hiddenCodes = JSON.parse(localStorage.getItem(`hiddenReceipts_${userPhone}`) || '[]');
                const visibleOrders = parsedOrders.filter((order: any) => !hiddenCodes.includes(order.code));
                setMyOrders(visibleOrders);
              }
            } catch (e) {
              console.error('❌ Error parsing orders:', e);
            }
          }
        } catch (error) {
          console.error('❌ [Sync] Failed to load user data from backend:', error);
        }
      }
    };
    
    loadUserData();
  }, [userPhone, ordersRefreshTrigger]);

  useEffect(() => {
    const initRAM = async () => {
      if (!isRAMUploadCompleted()) {
        console.log('🚀 [HomePage] Первый вход! Начинаем предзагрузку данных в RAM...');
        setIsUploadingRAM(true);
        
        try {
          await uploadAllDataToRAM((step, progress) => {
            setUploadProgress({ step, progress });
          });
          console.log('✅ [HomePage] Предзагрузка завершена!');
        } catch (error) {
          console.error('❌ [HomePage] Ошибка предзагрузки:', error);
        } finally {
          setIsUploadingRAM(false);
        }
      } else {
        console.log('✅ [HomePage] Данные уже в RAM, предзагрзка не требуется');
      }
    };
    
    initRAM();
  }, []); 

  useEffect(() => {
    console.log('🔄 [HomePage] useEffect triggered with userCompanyId:', userCompanyId);
    
    // Безопасная загрузка с try/catch
    const safeLoad = async () => {
      try {
        await loadProducts(true);
        await loadDiscounts(); // 🏷️ Load discounts
      } catch (error) {
        console.error('❌ [HomePage] Error in initial loadProducts:', error);
        // Попробуем загрузить из кэша при ошибке
        const cached = getCachedProducts();
        if (cached && cached.length > 0) {
          const filtered = cached.filter((p: Product) => 
            p.quantity > 0 && p.availableForCustomers === true
          );
          setProducts(filtered);
        }
        setLoading(false);
      }
    };
    
    safeLoad();
    
    const interval = setInterval(() => {
      console.log('🔄 [HomePage] Auto-refresh products (every 5 min)');
      loadProducts(true); 
    }, 5 * 60 * 1000); 
    
    const handleProductsUpdate = () => {
      console.log('🔔 [HomePage] Получено уведомление об обновлении товаров!');
      loadProducts(); 
    };
    window.addEventListener('productsUpdated', handleProductsUpdate);
    
    const shouldOpenCart = localStorage.getItem('openCartOnLoad');
    if (shouldOpenCart === 'true') {
      setShowCart(true);
      localStorage.removeItem('openCartOnLoad');
    }
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('productsUpdated', handleProductsUpdate);
    };
  }, [userCompanyId]);

  useEffect(() => {
    loadPaymentConfig();
    
    const handlePaymentModeChange = (e: CustomEvent) => {
      setPaymentMode(e.detail);
    };
    window.addEventListener('paymentModeChanged', handlePaymentModeChange as EventListener);
    
    return () => {
      window.removeEventListener('paymentModeChanged', handlePaymentModeChange as EventListener);
    };
  }, []);

  useEffect(() => {
    const weatherInterval = setInterval(() => {
      const weathers: WeatherType[] = ['sunny', 'rain', 'snow', 'storm'];
      const newWeather = weathers[Math.floor(Math.random() * weathers.length)];
      setWeather(newWeather);
    }, 5 * 60 * 1000); 

    return () => clearInterval(weatherInterval);
  }, []);

  useEffect(() => {
    const handleDisplayModeChange = (e: CustomEvent) => {
      setDisplayMode(e.detail);
    };

    const handleOpenCart = () => {
      setShowCart(true);
    };

    const handleWeatherToggle = (e: CustomEvent) => {
      setWeatherEnabled(e.detail);
    };

    const handleColorAnimationToggle = (e: CustomEvent) => {
      setColorAnimationEnabled(e.detail);
    };

    window.addEventListener('displayModeChange', handleDisplayModeChange as EventListener);
    window.addEventListener('openCart', handleOpenCart as EventListener);
    window.addEventListener('weatherToggle', handleWeatherToggle as EventListener);
    window.addEventListener('colorAnimationToggle', handleColorAnimationToggle as EventListener);

    return () => {
      window.removeEventListener('displayModeChange', handleDisplayModeChange as EventListener);
      window.removeEventListener('openCart', handleOpenCart as EventListener);
      window.removeEventListener('weatherToggle', handleWeatherToggle as EventListener);
      window.removeEventListener('colorAnimationToggle', handleColorAnimationToggle as EventListener);
    };
  }, []);

  const loadPaymentConfig = async () => {
    try {
      // 💎 Payment config теперь хранится локально
      const savedMode = localStorage.getItem('paymentMode');
      if (savedMode) {
        setPaymentMode(savedMode as 'manual_check' | 'demo_online' | 'real_online');
        console.log('💳 [Payment Config] Loaded from localStorage:', savedMode);
      }
    } catch (error) {
      console.error('Error loading payment config:', error);
      setPaymentMode('manual_check');
    }
  };

  const loadProducts = async (forceRefresh = false) => {
    try {
      console.log('🔒 [HomePage] Loading products with userCompanyId:', userCompanyId);
      
      // Устанавливаем loading только если нет данных
      if (products.length === 0) {
        setLoading(true);
      }
      
      if (!userCompanyId) {
        const cached = getCachedProducts();
        if (cached && cached.length > 0 && !forceRefresh) {
          console.log(`⚡ [HomePage] МГНОВЕННАЯ загрузка из localStorage: ${cached.length} товаров`);
          
          // Нормализуем данные из кэша
          const normalizedCached = cached.map((p: any) => {
            if (p.images && typeof p.images === 'string') {
              try {
                p.images = JSON.parse(p.images);
              } catch (e) {
                p.images = [];
              }
            }
            if (!Array.isArray(p.images)) {
              p.images = [];
            }
            return p;
          });
          
          const filtered = normalizedCached.filter((p: Product) => 
            p.quantity > 0 && p.availableForCustomers === true
          );
          setProducts(filtered);
          setLoading(false); 
        }
      }
      
      if (shouldRefreshProducts(5) || forceRefresh || userCompanyId) {
        console.log('🔄 [HomePage] Загружаем свежие данные из API...');
        
        const params: any = {
          availableOnly: true,
          limit: 1000 
        };
        
        // 🔐 Добавляем параметры приватности
        const mode = userMode || 'public';
        params.mode = mode;
        
        if (mode === 'private' && userCompanyId) {
          // Приватный режим: передаём privateCompanyId для фильтрации
          const companyIdNum = typeof userCompanyId === 'string' ? parseInt(userCompanyId) : userCompanyId;
          if (!isNaN(companyIdNum)) {
            params.privateCompanyId = companyIdNum.toString();
            console.log('🔒 [HomePage] Приватный режим: загружаем товары компании ID =', params.privateCompanyId);
          } else {
            console.warn('⚠️ [HomePage] Невалидный company_id:', userCompanyId);
          }
        } else {
          // Публичный режим: загружаем все публичные товары
          console.log('🌍 [HomePage] Публичный режим: загружаем товары всех публичных компаний');
        }
        
        // Новый API
        const data = await api.products.list(params);
        const productsArray = Array.isArray(data) ? data : (data.products || []);
        console.log(`📦 [HomePage] Получено ${productsArray.length} товаров из API`);
        console.log(`🔐 Режим: ${mode}, Компания ID: ${userCompanyId || 'N/A'}`);
        
        // Нормализуем данные: парсим images если это строка JSON
        const normalizedProducts = productsArray.map((p: any) => {
          if (p.images && typeof p.images === 'string') {
            try {
              p.images = JSON.parse(p.images);
            } catch (e) {
              console.warn('⚠️ Не удалось парсить images для товара', p.id);
              p.images = [];
            }
          }
          if (!Array.isArray(p.images)) {
            p.images = [];
          }
          return p;
        });
        
        const filtered = normalizedProducts.filter((p: Product) => 
          p.quantity > 0 && p.availableForCustomers === true
        );
        console.log(`✅ [HomePage] После фильтрации: ${filtered.length} товаров доступно для покупателей`);
        
        // Кэшируем только в публичном режиме
        if (mode === 'public') {
          setCachedProducts(normalizedProducts);
        }
        
        setProducts(filtered);
      } else {
        console.log('✅ [HomePage] Кэш свежий, пропускаем загрузку из API');
      }
    } catch (error) {
      console.error('❌ [HomePage] Ошибка загрузки товаров:', error);
      
      // Показываем пустой массив вместо ошибки
      setProducts([]);
      
      if (!userCompanyId) {
        const cached = getCachedProducts();
        if (cached && cached.length > 0) {
          console.log(`🆘 [HomePage] Ошибка API, используем старый кэш из localStorage: ${cached.length} товаров`);
          
          // Нормализуем данные из кэша
          const normalizedCached = cached.map((p: any) => {
            if (p.images && typeof p.images === 'string') {
              try {
                p.images = JSON.parse(p.images);
              } catch (e) {
                p.images = [];
              }
            }
            if (!Array.isArray(p.images)) {
              p.images = [];
            }
            return p;
          });
          
          const filtered = normalizedCached.filter((p: Product) => 
            p.quantity > 0 && p.availableForCustomers === true
          );
          setProducts(filtered);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    console.log('🔄 [HomePage] Ручное обновление днных...');
    setIsRefreshing(true);
    try {
      await loadProducts(true); 
      console.log('✅ [HomePage] Данные успешно обновлены!');
    } catch (error) {
      console.error('❌ [HomePage] Ошибка обновления:', error);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500); 
    }
  };

  const loadDiscounts = async () => {
    try {
      // Load both regular and aggressive discounts
      const [regularDiscounts, aggressiveDiscounts] = await Promise.all([
        api.discounts.listApproved(),
        api.aggressiveDiscounts.listApproved()
      ]);
      
      console.log('🏷️ [HomePage] Loaded regular discounts:', regularDiscounts);
      console.log('🔥 [HomePage] Loaded aggressive discounts:', aggressiveDiscounts);
      
      // Combine both discount types
      const allDiscounts = [
        ...(Array.isArray(regularDiscounts) ? regularDiscounts : []),
        ...(Array.isArray(aggressiveDiscounts) ? aggressiveDiscounts.map((ad: any) => ({
          productId: ad.productId || ad.product_id,  // Support both formats
          discountPercent: ad.discountPercent || ad.discount_percent,
          isAggressive: true, // Mark as aggressive discount
          title: ad.title,
          description: ad.description,
          productBasePrice: ad.productBasePrice || ad.product_base_price,
          productPrice: ad.productPrice || ad.product_price
        })) : [])
      ];
      
      console.log('✅ [HomePage] Combined discounts:', allDiscounts);
      setDiscounts(allDiscounts);
    } catch (error) {
      console.error('❌ [HomePage] Error loading discounts:', error);
      setDiscounts([]);
    }
  };

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  useEffect(() => {
    if (products.length > 0) {
      const newColors: { [key: number]: string } = { ...selectedColors };
      let hasChanges = false;
      
      products.forEach(product => {
        if (!newColors[product.id]) {
          newColors[product.id] = 'Любой';
          hasChanges = true;
        }
      });
      
      if (hasChanges) {
        setSelectedColors(newColors);
      }
    }
  }, [products]);

  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => { if (p.category) cats.add(p.category); });
    return Array.from(cats).sort();
  }, [products]);

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
    const matchesCategory = !activeCategory || product.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const addToCart = (productId: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const currentInCart = cart[productId] || 0;
    // Use variant-specific stock if known, otherwise fall back to total product stock
    const maxStock = variantStocks[productId] !== undefined ? variantStocks[productId] : product.quantity;
    if (currentInCart >= maxStock) {
      const variantDesc = [selectedColors[productId], selectedSizes[productId]].filter(v => v && v !== 'юбй').join(' / ');
      alert(variantDesc
        ? `На складе только ${maxStock} шт. (${variantDesc}). Больше добавить нельзя.`
        : `На складе только ${maxStock} шт. "${product.name}". Больше добавить нельзя.`);
      return;
    }
    const newQty = currentInCart + 1;
    // 1. Update UI instantly
    setCart(prev => ({ ...prev, [productId]: newQty }));
    // 2. Single direct API call — no GET, no race condition
    if (userPhone) {
      const color = selectedColors[productId] || '';
      const size = selectedSizes[productId] || '';
      console.log(`🔄 [addToCart] Calling api.users.setCartQty(${userPhone}, ${productId}, ${newQty}, color=${color}, size=${size})`);
      api.users.setCartQty(userPhone, productId, newQty, color, size)
        .then(() => console.log(`✅ [addToCart] API call successful`))
        .catch((err) => console.error(`❌ [addToCart] API call failed:`, err));
    }
  };

  const removeFromCart = (productId: number) => {
    const currentInCart = cart[productId] || 0;
    const newQty = currentInCart - 1;
    console.log(`🛒 [removeFromCart] productId=${productId}, currentQty=${currentInCart}, newQty=${newQty}, userPhone=${userPhone}`);
    // 1. Update UI instantly
    const newCart = { ...cart };
    if (newQty <= 0) {
      delete newCart[productId];
    } else {
      newCart[productId] = newQty;
    }
    setCart(newCart);
    // 2. Single direct API call — setCartQty(0) deletes, no GET needed
    if (userPhone) {
      const color = selectedColors[productId] || '';
      const size = selectedSizes[productId] || '';
      console.log(`🔄 [removeFromCart] Calling api.users.setCartQty(${userPhone}, ${productId}, ${Math.max(0, newQty)}, color=${color}, size=${size})`);
      api.users.setCartQty(userPhone, productId, Math.max(0, newQty), color, size)
        .then(() => console.log(`✅ [removeFromCart] API call successful`))
        .catch((err) => console.error(`❌ [removeFromCart] API call failed:`, err));
    } else {
      console.warn(`⚠️ [removeFromCart] No userPhone — API call skipped`);
    }
  };

  const updateCartQuantity = (productId: number, quantity: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const validQuantity = Math.max(0, Math.min(quantity, product.quantity));
    // 1. Update UI instantly
    const newCart = { ...cart };
    if (validQuantity === 0) {
      delete newCart[productId];
    } else {
      newCart[productId] = validQuantity;
    }
    setCart(newCart);
    // 2. Single direct API call — setCartQty(0) deletes, no GET needed
    if (userPhone) {
      api.users.setCartQty(userPhone, productId, validQuantity).catch(() => {});
    }
  };

  const handleProductClickFromProfile = (product: any) => {
    console.log('🔍 [HomePage] Переход к товару из профиля компании:', product.name);
    
    // Закрываем профиль компании
    setViewingCompanyId(null);
    
    // Открываем детали товара
    handleOpenProduct(product);
  };

  const handleCheckout = () => {
    if (Object.keys(cart).length === 0) {
      alert('Корзина пуста!');
      return;
    }
    if (paymentMode === 'demo_online' || paymentMode === 'real_online') {
      setShowCart(false);
      setShowPayment(true);
      return;
    }
    setCheckoutStep('delivery');
  };

  const handlePlaceOrder = async () => {
    if (isCheckingOut) return;
    setIsCheckingOut(true);

    let totalAmount = 0;
    const purchasedItems: any[] = [];

    for (const [productIdStr, purchasedQty] of Object.entries(cart)) {
      const productId = Number(productIdStr);
      const product = products.find((p: Product) => p.id === productId);
      if (!product) continue;
      if (product.quantity < purchasedQty) {
        alert(`Недостаточно товара "${product.name}". Доступно: ${product.quantity} шт.`);
        setIsCheckingOut(false);
        return;
      }
      const priceWithMarkup = getPriceWithMarkup(product);
      const markupPercent = product.markupPercent || 0;
      const markupAmount = priceWithMarkup - product.price;
      totalAmount += priceWithMarkup * purchasedQty;
      const itemColor = product.hasColorOptions ? (selectedColors[productId] || null) : null;
      const itemSize = selectedSizes[productId] || null;
      purchasedItems.push({
        id: product.id,
        name: product.name,
        quantity: purchasedQty,
        price: product.price,
        price_with_markup: priceWithMarkup,
        markupPercent,
        markupAmount,
        total: priceWithMarkup * purchasedQty,
        color: itemColor,
        size: itemSize,
        image_url: product.images && product.images.length > 0 ? getImageUrl(product.images[0]) : null,
        company_id: product.company_id
      });
    }

    if (purchasedItems.length === 0) { setIsCheckingOut(false); return; }

    // 🎟️⭐ Apply promo code and loyalty points to the charged total.
    const promoDisc = appliedPromo?.discount || 0;
    const afterPromo = Math.max(0, totalAmount - promoDisc);
    const pointsDisc = usePoints ? Math.min(loyaltyBalance, afterPromo) : 0;
    const finalTotal = Math.max(0, afterPromo - pointsDisc);

    try {
      const selectedCard = checkoutPaymentMethod === 'card' && savedPaymentCards.find(c => c.id === selectedCardId);
      const cardSubtype = selectedCard ? selectedCard.card_type : undefined;

      // 🛒 Корзина может содержать товары РАЗНЫХ компаний. Каждая компания
      // должна получить ОТДЕЛЬНЫЙ заказ только со своими товарами и своей
      // суммой — иначе заказ и вся сумма ошибочно уходят одной компании.
      const groupsMap = new Map<string, any[]>();
      for (const item of purchasedItems) {
        const key = String(item.company_id || userCompanyId || '1');
        if (!groupsMap.has(key)) groupsMap.set(key, []);
        groupsMap.get(key)!.push(item);
      }
      const groups = Array.from(groupsMap.entries());

      // Скидки (промокод + баллы) распределяем между компаниями
      // пропорционально их доле в общей сумме заказа.
      const totalDiscount = promoDisc + pointsDisc;
      const grandSubtotal = totalAmount; // сумма всех товаров до скидок

      const created: Array<{ code: string; orderId: number; companyId: string; items: any[]; total: number }> = [];
      let distributedDiscount = 0;

      for (let g = 0; g < groups.length; g++) {
        const [companyId, groupItems] = groups[g];
        const groupSubtotal = groupItems.reduce((s, it) => s + (it.total || 0), 0);
        // Последней группе отдаём остаток скидки, чтобы избежать ошибок округления.
        const groupDiscount = g === groups.length - 1
          ? Math.max(0, totalDiscount - distributedDiscount)
          : Math.round(totalDiscount * (grandSubtotal > 0 ? groupSubtotal / grandSubtotal : 0));
        distributedDiscount += groupDiscount;
        const groupFinal = Math.max(0, groupSubtotal - groupDiscount);

        const result = await api.orders.create({
          companyId,
          customerName: userName || 'Гость',
          customerPhone: userPhone || '',
          items: groupItems,
          totalAmount: groupFinal,
          deliveryType: checkoutDeliveryType,
          deliveryAddress: checkoutDeliveryType === 'delivery' ? checkoutDeliveryAddress : undefined,
          deliveryCoordinates: checkoutDeliveryType === 'delivery' && checkoutDeliveryCoords
            ? `${checkoutDeliveryCoords.lat},${checkoutDeliveryCoords.lng}`
            : undefined,
          paymentMethod: checkoutPaymentMethod,
          cardSubtype
        });

        const orderCode = result.orderCode || result.order_code || `ORD-${result.id}`;
        created.push({ code: orderCode, orderId: result.id, companyId, items: groupItems, total: groupFinal });
      }

      // Промокод и баллы списываем один раз, относя их к первому заказу.
      const firstOrderId = created[0]?.orderId;
      if (firstOrderId) {
        if (appliedPromo && promoDisc > 0) {
          api.promoCodes.redeem({ promoId: appliedPromo.id, userPhone: userPhone || '', orderId: firstOrderId, discount: promoDisc }).catch(() => {});
        }
        if (pointsDisc > 0) {
          api.loyalty.redeem({ userPhone: userPhone || '', points: pointsDisc, orderId: firstOrderId, description: 'Оплата баллами' }).catch(() => {});
        }
      }
      setAppliedPromo(null);
      setPromoInput('');
      setUsePoints(false);

      const nowIso = getUzbekistanISOString();
      setMyOrders(prev => [
        ...created.map(co => ({
          code: co.code,
          total: co.total,
          itemsCount: co.items.length,
          date: nowIso,
          items: co.items.map(item => ({ name: item.name, quantity: item.quantity, price: item.price, total: item.total, color: item.color, size: item.size })),
          status: 'pending',
          orderId: co.orderId,
        })),
        ...prev,
      ]);

      setCart({});
      await loadProducts();
      setShowCart(false);
      setCheckoutStep('cart');
      // Итоговое окно: один код при одной компании, либо перечень кодов
      // при заказе из нескольких компаний.
      const primary = created[0];
      setConfirmedOrder({
        code: created.length > 1
          ? created.map(co => co.code).join(', ')
          : (primary?.code || ''),
        total: totalAmount,
        itemsCount: purchasedItems.length,
        items: purchasedItems.map(item => ({ name: item.name, quantity: item.quantity, price: item.price, total: item.total, color: item.color, size: item.size }))
      });
      setShowOrderConfirmation(true);
      setCartTab('orders');
    } catch (error: any) {
      console.error('Error processing checkout:', error);
      const msg = error?.message || '';
      if (msg.includes('Недостаточно') || msg.includes('складе')) {
        alert(msg);
      } else {
        alert('Ошибка при оформлении заказа');
      }
    } finally {
      setIsCheckingOut(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('uz-UZ').format(price) + ' сум';
  };

  // 🏷️ Create discount map for fast lookup
  const discountMap = useMemo(() => {
    const map: { [productId: number]: number } = {};
    discounts.forEach((discount: any) => {
      map[discount.productId] = discount.discountPercent;
    });
    return map;
  }, [discounts]);

  const getPriceWithMarkup = (product: Product) => {
    const markupPercent = product.markupPercent || 0;
    const basePrice = product.price;
    const markupAmount = basePrice * (markupPercent / 100);
    // Use sellingPrice from API (цена продажи) if available, otherwise calculate
    const sellingPrice = (product as any).sellingPrice;
    const priceWithMarkup = (sellingPrice && sellingPrice > 0) ? sellingPrice : basePrice + markupAmount;

    // Check if product has a discount
    const discount = discounts.find((d: any) => (d.productId === product.id));
    if (discount && discount.discountPercent > 0) {
      if (discount.isAggressive) {
        // 🔥 Aggressive discount - applies to FULL PRICE (can go below cost)
        const discountAmount = priceWithMarkup * (discount.discountPercent / 100);
        const discountedPrice = priceWithMarkup - discountAmount;
        return discountedPrice;
      } else {
        // 🏷️ Regular discount - applies ONLY to markup portion
        const markupInSelling = priceWithMarkup - basePrice;
        const discountAmount = markupInSelling * (discount.discountPercent / 100);
        const discountedPrice = priceWithMarkup - discountAmount;
        return discountedPrice;
      }
    }

    return priceWithMarkup;
  };

  // Get discount info for a product
  const getProductDiscount = (product: Product) => {
    return discounts.find((d: any) => (d.productId === product.id));
  };

  // Get original price before discount (selling price without discount)
  const getOriginalPrice = (product: Product) => {
    const markupPercent = product.markupPercent || 0;
    const basePrice = product.price;
    const markupAmount = basePrice * (markupPercent / 100);
    const sellingPrice = (product as any).sellingPrice;
    return (sellingPrice && sellingPrice > 0) ? sellingPrice : basePrice + markupAmount;
  };

  const getTotalCart = () => {
    return Object.entries(cart).reduce((sum, [id, qty]) => {
      const product = products.find(p => p.id === Number(id));
      return sum + (product ? getPriceWithMarkup(product) * qty : 0);
    }, 0);
  };

  const getTotalItems = () => {
    return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  };

  // 🎟️⭐ Checkout discount helpers (promo code + loyalty points).
  const getCartCompanyId = (): number | null => {
    const firstId = Object.keys(cart)[0];
    if (!firstId) return null;
    const p = products.find((pr: Product) => pr.id === Number(firstId));
    return (p as any)?.company_id ?? null;
  };

  const applyPromo = async () => {
    const code = promoInput.trim();
    if (!code) return;
    setPromoChecking(true);
    try {
      const res = await api.promoCodes.validate({
        code,
        userPhone: userPhone || '',
        companyId: getCartCompanyId(),
        orderAmount: getTotalCart(),
      });
      if (res.valid) {
        setAppliedPromo({ id: res.promoId, code: res.code, discount: res.discount });
      } else {
        setAppliedPromo(null);
        alert(res.message || 'Промокод недействителен');
      }
    } catch (e) {
      console.error('Promo validate failed:', e);
      alert('Не удалось проверить промокод');
    } finally {
      setPromoChecking(false);
    }
  };

  const promoDiscountValue = appliedPromo?.discount || 0;
  const afterPromoTotal = Math.max(0, getTotalCart() - promoDiscountValue);
  const pointsDiscountValue = usePoints ? Math.min(loyaltyBalance, afterPromoTotal) : 0;
  const finalCheckoutTotal = Math.max(0, afterPromoTotal - pointsDiscountValue);

  // Load the loyalty balance when the cart is opened.
  useEffect(() => {
    if (showCart && userPhone) {
      api.loyalty.get(userPhone).then((d: any) => setLoyaltyBalance(d?.pointsBalance || 0)).catch(() => {});
    }
  }, [showCart, userPhone]);

  const toggleLike = (productId: number) => {
    if (isTogglingLike || !setLikedProductIds) return;
    setIsTogglingLike(true);
    const wasLiked = likedProductIds.includes(productId);
    // 1. Update UI instantly
    const newLikes = wasLiked
      ? likedProductIds.filter(id => id !== productId)
      : [...likedProductIds, productId];
    setLikedProductIds(newLikes);
    // 2. Single direct API call — no full-array sync, no GET needed
    if (userPhone) {
      if (wasLiked) {
        api.users.removeLike(userPhone, productId).catch(() => {});
      } else {
        api.users.addLike(userPhone, productId).catch(() => {});
      }
    }
    setLikeAnimation({ productId, isLiked: !wasLiked });
    setTimeout(() => {
      setLikeAnimation(null);
      setIsTogglingLike(false);
    }, 1000);
  };

  const handleCancelOrder = async (order: any) => {
    if (!confirm('Вы действительно хотите отменить этот заказ?')) return;
    
    try {
      console.log('🚫 Cancelling order:', order.orderId);
      // Optimistic update
      const updatedOrders = myOrders.map(o => 
        o.code === order.code ? { ...o, status: 'cancelled' } : o
      );
      setMyOrders(updatedOrders);

      // Persist the cancellation. The backend restores stock for a
      // previously-confirmed order and notifies the customer.
      if (order.orderId) {
        await api.orders.cancel(order.orderId);
      }

      alert('Заказ отменен');
    } catch (error) {
      console.error('Error cancelling order:', error);
      alert('Ошибка при отмене заказа');
    }
  };

  const handleReturnOrder = async (order: any) => {
    const reason = prompt('Опишите причину возврата:');
    if (reason === null) return; // user cancelled the prompt
    try {
      await api.returns.create({
        orderId: order.orderId || null,
        companyId: order.companyId || order.company_id || null,
        customerPhone: userPhone,
        reason: reason || '',
        items: order.items || [],
        refundAmount: order.totalAmount || order.total_amount || 0,
      });
      alert('Заявка на возврат отправлена продавцу');
    } catch (error) {
      console.error('Error requesting return:', error);
      alert('Не удалось отправить заявку на возврат');
    }
  };

  if (isUploadingRAM) {
    return <LoadingAnimation text={uploadProgress.step || 'Загрузка данных...'} />;
  }

  // 🛒 Показываем загрузку при оформлении заказа
  if (isCheckingOut) {
    return <LoadingAnimation text="Оформление заказа..." />;
  }

  if (showPayment) {
    const cartItems = Object.entries(cart).map(([productIdStr, quantity]) => {
      const productId = Number(productIdStr);
      const product = products.find(p => p.id === productId);
      if (!product) return null;
      
      const sellingPrice = getPriceWithMarkup(product);
      const basePrice = product.price;
      const markupPercent = product.markupPercent || 0;
      const markupAmount = sellingPrice - basePrice; 
      
      return {
        id: product.id,
        name: product.name,
        price: sellingPrice, 
        base_price: basePrice, 
        markupPercent: markupPercent, 
        markupAmount: markupAmount, 
        quantity,
        selectedColor: selectedColors[productId],
        image: product.images && product.images.length > 0 ? (getImageUrl(product.images[0]) || undefined) : undefined
      };
    }).filter(Boolean) as any[];

    const totalPrice = getTotalCart();

    const handlePaymentSuccess = () => {
      setCart({});
      setShowPayment(false);
      loadProducts(true);
      alert('✅ Оплата успешна! Товары списаны со склада.');
    };

    if (paymentMode === 'demo_online') {
      return (
        <DemoPaymentPage
          cart={cartItems}
          totalPrice={totalPrice}
          userPhone={userPhone}
          userName={userName}
          onBack={() => {
            setShowPayment(false);
            setShowCart(true);
          }}
          onSuccess={handlePaymentSuccess}
        />
      );
    } else if (paymentMode === 'real_online') {
      return (
        <PaymentPage
          cart={cartItems}
          totalPrice={totalPrice}
          userPhone={userPhone}
          userName={userName}
          userId={userPhone}
          onBack={() => {
            setShowPayment(false);
            setShowCart(true);
          }}
          onSuccess={handlePaymentSuccess}
        />
      );
    }
  }

  const isNight = displayMode === 'night';

  const toggleDisplayMode = () => {
    const newMode = displayMode === 'day' ? 'night' : 'day';
    setDisplayMode(newMode);
    localStorage.setItem('displayMode', newMode);
    window.dispatchEvent(new CustomEvent('displayModeChange', { detail: newMode }));
    window.dispatchEvent(new CustomEvent('colorAnimationToggle', { detail: newMode === 'day' })); // Disable color blobs in night mode for cleaner look
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'cancelled': return 'text-red-600 bg-red-100';
      default: return 'text-blue-600 bg-blue-100';
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'completed': return 'Выполнен';
      case 'cancelled': return 'Отменен';
      default: return 'В обработке';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (e) {
      return dateString;
    }
  };

  return (
    <div className={`min-h-screen pb-20 relative transition-colors duration-500 ${
      isNight ? 'bg-[#08090D]' : 'bg-[#F6F7F9]'
    }`}>
      {/* 💀 Скелетоны при первой загрузке — вместо пустого экрана со спиннером
          покупатель сразу видит «каркас» витрины, как у Ozon/Uzum */}
      {loading && products.length === 0 && (
        <div className={`fixed inset-0 z-50 overflow-hidden ${isNight ? 'bg-[#08090D]' : 'bg-[#F6F7F9]'}`} style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="px-4 pt-4 animate-pulse">
            {/* Поисковая строка */}
            <div className={`h-11 rounded-2xl mb-4 ${isNight ? 'bg-white/10' : 'bg-gray-200'}`} />
            {/* Баннер */}
            <div className={`h-36 rounded-2xl mb-4 ${isNight ? 'bg-white/10' : 'bg-gray-200'}`} />
            {/* Категории */}
            <div className="flex gap-3 mb-5 overflow-hidden">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 shrink-0">
                  <div className={`w-14 h-14 rounded-2xl ${isNight ? 'bg-white/10' : 'bg-gray-200'}`} />
                  <div className={`w-12 h-2.5 rounded ${isNight ? 'bg-white/10' : 'bg-gray-200'}`} />
                </div>
              ))}
            </div>
            {/* Сетка карточек товаров */}
            <div className="grid grid-cols-2 gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i}>
                  <div className={`aspect-[3/4] rounded-2xl mb-2 ${isNight ? 'bg-white/10' : 'bg-gray-200'}`} />
                  <div className={`h-3 rounded w-3/4 mb-1.5 ${isNight ? 'bg-white/10' : 'bg-gray-200'}`} />
                  <div className={`h-3.5 rounded w-1/2 ${isNight ? 'bg-white/10' : 'bg-gray-200'}`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* �🟢 NEW HEADER (FIXED & SAFE AREA) */}
      {!showCart && !selectedProduct && !showCatalog && !viewingCompanyId && !viewingUserProfile && (
        <header
          className={`sticky top-0 z-40 transition-colors duration-300 ${
            isNight
              ? 'bg-[#10131F]/95 border-b border-white/5'
              : 'bg-white/95 border-b border-gray-100'
          }`}
          style={{
            paddingTop: 'env(safe-area-inset-top)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          {/* Greeting + location selector row (как в Homepage) */}
          <div className="px-4 pt-2.5 pb-0 relative">
            <p className={`text-[13px] font-medium ${isNight ? 'text-gray-400' : 'text-gray-500'}`}>
              Добро пожаловать
            </p>
            <h2 className={`text-[22px] font-extrabold tracking-tight leading-tight ${isNight ? 'text-white' : 'text-[#0B0E16]'}`}>
              {userName ? userName.split(' ')[0] : 'Axentis Market'}
            </h2>
            <button
              onClick={() => setShowRegionPicker(prev => !prev)}
              className={`flex items-center gap-1.5 text-xs font-medium transition-colors mt-1 ${
                isNight ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <span className="text-sm">📍</span>
              <span className="max-w-[160px] truncate">{selectedRegion}</span>
              <span className="text-[10px] opacity-50">▾</span>
            </button>
            {showRegionPicker && (
              <div className={`absolute left-4 right-4 top-full mt-2 z-50 rounded-2xl shadow-2xl border overflow-hidden ${
                isNight ? 'bg-[#1c0e19] border-white/10' : 'bg-white border-gray-100'
              }`}>
                {UZ_REGIONS.map(region => (
                  <button
                    key={region}
                    onClick={() => {
                      setSelectedRegion(region);
                      localStorage.setItem('selectedRegion', region);
                      setShowRegionPicker(false);
                    }}
                    className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center gap-2 ${
                      selectedRegion === region
                        ? isNight ? 'bg-indigo-900/60 text-indigo-300 font-semibold' : 'bg-indigo-50 text-indigo-700 font-semibold'
                        : isNight ? 'text-gray-300 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {selectedRegion === region && <span className="text-indigo-500">✓</span>}
                    {region}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 py-2.5 flex items-center gap-3">
            {/* Menu Button */}
            <button
              onClick={() => showCatalog ? handleCloseCatalog() : handleOpenCatalog()}
              className={`p-2.5 rounded-xl transition-colors flex-shrink-0 ${
                isNight
                  ? 'bg-white/10 text-white hover:bg-white/15'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Search Bar */}
            <div className={`flex-1 flex items-center px-3.5 py-2.5 rounded-xl transition-colors gap-2 ${
              isNight ? 'bg-white/10 border border-white/10' : 'bg-gray-100 border border-transparent'
            }`}>
              <Search className={`w-4 h-4 flex-shrink-0 ${isNight ? 'text-gray-400' : 'text-gray-400'}`} />
              <input
                type="text"
                placeholder="Qidirish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full bg-transparent outline-none text-sm ${
                  isNight ? 'text-white placeholder-gray-500' : 'text-gray-800 placeholder-gray-400'
                }`}
              />
            </div>

            {/* 🔔 Колокольчик уведомлений */}
            <button
              onClick={() => setShowNotifications(true)}
              className={`relative p-2.5 rounded-xl transition-colors flex-shrink-0 ${
                isNight ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Bell className="w-5 h-5" />
              {unreadNotifs > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center" style={{ background: '#EF4444' }}>
                  {unreadNotifs > 9 ? '9+' : unreadNotifs}
                </span>
              )}
            </button>
          </div>
        </header>
      )}

      {/* 🔔 Экран уведомлений */}
      {showNotifications && (
        <NotificationsPage
          userPhone={userPhone}
          isNight={isNight}
          onBack={() => setShowNotifications(false)}
        />
      )}

      {/* Main Content */}
      <div className="w-full px-4 py-4 relative z-10">
        
        {/* Catalog Panel */}
      <CatalogPanel
        isOpen={showCatalog}
        onClose={handleCloseCatalog}
        isNight={isNight}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        products={products}
        cart={cart}
        likedProductIds={likedProductIds}
        displayMode={displayMode}
        onAddToCart={addToCart}
        onToggleLike={toggleLike}
        formatPrice={formatPrice}
        getPriceWithMarkup={getPriceWithMarkup}
        onOpenProduct={handleOpenProduct}
      />

      {/* Product Details Panel */}
      {selectedProduct ? (
        <div className="fixed inset-0 z-50 bg-white h-screen">
          <ProductDetails
            product={selectedProduct}
            onBack={handleCloseProduct}
            onAddToCart={(p) => addToCart(p.id)}
            onBuyNow={(p) => {
              addToCart(p.id);
              // Close product details, go directly to cart (Savat) view
              setSelectedProduct(null);
              setCheckoutStep('cart');
              setShowCart(true);
            }}
            isNight={isNight}
            cartQuantity={cart[selectedProduct.id] || 0}
            formatPrice={formatPrice}
            getPriceWithMarkup={getPriceWithMarkup}
            getProductDiscount={getProductDiscount}
            getOriginalPrice={getOriginalPrice}
            onViewCompany={handleOpenCompany}
            userPhone={userPhone}
            userName={userName}
            onUserClick={handleOpenUserProfile}
            isLiked={likedProductIds.includes(selectedProduct.id)}
            onToggleLike={toggleLike}
            onVariantChange={(productId, color, size, stock) => {
              setSelectedColors(prev => ({ ...prev, [productId]: color }));
              setSelectedSizes(prev => ({ ...prev, [productId]: size }));
              if (stock !== undefined) {
                setVariantStocks(prev => ({ ...prev, [productId]: stock }));
              }
            }}
          />
        </div>
      ) : viewingUserProfile ? (
        <div className="fixed inset-0 z-50 bg-white">
          <UserProfilePage
            targetUserPhone={viewingUserProfile.phone}
            targetUserName={viewingUserProfile.name}
            currentUserPhone={userPhone}
            onBack={handleCloseUserProfile}
            isNight={isNight}
          />
        </div>
      ) : (
        <>
            {/* ── DEMO BANNER CAROUSEL ── */}
            {!searchQuery && !activeCategory && (
              <div className="mb-5 relative overflow-hidden rounded-3xl" style={{ height: 152 }}>
                {DEMO_BANNERS.map((banner, idx) => (
                  <div
                    key={idx}
                    className="absolute inset-0 flex items-center px-5 transition-opacity duration-600"
                    style={{
                      background: banner.bg,
                      opacity: idx === bannerIndex ? 1 : 0,
                      pointerEvents: idx === bannerIndex ? 'auto' : 'none',
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-lg font-bold leading-tight mb-0.5">{banner.title}</p>
                      <p className="text-white/65 text-xs mb-3">{banner.subtitle}</p>
                      <button className="bg-white/25 hover:bg-white/35 text-white text-xs font-semibold px-4 py-1.5 rounded-full transition-colors backdrop-blur-sm">
                        Ko'rish →
                      </button>
                    </div>
                    <span className="text-6xl select-none ml-3 flex-shrink-0">{banner.emoji}</span>
                  </div>
                ))}
                {/* Dot indicators */}
                <div className="absolute bottom-3 left-6 flex gap-1.5">
                  {DEMO_BANNERS.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setBannerIndex(idx)}
                      className="rounded-full transition-all"
                      style={{
                        width: idx === bannerIndex ? 18 : 6,
                        height: 6,
                        background: idx === bannerIndex ? 'white' : 'rgba(255,255,255,0.4)',
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── APPROVED ADS BANNER ── */}
            <div className="mb-4">
              <ApprovedAdsBanner
                onCompanyClick={(companyId) => handleOpenCompany(Number(companyId))}
                onProductClick={(productId) => {
                  const product = products.find(p => p.id === Number(productId));
                  if (product) handleOpenProduct(product);
                }}
              />
            </div>

            {/* Pull to refresh indicator */}
            {isRefreshing && (
              <div className="flex justify-center mb-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600" />
              </div>
            )}

            {/* ── CATEGORY CHIPS ROW ── */}
            {!loading && uniqueCategories.length > 0 && (() => {
              const ICONS: Record<string, string> = {
                'электроника': '📱', 'electronics': '📱',
                'одежда': '👔', 'clothes': '👔', 'clothing': '👔',
                'еда': '🍔', 'food': '🍔', 'продукты': '🛒',
                'дом': '🏠', 'home': '🏠', 'мебель': '🪑',
                'спорт': '⚽', 'sport': '⚽', 'sports': '⚽',
                'детские': '🧸', 'kids': '🧸', 'children': '🧸',
                'красота': '💄', 'beauty': '💄', 'косметика': '💅',
                'авто': '🚗', 'auto': '🚗', 'автомобили': '🚗',
                'книги': '📚', 'books': '📚',
                'игрушки': '🎮', 'games': '🎮',
                'обувь': '👟', 'shoes': '👟',
                'аксессуары': '⌚', 'accessories': '⌚',
              };
              const getIcon = (cat: string) => ICONS[cat.toLowerCase()] || '📦';
              return (
                <div className="-mx-4 px-4 overflow-x-auto scrollbar-none mb-4" style={{ scrollbarWidth: 'none' }}>
                  <div className="flex gap-2 pb-1" style={{ width: 'max-content' }}>
                    {(() => {
                      const chipStyle = (active: boolean) => active
                        ? {
                            backgroundColor: isNight ? 'rgba(255,255,255,0.08)' : 'rgba(109,93,251,0.08)',
                            border: `2px solid ${isNight ? '#FFFFFF' : '#6D5DFB'}`,
                            color: isNight ? '#FFFFFF' : '#0B0E16',
                          }
                        : {
                            backgroundColor: 'transparent',
                            border: `1px solid ${isNight ? 'rgba(255,255,255,0.06)' : 'rgba(11,14,22,0.08)'}`,
                            color: isNight ? '#9CA3AF' : '#5B6472',
                          };
                      return (
                        <>
                          <button
                            onClick={() => setActiveCategory(null)}
                            className="flex items-center gap-1.5 pl-3 pr-3.5 h-[38px] rounded-full text-[13px] font-semibold transition-all shrink-0"
                            style={chipStyle(activeCategory === null)}
                          >
                            <Store className="w-[17px] h-[17px]" style={{ color: activeCategory === null ? (isNight ? '#FFFFFF' : '#0B0E16') : (isNight ? '#9CA3AF' : '#5B6472') }} />
                            <span>Barchasi</span>
                          </button>
                          {uniqueCategories.map(cat => {
                            const active = activeCategory === cat;
                            return (
                              <button
                                key={cat}
                                onClick={() => setActiveCategory(active ? null : cat)}
                                className="flex items-center gap-1.5 pl-3 pr-3.5 h-[38px] rounded-full text-[13px] font-semibold transition-all shrink-0"
                                style={chipStyle(active)}
                              >
                                <span style={{ color: active ? (isNight ? '#FFFFFF' : '#0B0E16') : (isNight ? '#9CA3AF' : '#5B6472'), display: 'flex' }}>
                                  <CategoryNameIcon name={cat} className="w-[17px] h-[17px]" />
                                </span>
                                <span className="max-w-[90px] truncate">{cat}</span>
                              </button>
                            );
                          })}
                        </>
                      );
                    })()}
                  </div>
                </div>
              );
            })()}

            {/* ── ХИТОВЫЕ МАГАЗИНЫ — горизонтальный скролл ── */}
            {!loading && !searchQuery && !activeCategory && (
              <HitCompanies isNight={isNight} onOpenCompany={(companyId) => handleOpenCompany(companyId)} />
            )}

            {/* ── ПОПУЛЯРНОЕ — горизонтальный скролл ── */}
            {!loading && !searchQuery && !activeCategory && products.length > 0 && (() => {
              const popular = [...products]
                .filter(p => p.availableForCustomers !== false)
                .sort((a: any, b: any) => (b.soldCount || b.sold_count || 0) - (a.soldCount || a.sold_count || 0))
                .slice(0, 12);
              if (popular.length < 2) return null;
              return (
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-3">
                    {/* Заголовки секций — как в приложении: жирные, обычный регистр */}
                    <h2 className={`text-base font-bold ${isNight ? 'text-white' : 'text-gray-900'}`}>
                      Ommabop mahsulotlar
                    </h2>
                  </div>
                  <div
                    className="-mx-4 px-4 overflow-x-auto scrollbar-none"
                    style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as any}
                  >
                    <div className="flex gap-3 pb-1" style={{ width: 'max-content' }}>
                      {popular.map(product => {
                        const price = getPriceWithMarkup(product);
                        const img = product.images && product.images.length > 0
                          ? (typeof (product.images[0] as any) === 'string'
                              ? (product.images[0] as any)
                              : null)
                          : null;
                        const inCart = (cart[product.id] || 0) > 0;
                        return (
                          <button
                            key={product.id}
                            onClick={() => handleOpenProduct(product)}
                            className={`shrink-0 w-36 rounded-2xl overflow-hidden text-left transition-transform active:scale-[0.97] ${
                              isNight ? 'bg-white/6' : 'bg-white shadow-[0_1px_8px_rgba(0,0,0,0.07)]'
                            }`}
                          >
                            {/* Image */}
                            <div className={`w-full h-32 relative ${isNight ? 'bg-white/5' : 'bg-gray-100'}`}>
                              {img ? (
                                <img
                                  src={img.startsWith('http') ? img : `/uploads/${img}`}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                              ) : (
                                <div className={`w-full h-full flex items-center justify-center ${isNight ? 'text-gray-600' : 'text-gray-300'}`}>
                                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                </div>
                              )}
                              {inCart && (
                                <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-gray-900 rounded-full flex items-center justify-center">
                                  <span className="text-white text-[9px] font-bold">{cart[product.id]}</span>
                                </div>
                              )}
                            </div>
                            {/* Info */}
                            <div className="p-2.5">
                              <p className={`text-xs font-medium line-clamp-2 leading-tight mb-1.5 ${isNight ? 'text-gray-200' : 'text-gray-800'}`}>
                                {product.name}
                              </p>
                              <p className={`text-xs font-bold ${isNight ? 'text-white' : 'text-gray-900'}`}>
                                {formatPrice(price)}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── PRODUCT GRID ── */}
            {!loading && filteredProducts.length > 0 && (
              <div className="flex items-center justify-between mb-3">
                <h2 className={`text-base font-bold ${isNight ? 'text-white' : 'text-gray-900'}`}>
                  {activeCategory || 'Barcha mahsulotlar'}
                </h2>
                <span className={`text-xs ${isNight ? 'text-gray-500' : 'text-gray-400'}`}>
                  {filteredProducts.length} ta
                </span>
              </div>
            )}
            {loading ? (
              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className={`h-64 rounded-xl animate-pulse ${
                    isNight ? 'bg-slate-800' : 'bg-gray-200'
                  }`} />
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-12">
                <Search className={`w-16 h-16 mx-auto mb-4 ${isNight ? 'text-gray-600' : 'text-gray-300'}`} />
                <p className={isNight ? 'text-gray-400' : 'text-gray-500'}>
                  {searchQuery ? 'Ничего не найдено' : 'Нет доступных товаров'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    displayMode={displayMode}
                    colorAnimationEnabled={colorAnimationEnabled}
                    highlightedProductId={highlightedProductId}
                    isLiked={likedProductIds.includes(product.id)}
                    cartQuantity={cart[product.id]}
                    likeAnimation={likeAnimation}
                    formatPrice={formatPrice}
                    getPriceWithMarkup={getPriceWithMarkup}
                    onToggleLike={toggleLike}
                    onViewImage={() => handleOpenProduct(product)}
                    onViewCompany={(companyId) => handleOpenCompany(companyId)}
                    onDoubleClick={() => handleOpenProduct(product)}
                    onClick={() => handleOpenProduct(product)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Shopping Cart Sidebar */}
      {showCart && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60]" onClick={handleCloseCart}>
          <div
            className={`absolute right-0 top-0 h-full w-full shadow-xl transition-colors duration-500 ${
              isNight ? 'bg-[#08090D]' : 'bg-white'
            }`}
            onClick={(e) => e.stopPropagation()}
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
          >
            <div className="flex flex-col h-full">
              {/* Cart Header — как в Homepage */}
              <div className="px-4 pt-3 pb-3 flex items-center justify-between">
                <h2 className={`text-2xl font-extrabold tracking-tight ${
                  isNight ? 'text-white' : 'text-[#0B0E16]'
                }`}>
                  Корзина
                </h2>
                <button
                  onClick={handleCloseCart}
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: isNight ? '#171C2A' : '#F2F3F6', color: isNight ? '#FFFFFF' : '#0B0E16' }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className={`flex px-4 gap-6 border-b ${isNight ? 'border-white/[0.06]' : 'border-black/[0.06]'}`}>
                {([['cart', 'Текущий заказ'], ['orders', `Мои заказы (${myOrders.length})`]] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setCartTab(key)}
                    className="py-3 text-sm font-semibold transition-colors relative"
                    style={{ color: cartTab === key ? '#6D5DFB' : (isNight ? '#6B7280' : '#9AA1AE') }}
                  >
                    {label}
                    {cartTab === key && (
                      <div className="absolute bottom-0 left-0 w-full rounded-full" style={{ height: 2.5, backgroundColor: '#6D5DFB' }} />
                    )}
                  </button>
                ))}
              </div>

              {/* Cart Content */}
              {cartTab === 'cart' ? (
                <>
                  {/* Checkout step: Delivery */}
                  {checkoutStep === 'delivery' && (
                    <div className="flex-1 overflow-y-auto p-4 pb-6">
                      <div className="flex items-center gap-2 mb-5">
                        <button onClick={() => setCheckoutStep('cart')} className="p-1 rounded-full hover:bg-gray-100">
                          <X className="w-5 h-5 text-gray-500" />
                        </button>
                        <span className={`text-base font-bold ${isNight ? 'text-white' : 'text-gray-800'}`}>Доставка</span>
                      </div>
                      {/* Steps indicator */}
                      <div className="flex items-center gap-2 mb-6">
                        <div className="flex-1 h-1 rounded-full bg-[#6D5DFB]" />
                        <div className="flex-1 h-1 rounded-full bg-gray-300" />
                        <div className="flex-1 h-1 rounded-full bg-gray-300" />
                      </div>
                      {/* Доставка — единственный способ получения заказа (самовывоз отключён) */}
                      <div className={`flex items-center gap-2 mb-5 py-3 px-4 rounded-xl border-2 border-[#6D5DFB] bg-[#6D5DFB]/10 text-[#6D5DFB] font-medium text-sm`}>
                        <Truck className="w-4 h-4" />
                        <span>Доставка курьером</span>
                      </div>
                      {checkoutDeliveryType === 'delivery' && (
                        <div className="mb-5">
                          <p className={`text-sm font-semibold mb-2 ${isNight ? 'text-gray-300' : 'text-gray-700'}`}>Адрес доставки</p>
                          <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 mb-2 ${isNight ? 'border-slate-600 bg-slate-700' : 'border-gray-200 bg-gray-50'}`}>
                            <input
                              type="text"
                              placeholder="Введите адрес..."
                              value={checkoutDeliveryAddress}
                              onChange={e => setCheckoutDeliveryAddress(e.target.value)}
                              className={`flex-1 bg-transparent outline-none text-sm ${isNight ? 'text-white placeholder-gray-500' : 'text-gray-800 placeholder-gray-400'}`}
                            />
                            {checkoutDeliveryCoords && (
                              <button
                                onClick={() => setCheckoutDeliveryCoords(null)}
                                className="text-xs text-red-400 hover:text-red-500"
                                title="Сбросить координаты"
                              >✕</button>
                            )}
                          </div>
                          {/* Map location picker */}
                          <DeliveryLocationPicker
                            isNight={isNight}
                            onLocationSelect={(coords, address) => {
                              setCheckoutDeliveryCoords(coords);
                              if (address) setCheckoutDeliveryAddress(address);
                            }}
                            selectedCoords={checkoutDeliveryCoords}
                          />
                          {checkoutDeliveryCoords && (
                            <p className="text-xs text-green-500 mt-1">
                              📍 Местоположение выбрано на карте ({checkoutDeliveryCoords.lat.toFixed(4)}, {checkoutDeliveryCoords.lng.toFixed(4)})
                            </p>
                          )}
                        </div>
                      )}
                      <button
                        onClick={() => { setCheckoutStep('payment'); loadSavedCards(); }}
                        disabled={checkoutDeliveryType === 'delivery' && !checkoutDeliveryAddress.trim()}
                        className="w-full py-3 rounded-xl bg-[#6D5DFB] text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Далее
                      </button>
                    </div>
                  )}

                  {/* Checkout step: Payment */}
                  {checkoutStep === 'payment' && (
                    <div className="flex-1 overflow-y-auto p-4 pb-6">
                      <div className="flex items-center gap-2 mb-5">
                        <button onClick={() => setCheckoutStep('delivery')} className="p-1 rounded-full hover:bg-gray-100">
                          <X className="w-5 h-5 text-gray-500" />
                        </button>
                        <span className={`text-base font-bold ${isNight ? 'text-white' : 'text-gray-800'}`}>Оплата</span>
                      </div>
                      {/* Steps indicator */}
                      <div className="flex items-center gap-2 mb-6">
                        <div className="flex-1 h-1 rounded-full bg-[#6D5DFB]" />
                        <div className="flex-1 h-1 rounded-full bg-[#6D5DFB]" />
                        <div className="flex-1 h-1 rounded-full bg-gray-300" />
                      </div>

                      <p className={`text-sm font-semibold mb-3 ${isNight ? 'text-gray-300' : 'text-gray-700'}`}>Способ оплаты</p>
                      <div className="space-y-2 mb-5">
                        {(['card', 'cash'] as const).map(method => (
                          <button key={method} onClick={() => setCheckoutPaymentMethod(method)}
                            className={`w-full flex items-center gap-3 py-3 px-4 rounded-xl border-2 transition-all ${
                              checkoutPaymentMethod === method
                                ? 'border-[#6D5DFB] bg-[#6D5DFB]/10'
                                : isNight ? 'border-slate-600' : 'border-gray-200'
                            }`}>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              checkoutPaymentMethod === method ? 'border-[#6D5DFB]' : 'border-gray-300'
                            }`}>
                              {checkoutPaymentMethod === method && <div className="w-2.5 h-2.5 rounded-full bg-[#6D5DFB]" />}
                            </div>
                            <span className={`text-sm font-medium ${isNight ? 'text-white' : 'text-gray-800'}`}>
                              {method === 'card' ? 'Банковская карта' : 'Наличными при получении'}
                            </span>
                          </button>
                        ))}
                      </div>

                      {/* Card selection */}
                      {checkoutPaymentMethod === 'card' && (
                        <div className="mb-5">
                          {savedPaymentCards.length > 0 && !showAddCardForm ? (
                            <>
                              <p className={`text-sm font-semibold mb-2 ${isNight ? 'text-gray-300' : 'text-gray-700'}`}>Сохранённая карта</p>
                              {savedPaymentCards.map(card => (
                                <button key={card.id} onClick={() => setSelectedCardId(card.id)}
                                  className={`w-full flex items-center gap-3 py-3 px-4 rounded-xl border-2 mb-2 transition-all ${
                                    selectedCardId === card.id ? 'border-[#6D5DFB] bg-[#6D5DFB]/10' : isNight ? 'border-slate-600' : 'border-gray-200'
                                  }`}>
                                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedCardId === card.id ? 'border-[#6D5DFB]' : 'border-gray-300'}`}>
                                    {selectedCardId === card.id && <div className="w-2.5 h-2.5 rounded-full bg-[#6D5DFB]" />}
                                  </div>
                                  <div className="flex-1 text-left">
                                    <div className={`text-sm font-medium ${isNight ? 'text-white' : 'text-gray-800'}`}>
                                      {(card.card_type || '').toUpperCase()} •••• {card.card_number_last4}
                                    </div>
                                    <div className="text-xs text-gray-500">{card.card_holder_name}</div>
                                  </div>
                                </button>
                              ))}
                              <button onClick={() => setShowAddCardForm(true)}
                                className="w-full py-2 text-sm text-[#6D5DFB] font-medium border border-[#6D5DFB]/30 rounded-xl mt-1">
                                + Добавить карту
                              </button>
                            </>
                          ) : (
                            <>
                              <p className={`text-sm font-semibold mb-3 ${isNight ? 'text-gray-300' : 'text-gray-700'}`}>Тип карты</p>
                              <div className="grid grid-cols-4 gap-2 mb-4">
                                {(['visa', 'mastercard', 'uzcard', 'humo'] as const).map(ct => (
                                  <button key={ct} onClick={() => setNewCard(prev => ({ ...prev, type: ct }))}
                                    className={`py-2 rounded-lg border-2 text-xs font-bold transition-all ${
                                      newCard.type === ct ? 'border-[#6D5DFB] bg-[#6D5DFB]/10 text-[#6D5DFB]' : isNight ? 'border-slate-600 text-gray-300' : 'border-gray-200 text-gray-600'
                                    }`}>
                                    {ct === 'visa' ? 'Visa' : ct === 'mastercard' ? 'MC' : ct === 'uzcard' ? 'UZCard' : 'Humo'}
                                  </button>
                                ))}
                              </div>
                              <div className="space-y-3">
                                <div>
                                  <p className={`text-xs mb-1 ${isNight ? 'text-gray-400' : 'text-gray-500'}`}>Номер карты</p>
                                  <input type="text" inputMode="numeric" maxLength={19} placeholder="0000 0000 0000 0000"
                                    value={newCard.number}
                                    onChange={e => {
                                      const raw = e.target.value.replace(/\D/g, '').slice(0, 16);
                                      const formatted = raw.replace(/(.{4})/g, '$1 ').trim();
                                      const autoType = detectCardType(raw);
                                      setNewCard(prev => ({ ...prev, number: formatted, type: autoType || prev.type }));
                                    }}
                                    className={`w-full px-3 py-2 rounded-xl border text-sm outline-none ${isNight ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-800'}`}
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <p className={`text-xs mb-1 ${isNight ? 'text-gray-400' : 'text-gray-500'}`}>Срок действия</p>
                                    <input type="text" inputMode="numeric" placeholder="MM/YY" maxLength={5}
                                      value={newCard.expiry}
                                      onChange={e => {
                                        let v = e.target.value.replace(/\D/g, '').slice(0, 4);
                                        if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
                                        setNewCard(prev => ({ ...prev, expiry: v }));
                                      }}
                                      className={`w-full px-3 py-2 rounded-xl border text-sm outline-none ${isNight ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-800'}`}
                                    />
                                  </div>
                                  {newCard.type !== 'humo' && (
                                    <div>
                                      <p className={`text-xs mb-1 ${isNight ? 'text-gray-400' : 'text-gray-500'}`}>CVC</p>
                                      <input type="text" inputMode="numeric" placeholder="•••" maxLength={4}
                                        value={newCard.cvc}
                                        onChange={e => setNewCard(prev => ({ ...prev, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                                        className={`w-full px-3 py-2 rounded-xl border text-sm outline-none ${isNight ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-800'}`}
                                      />
                                    </div>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <p className={`text-xs mb-1 ${isNight ? 'text-gray-400' : 'text-gray-500'}`}>Имя</p>
                                    <input type="text" placeholder="Имя"
                                      value={newCard.firstName}
                                      onChange={e => setNewCard(prev => ({ ...prev, firstName: e.target.value }))}
                                      className={`w-full px-3 py-2 rounded-xl border text-sm outline-none ${isNight ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-800'}`}
                                    />
                                  </div>
                                  <div>
                                    <p className={`text-xs mb-1 ${isNight ? 'text-gray-400' : 'text-gray-500'}`}>Фамилия</p>
                                    <input type="text" placeholder="Фамилия"
                                      value={newCard.lastName}
                                      onChange={e => setNewCard(prev => ({ ...prev, lastName: e.target.value }))}
                                      className={`w-full px-3 py-2 rounded-xl border text-sm outline-none ${isNight ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-800'}`}
                                    />
                                  </div>
                                </div>
                                <button onClick={handleSaveNewCard} disabled={savingCard || !newCard.number || !newCard.firstName || !newCard.lastName}
                                  className="w-full py-3 rounded-xl bg-[#6D5DFB] text-white font-bold disabled:opacity-50">
                                  {savingCard ? 'Сохранение...' : 'Сохранить карту'}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* 🎟️ Promo code */}
                      <div className="mb-3">
                        {appliedPromo ? (
                          <div className={`flex items-center justify-between py-2.5 px-4 rounded-xl ${isNight ? 'bg-green-900/30' : 'bg-green-50'}`}>
                            <span className="text-sm text-green-600 font-medium">🎟️ {appliedPromo.code} −{formatPrice(appliedPromo.discount)}</span>
                            <button onClick={() => { setAppliedPromo(null); setPromoInput(''); }} className="text-xs text-red-500">убрать</button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <input
                              value={promoInput}
                              onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                              placeholder="Промокод"
                              className={`flex-1 px-3 py-2 rounded-xl border text-sm outline-none ${isNight ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-800'}`}
                            />
                            <button onClick={applyPromo} disabled={promoChecking || !promoInput.trim()}
                              className="px-4 py-2 rounded-xl bg-[#6D5DFB] text-white text-sm font-medium disabled:opacity-50">
                              {promoChecking ? '...' : 'Применить'}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* ⭐ Pay with loyalty points */}
                      {loyaltyBalance > 0 && (
                        <label className={`flex items-center justify-between py-2.5 px-4 rounded-xl mb-3 cursor-pointer ${isNight ? 'bg-slate-700' : 'bg-gray-50'}`}>
                          <span className={`text-sm ${isNight ? 'text-gray-300' : 'text-gray-600'}`}>
                            ⭐ Списать баллы (доступно {loyaltyBalance})
                          </span>
                          <input type="checkbox" checked={usePoints} onChange={(e) => setUsePoints(e.target.checked)} />
                        </label>
                      )}

                      {/* Totals breakdown */}
                      <div className={`py-3 px-4 rounded-xl mb-4 space-y-1 ${isNight ? 'bg-slate-700' : 'bg-gray-50'}`}>
                        {(promoDiscountValue > 0 || pointsDiscountValue > 0) && (
                          <>
                            <div className="flex justify-between text-sm">
                              <span className={isNight ? 'text-gray-400' : 'text-gray-500'}>Сумма:</span>
                              <span className={isNight ? 'text-gray-300' : 'text-gray-700'}>{formatPrice(getTotalCart())}</span>
                            </div>
                            {promoDiscountValue > 0 && (
                              <div className="flex justify-between text-sm text-green-600">
                                <span>Промокод:</span><span>−{formatPrice(promoDiscountValue)}</span>
                              </div>
                            )}
                            {pointsDiscountValue > 0 && (
                              <div className="flex justify-between text-sm text-green-600">
                                <span>Баллы:</span><span>−{formatPrice(pointsDiscountValue)}</span>
                              </div>
                            )}
                          </>
                        )}
                        <div className="flex justify-between items-center pt-1">
                          <span className={`text-sm ${isNight ? 'text-gray-300' : 'text-gray-600'}`}>Итого:</span>
                          <span className={`text-lg font-bold ${isNight ? 'text-white' : 'text-gray-900'}`}>{formatPrice(finalCheckoutTotal)}</span>
                        </div>
                      </div>

                      <button onClick={handlePlaceOrder} disabled={isCheckingOut || (checkoutPaymentMethod === 'card' && savedPaymentCards.length > 0 && !selectedCardId)}
                        className="w-full py-3 rounded-xl bg-[#6D5DFB] text-white font-bold disabled:opacity-50 flex items-center justify-center">
                        {isCheckingOut ? <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> : 'Оформить заказ'}
                      </button>
                    </div>
                  )}

                  {checkoutStep === 'cart' && (<>
                  <div className="flex-1 overflow-y-auto p-4">
                    {Object.keys(cart).length === 0 ? (
                      <div className="text-center py-10">
                        <p className={isNight ? 'text-gray-400' : 'text-gray-500'}>Ваша корзина пуста</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {Object.entries(cart).map(([productId, quantity]) => {
                          const product = products.find(p => p.id === Number(productId));
                          if (!product) return null;
                          
                          return (
                            <div key={productId} className={`p-3 rounded-2xl flex gap-3 border ${
                              isNight ? 'bg-[#171C2A] border-white/[0.06]' : 'bg-[#F6F7F9] border-black/[0.06]'
                            }`}>
                              {/* Image Thumbnail (auto-rotates through photos every 3s) */}
                              <div className="w-[72px] h-[72px] rounded-xl overflow-hidden flex-shrink-0" style={{ backgroundColor: isNight ? '#1E2130' : '#EBEDF1' }}>
                                <CartItemImage images={product.images} name={product.name} />
                              </div>

                              <div className="flex-1 min-w-0">
                                <h3 className={`text-sm font-semibold line-clamp-2 ${isNight ? 'text-white' : 'text-[#0B0E16]'}`}>
                                  {product.name}
                                </h3>
                                {/* Show selected variant (color + size) */}
                                {[selectedColors[product.id], selectedSizes[product.id]].filter(v => v && v !== 'юбй').length > 0 && (
                                  <p className="text-xs mt-0.5" style={{ color: isNight ? '#9CA3AF' : '#5B6472' }}>
                                    {[selectedColors[product.id], selectedSizes[product.id]].filter(v => v && v !== 'юбй').join(' · ')}
                                  </p>
                                )}
                                <div className="text-[15px] font-extrabold mt-1 text-[#E8472A]">
                                  {formatPrice(getPriceWithMarkup(product) * quantity)}
                                </div>

                                {/* Quantity stepper — пилюля как в Homepage */}
                                <div className="flex items-center gap-2.5 mt-2">
                                  <button
                                    onClick={() => removeFromCart(product.id)}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 transition-transform"
                                    style={{ backgroundColor: isNight ? '#1B2233' : '#EBEDF1' }}
                                  >
                                    <Minus className="w-4 h-4" style={{ color: isNight ? '#FFFFFF' : '#0B0E16' }} />
                                  </button>
                                  <span className={`text-sm font-bold w-5 text-center ${isNight ? 'text-white' : 'text-[#0B0E16]'}`}>
                                    {quantity}
                                  </span>
                                  <button
                                    onClick={() => addToCart(product.id)}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 transition-transform disabled:opacity-40"
                                    style={{ backgroundColor: '#6D5DFB' }}
                                    disabled={quantity >= (variantStocks[product.id] !== undefined ? variantStocks[product.id] : product.quantity)}
                                  >
                                    <Plus className="w-4 h-4 text-white" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Checkout Footer */}
                  {Object.keys(cart).length > 0 && (
                    <div className={`p-4 border-t mb-20 ${isNight ? 'border-white/[0.06] bg-[#08090D]' : 'border-black/[0.06] bg-white'}`}>
                      <div className="flex justify-between items-center mb-4">
                        <span className={isNight ? 'text-[#9CA3AF]' : 'text-[#5B6472]'}>Итого:</span>
                        <span className={`text-2xl font-extrabold ${isNight ? 'text-white' : 'text-[#0B0E16]'}`}>
                          {formatPrice(getTotalCart())}
                        </span>
                      </div>
                      <button
                        onClick={handleCheckout}
                        className="w-full text-white py-3.5 rounded-2xl font-bold transition-transform active:scale-[0.98] flex justify-center items-center"
                        style={{ backgroundColor: '#6D5DFB' }}
                      >
                        Оформить заказ
                      </button>
                    </div>
                  )}
                  </>)}
                </>
              ) : (
                // ORDERS TAB
                <div className="flex-1 overflow-y-auto p-4 pb-24">
                  {myOrders.length === 0 ? (
                    <div className="text-center py-12">
                      <ShoppingBag className={`w-16 h-16 mx-auto mb-4 ${isNight ? 'text-gray-600' : 'text-gray-300'}`} />
                      <p className={isNight ? 'text-gray-400' : 'text-gray-500'}>У вас пока нет заказов</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {myOrders.map((order) => (
                        <div
                          key={order.code}
                          className="rounded-2xl p-4 border"
                          style={{ backgroundColor: isNight ? '#171C2A' : '#F6F7F9', borderColor: isNight ? 'rgba(255,255,255,0.06)' : 'rgba(11,14,22,0.06)' }}
                        >
                          {/* Order Header */}
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`text-lg font-bold ${isNight ? 'text-white' : 'text-gray-900'}`}>
                                  #{order.code}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(order.status)}`}>
                                  {getStatusText(order.status)}
                                </span>
                              </div>
                              <div className={`flex items-center gap-1 text-xs mt-1 ${isNight ? 'text-gray-400' : 'text-gray-500'}`}>
                                <Clock className="w-3 h-3" />
                                {formatDate(order.date)}
                              </div>
                            </div>
                            <div className="text-lg font-extrabold text-[#E8472A]">
                              {formatPrice(order.total)}
                            </div>
                          </div>

                          {/* Items Summary */}
                          <div className={`text-sm mb-3 pb-3 border-b ${isNight ? 'border-slate-700 text-gray-300' : 'border-gray-200 text-gray-600'}`}>
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between py-1">
                                <span className="line-clamp-1 flex-1 pr-2">
                                  {item.quantity}x {item.name}
                                  {[item.color && item.color !== 'Любой' ? item.color : '', (item as any).size || ''].filter(Boolean).length > 0
                                    ? ` (${[item.color && item.color !== 'Любой' ? item.color : '', (item as any).size || ''].filter(Boolean).join(', ')})`
                                    : ''}
                                </span>
                                <span className="font-medium">{formatPrice(item.total)}</span>
                              </div>
                            ))}
                          </div>

                          {/* Actions */}
                          {(order.status === 'pending' || !order.status) && (
                            <button
                              onClick={() => handleCancelOrder(order)}
                              className="w-full py-2.5 rounded-xl border border-red-200 text-red-600 font-medium hover:bg-red-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                            >
                              <X className="w-4 h-4" />
                              Отменить заказ
                            </button>
                          )}
                          {(order.status === 'delivered' || order.status === 'completed') && (
                            <button
                              onClick={() => handleReturnOrder(order)}
                              className="w-full py-2.5 rounded-xl border border-orange-200 text-orange-600 font-medium hover:bg-orange-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                            >
                              <RotateCcw className="w-4 h-4" />
                              Вернуть товар
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <BottomNavigation 
        currentPage={showCart ? 'cart' : 'home'}
        cartItemsCount={getTotalItems()}
        likesCount={likedProductIds.length}
        displayMode={displayMode}
        onNavigate={(page) => {
          // Сначала закрываем корзину если она открыта
          if (showCart && page !== 'cart') {
            setShowCart(false);
          }
          
          if (page === 'likes' && onNavigateTo) {
            onNavigateTo('likes');
          } else if (page === 'cart') {
            handleOpenCart();
          } else if (page === 'home') {
            handleCloseCart();
          } else if (page === 'settings') {
            onOpenSettings();
          }
        }}
      />

      {/* Image Viewer Modal */}
      {viewingImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 z-[70] flex items-center justify-center p-4"
          onClick={() => {
            setViewingImage(null);
            setViewingImageIndex(0);
          }}
        >
          <div className="relative w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
             <img 
               src={viewingImage.url} 
               alt={viewingImage.name} 
               className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
             />
             <button
               onClick={() => setViewingImage(null)}
               className="absolute -top-10 right-0 text-white p-2"
             >
               <X className="w-8 h-8" />
             </button>
          </div>
        </div>
      )}
      
      {/* Order Confirmation Modal */}
      {showOrderConfirmation && confirmedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[80]">
          <div className={`rounded-xl p-6 max-w-sm w-full shadow-2xl ${
            isNight ? 'bg-slate-800' : 'bg-white'
          }`}>
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h3 className={`text-xl font-bold ${isNight ? 'text-white' : 'text-gray-900'}`}>Заказ оформлен!</h3>
              <p className={`text-sm ${isNight ? 'text-gray-400' : 'text-gray-500'}`}>
                Ваш заказ успешно принят
              </p>
            </div>
            
            {(() => {
              const codes = String(confirmedOrder.code).split(',').map(s => s.trim()).filter(Boolean);
              const multi = codes.length > 1;
              return (
                <div className={`bg-gray-50 rounded-lg p-4 mb-4 border-2 border-dashed border-gray-300 text-center`}>
                  <div className="text-sm text-gray-500 mb-1">
                    {multi ? `КОДЫ ВАШИХ ЗАКАЗОВ (${codes.length})` : 'КОД ВАШЕГО ЗАКАЗА'}
                  </div>
                  {multi && (
                    <div className="text-xs text-gray-400 mb-2">Товары из разных магазинов — по заказу на каждый</div>
                  )}
                  {multi ? (
                    <div className="flex flex-wrap justify-center gap-2">
                      {codes.map((code) => (
                        <span key={code} className="text-xl font-mono font-bold text-gray-900 tracking-wider bg-white px-3 py-1 rounded-lg border border-gray-200">
                          {code}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-3xl font-mono font-bold text-gray-900 tracking-wider">
                      {codes[0]}
                    </div>
                  )}
                </div>
              );
            })()}
            
            <button
              onClick={() => setShowOrderConfirmation(false)}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700"
            >
              Отлично
            </button>
          </div>
        </div>
      )}

      {/* Company Profile Modal */}
      {viewingCompanyId && (
        <div className="fixed inset-0 z-50 bg-white h-screen">
          <CompanyProfilePage
            companyId={viewingCompanyId}
            onBack={handleCloseCompany}
            onProductClick={(product) => {
              // Закрываем профиль компании и открываем товар
              setViewingCompanyId(null);
              handleOpenProduct(product);
            }}
            isNight={isNight}
            likedProductIds={likedProductIds}
            cart={cart}
            customerId={userPhone}
          />
        </div>
      )}
    </div>
  );
}