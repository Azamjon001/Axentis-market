import React, { useState, useEffect } from 'react';
import { CacheProvider } from './utils/cache';
import { ThemeProvider } from './utils/ThemeContext';
// LoginPage больше не используется - удалена старая страница регистрации/входа
import SmsVerification from './components/SmsVerification';
import CompanyLogin from './components/CompanyLogin';
import CompanyKeyVerification from './components/CompanyKeyVerification';
import HomePage from './components/HomePage';
import LikesPage from './components/LikesPage';
import SettingsPage from './components/SettingsPage';
import LoadingScreen from './components/LoadingScreen';
// ⚡ Код-сплиттинг: тяжёлые панели (админка, кабинет продавца, курьер, агент)
// загружаются лениво — покупатель не тянет их код при открытии витрины.
const AdminPanel = React.lazy(() => import('./components/AdminPanel'));
const ReferralAgentPanel = React.lazy(() => import('./components/ReferralAgentPanel')); // 👥 Панель реферальных агентов
const CourierPanel = React.lazy(() => import('./components/CourierPanel')); // 🚚 Панель курьера
import CourierLoginPage from './components/CourierLoginPage'; // 🚚 Логин курьера
const CompanyPanel = React.lazy(() => import('./components/CompanyPanel'));
const PaymentPage = React.lazy(() => import('./components/PaymentPage'));
import MobileOptimization from './components/MobileOptimization'; // 📱 МОБИЛЬНАЯ ОПТИМИЗАЦИЯ для покупателей
import CompanyMobileOptimization from './components/CompanyMobileOptimization'; // 🌐 Для компании как веб-сайт
import UserAuthPage from './components/UserAuthPage'; // 🆕 НОВЫЙ: Объединенная страница входа/регистрации
import PWAInstallPrompt from './components/PWAInstallPrompt'; // 🚀 PWA: Install Prompt
import { Toaster } from './components/ui/sonner'; // 🔔 Контейнер для всплывающих сообщений (toast)
import api, { getUserCart, saveUserCart } from './utils/api';
import { subscribeToReload } from './utils/reloadBroadcast';

type UserType = 'customer' | 'admin' | 'company' | null;

export default function App() {
  return (
    <ThemeProvider>
      <CacheProvider>
        <AppContent />
      </CacheProvider>
    </ThemeProvider>
  );
}

