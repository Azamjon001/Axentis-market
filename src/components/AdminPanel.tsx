import React, { useState, useEffect } from 'react';
import { Shield, LogOut, Users, Trash2, Building2, Save, RefreshCw, Eye, EyeOff, CreditCard, Megaphone, Menu, X, Copy, Check, Package, Bell, BarChart3, Tag, Ticket, Truck, MessageSquare, Globe, Film, Flag } from 'lucide-react';
import api from '../utils/api';
// ⚡ Каждый раздел админки — ленивый чанк: панель открывается быстро, код
// раздела подгружается по клику на пункт меню.
const CompanyManagement = React.lazy(() => import('./CompanyManagement'));
const PaymentSettings = React.lazy(() => import('./PaymentSettings'));
const PaymentHistoryPanel = React.lazy(() => import('./PaymentHistoryPanel'));
const AdminAdsPanel = React.lazy(() => import('./AdminAdsPanel'));
const AdminCategoriesPanel = React.lazy(() => import('./AdminCategoriesPanel'));
const AdminNotificationsPanel = React.lazy(() => import('./AdminNotificationsPanel'));
const AdminCompanyMessagesPanel = React.lazy(() => import('./AdminCompanyMessagesPanel'));
const BroadcastChatPanel = React.lazy(() => import('./BroadcastChatPanel'));
const AdminRegionsPanel = React.lazy(() => import('./AdminRegionsPanel'));
const AdminDecorationVideosPanel = React.lazy(() => import('./AdminDecorationVideosPanel')); // 🎬 Видео-декорации
const AdminAnalyticsPanel = React.lazy(() => import('./AdminAnalyticsPanel'));
const AdminDiscountsPanel = React.lazy(() => import('./AdminDiscountsPanel'));
const AdminPromoCodesPanel = React.lazy(() => import('./AdminPromoCodesPanel'));
const AdminPlatformDashboard = React.lazy(() => import('./AdminPlatformDashboard'));
const AdminComplaintsPanel = React.lazy(() => import('./AdminComplaintsPanel'));
const AdminGlobalSearch = React.lazy(() => import('./AdminGlobalSearch'));
const AdminReferralPanel = React.lazy(() => import('./AdminReferralPanel')); // 👥 Реферальная система
const CouriersManagementPanel = React.lazy(() => import('./CouriersManagementPanel')); // 🚚 Курьеры
const AdminSecurityPanel = React.lazy(() => import('./AdminSecurityPanel')); // 🔐 Безопасность (смена пароля админа)
const AdminPoliciesPanel = React.lazy(() => import('./AdminPoliciesPanel')); // 📜 Политика конфиденциальности
const AdminPayoutsPanel = React.lazy(() => import('./AdminPayoutsPanel')); // 💸 Выплаты компаниям

// Спиннер на время подгрузки раздела
const AdminTabLoading = () => (
  <div className="flex items-center justify-center py-24 text-gray-400 gap-2">
    <RefreshCw className="w-5 h-5 animate-spin" />
    Загрузка раздела...
  </div>
);
import { broadcastReload } from '../utils/reloadBroadcast';
import { getCurrentLanguage, type Language, useTranslation } from '../utils/translations';

interface AdminPanelProps {
  onLogout: () => void;
}

