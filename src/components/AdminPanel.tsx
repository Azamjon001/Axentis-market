import React, { useState, useEffect } from 'react';
import {
  Shield, LogOut, Users, Trash2, Building2, Save, RefreshCw, Eye, EyeOff,
  CreditCard, Megaphone, Menu, X, Copy, Check, Package, Bell, BarChart3,
  Tag, Ticket, Truck, MessageSquare, Globe, Film, Flag, LayoutDashboard,
  ScrollText, Landmark, KeyRound, Phone, Lock, AlertTriangle,
} from 'lucide-react';
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

type AdminTab =
  | 'overview' | 'analytics' | 'companies' | 'payment' | 'history' | 'ads'
  | 'categories' | 'notifications' | 'companyMessages' | 'discounts'
  | 'referrals' | 'promo' | 'dashboard' | 'complaints' | 'couriers' | 'chat'
  | 'regions' | 'decorationVideos' | 'security' | 'policies' | 'payouts';

// 🧭 Навигация как данные: группы разделов с уникальными иконками.
// Одна точка правды для сайдбара и заголовка страницы.
interface NavItem {
  tab: AdminTab;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  labelUz?: string;
}
interface NavGroup {
  title: string;
  titleUz?: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Платформа',
    titleUz: 'Platforma',
    items: [
      { tab: 'overview', icon: LayoutDashboard, label: 'Обзор', labelUz: 'Umumiy' },
      { tab: 'dashboard', icon: BarChart3, label: 'Дашборд платформы', labelUz: 'Platforma' },
      { tab: 'analytics', icon: BarChart3, label: 'Аналитика', labelUz: 'Analitika' },
      { tab: 'companies', icon: Building2, label: 'Компании', labelUz: 'Kompaniyalar' },
      { tab: 'couriers', icon: Truck, label: 'Курьеры', labelUz: 'Kuryerlar' },
      { tab: 'referrals', icon: Ticket, label: 'Реферальные агенты', labelUz: 'Referal agentlar' },
    ],
  },
  {
    title: 'Финансы',
    titleUz: 'Moliya',
    items: [
      { tab: 'payment', icon: CreditCard, label: 'Оплата', labelUz: 'Toʻlov' },
      // 💸 «Выплаты компаниям» временно скрыты — вернутся с онлайн-доставкой.
      { tab: 'discounts', icon: Tag, label: 'Модерация скидок', labelUz: 'Chegirmalar' },
      { tab: 'promo', icon: Ticket, label: 'Промокоды', labelUz: 'Promokodlar' },
    ],
  },
  {
    title: 'Контент',
    titleUz: 'Kontent',
    items: [
      { tab: 'categories', icon: Package, label: 'Категории', labelUz: 'Kategoriyalar' },
      { tab: 'ads', icon: Megaphone, label: 'Реклама', labelUz: 'Reklama' },
      { tab: 'decorationVideos', icon: Film, label: 'Видео-декорации', labelUz: 'Video-bezaklar' },
      { tab: 'regions', icon: Globe, label: 'Регионы', labelUz: 'Regionlar' },
    ],
  },
  {
    title: 'Коммуникации',
    titleUz: 'Aloqa',
    items: [
      { tab: 'notifications', icon: Bell, label: 'Уведомления', labelUz: 'Bildirishnomalar' },
      { tab: 'companyMessages', icon: MessageSquare, label: 'Сообщения компаниям', labelUz: 'Xabarlar' },
      { tab: 'chat', icon: Users, label: 'Общий чат', labelUz: 'Umumiy chat' },
      { tab: 'complaints', icon: Flag, label: 'Жалобы', labelUz: 'Shikoyatlar' },
    ],
  },
  {
    title: 'Система',
    titleUz: 'Tizim',
    items: [
      { tab: 'security', icon: Shield, label: 'Безопасность', labelUz: 'Xavfsizlik' },
      { tab: 'policies', icon: ScrollText, label: 'Политика конфиденциальности', labelUz: 'Maxfiylik siyosati' },
    ],
  },
];

