import React, { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import {
  Building2, LogOut, Package, ShoppingCart, Receipt, BarChart3, Barcode,
  Megaphone, Menu, X, Globe, Tag, Sun, Moon, MessageSquare, RotateCcw,
  LayoutDashboard, MessageCircleQuestion, Truck, Settings, Camera,
  ChevronDown, Sparkles, Boxes, Wallet, ScanLine, Lock,
} from 'lucide-react';
// ⚡ Каждая вкладка — отдельный ленивый чанк: продавец грузит только тот
// раздел, который открыл, а не всю панель целиком.
const CompanyDashboardPanel = React.lazy(() => import('./CompanyDashboardPanel'));
const CompanyQuestionsPanel = React.lazy(() => import('./CompanyQuestionsPanel'));
const DigitalWarehouse = React.lazy(() => import('./DigitalWarehouse').then((m) => ({ default: m.DigitalWarehouse })));
const SalesPanel = React.lazy(() => import('./SalesPanel'));
const CompanyOrdersPanel = React.lazy(() => import('./CompanyOrdersPanel'));
const BroadcastChatPanel = React.lazy(() => import('./BroadcastChatPanel'));
const AnalyticsPanel = React.lazy(() => import('./AnalyticsPanel'));
const BarcodeSearchPanel = React.lazy(() => import('./BarcodeSearchPanel'));
const CompanySMMPanel = React.lazy(() => import('./CompanySMMPanel'));
const CompanyDiscountsManager = React.lazy(() => import('./CompanyDiscountsManager'));
const CompanyReturnsPanel = React.lazy(() => import('./CompanyReturnsPanel'));
const CompanyStoriesPanel = React.lazy(() => import('./CompanyStoriesPanel'));
const CompanyInboxPanel = React.lazy(() => import('./CompanyInboxPanel'));
const CouriersManagementPanel = React.lazy(() => import('./CouriersManagementPanel'));
const CompanySettingsPanel = React.lazy(() => import('./CompanySettingsPanel'));
const CompanyDebtsPanel = React.lazy(() => import('./CompanyDebtsPanel')); // 🧾 «Дафтар» — долги клиентов
const InventoryCheckModal = React.lazy(() => import('./InventoryCheckModal')); // 📦 Инвентаризация склада

// Лёгкий спиннер на время подгрузки чанка вкладки
const TabLoading = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180, color: 'var(--ax-text-2)', gap: 8 }}>
    <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(124,92,240,0.3)', borderTopColor: '#7C5CF0', animation: 'spin 0.8s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);
import { getCurrentLanguage, setCurrentLanguage, type Language, useTranslation } from '../utils/translations';
import { useResponsive, useResponsiveClasses } from '../hooks/useResponsive';
import { useTheme } from '../utils/ThemeContext';
import api from '../utils/api';

interface CompanyPanelProps {
  onLogout: () => void;
  companyId: number;
  companyName: string;
}

type Tab =
  | 'dashboard' | 'warehouse' | 'sales' | 'orders' | 'analytics' | 'barcode'
  | 'smm' | 'stories' | 'discounts' | 'returns' | 'questions' | 'couriers'
  | 'chat' | 'settings' | 'debts';

// 🎨 Две группы разделов с разными фирменными цветами:
//   • Операции  — холодный сине-голубой (склад, заказы, аналитика, офлайн)
//   • Сервис    — фиолетовый каталог (чат, курьеры, вопросы, возвраты, скидки, сторис, SMM)
const OPS_ACCENT = '#38BDF8';       // sky-400
const OPS_GRAD = 'linear-gradient(135deg, #0EA5E9, #2563EB)';
const MKT_ACCENT = '#A78BFA';       // violet-400
const MKT_GRAD = 'linear-gradient(135deg, #8B5CF6, #6D28D9)';

const VALID_TABS: Tab[] = ['dashboard', 'warehouse', 'sales', 'orders', 'analytics', 'barcode', 'smm', 'stories', 'discounts', 'returns', 'questions', 'couriers', 'chat', 'settings', 'debts'];

