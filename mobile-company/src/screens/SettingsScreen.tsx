import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, RefreshControl, ScrollView, Switch, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Clipboard from 'expo-clipboard';
import api, { CompanySession, Supplier } from '../api';
import { registerCompanyPush } from '../push';
import { useI18n } from '../i18n';
import { SP, useTheme } from '../theme';
import { Badge, Button, Card, Chip, haptic, Input, SectionTitle, Segmented } from '../ui';

interface Props {
  company: CompanySession;
  onLogout: () => void;
  onEnableCashier?: () => void;
  lockedTabs?: string[];
  onLocksChange?: (tabs: string[]) => void;
}

// ⚙️ Настройки — 1:1 с CompanySettingsPanel веб-панели: режим магазина
// (публичный ↔ закрытый + код доступа), доставка и возвраты, регионы
// обслуживания, Telegram-уведомления; плюс язык, тема и выход
// (нижний блок сайдбара CompanyPanel).
export default function SettingsScreen({
  company,
  onLogout,
  onEnableCashier,
  lockedTabs = [],
  onLocksChange,
}: Props) {
  const { theme, themeName, setThemeName } = useTheme();
  const { t, lang, setLang } = useI18n();

  const [profile, setProfile] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Режим магазина
  const [mode, setMode] = useState<'public' | 'private'>('public');
  const [privateCode, setPrivateCode] = useState<string | null>(null);
  const [switchingMode, setSwitchingMode] = useState(false);

  // Доставка и возвраты
  const [freeRadiusKm, setFreeRadiusKm] = useState('2');
  const [costPerKm, setCostPerKm] = useState('1500');
  const [returnEnabled, setReturnEnabled] = useState(true);
  const [returnWindowHours, setReturnWindowHours] = useState('24');
  const [savingDelivery, setSavingDelivery] = useState(false);

  // Регионы
  const [allRegions, setAllRegions] = useState<{ id: number; name: string; nameUz?: string }[]>([]);
  const [serviceRegions, setServiceRegions] = useState<string[]>([]);

  // Telegram
  const [tgStatus, setTgStatus] = useState<{ enabled?: boolean; connected: boolean; connectLink?: string; botName?: string } | null>(null);
  const [tgBusy, setTgBusy] = useState(false);

  // ⚙️ Настройки Telegram-бота: что и когда отправлять
  const [tgSettings, setTgSettings] = useState<{
    notifyOrders: boolean;
    notifyStock: boolean;
    notifyDaily: boolean;
    dailyHour: number;
    notifyDebts: boolean;
    debtsHour: number;
  } | null>(null);

  useEffect(() => {
    api.companies
      .telegramSettings(company.id)
      .then(setTgSettings)
      .catch(() => {});
  }, [company.id]);

  const saveTgSettings = async (patch: Partial<NonNullable<typeof tgSettings>>) => {
    if (!tgSettings) return;
    const next = { ...tgSettings, ...patch };
    setTgSettings(next);
    try {
      await api.companies.updateTelegramSettings(company.id, patch);
      haptic.light();
    } catch (e) {
      Alert.alert(t.error, e instanceof Error ? e.message : String(e));
    }
  };

  // 🔔 Push-настройки (хранятся локально, дублируются на бэкенд с токеном)
  const [pushNewOrders, setPushNewOrders] = useState(true);
  const [pushDailySummary, setPushDailySummary] = useState(true);
  const [pushDenied, setPushDenied] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('axentis_push_prefs').then((raw) => {
      if (!raw) return;
      try {
        const p = JSON.parse(raw);
        if (typeof p.newOrders === 'boolean') setPushNewOrders(p.newOrders);
        if (typeof p.dailySummary === 'boolean') setPushDailySummary(p.dailySummary);
      } catch {
        /* ignore */
      }
    });
  }, []);

  const savePushPrefs = async (newOrders: boolean, dailySummary: boolean) => {
    setPushNewOrders(newOrders);
    setPushDailySummary(dailySummary);
    AsyncStorage.setItem('axentis_push_prefs', JSON.stringify({ newOrders, dailySummary })).catch(() => {});
    const result = await registerCompanyPush(company.id, { newOrders, dailySummary });
    setPushDenied(result === 'denied');
  };

  const load = useCallback(async () => {
    try {
      // Полные настройки — из детального эндпоинта, как loadCompanyData в вебе
      const full = await api.companies.get(company.id);
      setProfile(full);
      if (full) {
        setMode(full.mode === 'private' ? 'private' : 'public');
        setPrivateCode(full.privateCode || null);
        if (full.deliveryRadiusKm != null) setFreeRadiusKm(String(full.deliveryRadiusKm));
        if (full.deliveryCostPerKm != null) setCostPerKm(String(full.deliveryCostPerKm));
        if (full.returnEnabled != null) setReturnEnabled(!!full.returnEnabled);
        if (full.returnWindowHours != null) setReturnWindowHours(String(full.returnWindowHours));
        if (Array.isArray(full.serviceRegions)) setServiceRegions(full.serviceRegions);
      }
    } catch (e) {
      console.error('Settings load failed:', e);
    }
    api.regions
      .list()
      .then((r) => setAllRegions(Array.isArray(r) ? r : []))
      .catch(() => setAllRegions([]));
    api.companies
      .telegramStatus(company.id)
      .then(setTgStatus)
      .catch(() => setTgStatus(null));
    setRefreshing(false);
  }, [company.id]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Режим магазина (PUT /companies/:id/privacy) ────────────────────────────
  const toggleMode = () => {
    const newMode = mode === 'public' ? 'private' : 'public';
    Alert.alert(
      t.modeSection,
      newMode === 'private' ? t.switchToPrivateConfirm : t.switchToPublicConfirm,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: 'OK',
          onPress: async () => {
            setSwitchingMode(true);
            try {
              const data = await api.companies.setPrivacy(company.id, newMode);
              setMode(newMode);
              setPrivateCode(data?.privateCode || null);
              haptic.success();
              Alert.alert(
                '✅',
                newMode === 'private' && data?.privateCode
                  ? `${t.modeChanged}\n${t.accessCode}: ${data.privateCode}`
                  : t.modeChanged
              );
            } catch (e) {
              haptic.error();
              Alert.alert(t.error, e instanceof Error ? e.message : String(e));
            } finally {
              setSwitchingMode(false);
            }
          },
        },
      ]
    );
  };

  const copyCode = async () => {
    if (!privateCode) return;
    await Clipboard.setStringAsync(privateCode);
    haptic.success();
    Alert.alert('✅', t.codeCopied);
  };

  // ── Доставка и возвраты — handleSaveDelivery из веба ───────────────────────
  const saveDelivery = async () => {
    setSavingDelivery(true);
    try {
      await api.companies.update(company.id, {
        deliveryRadiusKm: parseFloat(freeRadiusKm) || 0,
        deliveryCostPerKm: parseFloat(costPerKm) || 0,
        returnEnabled,
        returnWindowHours: parseInt(returnWindowHours, 10) || 0,
      });
      haptic.success();
      Alert.alert('✅', t.deliverySaved);
    } catch (e) {
      haptic.error();
      Alert.alert(t.error, e instanceof Error ? e.message : String(e));
    } finally {
      setSavingDelivery(false);
    }
  };

  // ── Регионы — toggleRegion из веба (сохранение сразу) ──────────────────────
  const toggleRegion = async (regionName: string) => {
    const next = serviceRegions.includes(regionName)
      ? serviceRegions.filter((x) => x !== regionName)
      : [...serviceRegions, regionName];
    setServiceRegions(next);
    try {
      await api.companies.update(company.id, { serviceRegions: next });
    } catch (e) {
      console.error('Region save failed:', e);
    }
  };

  // ── Telegram ───────────────────────────────────────────────────────────────
  const connectTelegram = () => {
    if (tgStatus?.connectLink) {
      haptic.light();
      Linking.openURL(tgStatus.connectLink).catch(() => {});
    }
  };

  const disconnectTelegram = async () => {
    setTgBusy(true);
    try {
      await api.companies.telegramDisconnect(company.id);
      setTgStatus((s) => (s ? { ...s, connected: false } : s));
      haptic.success();
      Alert.alert('✅', t.telegramDisconnected);
    } catch (e) {
      Alert.alert(t.error, e instanceof Error ? e.message : String(e));
    } finally {
      setTgBusy(false);
    }
  };

  // 👥 Режим кассира: PIN владельца + запуск режима
  const [cashierPin, setCashierPin] = useState('');
  const [savedPinExists, setSavedPinExists] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('axentis_cashier_pin').then((v) => setSavedPinExists(!!v));
  }, []);

  const saveCashierPin = async () => {
    if (cashierPin.length !== 4) {
      Alert.alert(t.error, t.cashierSetPin);
      return;
    }
    await AsyncStorage.setItem('axentis_cashier_pin', cashierPin);
    setSavedPinExists(true);
    setCashierPin('');
    haptic.success();
  };

  // 🚚 Поставщики (для автозаказа из плана закупки)
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
  const [supplierForm, setSupplierForm] = useState({ name: '', phone: '', telegram: '' });
  const [supplierSaving, setSupplierSaving] = useState(false);

  const loadSuppliers = useCallback(() => {
    api.suppliers
      .list(company.id)
      .then((s) => setSuppliersList(Array.isArray(s) ? s : []))
      .catch(() => {});
  }, [company.id]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const addSupplier = async () => {
    if (!supplierForm.name.trim()) {
      Alert.alert(t.error, t.supplierName);
      return;
    }
    setSupplierSaving(true);
    try {
      await api.suppliers.create({
        companyId: company.id,
        name: supplierForm.name.trim(),
        phone: supplierForm.phone.replace(/\D/g, ''),
        telegram: supplierForm.telegram.trim(),
      });
      haptic.success();
      setSupplierForm({ name: '', phone: '', telegram: '' });
      loadSuppliers();
    } catch (e) {
      Alert.alert(t.error, e instanceof Error ? e.message : String(e));
    } finally {
      setSupplierSaving(false);
    }
  };

  const deleteSupplier = (s: Supplier) => {
    Alert.alert(t.delete, t.deleteSupplierConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            await api.suppliers.delete(s.id);
            loadSuppliers();
          } catch (e) {
            Alert.alert(t.error, e instanceof Error ? e.message : String(e));
          }
        },
      },
    ]);
  };

  // 🔐 PIN-замки разделов: «Заказы» и касса не блокируются никогда
  const lockableTabs: { key: string; label: string }[] = [
    { key: 'dashboard', label: t.dashboard },
    { key: 'warehouse', label: `${t.warehouse} · ${t.sales}` },
    { key: 'analytics', label: t.analytics },
    { key: 'debts', label: t.debts },
    { key: 'settings', label: t.settings },
  ];

  const toggleLock = async (key: string) => {
    const pin = await AsyncStorage.getItem('axentis_cashier_pin');
    if (!pin) {
      Alert.alert(t.error, t.cashierPinRequired);
      return;
    }
    haptic.light();
    const next = lockedTabs.includes(key)
      ? lockedTabs.filter((x) => x !== key)
      : [...lockedTabs, key];
    onLocksChange?.(next);
  };

  const startCashierMode = async () => {
    const pin = await AsyncStorage.getItem('axentis_cashier_pin');
    if (!pin) {
      Alert.alert(t.error, t.cashierPinRequired);
      return;
    }
    haptic.medium();
    Alert.alert(t.cashierSection, t.cashierHint, [
      { text: t.cancel, style: 'cancel' },
      { text: t.cashierEnable, onPress: () => onEnableCashier?.() },
    ]);
  };

  const confirmLogout = () => {
    Alert.alert(t.logout, t.logoutConfirm, [
      { text: t.cancel, style: 'cancel' },
      { text: t.logout, style: 'destructive', onPress: onLogout },
    ]);
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: SP.lg - 2, paddingBottom: 32 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          tintColor={theme.primary}
        />
      }
    >
      {/* Профиль */}
      <SectionTitle text={t.companyProfile} />
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: theme.primaryPale,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="business-outline" size={24} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontSize: 17, fontWeight: '700' }} numberOfLines={1}>
              {profile?.name || company.name}
            </Text>
            <Text style={{ color: theme.text2, fontSize: 13.5, marginTop: 2 }}>+998 {company.phone}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <Badge
            text={`${t.mode}: ${mode === 'private' ? t.modePrivate : t.modePublic}`}
            color={mode === 'private' ? theme.mktAccent : theme.opsAccent}
          />
          {(profile?.status || company.status) ? (
            <Badge text={`${t.status}: ${profile?.status || company.status}`} color={theme.success} />
          ) : null}
        </View>
      </Card>

      {/* Режим магазина */}
      <View style={{ marginTop: 18 }}>
        <SectionTitle text={t.modeSection} accent={theme.mktAccent} />
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={{ color: theme.text, fontSize: 14.5, fontWeight: '600' }}>
                {mode === 'private' ? t.modePrivate : t.modePublic}
              </Text>
              <Text style={{ color: theme.text3, fontSize: 12.5, marginTop: 3 }}>
                {mode === 'private' ? t.modePrivateDesc : t.modePublicDesc}
              </Text>
            </View>
            <Switch
              value={mode === 'private'}
              onValueChange={toggleMode}
              disabled={switchingMode}
              trackColor={{ true: theme.mktAccent, false: theme.border }}
              thumbColor="#fff"
            />
          </View>
          {mode === 'private' && privateCode && (
            <Pressable
              onPress={copyCode}
              style={{
                marginTop: 12,
                backgroundColor: theme.primaryPale,
                borderRadius: 12,
                padding: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View>
                <Text style={{ color: theme.text3, fontSize: 11.5 }}>{t.accessCode}</Text>
                <Text style={{ color: theme.primary, fontSize: 19, fontWeight: '800', letterSpacing: 2 }}>
                  {privateCode}
                </Text>
              </View>
              <Ionicons name="copy-outline" size={20} color={theme.primary} />
            </Pressable>
          )}
        </Card>
      </View>

      {/* Доставка и возвраты */}
      <View style={{ marginTop: 18 }}>
        <SectionTitle text={t.deliverySection} />
        <Card>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Input
                label={t.freeRadius}
                value={freeRadiusKm}
                onChangeText={(v) => setFreeRadiusKm(v.replace(/[^0-9.]/g, ''))}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label={t.costPerKm}
                value={costPerKm}
                onChangeText={(v) => setCostPerKm(v.replace(/\D/g, ''))}
                keyboardType="number-pad"
              />
            </View>
          </View>
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}
          >
            <Text style={{ color: theme.text, fontSize: 14 }}>{t.returnsEnabled}</Text>
            <Switch
              value={returnEnabled}
              onValueChange={setReturnEnabled}
              trackColor={{ true: theme.primary, false: theme.border }}
              thumbColor="#fff"
            />
          </View>
          {returnEnabled && (
            <Input
              label={t.returnWindow}
              value={returnWindowHours}
              onChangeText={(v) => setReturnWindowHours(v.replace(/\D/g, ''))}
              keyboardType="number-pad"
            />
          )}
          <Button title={t.save} onPress={saveDelivery} loading={savingDelivery} small icon="checkmark" />
        </Card>
      </View>

      {/* Регионы обслуживания */}
      {allRegions.length > 0 && (
        <View style={{ marginTop: 18 }}>
          <SectionTitle text={t.regionsSection} hint={t.regionsHint} accent={theme.opsAccent} />
          <Card>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {allRegions.map((r) => {
                const name = lang === 'uz' && r.nameUz ? r.nameUz : r.name;
                const active = serviceRegions.includes(r.name);
                return (
                  <Chip
                    key={r.id}
                    label={name}
                    active={active}
                    onPress={() => toggleRegion(r.name)}
                    color={theme.opsAccent}
                  />
                );
              })}
            </View>
          </Card>
        </View>
      )}

      {/* 🔔 Push-уведомления */}
      <View style={{ marginTop: 18 }}>
        <SectionTitle text={t.pushSection} hint={t.pushHint} accent={theme.warning} />
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <Ionicons name="notifications-outline" size={17} color={theme.warning} />
              <Text style={{ color: theme.text, fontSize: 14 }}>{t.pushNewOrders}</Text>
            </View>
            <Switch
              value={pushNewOrders}
              onValueChange={(v) => savePushPrefs(v, pushDailySummary)}
              trackColor={{ true: theme.primary, false: theme.border }}
              thumbColor="#fff"
            />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <Ionicons name="sunny-outline" size={17} color={theme.warning} />
              <Text style={{ color: theme.text, fontSize: 14 }}>{t.pushDailySummary}</Text>
            </View>
            <Switch
              value={pushDailySummary}
              onValueChange={(v) => savePushPrefs(pushNewOrders, v)}
              trackColor={{ true: theme.primary, false: theme.border }}
              thumbColor="#fff"
            />
          </View>
          {pushDenied && (
            <Text style={{ color: theme.danger, fontSize: 12.5, marginTop: 10 }}>⚠️ {t.pushDenied}</Text>
          )}
        </Card>
      </View>

      {/* 🚚 Поставщики */}
      <View style={{ marginTop: 18 }}>
        <SectionTitle text={t.suppliers} hint={t.suppliersHint} accent={theme.success} />
        <Card>
          {suppliersList.length === 0 ? (
            <Text style={{ color: theme.text3, fontSize: 13, marginBottom: 10 }}>{t.noSuppliers}</Text>
          ) : (
            <View style={{ gap: 6, marginBottom: 12 }}>
              {suppliersList.map((s) => (
                <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="cube-outline" size={15} color={theme.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                      {s.name}
                    </Text>
                    <Text style={{ color: theme.text3, fontSize: 12 }} numberOfLines={1}>
                      {[s.phone && `+998 ${s.phone}`, s.telegram && `@${s.telegram}`].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Pressable onPress={() => deleteSupplier(s)} hitSlop={6}>
                    <Ionicons name="trash-outline" size={17} color={theme.text3} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
          <Input
            label={t.supplierName}
            value={supplierForm.name}
            onChangeText={(v) => setSupplierForm({ ...supplierForm, name: v })}
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Input
                label={t.phoneNumber}
                value={supplierForm.phone}
                onChangeText={(v) => setSupplierForm({ ...supplierForm, phone: v.replace(/\D/g, '').slice(0, 9) })}
                keyboardType="phone-pad"
                placeholder="901234567"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label={t.supplierTelegram}
                value={supplierForm.telegram}
                onChangeText={(v) => setSupplierForm({ ...supplierForm, telegram: v.replace(/@/g, '') })}
                autoCapitalize="none"
              />
            </View>
          </View>
          <Button title={t.addSupplier} onPress={addSupplier} loading={supplierSaving} small icon="add" />
        </Card>
      </View>

      {/* Telegram */}
      <View style={{ marginTop: 18 }}>
        <SectionTitle text={t.telegramSection} accent="#229ED9" />
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              backgroundColor: 'rgba(34,158,217,0.15)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="paper-plane" size={19} color="#229ED9" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>
              {tgStatus?.connected ? t.telegramConnected : t.telegramNotConnected}
            </Text>
            {tgStatus?.botName ? (
              <Text style={{ color: theme.text3, fontSize: 12.5 }}>@{tgStatus.botName}</Text>
            ) : null}
          </View>
          {tgStatus?.connected ? (
            <Button title={t.telegramDisconnect} onPress={disconnectTelegram} small variant="danger" loading={tgBusy} />
          ) : tgStatus?.connectLink ? (
            <Button title={t.telegramConnect} onPress={connectTelegram} small />
          ) : null}
        </Card>

        {/* ⚙️ Что и когда шлёт бот — редактируется прямо здесь */}
        {tgStatus?.connected && tgSettings && (
          <Card style={{ marginTop: 8 }}>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13.5, marginBottom: 10 }}>
              ⚙️ {t.tgWhatToSend}
            </Text>
            {(
              [
                { key: 'notifyOrders' as const, label: t.tgNewOrder, icon: 'receipt-outline' as const },
                { key: 'notifyStock' as const, label: t.tgLowStock, icon: 'alert-circle-outline' as const },
                { key: 'notifyDaily' as const, label: t.tgDailyReport, icon: 'stats-chart-outline' as const, hourKey: 'dailyHour' as const },
                { key: 'notifyDebts' as const, label: t.tgDebtReminder, icon: 'wallet-outline' as const, hourKey: 'debtsHour' as const },
              ]
            ).map((item, idx) => (
              <View
                key={item.key}
                style={{
                  paddingVertical: 8,
                  borderTopWidth: idx === 0 ? 0 : 1,
                  borderTopColor: theme.border,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <Ionicons name={item.icon} size={16} color="#229ED9" />
                    <Text style={{ color: theme.text, fontSize: 14 }}>{item.label}</Text>
                  </View>
                  <Switch
                    value={tgSettings[item.key]}
                    onValueChange={(v) => saveTgSettings({ [item.key]: v } as any)}
                    trackColor={{ true: '#229ED9', false: theme.border }}
                    thumbColor="#fff"
                  />
                </View>
                {/* Час отправки — для отчёта и напоминания о долгах */}
                {item.hourKey && tgSettings[item.key] && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginLeft: 24, flexWrap: 'wrap' }}>
                    <Text style={{ color: theme.text3, fontSize: 12.5 }}>{t.tgAtHour}:</Text>
                    {[8, 10, 12, 18, 20, 21, 22].map((h) => {
                      const on = tgSettings[item.hourKey!] === h;
                      return (
                        <Pressable
                          key={h}
                          onPress={() => saveTgSettings({ [item.hourKey!]: h } as any)}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: 999,
                            backgroundColor: on ? '#229ED9' : theme.input,
                            borderWidth: 1,
                            borderColor: on ? '#229ED9' : theme.border,
                          }}
                        >
                          <Text style={{ color: on ? '#fff' : theme.text2, fontSize: 12, fontWeight: '700' }}>
                            {h}:00
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            ))}
          </Card>
        )}
      </View>

      {/* 👥 Режим кассира */}
      <View style={{ marginTop: 18 }}>
        <SectionTitle text={t.cashierSection} hint={t.cashierHint} accent={theme.danger} />
        <Card>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <Input
                label={t.cashierSetPin}
                value={cashierPin}
                onChangeText={(v) => setCashierPin(v.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
                placeholder={savedPinExists ? '••••' : '1234'}
                style={{ marginBottom: 0 }}
              />
            </View>
            <Button title={t.save} onPress={saveCashierPin} small icon="key-outline" style={{ marginBottom: 12 }} />
          </View>
          <Button
            title={t.cashierEnable}
            onPress={startCashierMode}
            variant="warning"
            icon="person-outline"
            small
          />
        </Card>
      </View>

      {/* 🔐 PIN-защита разделов */}
      <View style={{ marginTop: 18 }}>
        <SectionTitle text={t.pinLocksSection} hint={t.pinLocksHint} accent={theme.primary} />
        <Card>
          {lockableTabs.map((item, idx) => {
            const locked = lockedTabs.includes(item.key);
            return (
              <View
                key={item.key}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 8,
                  borderTopWidth: idx === 0 ? 0 : 1,
                  borderTopColor: theme.border,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <Ionicons
                    name={locked ? 'lock-closed' : 'lock-open-outline'}
                    size={16}
                    color={locked ? theme.primary : theme.text3}
                  />
                  <Text style={{ color: theme.text, fontSize: 14 }}>{item.label}</Text>
                </View>
                <Switch
                  value={locked}
                  onValueChange={() => toggleLock(item.key)}
                  trackColor={{ true: theme.primary, false: theme.border }}
                  thumbColor="#fff"
                />
              </View>
            );
          })}
        </Card>
      </View>

      {/* Язык */}
      <View style={{ marginTop: 18 }}>
        <SectionTitle text={t.language} />
        <Segmented
          options={[
            { key: 'uz', label: "🇺🇿 O'zbekcha" },
            { key: 'ru', label: '🇷🇺 Русский' },
          ]}
          value={lang}
          onChange={setLang}
        />
      </View>

      {/* Тема */}
      <View style={{ marginTop: 18 }}>
        <SectionTitle text={t.theme} />
        <Segmented
          options={[
            { key: 'light', label: `☀️ ${t.themeLight}` },
            { key: 'dark', label: `🌙 ${t.themeDark}` },
          ]}
          value={themeName}
          onChange={setThemeName}
        />
      </View>

      {/* О приложении */}
      <View style={{ marginTop: 18 }}>
        <SectionTitle text={t.aboutApp} />
        <Card>
          <Text style={{ color: theme.text2, fontSize: 13.5, lineHeight: 19 }}>{t.aboutAppText}</Text>
          <Text style={{ color: theme.text3, fontSize: 12.5, marginTop: 8 }}>
            {t.version}: {Constants.expoConfig?.version || '1.0.0'}
          </Text>
        </Card>
      </View>

      <Button title={t.logout} onPress={confirmLogout} variant="danger" icon="log-out-outline" style={{ marginTop: 22 }} />
    </ScrollView>
  );
}