// Заголовки страниц (включая разделы вне меню, например history)
const TAB_TITLES: Record<AdminTab, { ru: string; uz: string }> = {
  overview: { ru: 'Обзор', uz: 'Umumiy koʻrinish' },
  dashboard: { ru: 'Дашборд платформы', uz: 'Platforma' },
  analytics: { ru: 'Аналитика платформы', uz: 'Platforma analitikasi' },
  companies: { ru: 'Компании', uz: 'Kompaniyalar' },
  couriers: { ru: 'Курьеры', uz: 'Kuryerlar' },
  referrals: { ru: 'Реферальные агенты', uz: 'Referal agentlar' },
  payment: { ru: 'Настройки оплаты', uz: 'Toʻlov sozlamalari' },
  history: { ru: 'История платежей', uz: 'Toʻlovlar tarixi' },
  payouts: { ru: 'Выплаты компаниям', uz: 'Pul yechish' },
  discounts: { ru: 'Модерация скидок', uz: 'Chegirmalar moderatsiyasi' },
  promo: { ru: 'Промокоды', uz: 'Promokodlar' },
  categories: { ru: 'Категории товаров', uz: 'Mahsulot kategoriyalari' },
  ads: { ru: 'Управление рекламой', uz: 'Reklama boshqaruvi' },
  decorationVideos: { ru: 'Видео-декорации', uz: 'Video-bezaklar' },
  regions: { ru: 'Регионы доставки', uz: 'Yetkazib berish regionlari' },
  notifications: { ru: 'Уведомления', uz: 'Bildirishnomalar' },
  companyMessages: { ru: 'Сообщения компаниям', uz: 'Kompaniyalarga xabarlar' },
  chat: { ru: 'Общий чат', uz: 'Umumiy chat' },
  complaints: { ru: 'Жалобы', uz: 'Shikoyatlar' },
  security: { ru: 'Безопасность', uz: 'Xavfsizlik' },
  policies: { ru: 'Политика конфиденциальности', uz: 'Maxfiylik siyosati' },
};