export default function CompanyPanel({ onLogout, companyId, companyName }: CompanyPanelProps) {
  useEffect(() => {
    if (!companyId || companyId === 0) {
      console.error('CRITICAL: CompanyPanel received invalid companyId!', companyId);
      alert('Ошибка: Неверный ID компании. Пожалуйста, выйдите и войдите заново.');
    }
  }, [companyId, companyName]);

  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showInbox, setShowInbox] = useState(false);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  // 📦 Внутренний переключатель объединённого раздела «Склад ↔ Продажи»
  const [warehouseView, setWarehouseView] = useState<'inventory' | 'sales'>('inventory');
  // 🗂 Раскрытие каталога «Маркетинг и сервис»
  const [marketingOpen, setMarketingOpen] = useState(false);
  // 📦 Инвентаризация склада (модалка со сверкой остатков)
  const [inventoryCheckOpen, setInventoryCheckOpen] = useState(false);
  // 👥 Режим кассира: наёмный продавец видит только офлайн-кассу; выход — по PIN
  const [cashierMode, setCashierMode] = useState(() => localStorage.getItem('axentis_cashier_mode') === '1');

  useEffect(() => {
    const onCashierChange = () => setCashierMode(localStorage.getItem('axentis_cashier_mode') === '1');
    window.addEventListener('cashierModeChange', onCashierChange);
    return () => window.removeEventListener('cashierModeChange', onCashierChange);
  }, []);

  const exitCashierMode = () => {
    const pin = localStorage.getItem('axentis_cashier_pin') || '';
    const entered = window.prompt(isUz ? 'Egasining PIN-kodini kiriting' : 'Введите PIN владельца');
    if (entered === pin && pin) {
      localStorage.setItem('axentis_cashier_mode', '0');
      setCashierMode(false);
    } else if (entered !== null) {
      alert(isUz ? 'PIN notoʻgʻri' : 'Неверный PIN');
    }
  };

  const { isMobile, isDesktop } = useResponsive();
  const responsive = useResponsiveClasses();
  const { effectiveTheme, setTheme } = useTheme();

  const [language, setLanguage] = useState<Language>(getCurrentLanguage());
  const t = useTranslation(language);
  const isUz = language === 'uz';

  useEffect(() => {
    const handleLanguageChange = (e: CustomEvent) => setLanguage(e.detail);
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    return () => window.removeEventListener('languageChange', handleLanguageChange as EventListener);
  }, []);

  useEffect(() => {
    let previousCount = unreadMessagesCount;
    const playNotificationSound = () => {
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZSA0PVqzn77BdGAg+ltryxnMnBSuBzvLZiTYHGWi77eeeTRAMUKfj8LZjHAY4ktfyzHksBSR2x/DdkUAKE1+06eqnVRQKRp/g8r9sIQUxh9Hz04IzBh5uwO/jmUgND1as5++wXRgIPpba8sZzJwUrgc7y2Yk2BxlpvO3nnk0QDFCn4/C2YxwGOJLX8sx5LAUkdsfw3ZFAChNftOnqp1UUCkaf4PK/bCEFMYfR89OCMwYeacDv45lIDQ9XrOjt8FwYBz64gf17i+sAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////wwvBnrv7/w==');
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch { /* ignore */ }
    };
    const loadUnreadCount = async () => {
      try {
        const data = await api.companyMessages.count(companyId);
        const newCount = data?.count || 0;
        if (newCount > previousCount && previousCount !== null) playNotificationSound();
        previousCount = newCount;
        setUnreadMessagesCount(newCount);
      } catch (error) {
        console.error('Error loading unread messages count:', error);
      }
    };
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 5000);
    return () => clearInterval(interval);
  }, [companyId]);

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    const initialTab: Tab = VALID_TABS.includes(hash as Tab) ? (hash as Tab) : 'dashboard';
    const currentState = window.history.state || {};
    window.history.replaceState({ ...currentState, tab: initialTab, page: 'company' }, '', `#${initialTab}`);
    if (initialTab !== activeTab) setActiveTab(initialTab);

    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.tab) {
        setActiveTab(event.state.tab);
        setIsSidebarOpen(false);
      } else {
        setActiveTab('dashboard');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = (tab: Tab) => {
    // «sales» больше не отдельная вкладка — открываем склад в режиме продаж.
    if (tab === 'sales') {
      setWarehouseView('sales');
      tab = 'warehouse';
    }
    window.history.pushState({ tab, page: 'company' }, '', `#${tab}`);
    setActiveTab(tab);
    setIsSidebarOpen(false);
    window.scrollTo(0, 0);
  };

  // ── Данные навигации ───────────────────────────────────────────────────────
  const opsItems: Array<{ key: Tab; icon: React.ElementType; label: string }> = [
    { key: 'dashboard', icon: LayoutDashboard, label: isUz ? 'Boshqaruv' : 'Дашборд' },
    { key: 'warehouse', icon: Package,         label: isUz ? 'Ombor va sotuv' : 'Склад и продажи' },
    { key: 'orders',    icon: Receipt,         label: t.orders },
    { key: 'debts',     icon: Wallet,          label: isUz ? 'Daftar (qarzlar)' : 'Дафтар (долги)' },
    { key: 'analytics', icon: BarChart3,       label: t.statistics },
    { key: 'barcode',   icon: Barcode,         label: isUz ? 'Oflayn' : 'Офлайн' },
  ];

  const mktItems: Array<{ key: Tab; icon: React.ElementType; label: string }> = [
    { key: 'chat',      icon: MessageSquare,        label: isUz ? 'Chat' : 'Чат' },
    { key: 'couriers',  icon: Truck,                label: isUz ? 'Kuryerlar' : 'Курьеры' },
    { key: 'questions', icon: MessageCircleQuestion, label: isUz ? 'Savollar' : 'Вопросы' },
    { key: 'returns',   icon: RotateCcw,            label: isUz ? 'Qaytarishlar' : 'Возвраты' },
    { key: 'discounts', icon: Tag,                  label: t.discountsManagement },
    { key: 'stories',   icon: Camera,               label: isUz ? 'Storilar' : 'Сторис' },
    { key: 'smm',       icon: Megaphone,            label: t.smm },
  ];

  const mktKeys = mktItems.map(i => i.key);
  const isMarketingActive = mktKeys.includes(activeTab);

  // Автораскрытие каталога, если активен один из его разделов
  useEffect(() => {
    if (isMarketingActive) setMarketingOpen(true);
  }, [isMarketingActive]);

  const headerTitle = (() => {
    if (activeTab === 'warehouse') return isUz ? 'Ombor va sotuv' : 'Склад и продажи';
    if (activeTab === 'orders') return t.orders;
    if (activeTab === 'analytics') return t.statistics;
    if (activeTab === 'barcode') return isUz ? 'Oflayn rejim' : 'Офлайн-режим';
    if (activeTab === 'smm') return t.smm;
    if (activeTab === 'stories') return isUz ? 'Storilar' : 'Сторис';
    if (activeTab === 'discounts') return t.discountsManagement;
    if (activeTab === 'dashboard') return isUz ? 'Boshqaruv paneli' : 'Панель управления';
    if (activeTab === 'returns') return isUz ? 'Qaytarishlar' : 'Возвраты';
    if (activeTab === 'questions') return isUz ? 'Savollar' : 'Вопросы';
    if (activeTab === 'couriers') return isUz ? 'Kuryerlar' : 'Курьеры';
    if (activeTab === 'chat') return isUz ? 'Umumiy chat' : 'Общий чат';
    if (activeTab === 'settings') return isUz ? 'Sozlamalar' : 'Настройки';
    if (activeTab === 'debts') return isUz ? 'Daftar — qarzlar' : 'Дафтар — долги клиентов';
    return '';
  })();

  // ── Кнопка пункта меню ─────────────────────────────────────────────────────
  const NavButton = ({
    item, accent, grad, group,
  }: {
    item: { key: Tab; icon: React.ElementType; label: string };
    accent: string; grad: string; group: 'ops' | 'mkt';
  }) => {
    const Icon = item.icon;
    const active = activeTab === item.key;
    return (
      <motion.button
        onClick={() => handleNavigate(item.key)}
        whileTap={{ scale: 0.97 }}
        className="relative w-full flex items-center gap-3"
        style={{
          padding: group === 'mkt' ? '9px 12px 9px 14px' : '10px 12px',
          marginBottom: 3, borderRadius: 12, border: 'none', cursor: 'pointer',
          textAlign: 'left', background: 'transparent',
          color: active ? '#fff' : 'var(--ax-text-2)',
          fontWeight: active ? 600 : 500, fontSize: isMobile ? 13.5 : 14,
        }}
        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--ax-sidebar-hover)'; }}
        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      >
        {active && (
          <motion.span
            layoutId="nav-active-pill"
            transition={{ type: 'spring', stiffness: 500, damping: 38 }}
            style={{ position: 'absolute', inset: 0, borderRadius: 12, background: grad, boxShadow: `0 6px 20px ${accent}55`, zIndex: 0 }}
          />
        )}
        <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: 12, width: '100%' }}>
          <Icon className={responsive.iconSmall} style={{ flexShrink: 0, color: active ? '#fff' : accent }} />
          <span className="truncate">{item.label}</span>
        </span>
      </motion.button>
    );
  };

  // 👥 РЕЖИМ КАССИРА: только офлайн-касса, без аналитики и прибыли.
  // Выход — по PIN владельца (localStorage axentis_cashier_pin).
  if (cashierMode) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--ax-bg)', color: 'var(--ax-text)' }}>
        <header className="sticky top-0 z-10 flex items-center justify-between" style={{ padding: '10px 16px', background: 'var(--ax-sidebar)', borderBottom: '1px solid var(--ax-border)' }}>
          <div className="flex items-center gap-2.5">
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 11, background: 'linear-gradient(135deg, #7C5CF0, #5B3DD4)' }}>
              <ScanLine style={{ width: 17, height: 17, color: '#fff' }} />
            </span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>{isUz ? 'Kassir rejimi' : 'Режим кассира'}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ax-text-3)' }}>{companyName}</div>
            </div>
          </div>
          <button
            onClick={exitCashierMode}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: 'var(--ax-primary-pale)', color: 'var(--ax-primary)', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            <Lock style={{ width: 14, height: 14 }} />
            {isUz ? 'Chiqish (PIN)' : 'Выход (PIN)'}
          </button>
        </header>
        <div style={{ padding: '14px 12px' }}>
          <Suspense fallback={<TabLoading />}>
            <BarcodeSearchPanel companyId={companyId} />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex overflow-x-hidden" style={{ background: 'var(--ax-bg)', color: 'var(--ax-text)' }}>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-20 lg:hidden"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── SIDEBAR ── */}
      <aside
        className={`flex flex-col fixed h-full z-30 transition-transform duration-300 lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{ width: isMobile ? '84vw' : '236px', background: 'var(--ax-sidebar)', borderRight: '1px solid var(--ax-border)', boxShadow: 'var(--ax-shadow)' }}
      >
        {/* Brand header */}
        <div className="flex items-center justify-between flex-shrink-0" style={{ padding: isMobile ? '14px' : '16px 16px', borderBottom: '1px solid rgba(255,255,255,0.10)', background: 'linear-gradient(135deg, #7C5CF0, #5B3DD4)' }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <motion.div
              initial={{ scale: 0.8, rotate: -8 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
              className="flex items-center justify-center rounded-xl flex-shrink-0"
              style={{ width: 38, height: 38, background: 'rgba(255,255,255,0.2)' }}
            >
              <Building2 className="w-5 h-5" style={{ color: '#fff' }} />
            </motion.div>
            <div className="min-w-0">
              <h2 className="font-semibold truncate" style={{ fontSize: isMobile ? 13.5 : 14.5, color: '#fff', lineHeight: 1.25 }}>{companyName}</h2>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{t.companyPanel}</p>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden rounded-lg transition-colors" style={{ padding: 5, color: 'rgba(255,255,255,0.85)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <LayoutGroup>
        <nav className="flex-1 overflow-y-auto" style={{ padding: '12px 10px' }}>
          {/* — Группа: Операции — */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 10px 8px' }}>
            <span style={{ width: 6, height: 6, borderRadius: 2, background: OPS_ACCENT }} />
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.11em', textTransform: 'uppercase', color: 'var(--ax-text-3)' }}>
              {isUz ? 'Operatsiyalar' : 'Операции'}
            </span>
          </div>
          {opsItems.map(item => (
            <NavButton key={item.key} item={item} accent={OPS_ACCENT} grad={OPS_GRAD} group="ops" />
          ))}

          {/* — Каталог: Маркетинг и сервис — */}
          <div style={{ height: 1, background: 'var(--ax-border)', margin: '12px 6px' }} />
          <motion.button
            onClick={() => setMarketingOpen(o => !o)}
            whileTap={{ scale: 0.98 }}
            className="relative w-full flex items-center gap-3"
            style={{
              padding: '10px 12px', marginBottom: 3, borderRadius: 12, border: 'none', cursor: 'pointer', textAlign: 'left',
              background: marketingOpen ? 'rgba(139,92,246,0.12)' : 'transparent',
              color: 'var(--ax-text)', fontWeight: 600, fontSize: isMobile ? 13.5 : 14,
            }}
            onMouseEnter={e => { if (!marketingOpen) (e.currentTarget as HTMLElement).style.background = 'var(--ax-sidebar-hover)'; }}
            onMouseLeave={e => { if (!marketingOpen) (e.currentTarget as HTMLElement).style.background = marketingOpen ? 'rgba(139,92,246,0.12)' : 'transparent'; }}
          >
            <span style={{ width: 28, height: 28, borderRadius: 9, background: MKT_GRAD, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 4px 12px ${MKT_ACCENT}44` }}>
              <Sparkles className="w-4 h-4" style={{ color: '#fff' }} />
            </span>
            <span className="truncate" style={{ flex: 1 }}>{isUz ? 'Marketing va servis' : 'Маркетинг и сервис'}</span>
            {isMarketingActive && !marketingOpen && (
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: MKT_ACCENT, flexShrink: 0 }} />
            )}
            <motion.span animate={{ rotate: marketingOpen ? 180 : 0 }} transition={{ duration: 0.2 }} style={{ display: 'inline-flex', color: 'var(--ax-text-3)' }}>
              <ChevronDown className="w-4 h-4" />
            </motion.span>
          </motion.button>

          <AnimatePresence initial={false}>
            {marketingOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 34 }}
                style={{ overflow: 'hidden', paddingLeft: 8, marginLeft: 4, borderLeft: `2px solid ${MKT_ACCENT}33` }}
              >
                {mktItems.map(item => (
                  <NavButton key={item.key} item={item} accent={MKT_ACCENT} grad={MKT_GRAD} group="mkt" />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* — Настройки — */}
          <div style={{ height: 1, background: 'var(--ax-border)', margin: '12px 6px' }} />
          <NavButton
            item={{ key: 'settings', icon: Settings, label: isUz ? 'Sozlamalar' : 'Настройки' }}
            accent={OPS_ACCENT} grad={OPS_GRAD} group="ops"
          />
        </nav>
        </LayoutGroup>

        {/* Bottom controls */}
        <div style={{ borderTop: '1px solid var(--ax-border)', padding: isMobile ? 10 : 12, flexShrink: 0 }}>
          <div className="flex items-center justify-between rounded-xl mb-2" style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}>
            <Sun className="w-3.5 h-3.5" style={{ color: 'var(--ax-text-3)', flexShrink: 0 }} />
            <div className="flex gap-1">
              <button onClick={() => setTheme('light')} className="rounded-lg font-medium transition-all" style={{ padding: '4px 10px', fontSize: 12, background: effectiveTheme === 'light' ? 'var(--ax-primary)' : 'transparent', color: effectiveTheme === 'light' ? '#fff' : 'var(--ax-text-2)', border: 'none', cursor: 'pointer' }}>☀️</button>
              <button onClick={() => setTheme('dark')} className="rounded-lg font-medium transition-all" style={{ padding: '4px 10px', fontSize: 12, background: effectiveTheme === 'dark' ? 'var(--ax-primary)' : 'transparent', color: effectiveTheme === 'dark' ? '#fff' : 'var(--ax-text-2)', border: 'none', cursor: 'pointer' }}>🌙</button>
            </div>
            <Moon className="w-3.5 h-3.5" style={{ color: 'var(--ax-text-3)', flexShrink: 0 }} />
          </div>

          <div className="flex items-center justify-between rounded-xl mb-2" style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}>
            <Globe className="w-3.5 h-3.5" style={{ color: 'var(--ax-text-3)', flexShrink: 0 }} />
            <div className="flex gap-1">
              <button onClick={() => setCurrentLanguage('uz')} className="rounded-lg font-medium transition-all" style={{ padding: '4px 9px', fontSize: 11, background: language === 'uz' ? 'var(--ax-primary)' : 'transparent', color: language === 'uz' ? '#fff' : 'var(--ax-text-2)', border: 'none', cursor: 'pointer' }}>🇺🇿 O'zb</button>
              <button onClick={() => setCurrentLanguage('ru')} className="rounded-lg font-medium transition-all" style={{ padding: '4px 9px', fontSize: 11, background: language === 'ru' ? 'var(--ax-primary)' : 'transparent', color: language === 'ru' ? '#fff' : 'var(--ax-text-2)', border: 'none', cursor: 'pointer' }}>🇷🇺 Рус</button>
            </div>
          </div>

          <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 rounded-xl font-medium transition-all" style={{ padding: isMobile ? '8px' : '9px', fontSize: 13, background: 'rgba(220,38,38,0.08)', color: 'var(--ax-danger)', border: '1px solid transparent', cursor: 'pointer' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(220,38,38,0.15)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(220,38,38,0.08)'; }}
          >
            <LogOut className={responsive.iconSmall} />
            {t.logout}
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 w-full overflow-x-hidden" style={{ marginLeft: isDesktop ? 236 : 0 }}>
        {/* Sticky header */}
        <header className="sticky top-0 z-10" style={{ background: 'color-mix(in srgb, var(--ax-sidebar) 88%, transparent)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--ax-border)' }}>
          <div className="flex items-center justify-between gap-4" style={{ padding: isMobile ? '10px 14px' : '12px 20px' }}>
            <div className="flex items-center gap-3">
              <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden rounded-xl transition" style={{ padding: 8, background: 'var(--ax-primary-pale)', color: 'var(--ax-primary)', border: 'none', cursor: 'pointer' }}>
                <Menu className={isMobile ? 'w-4 h-4' : 'w-5 h-5'} />
              </button>
              <AnimatePresence mode="wait">
                <motion.h1
                  key={headerTitle}
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.2 }}
                  className="font-bold" style={{ fontSize: isMobile ? 16 : 18.5, color: 'var(--ax-text)' }}
                >
                  {headerTitle}
                </motion.h1>
              </AnimatePresence>
            </div>

            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => { setShowInbox(true); setUnreadMessagesCount(0); }}
              className="relative rounded-xl transition-all"
              style={{ padding: isMobile ? 8 : 9, background: 'var(--ax-primary-pale)', color: 'var(--ax-primary)', border: 'none', cursor: 'pointer' }}
              title="Axis Messages"
            >
              <MessageSquare className="w-5 h-5" />
              {unreadMessagesCount > 0 && (
                <span className="absolute -top-1 -right-1 text-white font-bold rounded-full flex items-center justify-center animate-bounce" style={{ minWidth: 18, height: 18, padding: '0 4px', background: 'var(--ax-danger)', fontSize: 10 }}>
                  {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                </span>
              )}
            </motion.button>
          </div>
        </header>

        {/* Panel content */}
        <div style={{ padding: isMobile ? '12px 8px' : '18px 16px' }}>
          {/* Объединённый склад: сегментированный переключатель Склад ↔ Продажи */}
          {activeTab === 'warehouse' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 6, padding: 5, borderRadius: 14, background: 'var(--ax-card)', border: '1px solid var(--ax-border)', width: 'fit-content', position: 'relative' }}>
              {([
                { key: 'inventory' as const, icon: Boxes, label: isUz ? 'Ombor' : 'Склад' },
                { key: 'sales' as const, icon: ShoppingCart, label: isUz ? 'Sotuv' : 'Продажи' },
              ]).map(seg => {
                const on = warehouseView === seg.key;
                const SegIcon = seg.icon;
                return (
                  <button key={seg.key} onClick={() => setWarehouseView(seg.key)} className="relative" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'transparent', color: on ? '#fff' : 'var(--ax-text-2)', fontSize: 13.5, fontWeight: on ? 600 : 500 }}>
                    {on && (
                      <motion.span layoutId="wh-seg-pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} style={{ position: 'absolute', inset: 0, borderRadius: 10, background: OPS_GRAD, boxShadow: `0 4px 14px ${OPS_ACCENT}55`, zIndex: 0 }} />
                    )}
                    <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                      <SegIcon className="w-4 h-4" /> {seg.label}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* 📦 Инвентаризация: сверка фактических остатков с базой */}
            <button
              onClick={() => setInventoryCheckOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 12, border: '1px solid rgba(14,165,233,0.35)', background: 'rgba(14,165,233,0.12)', color: '#38BDF8', cursor: 'pointer', fontSize: 13.5, fontWeight: 600 }}
            >
              <ScanLine className="w-4 h-4" />
              {isUz ? 'Inventarizatsiya' : 'Инвентаризация'}
            </button>
            </div>
          )}

          <Suspense fallback={<TabLoading />}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab === 'warehouse' ? `warehouse-${warehouseView}` : activeTab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              >
                {activeTab === 'warehouse' && warehouseView === 'inventory' && <DigitalWarehouse companyId={companyId} />}
                {activeTab === 'warehouse' && warehouseView === 'sales' && <SalesPanel companyId={companyId} />}
                {activeTab === 'orders' && <CompanyOrdersPanel companyId={companyId} />}
                {activeTab === 'analytics' && <AnalyticsPanel companyId={companyId} />}
                {activeTab === 'barcode' && <BarcodeSearchPanel companyId={companyId} />}
                {activeTab === 'smm' && <CompanySMMPanel companyId={companyId} companyName={companyName} />}
                {activeTab === 'stories' && <CompanyStoriesPanel companyId={companyId} />}
                {activeTab === 'discounts' && <CompanyDiscountsManager companyId={companyId} products={[]} />}
                {activeTab === 'dashboard' && <CompanyDashboardPanel companyId={companyId} onNavigate={(tab) => handleNavigate(tab as Tab)} />}
                {activeTab === 'returns' && <CompanyReturnsPanel companyId={companyId} />}
                {activeTab === 'questions' && <CompanyQuestionsPanel companyId={companyId} companyName={companyName} />}
                {activeTab === 'couriers' && <CouriersManagementPanel companyId={companyId} />}
                {activeTab === 'chat' && <BroadcastChatPanel companyId={companyId} />}
                {activeTab === 'settings' && <CompanySettingsPanel companyId={companyId} companyName={companyName} />}
                {activeTab === 'debts' && <CompanyDebtsPanel companyId={companyId} />}
              </motion.div>
            </AnimatePresence>
          </Suspense>
        </div>
      </main>

      {/* Inbox modal */}
      {showInbox && (
        <Suspense fallback={null}>
          <CompanyInboxPanel companyId={companyId} onClose={() => setShowInbox(false)} />
        </Suspense>
      )}

      {/* 📦 Инвентаризация склада */}
      {inventoryCheckOpen && (
        <Suspense fallback={null}>
          <InventoryCheckModal companyId={companyId} onClose={() => setInventoryCheckOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
