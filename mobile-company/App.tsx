import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import api, { clearAuth, CompanySession, loadSession, loadStoredToken } from './src/api';
import { I18nProvider, useI18n } from './src/i18n';
import { ThemeProvider, useTheme } from './src/theme';
import DashboardScreen from './src/screens/DashboardScreen';
import LoginScreen from './src/screens/LoginScreen';
import OrdersScreen from './src/screens/OrdersScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import WarehouseScreen from './src/screens/WarehouseScreen';

// ============================================================================
// Axentis Business — мобильная панель компании (React Native + Expo).
// Тот же принцип, что веб-панель компаний (CompanyPanel.tsx), но в формате
// нативного приложения: нижняя навигация вместо сайдбара.
//
// 🚫 Админ-панели в приложении НЕТ: единственный способ входа —
// /auth/login/company; admin-endpoints не подключены вовсе.
// ============================================================================

type Tab = 'dashboard' | 'warehouse' | 'orders' | 'analytics' | 'settings';

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <I18nProvider>
          <Root />
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function Root() {
  const { theme, themeName } = useTheme();
  const [booting, setBooting] = useState(true);
  const [company, setCompany] = useState<CompanySession | null>(null);

  // 🔄 Восстановление сессии при запуске (токен + данные компании)
  useEffect(() => {
    (async () => {
      try {
        const token = await loadStoredToken();
        if (token) {
          const session = await loadSession();
          if (session) setCompany(session);
        }
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  const handleLogout = async () => {
    await clearAuth();
    setCompany(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar style={themeName === 'dark' ? 'light' : 'dark'} />
      {booting ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : company ? (
        <CompanyPanel company={company} onLogout={handleLogout} />
      ) : (
        <LoginScreen onLogin={setCompany} />
      )}
    </View>
  );
}

// ─── Панель компании: шапка + контент + нижняя навигация ─────────────────────

function CompanyPanel({ company, onLogout }: { company: CompanySession; onLogout: () => void }) {
  const { theme } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [unread, setUnread] = useState(0);

  // 🔔 Счётчик непрочитанных сообщений — как в шапке веб-панели
  useEffect(() => {
    let alive = true;
    const loadCount = async () => {
      try {
        const data = await api.companyMessages.count(company.id);
        if (alive) setUnread(data?.count || 0);
      } catch {
        /* не критично */
      }
    };
    loadCount();
    const interval = setInterval(loadCount, 30000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [company.id]);

  const titles: Record<Tab, string> = {
    dashboard: t.dashboard,
    warehouse: `${t.warehouse} · ${t.sales}`,
    orders: t.orders,
    analytics: t.analytics,
    settings: t.settings,
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'dashboard', label: t.dashboard, icon: '📊' },
    { key: 'warehouse', label: t.warehouse, icon: '📦' },
    { key: 'orders', label: t.orders, icon: '🧾' },
    { key: 'analytics', label: t.analytics, icon: '📈' },
    { key: 'settings', label: t.more, icon: '⚙️' },
  ];

  return (
    <View style={{ flex: 1 }}>
      {/* Шапка */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: 16,
          backgroundColor: theme.sidebar,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={{ color: theme.text, fontSize: 17, fontWeight: '700' }} numberOfLines={1}>
            {titles[tab]}
          </Text>
          <Text style={{ color: theme.text3, fontSize: 12, marginTop: 1 }} numberOfLines={1}>
            {company.name} · {t.companyPanel}
          </Text>
        </View>
        {unread > 0 && (
          <View
            style={{
              backgroundColor: theme.danger,
              borderRadius: 999,
              minWidth: 22,
              height: 22,
              paddingHorizontal: 6,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 11.5, fontWeight: '700' }}>
              {unread > 9 ? '9+' : unread}
            </Text>
          </View>
        )}
      </View>

      {/* Контент активной вкладки */}
      <View style={{ flex: 1 }}>
        {tab === 'dashboard' && <DashboardScreen companyId={company.id} />}
        {tab === 'warehouse' && <WarehouseScreen companyId={company.id} />}
        {tab === 'orders' && <OrdersScreen companyId={company.id} />}
        {tab === 'analytics' && <AnalyticsScreen companyId={company.id} />}
        {tab === 'settings' && <SettingsScreen company={company} onLogout={onLogout} />}
      </View>

      {/* Нижняя навигация */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: theme.sidebar,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
        }}
      >
        {tabs.map((item) => {
          const on = tab === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setTab(item.key)}
              style={{ flex: 1, alignItems: 'center', gap: 3 }}
            >
              <View
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 3,
                  borderRadius: 999,
                  backgroundColor: on ? theme.primaryPale : 'transparent',
                }}
              >
                <Text style={{ fontSize: 18, opacity: on ? 1 : 0.55 }}>{item.icon}</Text>
              </View>
              <Text
                style={{
                  fontSize: 10.5,
                  fontWeight: on ? '700' : '500',
                  color: on ? theme.primary : theme.text3,
                }}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