export default function AdminPanel({ onLogout }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // 📱 Для мобильной версии

  // 🌍 Система локализации для админа
  const [language] = useState<Language>(getCurrentLanguage());
  useTranslation(language);

  const [stats, setStats] = useState({ users: 0 });
  const [, setLoading] = useState(true);
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
  // 🔑 Текущий 30-значный ключ главной компании — всегда виден админу.
  const [currentAccessKey, setCurrentAccessKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // 🌑 Админ-панель всегда в тёмной теме — принудительно включаем dark на время
  // жизни компонента и восстанавливаем прежнее состояние при выходе.
  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains('dark');
    root.classList.add('dark');
    return () => {
      if (!hadDark) root.classList.remove('dark');
    };
  }, []);

  useEffect(() => {
    loadData();

    // 🔄 Auto-refresh every 10 seconds
    const intervalId = setInterval(() => {
      loadData();
    }, 10000);

    return () => clearInterval(intervalId);
  }, []);

  // 🔄 HISTORY API HANDLER
  useEffect(() => {
    const currentState = window.history.state || {};
    window.history.replaceState({ ...currentState, tab: 'overview', page: 'admin' }, '', '#overview');

    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.tab) {
        setActiveTab(event.state.tab);
      } else {
        setActiveTab('overview');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = (tab: AdminTab) => {
    window.history.pushState({ tab: tab, page: 'admin' }, '', `#${tab}`);
    setActiveTab(tab);
    setIsSidebarOpen(false);
    window.scrollTo(0, 0);
  };

  const loadData = async () => {
    try {
      await Promise.all([loadStats(), loadCompanyData()]);
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await api.users.count();
      setStats({ users: data.count || 0 });
    } catch (error) {
      console.error('Error loading stats:', error);
      setStats({ users: 0 });
    }
  };

  const handleCopyToClipboard = async (text: string, fieldName: string) => {
    try {
      if (!navigator.clipboard) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (!successful) throw new Error('execCommand failed');
      } else {
        await navigator.clipboard.writeText(text);
      }
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Ошибка копирования:', err);
      alert(`Не удалось скопировать.\n\n${text}\n\nСкопируйте вручную.`);
    }
  };

  const loadCompanyData = async () => {
    try {
      const companies = await api.companies.list();
      const company = companies && companies.length > 0 ? companies[0] : null;

      if (company) {
        // Пароль и телефон не подгружаются (задаются заново при замене),
        // а 30-значный ключ доступа админу виден всегда.
        const data = {
          name: company.name || '',
          phone: '',
          password: '',
          access_key: ''
        };
        setCompanyData(data);
        setOriginalCompanyData(data);
        setCurrentAccessKey(company.accessKey || '');
      } else {
        throw new Error('No companies found');
      }
    } catch (error) {
      console.warn('⚠️ Error in loadCompanyData (fallback to defaults):', error);
      const defaultData = { name: 'Главная компания', phone: '', password: '', access_key: '' };
      setCompanyData(defaultData);
      setOriginalCompanyData(defaultData);
    }
  };

  const handleSaveCompany = async () => {
    try {
      if (!companyData.name.trim()) {
        alert('Введите название компании');
        return;
      }

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
      'Удалить ВСЕ данные пользователей? Это действие нельзя отменить!';

    if (!confirm(confirmMessage)) return;
    // Двойное подтверждение — операция необратима
    if (!confirm('Вы уверены? Восстановить данные будет невозможно.')) return;

    try {
      const res: any = await api.users.deleteAll(type);
      await loadStats();
      alert(`✅ Удалено аккаунтов: ${res?.deleted ?? 0}`);
    } catch (error: any) {
      console.error('Error clearing data:', error);
      alert('Ошибка при удалении данных: ' + (error?.message || ''));
    }
  };

  const handleReloadAllDevices = async () => {
    if (!confirm('🔄 Перезагрузить ВСЕ устройства?\n\nВсе смартфоны, планшеты и компьютеры с открытым приложением будут автоматически перезагружены через 2 секунды.\n\nЭто полезно после изменения настроек оплаты или других системных параметров.')) {
      return;
    }

    try {
      await broadcastReload('Админ');
      alert('✅ Команда перезагрузки отправлена!\n\nВсе устройства будут перезагружены через 2 секунды.\n\nВаше устройство тоже будет перезагружено.');
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('❌ Error broadcasting reload:', error);
      alert('Ошибка при отправке команды перезагрузки');
    }
  };

  const uz = language === 'uz';
  const pageTitle = TAB_TITLES[activeTab] ? (uz ? TAB_TITLES[activeTab].uz : TAB_TITLES[activeTab].ru) : '';

  return (
    <div className="min-h-screen flex text-[15px]" style={{ background: 'var(--ax-bg)' }}>
      {/* 📱 Overlay для мобильных (при открытом sidebar) */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/55 backdrop-blur-[2px] z-20 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        w-72 bg-[#12122B] text-white fixed h-full z-30 flex flex-col
        border-r border-white/[0.06] transition-transform duration-300
        lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Бренд */}
        <div className="px-5 pt-6 pb-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7C5CF0] to-[#5B3FD4] flex items-center justify-center shadow-lg shadow-purple-950/50 shrink-0">
              <Shield className="w-5 h-5 text-white" />
            </span>
            <div className="min-w-0">
              <h1 className="text-[15px] font-bold leading-tight truncate">Axentis Market</h1>
              <p className="text-[11px] text-white/40 leading-tight">Панель администратора</p>
            </div>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-2 -mr-1 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Закрыть меню"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Навигация по группам */}
        <nav className="flex-1 overflow-y-auto px-3 pb-4 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent]">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="mt-4 first:mt-1">
              <p className="px-3 mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/30 select-none">
                {uz && group.titleUz ? group.titleUz : group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map(({ tab, icon: Icon, label, labelUz }) => {
                  const active = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => handleNavigate(tab)}
                      aria-current={active ? 'page' : undefined}
                      className={`relative w-full flex items-center gap-3 pl-3.5 pr-3 py-2.5 rounded-lg text-left transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9F87F5] ${
                        active
                          ? 'bg-[#7C5CF0]/[0.16] text-white'
                          : 'text-white/60 hover:bg-white/[0.06] hover:text-white'
                      }`}
                    >
                      {/* активный индикатор */}
                      <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full transition-opacity ${active ? 'bg-[#9F87F5] opacity-100' : 'opacity-0'}`} />
                      <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-[#B7A5F8]' : ''}`} />
                      <span className={`text-[13.5px] leading-snug ${active ? 'font-semibold' : 'font-medium'}`}>
                        {uz && labelUz ? labelUz : label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Выход */}
        <div className="p-3 border-t border-white/[0.06] shrink-0">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-white/60 hover:bg-red-500/15 hover:text-red-300 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            <LogOut className="w-[18px] h-[18px]" />
            <span className="text-[13.5px] font-medium">Выход</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-72 min-w-0">
        {/* Header */}
        <header className="bg-white/90 backdrop-blur border-b border-gray-200/80 sticky top-0 z-10">
          <div className="px-4 lg:px-8 h-16 flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Открыть меню"
            >
              <Menu className="w-5 h-5 text-gray-600" />
            </button>

            <h1 className="text-[17px] lg:text-lg font-bold text-gray-900 truncate">{pageTitle}</h1>

            {/* 🔍 Глобальный поиск по платформе */}
            <div className="ml-auto hidden md:block w-full max-w-md">
              <React.Suspense fallback={null}>
                <AdminGlobalSearch onNavigate={handleNavigate} lang={language as 'ru' | 'uz'} />
              </React.Suspense>
            </div>
          </div>
        </header>

        {/* Контент панелей */}
        <div className="p-4 lg:p-8 max-w-[1400px]">
          <React.Suspense fallback={<AdminTabLoading />}>
          {activeTab === 'overview' ? (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-gray-200/80 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[13px] font-medium text-gray-500 mb-1">Пользователи</p>
                      <p className="text-[28px] font-bold text-gray-900 leading-none tabular-nums">{stats.users}</p>
                    </div>
                    <span className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-600" />
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleNavigate('dashboard')}
                  className="bg-white rounded-2xl border border-gray-200/80 p-5 text-left hover:border-[#7C5CF0]/50 hover:shadow-sm transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[13px] font-medium text-gray-500 mb-1">Финансы и заказы</p>
                      <p className="text-[15px] font-semibold text-gray-900 group-hover:text-[#6D4FE0]">Дашборд платформы →</p>
                    </div>
                    <span className="w-11 h-11 rounded-xl bg-purple-50 flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-[#7C5CF0]" />
                    </span>
                  </div>
                </button>
                {/* 💸 Карточка «Заявки на вывод средств» временно убрана. */}
              </div>

              {/* Company Settings */}
              <section className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
                  <span className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
                    <Building2 className="w-[18px] h-[18px] text-[#7C5CF0]" />
                  </span>
                  <div>
                    <h2 className="text-[15px] font-bold text-gray-900 leading-tight">Главная компания</h2>
                    <p className="text-[12.5px] text-gray-500 leading-tight">Учётные данные для входа продавца</p>
                  </div>
                </div>

                <div className="p-6 space-y-5">
                  {/* 🔑 Текущий ключ доступа — всегда виден */}
                  <div className="rounded-xl border-2 border-[#7C5CF0]/25 bg-gradient-to-r from-purple-50/70 to-indigo-50/70 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <KeyRound className="w-4 h-4 text-[#7C5CF0]" />
                      <p className="text-[13px] font-semibold text-gray-800">Ключ доступа (30 цифр)</p>
                    </div>
                    {currentAccessKey ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <code
                          className="flex-1 min-w-[240px] font-mono text-[14px] font-semibold tracking-[0.08em] text-gray-900 bg-white rounded-lg border border-purple-200 px-3.5 py-2.5 break-all select-all"
                          style={{ userSelect: 'all' }}
                        >
                          {currentAccessKey.replace(/(\d{6})(?=\d)/g, '$1 ')}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleCopyToClipboard(currentAccessKey, 'current_key')}
                          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-[#7C5CF0] text-white text-[13px] font-semibold hover:bg-[#6D4FE0] transition-colors cursor-pointer"
                        >
                          {copiedField === 'current_key' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          {copiedField === 'current_key' ? 'Скопировано' : 'Копировать'}
                        </button>
                      </div>
                    ) : (
                      <p className="text-[13px] text-gray-500">Ключ ещё не задан — установите его в поле ниже.</p>
                    )}
                  </div>

                  {/* Company Name */}
                  <div>
                    <label className="block text-[13px] font-medium text-gray-700 mb-1.5">
                      Название компании
                    </label>
                    <input
                      type="text"
                      value={companyData.name}
                      onChange={(e) => setCompanyData({ ...companyData, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-[14px] focus:outline-none focus:border-[#7C5CF0] focus:ring-2 focus:ring-[#7C5CF0]/15 transition-shadow"
                      placeholder="Главная Компания"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="flex items-center gap-1.5 text-[13px] font-medium text-gray-700 mb-1.5">
                      <Phone className="w-3.5 h-3.5 text-gray-400" /> Новый телефон (9 цифр)
                    </label>
                    <input
                      type="text"
                      value={companyData.phone}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 9);
                        setCompanyData({ ...companyData, phone: value });
                      }}
                      className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-[14px] focus:outline-none focus:border-[#7C5CF0] focus:ring-2 focus:ring-[#7C5CF0]/15 transition-shadow"
                      placeholder="Оставьте пустым, чтобы не менять"
                      maxLength={9}
                    />
                    <p className="text-[12px] text-gray-500 mt-1">
                      Текущий номер скрыт политикой конфиденциальности ({companyData.phone.length}/9)
                    </p>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="flex items-center gap-1.5 text-[13px] font-medium text-gray-700 mb-1.5">
                      <Lock className="w-3.5 h-3.5 text-gray-400" /> Новый пароль
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={companyData.password}
                        onChange={(e) => setCompanyData({ ...companyData, password: e.target.value })}
                        className="w-full px-3.5 py-2.5 pr-12 bg-white border border-gray-300 rounded-xl text-[14px] focus:outline-none focus:border-[#7C5CF0] focus:ring-2 focus:ring-[#7C5CF0]/15 transition-shadow"
                        placeholder="Оставьте пустым, чтобы не менять"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                        aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                      >
                        {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                      </button>
                    </div>
                  </div>

                  {/* Access Key (замена) */}
                  <div>
                    <label className="flex items-center gap-1.5 text-[13px] font-medium text-gray-700 mb-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-gray-400" /> Новый ключ доступа (30 цифр)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={companyData.access_key}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 30);
                          setCompanyData({ ...companyData, access_key: value });
                        }}
                        className="flex-1 px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl font-mono text-[13.5px] focus:outline-none focus:border-[#7C5CF0] focus:ring-2 focus:ring-[#7C5CF0]/15 transition-shadow"
                        placeholder="Оставьте пустым, чтобы не менять"
                        maxLength={30}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          let key = '';
                          for (let i = 0; i < 30; i++) key += Math.floor(Math.random() * 10);
                          setCompanyData({ ...companyData, access_key: key });
                        }}
                        className="px-4 py-2.5 rounded-xl bg-gray-900 text-white text-[13px] font-semibold hover:bg-gray-700 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        Сгенерировать
                      </button>
                    </div>
                    {companyData.access_key && (
                      <p className={`text-[12px] mt-1 ${companyData.access_key.length === 30 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {companyData.access_key.length}/30 цифр {companyData.access_key.length === 30 ? '✓' : '— нужно ровно 30'}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      onClick={handleSaveCompany}
                      disabled={!hasChanges || saving}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[14px] font-semibold transition-colors ${
                        hasChanges && !saving
                          ? 'bg-[#7C5CF0] text-white hover:bg-[#6D4FE0] cursor-pointer'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {saving ? (
                        <><RefreshCw className="w-4 h-4 animate-spin" /> Сохранение...</>
                      ) : (
                        <><Save className="w-4 h-4" /> Сохранить изменения</>
                      )}
                    </button>

                    {hasChanges && (
                      <button
                        onClick={handleResetCompany}
                        disabled={saving}
                        className="px-5 py-2.5 rounded-xl bg-white border border-gray-300 text-gray-700 text-[14px] font-medium hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        Отменить
                      </button>
                    )}
                  </div>
                </div>
              </section>

              {/* Danger Zone */}
              <section className="bg-white rounded-2xl border border-red-200 overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-red-100 bg-red-50/60">
                  <span className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
                    <AlertTriangle className="w-[18px] h-[18px] text-red-600" />
                  </span>
                  <div>
                    <h2 className="text-[15px] font-bold text-red-700 leading-tight">Опасная зона</h2>
                    <p className="text-[12.5px] text-red-500/80 leading-tight">Необратимые действия — будьте осторожны</p>
                  </div>
                </div>

                <div className="p-6 space-y-3">
                  {[
                    {
                      title: 'Удалить всех пользователей',
                      desc: 'Удалит всех зарегистрированных покупателей',
                      btn: 'Удалить', icon: Trash2,
                      onClick: () => clearAllData('users'),
                    },
                    {
                      title: 'Удалить ВСЕ данные пользователей',
                      desc: 'Полная очистка системы (необратимо!)',
                      btn: 'Удалить всё', icon: Trash2,
                      onClick: () => clearAllData('all'),
                    },
                    {
                      title: 'Перезагрузить ВСЕ устройства',
                      desc: 'Перезагрузит все устройства с открытым приложением',
                      btn: 'Перезагрузить', icon: RefreshCw,
                      onClick: handleReloadAllDevices,
                    },
                  ].map((row) => (
                    <div key={row.title} className="flex items-center justify-between gap-4 p-4 rounded-xl border border-red-100 bg-red-50/40">
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-gray-900">{row.title}</p>
                        <p className="text-[12.5px] text-gray-500">{row.desc}</p>
                      </div>
                      <button
                        onClick={row.onClick}
                        className="flex items-center gap-1.5 shrink-0 px-4 py-2 rounded-lg bg-red-600 text-white text-[13px] font-semibold hover:bg-red-700 transition-colors cursor-pointer"
                      >
                        <row.icon className="w-4 h-4" />
                        {row.btn}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </div>
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
