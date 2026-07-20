import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api, { Debt } from '../api';
import { useI18n } from '../i18n';
import { R, SP, useTheme } from '../theme';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  fmt,
  fmtShort,
  haptic,
  Input,
  Loading,
  ProgressBar,
  Segmented,
  Sheet,
} from '../ui';

// 🧾 «Дафтар» — цифровая долговая тетрадь (общий API /debts с веб-панелью).
// Кому, сколько, до какого числа; частичные оплаты; push-напоминание в срок.
export default function DebtsScreen({
  companyId,
  visible,
  onClose,
}: {
  companyId: number;
  visible: boolean;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const { t, lang } = useI18n();
  const insets = useSafeAreaInsets();

  const [list, setList] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'open' | 'paid'>('open');

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ customerName: '', customerPhone: '', amount: '', dueDate: '', note: '' });
  const [payingDebt, setPayingDebt] = useState<Debt | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.debts.list(companyId);
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Debts load failed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      load();
    }
  }, [visible, load]);

  const filtered = useMemo(() => list.filter((d) => d.status === filter), [list, filter]);

  const totalOpen = useMemo(
    () => list.filter((d) => d.status === 'open').reduce((s, d) => s + (d.amount - d.paidAmount), 0),
    [list]
  );

  const today = new Date().toISOString().slice(0, 10);

  const submitDebt = async () => {
    const amount = parseFloat(form.amount);
    if (!form.customerName.trim() || !amount || amount <= 0) {
      Alert.alert(t.error, t.fillAllFields);
      return;
    }
    if (form.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(form.dueDate)) {
      Alert.alert(t.error, t.debtDue);
      return;
    }
    setSaving(true);
    try {
      await api.debts.create({
        companyId,
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.replace(/\D/g, ''),
        amount,
        note: form.note.trim(),
        dueDate: form.dueDate || undefined,
      });
      haptic.success();
      setFormOpen(false);
      setForm({ customerName: '', customerPhone: '', amount: '', dueDate: '', note: '' });
      load();
      Alert.alert('✅', t.debtSaved);
    } catch (e) {
      haptic.error();
      Alert.alert(t.error, e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const submitPayment = async () => {
    if (!payingDebt) return;
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      Alert.alert(t.error, t.paymentAmount);
      return;
    }
    setSaving(true);
    try {
      const updated = await api.debts.update(payingDebt.id, { addPayment: amount });
      haptic.success();
      setPayingDebt(null);
      setPayAmount('');
      load();
      if (updated?.status === 'paid') Alert.alert('🎉', t.debtPaidFully);
    } catch (e) {
      haptic.error();
      Alert.alert(t.error, e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const deleteDebt = (d: Debt) => {
    Alert.alert(t.delete, t.deleteDebtConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            await api.debts.delete(d.id);
            haptic.success();
            load();
          } catch (e) {
            Alert.alert(t.error, e instanceof Error ? e.message : String(e));
          }
        },
      },
    ]);
  };

  const callCustomer = (phone: string) => {
    if (!phone) return;
    haptic.light();
    Linking.openURL(`tel:+998${phone.replace(/\D/g, '').slice(-9)}`).catch(() => {});
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
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
            gap: 12,
          }}
        >
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontSize: 17, fontWeight: '700' }}>{t.debtsTitle}</Text>
            <Text style={{ color: theme.text3, fontSize: 11.5 }}>{t.debtsHint}</Text>
          </View>
        </View>

        {loading ? (
          <Loading />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(d) => String(d.id)}
            contentContainerStyle={{ padding: SP.lg - 2, paddingBottom: 100, gap: 8 }}
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
            ListHeaderComponent={
              <View style={{ gap: 10, marginBottom: 4 }}>
                <Card>
                  <Text style={{ color: theme.text2, fontSize: 12.5, marginBottom: 4 }}>{t.debtTotalOpen}</Text>
                  <Text style={{ color: theme.warning, fontSize: 23, fontWeight: '800' }}>
                    {fmtShort(totalOpen, lang)} {t.sum}
                  </Text>
                  <Text style={{ color: theme.text3, fontSize: 12, marginTop: 4 }}>💡 {t.debtRemindWorks}</Text>
                </Card>
                <Segmented
                  options={[
                    { key: 'open', label: `${t.debtOpen} (${list.filter((d) => d.status === 'open').length})` },
                    { key: 'paid', label: `${t.debtPaid} (${list.filter((d) => d.status === 'paid').length})` },
                  ]}
                  value={filter}
                  onChange={setFilter}
                />
              </View>
            }
            ListEmptyComponent={<EmptyState text={t.noDebts} icon="wallet-outline" />}
            renderItem={({ item: d }) => {
              const remaining = d.amount - d.paidAmount;
              const overdue = d.status === 'open' && d.dueDate && d.dueDate < today;
              const dueToday = d.status === 'open' && d.dueDate === today;
              return (
                <Card>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15 }} numberOfLines={1}>
                        {d.customerName}
                      </Text>
                      {!!d.note && (
                        <Text style={{ color: theme.text3, fontSize: 12.5, marginTop: 2 }} numberOfLines={1}>
                          {d.note}
                        </Text>
                      )}
                    </View>
                    {overdue ? (
                      <Badge text={t.debtOverdue} color={theme.danger} />
                    ) : dueToday ? (
                      <Badge text={t.debtDueToday} color={theme.warning} />
                    ) : d.dueDate && d.status === 'open' ? (
                      <Badge text={d.dueDate.split('-').reverse().join('.')} color={theme.opsAccent} />
                    ) : d.status === 'paid' ? (
                      <Badge text={t.debtPaid} color={theme.success} />
                    ) : null}
                  </View>

                  <View style={{ marginTop: 10 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                      <Text style={{ color: theme.text2, fontSize: 13 }}>
                        {fmt(d.paidAmount)} / {fmt(d.amount)} {t.sum}
                      </Text>
                      {d.status === 'open' && (
                        <Text style={{ color: theme.warning, fontSize: 13, fontWeight: '700' }}>
                          {t.debtRemaining}: {fmt(remaining)}
                        </Text>
                      )}
                    </View>
                    <ProgressBar
                      ratio={d.amount > 0 ? d.paidAmount / d.amount : 0}
                      color={d.status === 'paid' ? theme.success : theme.primary}
                    />
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' }}>
                    {d.status === 'open' && (
                      <Button
                        title={t.addPayment}
                        onPress={() => {
                          setPayingDebt(d);
                          setPayAmount('');
                        }}
                        small
                        variant="success"
                        icon="cash-outline"
                        style={{ flex: 1 }}
                      />
                    )}
                    {!!d.customerPhone && (
                      <Pressable
                        onPress={() => callCustomer(d.customerPhone)}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: R.sm,
                          backgroundColor: `${theme.success}22`,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons name="call-outline" size={17} color={theme.success} />
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() => deleteDebt(d)}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: R.sm,
                        backgroundColor: 'rgba(220,38,38,0.10)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="trash-outline" size={17} color={theme.danger} />
                    </Pressable>
                  </View>
                </Card>
              );
            }}
          />
        )}

        {/* FAB: записать долг */}
        <Pressable
          onPress={() => {
            haptic.medium();
            setFormOpen(true);
          }}
          style={({ pressed }) => ({
            position: 'absolute',
            right: 18,
            bottom: insets.bottom + 20,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: theme.primary,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
            elevation: 8,
            shadowColor: theme.primary,
            shadowOpacity: 0.45,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
          })}
        >
          <Ionicons name="add" size={30} color="#fff" />
        </Pressable>

        {/* Новый долг */}
        <Sheet visible={formOpen} onClose={() => setFormOpen(false)} title={t.addDebt}>
          <Input
            label={t.debtCustomer}
            value={form.customerName}
            onChangeText={(v) => setForm({ ...form, customerName: v })}
          />
          <Input
            label={t.phoneNumber}
            value={form.customerPhone}
            onChangeText={(v) => setForm({ ...form, customerPhone: v.replace(/\D/g, '').slice(0, 9) })}
            keyboardType="phone-pad"
            placeholder="901234567"
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Input
                label={`${t.debtAmount}, ${t.sum}`}
                value={form.amount}
                onChangeText={(v) => setForm({ ...form, amount: v.replace(/[^0-9.]/g, '') })}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label={t.debtDue}
                value={form.dueDate}
                onChangeText={(v) => setForm({ ...form, dueDate: v.replace(/[^0-9-]/g, '').slice(0, 10) })}
                placeholder="2026-08-01"
              />
            </View>
          </View>
          <Input label={t.debtNote} value={form.note} onChangeText={(v) => setForm({ ...form, note: v })} />
          <Button title={t.save} onPress={submitDebt} loading={saving} icon="checkmark" />
        </Sheet>

        {/* Приём оплаты */}
        <Sheet
          visible={payingDebt !== null}
          onClose={() => setPayingDebt(null)}
          title={`${t.addPayment} · ${payingDebt?.customerName || ''}`}
        >
          {payingDebt && (
            <>
              <Text style={{ color: theme.text2, fontSize: 13.5, marginBottom: 14 }}>
                {t.debtRemaining}:{' '}
                <Text style={{ color: theme.warning, fontWeight: '700' }}>
                  {fmt(payingDebt.amount - payingDebt.paidAmount)} {t.sum}
                </Text>
              </Text>
              <Input
                label={`${t.paymentAmount}, ${t.sum}`}
                value={payAmount}
                onChangeText={(v) => setPayAmount(v.replace(/[^0-9.]/g, ''))}
                keyboardType="numeric"
              />
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <Button
                  title={`${t.debtRemaining} (${fmt(payingDebt.amount - payingDebt.paidAmount)})`}
                  onPress={() => setPayAmount(String(payingDebt.amount - payingDebt.paidAmount))}
                  small
                  variant="ghost"
                  style={{ flex: 1 }}
                />
              </View>
              <Button title={t.addPayment} onPress={submitPayment} loading={saving} variant="success" icon="cash-outline" />
            </>
          )}
        </Sheet>
      </View>
    </Modal>
  );
}