export default function AdminPanel({ onLogout }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'companies' | 'payment' | 'history' | 'ads' | 'categories' | 'notifications' | 'companyMessages' | 'discounts' | 'referrals' | 'promo' | 'dashboard' | 'complaints' | 'couriers' | 'chat' | 'regions' | 'decorationVideos' | 'security' | 'policies' | 'payouts'>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // 📱 Для мобильной версии
  
  // 🌍 Система локализации для админа (заблокирована на русском)
  const [language, setLanguage] = useState<Language>(getCurrentLanguage());
  const t = useTranslation(language);
  
  const [stats, setStats] = useState({
    users: 0
  });
  const [loading, setLoading] = useState(true);
  const [companyData, setCompanyData] = useState({
    name: '',
    phone: '',
    password: '',
    access_key: ''
  });
  const [originalCompanyData, setOriginalCompanyData] = useState({
    name: '',
    phone: '',
    password: '',
    access_key: ''
  });
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showAccessKey, setShowAccessKey] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    
    // 🔄 Auto-refresh every 10 seconds
    console.log('🔄 [Admin] Setting up auto-refresh every 10 seconds');
    const intervalId = setInterval(() => {
      console.log('🔄 [Admin] Auto-refreshing data...');
      loadData();
    }, 10000); // 10 seconds
    
    // Cleanup on unmount
    return () => {
      console.log('🛑 [Admin] Stopping auto-refresh');
      clearInterval(intervalId);
    };
  }, []);

  // 🔄 HISTORY API HANDLER
  useEffect(() => {
    // Initial state setup - preserve page: 'admin' context
    const currentState = window.history.state || {};
    window.history.replaceState({ ...currentState, tab: 'overview', page: 'admin' }, '', '#overview');

    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.tab) {
        setActiveTab(event.state.tab);
      } else {
        // Fallback to default
        setActiveTab('overview');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Custom Navigation Handler
  const handleNavigate = (tab: typeof activeTab) => {
    // ИСПРАВЛЕНИЕ: Убрал проверку чтобы не требовался двойной клик
    // Include page: 'admin' so App.tsx knows where we are
    window.history.pushState({ tab: tab, page: 'admin' }, '', `#${tab}`);
    setActiveTab(tab);
    setIsSidebarOpen(false); // Закрываем sidebar на мобильных
    window.scrollTo(0, 0);
  };

  const loadData = async () => {
    try {
      await Promise.all([loadStats(), loadCompanyData()]);
    } catch (error) {
      console.error('Error loading admin data:', error);
      alert('Ошибка загрузки данных админа');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      // ✅ Используем API client вместо прямого fetch
      const data = await api.users.count();
      setStats({
        users: data.count || 0
      });
    } catch (error) {
      console.error('Error loading stats:', error);
      setStats({ users: 0 });
    }
  };

  const handleCopyToClipboard = async (text: string, fieldName: string) => {
    try {
      // 📍 Проверяем наличие Clipboard API
      if (!navigator.clipboard) {
        // Fallback для старых браузеров
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (!successful) {
          throw new Error('execCommand failed');
        }
      } else {
        await navigator.clipboard.writeText(text);
      }
      
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
      console.log(`✅ Скопировано: ${text}`);
    } catch (err) {
      console.error('Ошибка копирования:', err);
      // Показываем более информативное сообщение
      alert(`Не удалось скопировать. \n\nКлюч доступа: ${text}\n\nСкопируйте вручную.`);
    }
  };

  const loadCompanyData = async () => {
    try {
      console.log('🏢 Loading company data...');
      // Получаем первую компанию из списка
      const companies = await api.companies.list();
      const company = companies && companies.length > 0 ? companies[0] : null;
      
      if (company) {
        console.log('✅ Company data loaded:', company);
        // 🔒 Учётные данные не подгружаются: поля пустые и служат только
        // для установки НОВЫХ значений (политика конфиденциальности).
        const data = {
          name: company.name || '',
          phone: '',
          password: '',
          access_key: ''
        };
        setCompanyData(data);
        setOriginalCompanyData(data);
      } else {
        throw new Error('No companies found');
      }
    } catch (error) {
      console.warn('⚠️ Error in loadCompanyData (fallback to defaults):', error);
      const defaultData = {
        name: 'Главная компания',
        phone: '',
        password: '',
        access_key: ''
      };
      setCompanyData(defaultData);
      setOriginalCompanyData(defaultData);
    }
  };

  const handleSaveCompany = async () => {
    try {
      // Валидация
      if (!companyData.name.trim()) {
        alert('Введите название компании');
        return;
      }
      
      // 🔒 Учётные данные скрыты и не подгружаются — поля заполняются только
      // для ЗАМЕНЫ. Пустое поле означает «оставить как есть».
      const phoneDigits = companyData.phone.replace(/\s/g, '');
      if (phoneDigits && (phoneDigits.length !== 9 || !/^\d+$/.test(phoneDigits))) {
        alert('Номер телефона должен содержать 9 цифр');
        return;
      }

      if (companyData.access_key && (companyData.access_key.length !== 30 || !/^\d+$/.test(companyData.access_key))) {
        alert('Ключ доступа должен содержать 30 цифр');
        return;
      }

      setSaving(true);

      // Получаем первую компанию и обновляем её
      const companies = await api.companies.list();
      if (companies && companies.length > 0) {
        const companyId = companies[0].id;
        await api.companies.update(companyId.toString(), {
          name: companyData.name,
          phone: phoneDigits || undefined,
          password: companyData.password || undefined,
          access_key: companyData.access_key || undefined
        });
      } else {
        throw new Error('No company found to update');
      }
      
      setOriginalCompanyData(companyData);
      alert('✅ Данные компании успешно обновлены!');
      
      // Перезагрузить данные
      await loadCompanyData();
    } catch (error) {
      console.error('Error saving company:', error);
      alert('Ошибка при сохранении данных компании');
    } finally {
      setSaving(false);
    }
  };

  const handleResetCompany = () => {
    setCompanyData(originalCompanyData);
  };

  const hasChanges = JSON.stringify(companyData) !== JSON.stringify(originalCompanyData);

  const clearAllData = async (type: 'users' | 'all') => {
    const confirmMessage =
      type === 'users' ? 'Удалить всех пользователей?' :
      'Удалить ВСЕ данные пользователей (аккаунты, корзины, избранное, адреса)? Это действие нельзя отменить!';

    if (!confirm(confirmMessage)) return;
    // Двойное подтверждение — операция необратима
    if (!confirm('Вы уверены? Восстановить данные будет невозможно.')) return;

    try {
      const res = await api.users.purge(type);
      await loadStats();
      const total = res?.deleted ? Object.values(res.deleted as Record<string, number>).reduce((s, n) => s + n, 0) : 0;
      alert(`✅ Данные удалены (записей: ${total})`);
    } catch (error) {
      console.error('Error clearing data:', error);
      alert('Ошибка при удалении данных');
    }
  };

  const handleReloadAllDevices = async () => {
    if (!confirm('🔄 Перезагрузить ВСЕ устройства?\n\nВсе смартфоны, планшеты и компьютеры с открытым приложением будут автоматически перезагружены через 2 секунды.\n\nЭто полезно после изменения настроек оплаты или других системных параметров.')) {
      return;
    }

    try {
      console.log('📡 [Admin] Отправка команды перезагрузки...');
      
      await broadcastReload();
      
      alert('✅ Команда перезагрузки отправлена!\n\nВсе устройства будут перезагружены через 2 секунды.\n\nВаше устройство тоже будет перезагружено.');
      
      // Перезагружаем также админ панель через 2 секунды
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('❌ Error broadcasting reload:', error);
      alert('Ошибка при отправке команды перезагрузки');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* 📱 Overlay для мобильных (при открытом sidebar) */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar слева - РЕСПОНСИВНЫЙ */}
      <aside className={`
        w-64 bg-[#13132A] text-white shadow-xl border-r border-white/10 
        fixed h-full z-30 transition-transform duration-300 flex flex-col
        lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8" />
              <div>
                <h1 className="text-xl font-bold">Админ Панель</h1>
                <p className="text-gray-400 text-xs">Панель управления платформой</p>
              </div>
            </div>
            {/* Кнопка закрытия для мобильных */}
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-1 hover:bg-white/20 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation - with flex-1 to take available space */}
        <nav className="flex-1 overflow-y-auto px-6 space-y-2 pb-4">
            <button
              onClick={() => handleNavigate('overview')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                activeTab === 'overview'
                  ? 'bg-[#7C5CF0] text-white shadow-lg shadow-purple-900/40'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Shield className="w-5 h-5" />
              <span className="font-medium">Обзор</span>
            </button>

            <button
              onClick={() => handleNavigate('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                activeTab === 'dashboard'
                  ? 'bg-[#7C5CF0] text-white shadow-lg shadow-purple-900/40'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <BarChart3 className="w-5 h-5" />
              <span className="font-medium">{language === 'uz' ? 'Platforma' : 'Дашборд платформы'}</span>
            </button>

            <button
              onClick={() => handleNavigate('complaints')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                activeTab === 'complaints'
                  ? 'bg-[#7C5CF0] text-white shadow-lg shadow-purple-900/40'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Flag className="w-5 h-5" />
              <span className="font-medium">{language === 'uz' ? 'Shikoyatlar' : 'Жалобы'}</span>
            </button>

            <button
              onClick={() => handleNavigate('analytics')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                activeTab === 'analytics'
                  ? 'bg-[#7C5CF0] text-white shadow-lg shadow-purple-900/40'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <BarChart3 className="w-5 h-5" />
              <span className="font-medium">Аналитика</span>
            </button>

            <button
              onClick={() => handleNavigate('companies')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                activeTab === 'companies'
                  ? 'bg-[#7C5CF0] text-white shadow-lg shadow-purple-900/40'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Building2 className="w-5 h-5" />
              <span className="font-medium">Компании</span>
            </button>

            <button
              onClick={() => handleNavigate('payment')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                activeTab === 'payment'
                  ? 'bg-[#7C5CF0] text-white shadow-lg shadow-purple-900/40'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <CreditCard className="w-5 h-5" />
              <span className="font-medium">Оплата</span>
            </button>

            <button
              onClick={() => handleNavigate('ads')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                activeTab === 'ads'
                  ? 'bg-[#7C5CF0] text-white shadow-lg shadow-purple-900/40'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Megaphone className="w-5 h-5" />
              <span className="font-medium">Реклама</span>
            </button>

            <button
              onClick={() => handleNavigate('categories')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                activeTab === 'categories'
                  ? 'bg-[#7C5CF0] text-white shadow-lg shadow-purple-900/40'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Package className="w-5 h-5" />
              <span className="font-medium">Категории</span>
            </button>

            <button
              onClick={() => handleNavigate('notifications')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                activeTab === 'notifications'
                  ? 'bg-[#7C5CF0] text-white shadow-lg shadow-purple-900/40'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Bell className="w-5 h-5" />
              <span className="font-medium">Уведомления</span>
            </button>

            <button
              onClick={() => handleNavigate('companyMessages')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                activeTab === 'companyMessages'
                  ? 'bg-[#7C5CF0] text-white shadow-lg shadow-purple-900/40'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Building2 className="w-5 h-5" />
              <span className="font-medium">Сообщения компаниям</span>
            </button>

            <button
              onClick={() => handleNavigate('chat')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                activeTab === 'chat'
                  ? 'bg-[#7C5CF0] text-white shadow-lg shadow-purple-900/40'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
              <span className="font-medium">{language === 'uz' ? 'Umumiy chat' : 'Общий чат'}</span>
            </button>

            <button
              onClick={() => handleNavigate('regions')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                activeTab === 'regions'
                  ? 'bg-[#7C5CF0] text-white shadow-lg shadow-purple-900/40'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Globe className="w-5 h-5" />
              <span className="font-medium">{language === 'uz' ? 'Regionlar' : 'Регионы'}</span>
            </button>

            <button
              onClick={() => handleNavigate('decorationVideos')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                activeTab === 'decorationVideos'
                  ? 'bg-[#7C5CF0] text-white shadow-lg shadow-purple-900/40'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Film className="w-5 h-5" />
              <span className="font-medium">{language === 'uz' ? 'Video-bezaklar' : 'Видео-декорации'}</span>
            </button>

            <button
              onClick={() => handleNavigate('discounts')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                activeTab === 'discounts'
                  ? 'bg-[#7C5CF0] text-white shadow-lg shadow-purple-900/40'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Tag className="w-5 h-5" />
              <span className="font-medium">Модерация скидок</span>
            </button>

            <button
              onClick={() => handleNavigate('promo')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                activeTab === 'promo'
                  ? 'bg-[#7C5CF0] text-white shadow-lg shadow-purple-900/40'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Tag className="w-5 h-5" />
              <span className="font-medium">{language === 'uz' ? 'Promokodlar' : 'Промокоды'}</span>
            </button>

            <button
              onClick={() => handleNavigate('referrals')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                activeTab === 'referrals'
                  ? 'bg-[#7C5CF0] text-white shadow-lg shadow-purple-900/40'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Ticket className="w-5 h-5" />
              <span className="font-medium">Реферальные агенты</span>
            </button>

            <button
              onClick={() => handleNavigate('couriers')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                activeTab === 'couriers'
                  ? 'bg-[#7C5CF0] text-white shadow-lg shadow-purple-900/40'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Truck className="w-5 h-5" />
              <span className="font-medium">Курьеры</span>
            </button>

            <button
              onClick={() => handleNavigate('security')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                activeTab === 'security'
                  ? 'bg-[#7C5CF0] text-white shadow-lg shadow-purple-900/40'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Shield className="w-5 h-5" />
              <span className="font-medium">Безопасность</span>
            </button>

            <button
              onClick={() => handleNavigate('policies')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                activeTab === 'policies'
                  ? 'bg-[#7C5CF0] text-white shadow-lg shadow-purple-900/40'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Shield className="w-5 h-5" />
              <span className="font-medium">{language === 'uz' ? 'Maxfiylik siyosati' : 'Политика конфиденциальности'}</span>
            </button>

            <button
              onClick={() => handleNavigate('payouts')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                activeTab === 'payouts'
                  ? 'bg-[#7C5CF0] text-white shadow-lg shadow-purple-900/40'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <CreditCard className="w-5 h-5" />
              <span className="font-medium">{language === 'uz' ? 'Toʻlovlar (pul yechish)' : 'Выплаты компаниям'}</span>
            </button>
          </nav>

        {/* Logout Button - using relative positioning at bottom */}
        <div className="p-6 border-t border-white/20">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Выход</span>
          </button>
        </div>
      </aside>

      {/* Main Content - РЕСПОНСИВНЫЙ */}
      <main className="flex-1 lg:ml-64">
        {/* Header с гамбургером */}
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
          <div className="px-4 lg:px-8 py-4 flex items-center gap-4">
            {/* 📱 Кнопка гамбургера (только на мобильных) */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <Menu className="w-6 h-6 text-gray-600" />
            </button>

            <h1 className="text-xl lg:text-2xl font-bold text-gray-800">
              {activeTab === 'overview' && 'Обзор'}
              {activeTab === 'analytics' && 'Аналитика платформы'}
              {activeTab === 'companies' && 'Компании'}
              {activeTab === 'payment' && 'Настройки оплаты'}
              {activeTab === 'history' && 'История платежей'}
              {activeTab === 'ads' && 'Управление рекламой'}
              {activeTab === 'categories' && 'Категории товаров'}
              {activeTab === 'notifications' && 'Уведомления'}
              {activeTab === 'companyMessages' && 'Сообщения компаниям'}
              {activeTab === 'chat' && (language === 'uz' ? 'Umumiy chat' : 'Общий чат')}
              {activeTab === 'regions' && (language === 'uz' ? 'Yetkazib berish regionlari' : 'Регионы доставки')}
              {activeTab === 'decorationVideos' && (language === 'uz' ? 'Video-bezaklar' : 'Видео-декорации')}
              {activeTab === 'discounts' && 'Модерация скидок'}
              {activeTab === 'promo' && (language === 'uz' ? 'Promokodlar' : 'Промокоды')}
              {activeTab === 'dashboard' && (language === 'uz' ? 'Platforma' : 'Дашборд платформы')}
              {activeTab === 'complaints' && (language === 'uz' ? 'Shikoyatlar' : 'Жалобы')}
              {activeTab === 'referrals' && 'Реферальные агенты'}
              {activeTab === 'couriers' && (language === 'uz' ? 'Kuryerlar' : 'Курьеры')}
              {activeTab === 'security' && (language === 'uz' ? 'Xavfsizlik' : 'Безопасность')}
              {activeTab === 'policies' && (language === 'uz' ? 'Maxfiylik siyosati' : 'Политика конфиденциальности')}
              {activeTab === 'payouts' && (language === 'uz' ? 'Toʻlovlar (pul yechish)' : 'Выплаты компаниям')}
            </h1>

            {/* 🔍 Глобальный поиск по платформе */}
            <div className="ml-auto hidden md:block w-full max-w-md">
              <React.Suspense fallback={null}>
                <AdminGlobalSearch onNavigate={handleNavigate} lang={language as 'ru' | 'uz'} />
              </React.Suspense>
            </div>
          </div>
        </header>

        {/* Контент панелей */}
        <div className="p-4 lg:p-8">{/* Tab Content */}
          <React.Suspense fallback={<AdminTabLoading />}>
          {activeTab === 'overview' ? (
            <>
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Users className="w-6 h-6 text-blue-600" />
                    <div className="text-gray-600">Пользователи</div>
                  </div>
                  <div className="text-3xl text-blue-600">{stats.users}</div>
                </div>
              </div>

              {/* Company Settings */}
              <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <Building2 className="w-6 h-6 text-purple-600" />
                  <h2 className="text-purple-900">Настройки главной компании</h2>
                </div>

                <div className="space-y-4">
                  {/* Company Name */}
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">
                      Название компании
                    </label>
                    <input
                      type="text"
                      value={companyData.name}
                      onChange={(e) => setCompanyData({ ...companyData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                      placeholder="Главная Компания"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">
                      Номер телефона (9 цифр)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={companyData.phone}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 9);
                          setCompanyData({ ...companyData, phone: value });
                        }}
                        className="w-full px-4 py-2 pr-20 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                        placeholder="909383572"
                        maxLength={9}
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyToClipboard(companyData.phone, 'phone')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-xs flex items-center gap-1"
                      >
                        {copiedField === 'phone' ? (
                          <><Check className="w-3 h-3" /> Скопировано</>
                        ) : (
                          <><Copy className="w-3 h-3" /> Копировать</>
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      🔒 Текущий номер скрыт. Заполните, только чтобы заменить ({companyData.phone.length}/9)
                    </p>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">
                      Пароль
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={companyData.password}
                        onChange={(e) => setCompanyData({ ...companyData, password: e.target.value })}
                        className="w-full px-4 py-2 pr-32 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                        placeholder="Введите пароль..."
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyToClipboard(companyData.password, 'password')}
                          className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-xs flex items-center gap-1"
                          disabled={!companyData.password}
                        >
                          {copiedField === 'password' ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      🔒 Текущий пароль скрыт. Заполните, только чтобы заменить
                    </p>
                  </div>

                  {/* Access Key */}
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">
                      🔑 Ключ доступа (30 символов)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={companyData.access_key}
                        onChange={(e) => {
                          const value = e.target.value.slice(0, 30);
                          setCompanyData({ ...companyData, access_key: value });
                        }}
                        className="w-full px-4 py-2 pr-24 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 font-mono text-sm select-all"
                        placeholder="123456789012345678901234567890"
                        maxLength={30}
                        readOnly={false}
                        style={{ userSelect: 'text' }}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyToClipboard(companyData.access_key, 'access_key')}
                          className="px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-xs flex items-center gap-1 font-medium"
                          disabled={!companyData.access_key}
                          title="Копировать ключ"
                        >
                          {copiedField === 'access_key' ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>✅</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Копия</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      🔒 Текущий ключ скрыт. Заполните, только чтобы заменить ({companyData.access_key.length}/30 символов)
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-4">
                    <button
                      onClick={handleSaveCompany}
                      disabled={!hasChanges || saving}
                      className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-colors ${
                        hasChanges && !saving
                          ? 'bg-purple-600 text-white hover:bg-purple-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {saving ? (
                        <>
                          <RefreshCw className="w-5 h-5 animate-spin" />
                          Сохранение...
                        </>
                      ) : (
                        <>
                          <Save className="w-5 h-5" />
                          Сохранить изменения
                        </>
                      )}
                    </button>

                    {hasChanges && (
                      <button
                        onClick={handleResetCompany}
                        disabled={saving}
                        className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        Отменить
                      </button>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                  <h3 className="text-blue-900 mb-2">ℹ️ Важная информация</h3>
                  <ul className="text-blue-800 text-sm space-y-1">
                    <li>• После изменения данных все должны использовать новые данные для входа</li>
                    <li>• Телефон: 9 цифр (без пробелов и спецсимволов)</li>
                    <li>• Ключ доступа: строго 30 цифр</li>
                    <li>• Пароль: может быть любой длины</li>
                  </ul>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="bg-white rounded-lg shadow-sm p-6 border-2 border-red-200">
                <h2 className="text-red-600 mb-6">Опасная зона</h2>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                    <div>
                      <div className="text-gray-900">Удалить всех пользователей</div>
                      <div className="text-sm text-gray-600">Удалит всех зарегистрированных покупателей</div>
                    </div>
                    <button
                      onClick={() => clearAllData('users')}
                      className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Удалить
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-red-100 rounded-lg border-2 border-red-300">
                    <div>
                      <div className="text-gray-900">Удалить ВСЕ данные пользователей</div>
                      <div className="text-sm text-gray-600">Полная очистка системы (необратимо!)</div>
                    </div>
                    <button
                      onClick={() => clearAllData('all')}
                      className="flex items-center gap-2 bg-red-700 text-white px-4 py-2 rounded-lg hover:bg-red-800 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Удалить всё
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-red-100 rounded-lg border-2 border-red-300">
                    <div>
                      <div className="text-gray-900">Перезагрузить ВСЕ устройства</div>
                      <div className="text-sm text-gray-600">Перезагрузит все смартфоны, планшеты и компьютеры с открытым приложением</div>
                    </div>
                    <button
                      onClick={handleReloadAllDevices}
                      className="flex items-center gap-2 bg-red-700 text-white px-4 py-2 rounded-lg hover:bg-red-800 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Перезагрузить
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : activeTab === 'analytics' ? (
            <AdminAnalyticsPanel />
          ) : activeTab === 'companies' ? (
            <CompanyManagement />
          ) : activeTab === 'payment' ? (
            <PaymentSettings />
          ) : activeTab === 'history' ? (
            <PaymentHistoryPanel />
          ) : activeTab === 'ads' ? (
            <AdminAdsPanel />
          ) : activeTab === 'categories' ? (
            <AdminCategoriesPanel />
          ) : activeTab === 'notifications' ? (
            <AdminNotificationsPanel />
          ) : activeTab === 'companyMessages' ? (
            <AdminCompanyMessagesPanel />
          ) : activeTab === 'discounts' ? (
            <AdminDiscountsPanel />
          ) : activeTab === 'referrals' ? (
            <AdminReferralPanel />
          ) : activeTab === 'dashboard' ? (
            <AdminPlatformDashboard onNavigate={(tab) => handleNavigate(tab as any)} />
          ) : activeTab === 'complaints' ? (
            <AdminComplaintsPanel />
          ) : activeTab === 'promo' ? (
            <AdminPromoCodesPanel />
          ) : activeTab === 'couriers' ? (
            <CouriersManagementPanel />
          ) : activeTab === 'chat' ? (
            <BroadcastChatPanel isAdmin />
          ) : activeTab === 'regions' ? (
            <AdminRegionsPanel />
          ) : activeTab === 'decorationVideos' ? (
            <AdminDecorationVideosPanel />
          ) : activeTab === 'security' ? (
            <AdminSecurityPanel />
          ) : activeTab === 'policies' ? (
            <AdminPoliciesPanel />
          ) : activeTab === 'payouts' ? (
            <AdminPayoutsPanel />
          ) : (
            <AdminAdsPanel />
          )}
          </React.Suspense>
        </div>
      </main>
    </div>
  );
}