function AppContent() {
  const [currentCourier, setCurrentCourier] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<'register' | 'userLogin' | 'login' | 'sms' | 'companyLogin' | 'companyKey' | 'home' | 'likes' | 'settings' | 'admin' | 'company' | 'payment' | 'referralAgent' | 'courier' | 'courierLogin'>(() => {
    // 🔄 Восстановление страницы при загрузке
    if (typeof window !== 'undefined') {
      // Панель бизнеса раздаётся с префикса /business — убираем его,
      // чтобы внутренняя маршрутизация работала как раньше.
      const pathname = window.location.pathname.replace(/^\//, '').replace(/^business\/?/, '');
      const hash = window.location.hash.replace('#', '');
      const state = window.history.state;

      // Direct URL routes: axentis.uz/courier → courier login
      if (pathname === 'courier') return 'courierLogin';

      // 🔗 Смарт-ссылки шаринга: axentis.uz/product/123 и axentis.uz/company/45.
      // Переводим путь в существующий hash-механизм витрины и чистим URL.
      const shareMatch = pathname.match(/^(product|company)\/(\d+)/);
      if (shareMatch) {
        window.history.replaceState(null, '', `/#${shareMatch[1]}-${shareMatch[2]}`);
        window.location.hash = `${shareMatch[1]}-${shareMatch[2]}`;
        return 'home';
      }

      if (state && state.page) {
        return state.page;
      }

      // Hash-based routing
      if (hash === 'home') return 'home';
      if (hash === 'admin') return 'admin';
      if (hash === 'company') return 'company';
      if (hash === 'warehouse' || hash === 'sales' || hash === 'orders' || hash === 'analytics') return 'company';
      if (hash === 'cart' || hash === 'catalog' || hash.startsWith('product-') || hash.startsWith('company-')) return 'home';
      if (hash === 'courier') return 'courierLogin';
      if (hash === 'courier-login') return 'courierLogin';
    }
    return 'companyLogin'; // 🎯 Дефолтная страница - вход для компаний/админа
  });
  const [userType, setUserType] = useState<UserType>(null);
  const [pendingUser, setPendingUser] = useState<any>(null);
  const [currentReferralAgent, setCurrentReferralAgent] = useState<any>(null);
  const [currentCompany, setCurrentCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
// Likes state — loaded from backend on login/session restore
  const [likedProductIds, setLikedProductIds] = useState<number[]>([]);
  
  // Cart state — loaded from backend on login/session restore
  const [cart, setCart] = useState<{ [key: number]: number }>({});
  
  // 🎨 Selected colors for products (shared between HomePage and LikesPage)
  const [selectedColors, setSelectedColors] = useState<{ [key: number]: string }>(() => {
    const saved = localStorage.getItem('selectedColors');
    return saved ? JSON.parse(saved) : {};
  });
  
  // Image viewer state
  const [viewingImage, setViewingImage] = useState<{ url: string; name: string } | null>(null);
  const [viewingImageIndex, setViewingImageIndex] = useState(0); // 🆕 Индекс текущего изображения в карусели

  // 🎨 Save selected colors to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem('selectedColors', JSON.stringify(selectedColors));
    } catch (error) {
      console.error('❌ Error saving selected colors:', error);
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.log('🗑️ localStorage full, clearing old cache...');
        try {
          const keys = Object.keys(localStorage);
          keys.forEach(key => {
            if (key.startsWith('v2_') || key.startsWith('cache_')) {
              localStorage.removeItem(key);
            }
          });
        } catch (clearError) {
          console.error('❌ Error clearing cache:', clearError);
        }
      }
    }
  }, [selectedColors]);

  // 🔄 HISTORY API HANDLER FOR APP LEVEL
  useEffect(() => {
    // Initial State
    if (!window.history.state) {
      window.history.replaceState({ page: 'companyLogin' }, '', '#companyLogin');
    }

    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      if (state && state.page) {
        console.log('🔙 [App] Navigating to page:', state.page);
        setCurrentPage(state.page);
      } else {
        // Fallback for initial load or unknown state
        // setCurrentPage('userModeSelector'); 
        // Better to not touch it if we don't know
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Helper to change page with history
  const navigateTo = (page: typeof currentPage, replace = false) => {
    console.log(`🚀 [App] Navigating to ${page} (replace=${replace})`);
    
    // Preserve existing state props if needed (like 'view' from HomePage)
    // But since this is a top-level page change, we usually want a fresh state for that page
    // EXCEPT if we are sub-navigating.
    
    // For App level pages, we assume they are distinct roots
    const newState = { page };
    
    if (replace) {
      window.history.replaceState(newState, '', `#${page}`);
    } else {
      window.history.pushState(newState, '', `#${page}`);
    }
    setCurrentPage(page);
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    initializeApp();
  }, []);

  // 🔄 Подписка на события перезагрузки от админа
  useEffect(() => {
    console.log('🔔 [App] Подписка на события автоматической перезагрузки...');
    
    const unsubscribe = subscribeToReload(() => {
      console.log('🔄 [App] Админ запросил перезагрузку всех устройст!');
      console.log('⏱️ Перезагрузка через 2 секунды...');
      
      // Показываем уведомление пользователю
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        z-index: 999999;
        font-family: Arial, sans-serif;
        font-size: 16px;
        font-weight: 600;
        text-align: center;
        animation: slideDown 0.5s ease;
      `;
      notification.innerHTML = '🔄 Обновление системы...<br><small style="font-weight: 400; font-size: 14px;">Перезагрузка через 2 сек</small>';
      
      // Добавляем анимацию
      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `;
      document.head.appendChild(style);
      document.body.appendChild(notification);
      
      // Перезагружаем страницу через 2 секунды
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    });
    
    return () => {
      console.log('🔕 [App] Отписка от событий перезагрузки');
      unsubscribe();
    };
  }, []);

  const initializeApp = async () => {
    const startTime = Date.now(); // 🕐 Засекаем время начала
    const MINIMUM_LOADING_TIME = 4600; // ⏱️ Минимум 4.6 секунд
    
    try {
      console.log('🚀 [App] Initializing application...');
      
      // 🔍 ПЕРВЫМ ДЕЛОМ проверяем сохраненную сессию
      const savedSession = localStorage.getItem('userSession');
      console.log('🔍 [App] Checking for saved session...', savedSession ? 'FOUND' : 'NOT FOUND');
      
      if (savedSession) {
        try {
          const session = JSON.parse(savedSession);
          console.log('✅ [App] Session parsed successfully:', {
            userType: session.userType,
            hasUserData: !!session.userData,
            hasCompanyData: !!session.companyData
          });
          
          if (session.userType === 'customer' && session.userData) {
            console.log('👤 [App] Restoring customer session...');
            setPendingUser(session.userData);
            setUserType('customer');

            // Персональные эндпоинты (корзина, избранное, заказы) теперь требуют
            // JWT. Старые сессии могли сохраниться без токена — тихо перелогиниваем
            // (работает для аккаунтов без пароля; с паролем попросим войти заново).
            if (!api.getAuthToken() && session.userData?.phone) {
              try { await api.auth.loginUser(session.userData.phone); } catch (e) { console.warn('Silent re-login failed:', e); }
            }
            
            // Восстанавливаем company_id если есть
            if (session.userData.companyId) {
              console.log('🔒 [App] Restoring private company ID:', session.userData.companyId);
              setPrivateCompanyId(session.userData.companyId);
            }
            
            // Load user likes AND cart from backend API when restoring customer session,
            // BUT only if localStorage is empty (i.e. first install / data cleared).
            // localStorage is the source of truth — it is already loaded in useState initializer.
            if (session.userData?.phone) {
              // Always load cart and likes from backend (database is the only source of truth)
              console.log('🔄 [App] Loading likes and cart from backend...');
              try {
                const savedLikes = await api.users.getLikes(session.userData.phone);
                setLikedProductIds(Array.isArray(savedLikes) ? savedLikes : []);
              } catch (error) {
                console.error('❌ [App] Failed to load likes:', error);
              }
              try {
                const cartData = await getUserCart(session.userData.phone);
                if (cartData && typeof cartData === 'object' && 'quantities' in cartData) {
                  setCart((cartData as any).quantities || {});
                  if ((cartData as any).colors) setSelectedColors((cartData as any).colors);
                } else {
                  setCart(cartData && typeof cartData === 'object' ? cartData as any : {});
                }
              } catch (error) {
                console.error('❌ [App] Failed to load cart:', error);
              }
            }
            
            // ⏱️ Ждем минимальное время загрузки
            await ensureMinimumLoadingTime(startTime, MINIMUM_LOADING_TIME);
            
            // Переходим на главную страницу
            navigateTo('home', true);
            setLoading(false);
            console.log('✅ [App] Customer session restored successfully!');
            return;
          } else if (session.userType === 'admin' && session.userData) {
            console.log('👨‍💼 [App] Restoring admin session...');
            // Используем сохранённый admin JWT (живёт 168ч). Когда истечёт —
            // админ входит заново через форму; креды в коде не хранятся.
            setPendingUser(session.userData);
            setUserType('admin');
            
            // ⏱️ Ждем минимальное время загрузки
            await ensureMinimumLoadingTime(startTime, MINIMUM_LOADING_TIME);
            
            navigateTo('admin', true);
            setLoading(false);
            console.log('✅ [App] Admin session restored successfully!');
            return;
          } else if (session.userType === 'company' && session.companyData) {
            console.log('🏢 [App] Restoring company session...');
            setCurrentCompany(session.companyData);
            setUserType('company');
            
            // ⏱️ Ждем минимальное время загрузки
            await ensureMinimumLoadingTime(startTime, MINIMUM_LOADING_TIME);
            
            navigateTo('company', true);
            setLoading(false);
            console.log('✅ [App] Company session restored successfully!');
            return;
          } else if (session.userType === 'referralAgent' && session.agentData) {
            console.log('👥 [App] Restoring referral agent session...');
            setCurrentReferralAgent(session.agentData);

            // ⏱️ Ждем минимальное время загрузки
            await ensureMinimumLoadingTime(startTime, MINIMUM_LOADING_TIME);

            navigateTo('referralAgent', true);
            setLoading(false);
            console.log('✅ [App] Referral agent session restored successfully!');
            return;
          } else if (session.userType === 'courier' && session.courierData) {
            console.log('🚚 [App] Restoring courier session...');
            setCurrentCourier(session.courierData);
            await ensureMinimumLoadingTime(startTime, MINIMUM_LOADING_TIME);
            navigateTo('courier', true);
            setLoading(false);
            return;
          } else {
            console.log('⚠️ [App] Invalid session data, clearing...');
            localStorage.removeItem('userSession');
          }
        } catch (error) {
          console.error('❌ [App] Error restoring session:', error);
          localStorage.removeItem('userSession');
        }
      }
      
      // Check if any companies exist, if not create default one
      const companies = await api.companies.list();
      
      if (!companies || companies.length === 0) {
        console.log('📦 No companies found, creating default company...');
        const defaultKey = generateKey();
        
        try {
          const company = await api.auth.registerCompany({
            name: 'Главная компания',
            phone: '909383572',
            password: '24067',
            mode: 'public',
            description: '',
            access_key: defaultKey,
            referral_code: ''
          });
          
          // 🔒 БЕЗОПАСНОСТЬ: Данные компании показываются только ОДИН РАЗ при создании
          // После этого админ должен использовать админ-панель для просмотра данных
          console.log('\n%c╔═══════════════════════════════════════════════════════════════════╗', 'color: #00ff00; font-weight: bold;');
          console.log('%c║            🔑 ПЕРВАЯ КОМПАНИЯ СОЗДАНА!                           ║', 'color: #00ff00; font-weight: bold;');
          console.log('%c╚══════════════════════════════════════════════════════════════════╝', 'color: #00ff00; font-weight: bold;');
          console.log('\n%c⚠️ Данные компании показаны ОДИН РАЗ! Сохраните их.', 'color: #F44336; font-size: 14px; font-weight: bold;');
          console.log(`%c🔑 Ключ доступа: ${defaultKey}`, 'color: #FF9800; font-size: 16px; font-weight: bold;');
          console.log('\n%c💡 Для повторного просмотра используйте Админ панель', 'color: #2196F3; font-size: 12px;');
          console.log('\n');
        } catch (createError: any) {
          // If company already exists (race condition or database already has it)
          if (createError.message && createError.message.includes('already exists')) {
            console.log('ℹ️ Company already exists, fetching existing companies...');
            const existingCompanies = await api.companies.list();
            if (existingCompanies && existingCompanies.length > 0) {
              const firstCompany = existingCompanies[0];
              console.log('\n%c╔══════════════════════════════════════════════════════════════════╗', 'color: #2196F3; font-weight: bold;');
              console.log('%c║                  🔐 ДАННЫЕ КОМПАНИИ                              ║', 'color: #2196F3; font-weight: bold;');
              console.log('%c╚══════════════════════════════════════════════════════════════════╝', 'color: #2196F3; font-weight: bold;');
              console.log(`\n%c🏢 Название: ${firstCompany.name}`, 'color: #9C27B0; font-size: 14px;');
              console.log(`%c📱 Телефон: ${firstCompany.phone}`, 'color: #4CAF50; font-size: 14px;');
              console.log(`%c🔒 Пароль: ${firstCompany.password}`, 'color: #4CAF50; font-size: 14px;');
              console.log(`%c🔑 Ключ доступа: ${firstCompany.access_key}`, 'color: #FF9800; font-size: 16px; font-weight: bold;');
              console.log('\n%c💡 Для входа в компанию введите телефон, пароль, затем этот ключ', 'color: #2196F3; font-size: 12px;');
              console.log('\n');
            }
          } else {
            throw createError; // Re-throw if it's a different error
          }
        }
      } else {
        // Show first company key in console
        const firstCompany = companies[0];
        console.log('\n%c╔══════════════════════════════════════════════════════════════════╗', 'color: #2196F3; font-weight: bold;');
        console.log('%c║                  🔐 ДАННЫЕ ПЕРВОЙ КОМПАНИИ                       ║', 'color: #2196F3; font-weight: bold;');
        console.log('%c╚════════════════════════════════════════════════════════════════╝', 'color: #2196F3; font-weight: bold;');
        console.log(`\n%c🏢 Название: ${firstCompany.name}`, 'color: #9C27B0; font-size: 14px;');
        console.log(`%c📱 Телефон: ${firstCompany.phone}`, 'color: #4CAF50; font-size: 14px;');
        console.log(`%c🔒 Парол: ${firstCompany.password}`, 'color: #4CAF50; font-size: 14px;');
        console.log(`%c🔑 Ключ доступа: ${firstCompany.access_key}`, 'color: #FF9800; font-size: 16px; font-weight: bold;');
        console.log('\n%c💡 Для входа в компанию введите телефон, пароль, затем этот ключ', 'color: #2196F3; font-size: 12px;');
        console.log('\n');
      }
    } catch (error) {
      console.error('❌ Error initializing app:', error);
      
      // Check if it's a network error (backend not running)
      const errorMessage = (error as Error).message || '';
      
      if (errorMessage.includes('fetch') || errorMessage.includes('Network') || errorMessage.includes('Failed to fetch')) {
        alert('⚠️ Backend сервер не доступен!\n\n' +
              '1. Запустите backend: cd backend && npm run dev\n' +
              '2. Проверьте, что PostgreSQL запущен\n' +
              '3. Проверьте .env файл в backend папке\n\n' +
              'Backend должен работать на http://localhost:3000');
      } else if (!errorMessage.includes('already exists')) {
        alert('Ошибка инициализации приложения:\n' + errorMessage);
      }
    } finally {
      // ⏱️ ВСЕГДА ждем минимум 4.6 секунд перед показом контента
      await ensureMinimumLoadingTime(startTime, MINIMUM_LOADING_TIME);
      setLoading(false);
    }
  };

  const ensureMinimumLoadingTime = async (startTime: number, minimumTime: number) => {
    const elapsedTime = Date.now() - startTime;
    const remainingTime = minimumTime - elapsedTime;
    
    if (remainingTime > 0) {
      console.log(`⏱️ Waiting ${remainingTime}ms to ensure minimum loading time of ${minimumTime}ms`);
      await new Promise(resolve => setTimeout(resolve, remainingTime));
    } else {
      console.log(`✅ Loading took ${elapsedTime}ms (minimum ${minimumTime}ms already exceeded)`);
    }
  };

  const generateKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = '';
    for (let i = 0; i < 30; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  };

  const handleUserLogin = async (userData: any) => {
    console.log('🔐 handleUserLogin called with userData:', userData);
    setPendingUser(userData);

    // Check if this is admin login (already verified via backend in the login form)
    if (userData.isAdmin) {
      console.log('✅ Admin detected! Opening admin panel...');
      // Admin login - go directly to admin panel
      setUserType('admin');
      navigateTo('admin', true);
      
      // Save admin session
      localStorage.setItem('userSession', JSON.stringify({
        userType: 'admin',
        userData: userData
      }));
      console.log('💾 Admin session saved');
      return;
    }
    
    // Regular customer - login directly without SMS verification
    handleCustomerLogin(userData);
  };

  const handleCustomerLogin = async (userData: any) => {
    try {
      // Регистрация/вход пользователя (API сам определит существует ли пользователь)
      const fullName = `${userData.firstName} ${userData.lastName}`.trim();
      const response = await api.auth.registerUser(userData.phone, fullName);
      
      console.log('✅ User registration/login response:', response);
      
      // Update pendingUser with database user info if needed
      if (response.user) {
        // Split name into firstName and lastName
        const nameParts = (response.user.name || '').split(' ');
        const firstName = nameParts[0] || userData.firstName || '';
        const lastName = nameParts.slice(1).join(' ') || userData.lastName || '';
        
        setPendingUser({
          ...userData,
          id: response.user.id,
          firstName: firstName,
          lastName: lastName,
          companyId: response.user.company_id
        });
      }
      
      // Always load likes and cart from backend (database is the only source of truth)
      console.log('🔄 Loading likes and cart from backend for phone:', userData.phone);
      try {
        const savedLikes = await api.users.getLikes(userData.phone);
        setLikedProductIds(Array.isArray(savedLikes) ? savedLikes : []);
      } catch (error) {
        console.error('❌ Failed to load user likes:', error);
      }
      try {
        const savedCart = await getUserCart(userData.phone);
        setCart(savedCart && typeof savedCart === 'object' ? savedCart : {});
      } catch (error) {
        console.error('❌ Failed to load cart:', error);
      }
      
      setUserType('customer');
      navigateTo('home', true);
      
      // Save customer session with the actual user data from database
      const sessionData = {
        userType: 'customer',
        userData: {
          ...userData,
          id: response.user?.id,
          firstName: response.user?.name?.split(' ')[0] || userData.firstName,
          lastName: response.user?.name?.split(' ').slice(1).join(' ') || userData.lastName,
          phone: userData.phone,
          companyId: response.user?.company_id
        }
      };
      
      localStorage.setItem('userSession', JSON.stringify(sessionData));
      console.log('💾 ✅ Customer session saved to localStorage!');
      console.log('📱 Session data:', {
        userType: sessionData.userType,
        userName: `${sessionData.userData.firstName} ${sessionData.userData.lastName}`,
        hasCompanyId: !!sessionData.userData.companyId
      });
      console.log('🔄 On next app load, user will be automatically logged in!');
    } catch (error) {
      console.error('Error saving user:', error);
      alert('Ошибка при сохранении данных. Попробуйте снова.');
    }
  };

  const handleSmsVerify = async (code: string) => {
    // Check for admin access — креды проверяет бэкенд, не фронтенд.
    let adminOk = false;
    try {
      const resp = await api.auth.loginAdmin(pendingUser.phone, code);
      adminOk = !!resp?.token;
    } catch { /* не админ */ }
    if (adminOk) {
      setUserType('admin');
      navigateTo('admin', true);
      
      // Save admin session
      localStorage.setItem('userSession', JSON.stringify({
        userType: 'admin',
        userData: pendingUser
      }));
      console.log('💾 Admin session saved');
    } else {
      // Regular customer - save to backend
      try {
        const fullName = `${pendingUser.firstName} ${pendingUser.lastName}`.trim();
        const response = await api.auth.registerUser(pendingUser.phone, fullName);
        
        console.log('✅ User registration/login response:', response);
        
        // Update pendingUser with database user info if needed
        if (response.user) {
          // Split name into firstName and lastName
          const nameParts = (response.user.name || '').split(' ');
          const firstName = nameParts[0] || pendingUser.firstName || '';
          const lastName = nameParts.slice(1).join(' ') || pendingUser.lastName || '';
          
          setPendingUser({
            ...pendingUser,
            id: response.user.id,
            firstName: firstName,
            lastName: lastName
          });
        }
        
        // Load user likes from backend API
        console.log('🔄 Loading user likes from backend for phone:', pendingUser.phone);
        try {
          const savedLikes = await api.users.getLikes(pendingUser.phone);
          if (savedLikes && savedLikes.length > 0) {
            console.log('✅ User likes loaded:', savedLikes.length, 'products');
            setLikedProductIds(savedLikes);
          } else {
            console.log('ℹ️ No likes found for user');
            setLikedProductIds([]);
          }
        } catch (error) {
          console.error('❌ Failed to load user likes:', error);
          setLikedProductIds([]);
        }
        
        setUserType('customer');
        setCurrentPage('home');
        
        // Save customer session with the actual user data from database
        localStorage.setItem('userSession', JSON.stringify({
          userType: 'customer',
          userData: {
            ...pendingUser,
            id: response.user?.id,
            firstName: response.user?.first_name || pendingUser.firstName,
            lastName: response.user?.last_name || pendingUser.lastName
          }
        }));
        console.log('💾 Customer session saved');
      } catch (error) {
        console.error('Error saving user:', error);
        alert('Ошибка при сохранении данных. Попробуйте снова.');
      }
    }
  };

  const handleCompanyLogin = async (companyData: any) => {
    try {
      console.log('🔐 Company login with data:', companyData);

      // 🚚 Redirect to courier login page
      if (companyData?.goCourierLogin) {
        navigateTo('courierLogin', true);
        return true;
      }

      // 👥 Проверка на реферального агента
      if (companyData?.isReferralAgent && companyData?.agent) {
        console.log('👥 Referral agent detected, redirecting to agent panel...');
        setCurrentReferralAgent(companyData.agent);
        navigateTo('referralAgent', true);
        
        // Сохраняем сессию агента
        localStorage.setItem('userSession', JSON.stringify({
          userType: 'referralAgent',
          agentData: companyData.agent
        }));
        console.log('💾 Referral agent session saved');
        return true;
      }
      
      console.log('🔍 CompanyData details:', {
        id: companyData?.id,
        name: companyData?.name,
        phone: companyData?.phone,
        company_id: companyData?.company?.id,
        company_name: companyData?.company?.name,
        fullObject: companyData
      });
      
      // 🔑 Проверка на админа: CompanyLogin уже получил admin JWT у бэкенда
      // и пометил объект isAdmin — никаких захардкоженных кредов здесь.
      if (companyData?.isAdmin) {
        console.log('🔐 Admin detected, redirecting to admin panel...');
        setCurrentCompany({
          id: 0,
          name: 'Admin',
          phone: companyData.phone,
          mode: 'admin',
          status: 'active',
          isAdmin: true
        });
        setCurrentPage('admin');
        return true;
      }
      
      // Обычный вход компании
      console.log('✅ Company login successful:', companyData);
      
      // ⚠️ ЗАЩИТА: Проверяем что companyId существует и не равен 0
      if (!companyData.id || companyData.id === 0) {
        console.error('❌ CRITICAL ERROR: Company ID is missing or zero!', companyData);
        alert('❌ Ошибка: Не удалось получить ID компании. Обратитесь к администратору.');
        return false;
      }
      
      console.log('✅ Setting company with ID:', companyData.id);
      setCurrentCompany(companyData);
      setCurrentPage('companyKey');
      return true;
    } catch (error) {
      console.error('❌ Error during company login:', error);
      const errorMessage = (error as Error).message;
      
      // Более понятные сообщения об ошибках
      if (errorMessage.includes('not found') || errorMessage.includes('Invalid credentials')) {
        alert('Неверный телефон или пароль');
      } else {
        alert('Ошибка входа: ' + errorMessage);
      }
      return false;
    }
  };

  const handleCompanyKeyVerify = async (key: string) => {
    try {
      if (!currentCompany) {
        console.error('❌ No current company set!');
        alert('Ошибка: компания не выбрана. Войдите заново.');
        setCurrentPage('companyLogin');
        return false;
      }
      
      console.log('🔑 Verifying access key for company:', currentCompany.id);
      
      // спользуем API для проверки ключа доступа из баы данных
      const company = await api.companies.verifyAccess(currentCompany.id, key);
      
      console.log('✅ Access key verified successfully');
      setUserType('company');
      setCurrentPage('company');
      
      // Save company session with verified company data
      localStorage.setItem('userSession', JSON.stringify({
        userType: 'company',
        companyData: company
      }));
      console.log('💾 Company session saved');
      return true;
    } catch (error) {
      console.error('❌ Error verifying company key:', error);
      const errorMessage = (error as Error).message;
      
      // Более понятные собщения об ошибках
      if (errorMessage.includes('Invalid access key')) {
        alert('Неверный ключ доступа');
      } else {
        alert('Ошибка проверки ключа: ' + errorMessage);
      }
      return false;
    }
  };

  const handleLogout = () => {
    setUserType(null);
    setPendingUser(null);
    setCurrentCompany(null);
    setCurrentReferralAgent(null);
    setCurrentPage('companyLogin');
    localStorage.removeItem('userSession');
    // Clear user-specific cart and likes from localStorage on logout
    localStorage.removeItem('userCart');
    localStorage.removeItem('userLikes');
    setCart({});
    setLikedProductIds([]);
    console.log('💾 Session cleared');
    window.history.pushState({ page: 'companyLogin' }, '', '#companyLogin');
  };

  const switchToCompanyLogin = () => {
    setCurrentPage('companyLogin');
  };

  const switchToCustomerLogin = () => {
    // ✅ ИСПРАВЛЕНО: Возвращаемся к панели входа для компаний
    setCurrentPage('companyLogin');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ✅ Разные оптимизации для разных типов пользователей */}
      {userType === 'company' ? (
        <CompanyMobileOptimization /> // 🌐 Компания как обычный веб-сайт
      ) : (
        <>
          <MobileOptimization /> {/* 📱 Для покупателей - полная оптимизация */}
          <PWAInstallPrompt /> {/* 🚀 PWA только для покупателей */}
        </>
      )}
      
      {loading ? (
        <LoadingScreen />
      ) : (
        <>
          {/* УДАЛЕНО: userModeSelector и userLogin - теперь по умолчанию только CompanyLogin */}
          {/* Старая страница login удалена - используем только companyLogin */}
          {currentPage === 'sms' && (
            <SmsVerification 
              phone={pendingUser?.phone}
              onVerify={handleSmsVerify}
              onBack={() => setCurrentPage('companyLogin')}
            />
          )}
          {currentPage === 'companyLogin' && (
            <CompanyLogin 
              onLogin={handleCompanyLogin}
            />
          )}
          {currentPage === 'companyKey' && (
            <CompanyKeyVerification 
              onVerify={handleCompanyKeyVerify}
              onBack={() => setCurrentPage('companyLogin')}
            />
          )}
          {currentPage === 'home' && (
            <HomePage 
              onLogout={handleLogout}
              userName={pendingUser ? `${pendingUser.firstName} ${pendingUser.lastName}` : undefined}
              userPhone={pendingUser?.phone}
              userCompanyId={pendingUser?.companyId}
              userMode={pendingUser?.mode || (pendingUser?.companyId ? 'private' : 'public')}
              onOpenSettings={() => navigateTo('settings')}
              onNavigateTo={(page) => navigateTo(page)}
              onLikesChange={(likes) => setLikedProductIds(likes)}
              likedProductIds={likedProductIds}
              setLikedProductIds={setLikedProductIds}
              cart={cart}
              setCart={setCart}
              selectedColors={selectedColors}
              setSelectedColors={setSelectedColors}
            />
          )}
          {currentPage === 'likes' && (
            <LikesPage 
              likedProductIds={likedProductIds}
              setLikedProductIds={setLikedProductIds}
              cart={cart}
              setCart={setCart}
              selectedColors={selectedColors}
              setSelectedColors={setSelectedColors}
              onBackToHome={() => navigateTo('home')}
              onLogout={handleLogout}
              userName={pendingUser ? `${pendingUser.firstName} ${pendingUser.lastName}` : undefined}
              userPhone={pendingUser?.phone}
              viewingImage={viewingImage}
              setViewingImage={setViewingImage}
              viewingImageIndex={viewingImageIndex}
              setViewingImageIndex={setViewingImageIndex}
              onNavigateTo={(page) => {
                if (page === 'home') {
                  navigateTo('home');
                } else if (page === 'cart') {
                  // Open cart on home page
                  localStorage.setItem('openCartOnLoad', 'true');
                  navigateTo('home');
                } else if (page === 'settings') {
                  navigateTo('settings');
                }
              }}
            />
          )}
          {currentPage === 'settings' && (
            <SettingsPage 
              onLogout={handleLogout}
              userName={pendingUser ? `${pendingUser.firstName} ${pendingUser.lastName}` : undefined}
              userPhone={pendingUser?.phone}
              onBackToHome={() => navigateTo('home')}
              onNavigateTo={(page) => {
                if (page === 'home') {
                  navigateTo('home');
                } else if (page === 'cart') {
                  // Open cart on home page
                  localStorage.setItem('openCartOnLoad', 'true');
                  navigateTo('home');
                } else if (page === 'likes') {
                  navigateTo('likes');
                }
              }}
            />
          )}
          {currentPage === 'admin' && (
            <React.Suspense fallback={<LoadingScreen />}>
              <AdminPanel onLogout={handleLogout} />
            </React.Suspense>
          )}
          {currentPage === 'referralAgent' && (
            <React.Suspense fallback={<LoadingScreen />}>
              <ReferralAgentPanel agentData={currentReferralAgent} onLogout={handleLogout} />
            </React.Suspense>
          )}
          {currentPage === 'company' && currentCompany && (
            <React.Suspense fallback={<LoadingScreen />}>
              <CompanyPanel
                onLogout={handleLogout}
                companyId={currentCompany.id}
                companyName={currentCompany.name}
              />
            </React.Suspense>
          )}
          {currentPage === 'payment' && (
            <React.Suspense fallback={<LoadingScreen />}>
              <PaymentPage
                onBackToHome={() => setCurrentPage('home')}
                onLogout={handleLogout}
                userName={pendingUser ? `${pendingUser.firstName} ${pendingUser.lastName}` : undefined}
                userPhone={pendingUser?.phone}
              />
            </React.Suspense>
          )}
          {currentPage === 'courierLogin' && (
            <CourierLoginPage
              onLogin={(data) => {
                setCurrentCourier(data);
                localStorage.setItem('userSession', JSON.stringify({ userType: 'courier', courierData: data }));
                navigateTo('courier', true);
              }}
              onBack={() => navigateTo('companyLogin', true)}
            />
          )}
          {currentPage === 'courier' && currentCourier && (
            <React.Suspense fallback={<LoadingScreen />}>
              <CourierPanel
                courierData={currentCourier}
                onLogout={() => {
                  setCurrentCourier(null);
                  localStorage.removeItem('userSession');
                  navigateTo('companyLogin', true);
                }}
              />
            </React.Suspense>
          )}

        </>
      )}

      {/* 🔔 Глобальный контейнер toast-сообщений. Без него toast.success/error
          из любого компонента (загрузка рекламы в SMM-панели и т.д.) не отображались. */}
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}