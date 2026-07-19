import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import api, { clearAuth, CompanySession, loadSession, loadStoredToken } from './src/api';
import { I18nProvider, useI18n } from './src/i18n';
import { BRAND_GRAD, ThemeProvider, useTheme } from './src/theme';
import { Button, haptic, Input, Sheet } from './src/ui';
import { registerCompanyPush, unregisterCompanyPush } from './src/push';
import { syncPendingSales } from './src/offline';
import DashboardScreen from './src/screens/DashboardScreen';
import DebtsScreen from './src/screens/DebtsScreen';
import LoginScreen from './src/screens/LoginScreen';
import OrdersScreen from './src/screens/OrdersScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import ScannerScreen from './src/screens/ScannerScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import WarehouseScreen from './src/screens/WarehouseScreen';

// ============================================================================
// Axentis Business — мобильная панель компании (React Native + Expo).
// Те же принципы и функции, что веб-панель компаний (CompanyPanel.tsx),
// но в формате нативного приложения: нижняя навигация вместо сайдбара.
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

  // 🔔 Push + 📴 офлайн-очередь: регистрируем токен и досылаем продажи
  useEffect(() => {
    if (!company) return;
    registerCompanyPush(company.id);
    syncPendingSales().catch(() => {});
    const interval = setInterval(() => syncPendingSales().catch(() => {}), 60000);
    return () => clearInterval(interval);
  }, [company]);

  const handleLogout = async () => {
    if (company) await unregisterCompanyPush(company.id); // отвязываем push от устройства
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

// ─── Панель компании: градиентная шапка + контент + нижняя навигация ─────────

function CompanyPanel({ company, onLogout }: { company: CompanySession; onLogout: () => void }) {
  const { theme } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [unread, setUnread] = useState(0);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [debtsOpen, setDebtsOpen] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;

  // 👥 Режим кассира: продавец-наёмник видит только кассу; выход — по PIN владельца
  const [cashierMode, setCashierMode] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');

  useEffect(() => {
    AsyncStorage.getItem('axentis_cashier_mode').then((v) => setCashierMode(v === '1'));
  }, []);

  const enableCashierMode = () => {
    AsyncStorage.setItem('axentis_cashier_mode', '1').catch(() => {});
    setCashierMode(true);
  };

  const tryExitCashier = async () => {
    const pin = await AsyncStorage.getItem('axentis_cashier_pin');
    if (pinInput === pin) {
      haptic.success();
      AsyncStorage.setItem('axentis_cashier_mode', '0').catch(() => {});
      setCashierMode(false);
      setPinOpen(false);
      setPinInput('');
    } else {
      haptic.error();
      setPinInput('');
      Alert.alert('❌', t.cashierWrongPin);
    }
  };

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

  // Плавная смена вкладки
  const switchTab = (next: Tab) => {
    if (next === tab) return;
    haptic.light();
    fade.setValue(0);
    setTab(next);
    Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  };

  const titles: Record<Tab, string> = {
    dashboard: t.dashboard,
    warehouse: `${t.warehouse} · ${t.sales}`,
    orders: t.orders,
    analytics: t.analytics,
    settings: t.settings,
  };

  const tabs: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'dashboard', label: t.dashboard, icon: 'grid-outline', iconActive: 'grid' },
    { key: 'warehouse', label: t.warehouse, icon: 'cube-outline', iconActive: 'cube' },
    { key: 'orders', label: t.orders, icon: 'receipt-outline', iconActive: 'receipt' },
    { key: 'analytics', label: t.analytics, icon: 'stats-chart-outline', iconActive: 'stats-chart' },
    { key: 'settings', label: t.more, icon: 'settings-outline', iconActive: 'settings' },
  ];

  // 👥 Режим кассира: только касса, выход по PIN владельца
  if (cashierMode) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <ScannerScreen
          companyId={company.id}
          visible
          onClose={() => {
            setPinInput('');
            setPinOpen(true);
          }}
        />
        <Sheet visible={pinOpen} onClose={() => setPinOpen(false)} title={t.cashierExit}>
          <Input
            label={t.cashierEnterPin}
            value={pinInput}
            onChangeText={(v) => setPinInput(v.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
          />
          <Button title={t.cashierExit} onPress={tryExitCashier} icon="lock-open-outline" />
        </Sheet>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Градиентная шапка — фирменный стиль панели */}
      <LinearGradient colors={[...BRAND_GRAD]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View
          style={{
            paddingTop: insets.top + 8,
            paddingBottom: 12,
            paddingHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 13,
              backgroundColor: 'rgba(255,255,255,0.2)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="business" size={19} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 16.5, fontWeight: '700' }} numberOfLines={1}>
              {titles[tab]}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11.5 }} numberOfLines={1}>
              {company.name} · {t.companyPanel}
            </Text>
          </View>
          {/* 🧾 Дафтар — журнал долгов клиентов */}
          <Pressable
            onPress={() => {
              haptic.light();
              setDebtsOpen(true);
            }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.18)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="wallet-outline" size={18} color="#fff" />
          </Pressable>
          {unread > 0 && (
            <View
              style={{
                backgroundColor: '#F87171',
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
      </LinearGradient>

      {/* Контент активной вкладки — с плавным появлением */}
      <Animated.View style={{ flex: 1, opacity: fade }}>
        {tab === 'dashboard' && <DashboardScreen companyId={company.id} />}
        {tab === 'warehouse' && <WarehouseScreen companyId={company.id} />}
        {tab === 'orders' && <OrdersScreen companyId={company.id} />}
        {tab === 'analytics' && <AnalyticsScreen companyId={company.id} />}
        {tab === 'settings' && (
          <SettingsScreen company={company} onLogout={onLogout} onEnableCashier={enableCashierMode} />
        )}
      </Animated.View>

      {/* Нижняя навигация — с приподнятой кнопкой кассы по центру */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          backgroundColor: theme.sidebar,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
        }}
      >
        {tabs.map((item, idx) => {
          const on = tab === item.key;
          const tabButton = (
            <Pressable
              key={item.key}
              onPress={() => switchTab(item.key)}
              style={{ flex: 1, alignItems: 'center', gap: 3 }}
            >
              <View
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor: on ? theme.primaryPale : 'transparent',
                }}
              >
                <Ionicons name={on ? item.iconActive : item.icon} size={20} color={on ? theme.primary : theme.text3} />
              </View>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: on ? '700' : '500',
                  color: on ? theme.primary : theme.text3,
                }}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </Pressable>
          );
          // 📷 Между «Склад» и «Заказы» — большая кнопка кассы-сканера
          if (idx === 2) {
            return (
              <React.Fragment key={item.key}>
                <Pressable
                  onPress={() => {
                    haptic.medium();
                    setScannerOpen(true);
                  }}
                  style={{ flex: 1, alignItems: 'center' }}
                >
                  <LinearGradient
                    colors={[...BRAND_GRAD]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 26,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: -22,
                      shadowColor: '#7C5CF0',
                      shadowOpacity: 0.5,
                      shadowRadius: 10,
                      shadowOffset: { width: 0, height: 5 },
                      elevation: 8,
                      borderWidth: 3,
                      borderColor: theme.sidebar,
                    }}
                  >
                    <Ionicons name="barcode-outline" size={24} color="#fff" />
                  </LinearGradient>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: theme.primary, marginTop: 3 }}>
                    {t.pos}
                  </Text>
                </Pressable>
                {tabButton}
              </React.Fragment>
            );
          }
          return tabButton;
        })}
      </View>

      {/* 📷 Касса-сканер (полноэкранная) */}
      <ScannerScreen companyId={company.id} visible={scannerOpen} onClose={() => setScannerOpen(false)} />

      {/* 🧾 Дафтар (долги клиентов) */}
      <DebtsScreen companyId={company.id} visible={debtsOpen} onClose={() => setDebtsOpen(false)} />
    </View>
  );
}
