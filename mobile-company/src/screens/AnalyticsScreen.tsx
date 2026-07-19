import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../api';
import { useI18n } from '../i18n';
import { SP, useTheme } from '../theme';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  fmt,
  fmtDate,
  fmtShort,
  haptic,
  Input,
  KV,
  Loading,
  ProgressBar,
  SectionTitle,
  Segmented,
  Sheet,
  StatCard,
} from '../ui';

// 📈 Аналитика — 1:1 с AnalyticsPanel веб-панели: вкладки Финансы/Закупки/
// Расходы, периоды день/неделя/месяц/год, сравнение с прошлым периодом,
// онлайн (заказы) vs офлайн (касса), чистая прибыль = наценка − расходы,
// выручка по дням, топ товаров, разбор по категориям.
type Tab = 'analytics' | 'purchases' | 'expenses';
type Period = 'day' | 'week' | 'month' | 'year';

export default function AnalyticsScreen({ companyId }: { companyId: number }) {
  const { theme } = useTheme();
  const { t, lang } = useI18n();

  const [tab, setTab] = useState<Tab>('analytics');
  const [period, setPeriod] = useState<Period>('month');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [salesHistory, setSalesHistory] = useState<any[]>([]);
  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [expensesList, setExpensesList] = useState<any[]>([]);
  const [purchasesList, setPurchasesList] = useState<any[]>([]);

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ amount: '', category: 'other', description: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      // Тот же набор данных, что loadData в AnalyticsPanel
      const [productsData, salesData, ordersData, expensesData, purchasesData] = await Promise.all([
        api.products.list({ companyId: String(companyId), limit: 2000 }).catch(() => []),
        api.sales.list({ companyId: String(companyId), limit: 1000 }).catch(() => []),
        api.orders.list({ companyId: String(companyId) }).catch(() => []),
        api.expenses.list({ companyId: String(companyId), limit: 500 }).catch(() => []),
        api.productPurchases.list({ companyId, limit: 500 }).catch(() => []),
      ]);
      setProducts(Array.isArray(productsData) ? productsData : productsData?.products || []);
      setSalesHistory(Array.isArray(salesData) ? salesData : salesData?.sales || []);
      setOrdersList(Array.isArray(ordersData) ? ordersData : ordersData?.orders || []);
      setExpensesList(Array.isArray(expensesData) ? expensesData : expensesData?.expenses || []);
      setPurchasesList(Array.isArray(purchasesData) ? purchasesData : purchasesData?.purchases || []);
    } catch (e) {
      console.error('Analytics load failed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Периоды: текущий и предыдущий (getPeriodRange из веба) ────────────────
  const ranges = useMemo(() => {
    const now = new Date();
    const start = new Date();
    const prevStart = new Date();
    const prevEnd = new Date();
    if (period === 'day') {
      start.setHours(0, 0, 0, 0);
      prevStart.setDate(now.getDate() - 1); prevStart.setHours(0, 0, 0, 0);
      prevEnd.setDate(now.getDate() - 1); prevEnd.setHours(23, 59, 59, 999);
    } else if (period === 'week') {
      start.setDate(now.getDate() - 7); start.setHours(0, 0, 0, 0);
      prevStart.setDate(now.getDate() - 14); prevStart.setHours(0, 0, 0, 0);
      prevEnd.setDate(now.getDate() - 7);
    } else if (period === 'month') {
      start.setMonth(now.getMonth() - 1); start.setHours(0, 0, 0, 0);
      prevStart.setMonth(now.getMonth() - 2); prevStart.setHours(0, 0, 0, 0);
      prevEnd.setMonth(now.getMonth() - 1);
    } else {
      start.setFullYear(now.getFullYear() - 1); start.setHours(0, 0, 0, 0);
      prevStart.setFullYear(now.getFullYear() - 2); prevStart.setHours(0, 0, 0, 0);
      prevEnd.setFullYear(now.getFullYear() - 1);
    }
    return { start, prevStart, prevEnd };
  }, [period]);

  const inRange = (iso: string | undefined, start: Date, end?: Date) => {
    if (!iso) return false;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return false;
    return d >= start && (!end || d <= end);
  };

  const dateOf = (x: any) => x.created_at || x.createdAt || x.order_date || x.purchase_date || x.purchaseDate || x.date;

  // ── Метрики периода: онлайн (заказы, без отменённых) + офлайн (касса) ──────
  const metrics = useMemo(() => {
    const calc = (start: Date, end?: Date) => {
      const orders = ordersList.filter((o) => o.status !== 'cancelled' && inRange(dateOf(o), start, end));
      const sales = salesHistory.filter((s) => inRange(dateOf(s), start, end));
      const onlineRevenue = orders.reduce((sum, o) => sum + (parseFloat(o.totalAmount ?? o.total_amount) || 0), 0);
      const offlineRevenue = sales.reduce((sum, s) => sum + (parseFloat(s.totalAmount ?? s.total_amount) || 0), 0);
      const onlineMarkup = orders.reduce((sum, o) => sum + (parseFloat(o.markupProfit ?? o.markup_profit) || 0), 0);
      const offlineMarkup = sales.reduce((sum, s) => sum + (parseFloat(s.markupProfit ?? s.markup_profit) || 0), 0);
      const count = orders.length + sales.length;
      return { onlineRevenue, offlineRevenue, onlineMarkup, offlineMarkup, count };
    };
    const cur = calc(ranges.start);
    const prev = calc(ranges.prevStart, ranges.prevEnd);
    const delta = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : null);
    const revenue = cur.onlineRevenue + cur.offlineRevenue;
    const prevRevenue = prev.onlineRevenue + prev.offlineRevenue;
    const markup = cur.onlineMarkup + cur.offlineMarkup;
    const prevMarkup = prev.onlineMarkup + prev.offlineMarkup;
    const periodExpenses = expensesList
      .filter((e) => inRange(dateOf(e), ranges.start))
      .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    return {
      ...cur,
      revenue,
      markup,
      expenses: periodExpenses,
      netProfit: markup - periodExpenses,
      avgCheck: cur.count > 0 ? Math.round(revenue / cur.count) : 0,
      revenueDelta: delta(revenue, prevRevenue),
      markupDelta: delta(markup, prevMarkup),
      countDelta: delta(cur.count, prev.count),
    };
  }, [ordersList, salesHistory, expensesList, ranges]);

  // Себестоимость склада — как purchaseCost в вебе
  const inventoryCost = useMemo(
    () =>
      products
        .filter((p) => !p.name?.startsWith('__CATEGORY_MARKER__'))
        .reduce((sum, p) => sum + (p.inventoryCost || (p.quantity || 0) * (p.price || 0)), 0),
    [products]
  );

  // Выручка по дням (заказы + касса)
  const chart = useMemo(() => {
    const days = period === 'day' ? 1 : period === 'week' ? 7 : period === 'month' ? 30 : 90;
    const map = new Map<string, number>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      map.set(d.toISOString().slice(0, 10), 0);
    }
    const add = (iso: string | undefined, amount: number) => {
      const key = (iso || '').slice(0, 10);
      if (map.has(key)) map.set(key, (map.get(key) || 0) + amount);
    };
    for (const o of ordersList) {
      if (o.status !== 'cancelled') add(dateOf(o), parseFloat(o.totalAmount ?? o.total_amount) || 0);
    }
    for (const s of salesHistory) add(dateOf(s), parseFloat(s.totalAmount ?? s.total_amount) || 0);
    const points = Array.from(map.entries()).map(([date, v]) => ({ date, v }));
    return { points, max: Math.max(1, ...points.map((p) => p.v)) };
  }, [ordersList, salesHistory, period]);

  // Топ товаров и категории — агрегация позиций заказов + продаж за период
  const { topProducts, categoryBreakdown } = useMemo(() => {
    const agg = new Map<string, { units: number; revenue: number }>();
    const catAgg = new Map<string, number>();
    const catOf = new Map<string, string>();
    for (const p of products) catOf.set(p.name, p.category || '—');

    const collect = (records: any[], skipCancelled: boolean) => {
      for (const r of records) {
        if (skipCancelled && r.status === 'cancelled') continue;
        if (!inRange(dateOf(r), ranges.start)) continue;
        let items: any[] = Array.isArray(r.items) ? r.items : [];
        if (typeof r.items === 'string') {
          try {
            const parsed = JSON.parse(r.items);
            items = Array.isArray(parsed) ? parsed : [];
          } catch {
            items = [];
          }
        }
        for (const i of items) {
          const name = i.productName || i.product_name || i.name || '—';
          const qty = i.quantity || 1;
          const price = i.price_with_markup || i.priceWithMarkup || i.price || 0;
          const revenue = i.total || qty * price;
          const cur = agg.get(name) || { units: 0, revenue: 0 };
          cur.units += qty;
          cur.revenue += revenue;
          agg.set(name, cur);
          const cat = catOf.get(name) || '—';
          catAgg.set(cat, (catAgg.get(cat) || 0) + revenue);
        }
      }
    };
    collect(ordersList, true);
    collect(salesHistory, false);

    const top = Array.from(agg.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
    const totalCat = Array.from(catAgg.values()).reduce((a, b) => a + b, 0) || 1;
    const cats = Array.from(catAgg.entries())
      .map(([name, revenue]) => ({ name, revenue, ratio: revenue / totalCat }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
    return { topProducts: top, categoryBreakdown: cats };
  }, [ordersList, salesHistory, products, ranges]);

  // ── Расходы ────────────────────────────────────────────────────────────────
  const expenseCategories = [
    { key: 'rent', label: t.expenseCatRent },
    { key: 'salary', label: t.expenseCatSalary },
    { key: 'transport', label: t.expenseCatTransport },
    { key: 'other', label: t.expenseCatOther },
  ];

  const submitExpense = async () => {
    const amount = parseFloat(expenseForm.amount);
    if (!amount || amount <= 0) {
      Alert.alert(t.error, t.expenseAmount);
      return;
    }
    setSaving(true);
    try {
      await api.expenses.create({
        amount,
        category: expenseForm.category,
        description: expenseForm.description.trim(),
      });
      haptic.success();
      setExpenseOpen(false);
      setExpenseForm({ amount: '', category: 'other', description: '' });
      load();
      Alert.alert('✅', t.expenseAdded);
    } catch (e) {
      haptic.error();
      Alert.alert(t.error, e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const deleteExpense = (id: number) => {
    Alert.alert(t.delete, t.deleteExpenseConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            await api.expenses.delete(id);
            haptic.success();
            load();
          } catch (e) {
            Alert.alert(t.error, e instanceof Error ? e.message : String(e));
          }
        },
      },
    ]);
  };

  const purchasesTotal = useMemo(
    () => purchasesList.reduce((s, p) => s + (parseFloat(p.totalCost ?? p.total_cost) || 0), 0),
    [purchasesList]
  );

  if (loading) return <Loading />;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: SP.lg - 2, paddingTop: SP.md }}>
        <Segmented
          options={[
            { key: 'analytics', label: t.tabAnalytics, icon: 'stats-chart-outline' },
            { key: 'purchases', label: t.tabPurchases, icon: 'download-outline' },
            { key: 'expenses', label: t.tabExpenses, icon: 'card-outline' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

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
        {tab === 'analytics' && (
          <>
            {/* Период */}
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {(['day', 'week', 'month', 'year'] as Period[]).map((p) => (
                <Chip
                  key={p}
                  label={p === 'day' ? t.periodDay : p === 'week' ? t.periodWeek : p === 'month' ? t.periodMonth : t.periodYear}
                  active={period === p}
                  onPress={() => setPeriod(p)}
                />
              ))}
            </View>

            {/* Метрики с дельтами к прошлому периоду */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
              <StatCard
                label={t.revenue}
                value={fmtShort(metrics.revenue, lang)}
                hint={t.vsPrevPeriod}
                delta={metrics.revenueDelta}
                icon="cash-outline"
                color={theme.success}
              />
              <StatCard
                label={t.netProfit}
                value={fmtShort(metrics.netProfit, lang)}
                hint={t.netProfitFormula}
                icon="trending-up-outline"
                color={metrics.netProfit >= 0 ? theme.primary : theme.danger}
              />
              <StatCard
                label={t.ordersCount}
                value={fmt(metrics.count)}
                hint={t.vsPrevPeriod}
                delta={metrics.countDelta}
                icon="receipt-outline"
              />
              <StatCard label={t.avgCheck} value={fmtShort(metrics.avgCheck, lang)} hint={t.sum} icon="calculator-outline" />
            </View>

            {/* Онлайн / офлайн */}
            <View style={{ marginTop: 18 }}>
              <SectionTitle text={`${t.online} · ${t.offline}`} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Card style={{ flex: 1 }}>
                  <Text style={{ color: theme.opsAccent, fontWeight: '700', fontSize: 13, marginBottom: 6 }}>
                    {t.online}
                  </Text>
                  <KV k={t.revenue} v={fmtShort(metrics.onlineRevenue, lang)} />
                  <KV k={t.markupProfit} v={fmtShort(metrics.onlineMarkup, lang)} vColor={theme.success} />
                </Card>
                <Card style={{ flex: 1 }}>
                  <Text style={{ color: theme.mktAccent, fontWeight: '700', fontSize: 13, marginBottom: 6 }}>
                    {t.offline}
                  </Text>
                  <KV k={t.revenue} v={fmtShort(metrics.offlineRevenue, lang)} />
                  <KV k={t.markupProfit} v={fmtShort(metrics.offlineMarkup, lang)} vColor={theme.success} />
                </Card>
              </View>
              <Card style={{ marginTop: 10 }}>
                <KV k={t.expensesTotal} v={`− ${fmtShort(metrics.expenses, lang)}`} vColor={theme.danger} />
                <KV k={t.inventoryCost} v={fmtShort(inventoryCost, lang)} />
              </Card>
            </View>

            {/* График выручки */}
            <View style={{ marginTop: 18 }}>
              <SectionTitle text={t.revenueByDay} />
              <Card>
                {chart.points.every((p) => p.v === 0) ? (
                  <EmptyState text={t.noData} icon="bar-chart-outline" />
                ) : (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 2 }}>
                      {chart.points.map((p) => (
                        <View
                          key={p.date}
                          style={{
                            flex: 1,
                            height: Math.max(3, (p.v / chart.max) * 116),
                            backgroundColor: p.v > 0 ? theme.primary : theme.border,
                            borderRadius: 3,
                          }}
                        />
                      ))}
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                      <Text style={{ color: theme.text3, fontSize: 11 }}>
                        {chart.points[0]?.date.slice(5).split('-').reverse().join('.')}
                      </Text>
                      <Text style={{ color: theme.text3, fontSize: 11 }}>
                        {chart.points[chart.points.length - 1]?.date.slice(5).split('-').reverse().join('.')}
                      </Text>
                    </View>
                  </>
                )}
              </Card>
            </View>

            {/* Топ товаров */}
            <View style={{ marginTop: 18 }}>
              <SectionTitle text={t.topProducts} accent={theme.mktAccent} />
              {topProducts.length === 0 ? (
                <EmptyState text={t.noData} />
              ) : (
                <Card>
                  {topProducts.map((p, idx) => (
                    <View
                      key={p.name}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 8,
                        borderTopWidth: idx === 0 ? 0 : 1,
                        borderTopColor: theme.border,
                      }}
                    >
                      <Text style={{ color: theme.text3, fontSize: 13, width: 26 }}>{idx + 1}.</Text>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ color: theme.text, fontSize: 14 }} numberOfLines={1}>{p.name}</Text>
                        <Text style={{ color: theme.text3, fontSize: 12 }}>×{fmt(p.units)}</Text>
                      </View>
                      <Text style={{ color: theme.success, fontWeight: '600', fontSize: 13.5 }}>
                        {fmtShort(p.revenue, lang)}
                      </Text>
                    </View>
                  ))}
                </Card>
              )}
            </View>

            {/* По категориям */}
            {categoryBreakdown.length > 0 && (
              <View style={{ marginTop: 18 }}>
                <SectionTitle text={t.byCategories} />
                <Card style={{ gap: 10 }}>
                  {categoryBreakdown.map((c) => (
                    <View key={c.name}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ color: theme.text2, fontSize: 13 }} numberOfLines={1}>{c.name}</Text>
                        <Text style={{ color: theme.text, fontSize: 13, fontWeight: '700' }}>
                          {fmtShort(c.revenue, lang)}
                        </Text>
                      </View>
                      <ProgressBar ratio={c.ratio} color={theme.opsAccent} />
                    </View>
                  ))}
                </Card>
              </View>
            )}
          </>
        )}

        {tab === 'purchases' && (
          <>
            <Card style={{ marginBottom: 10 }}>
              <Text style={{ color: theme.text2, fontSize: 12.5, marginBottom: 6 }}>{t.purchasesTotal}</Text>
              <Text style={{ color: theme.warning, fontSize: 21, fontWeight: '700' }}>
                {fmtShort(purchasesTotal, lang)} {t.sum}
              </Text>
              <Text style={{ color: theme.text3, fontSize: 12, marginTop: 4 }}>
                {t.total}: {purchasesList.length}
              </Text>
            </Card>
            {purchasesList.length === 0 ? (
              <EmptyState text={t.noPurchases} icon="download-outline" />
            ) : (
              <View style={{ gap: 8 }}>
                {purchasesList.map((p) => (
                  <Card key={p.id}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14, flex: 1, marginRight: 8 }} numberOfLines={1}>
                        {p.productName || p.product_name}
                      </Text>
                      <Text style={{ color: theme.warning, fontWeight: '700', fontSize: 14 }}>
                        {fmt(p.totalCost ?? p.total_cost)} {t.sum}
                      </Text>
                    </View>
                    <Text style={{ color: theme.text3, fontSize: 12.5, marginTop: 4 }}>
                      {fmt(p.quantity)} {t.pcs} × {fmt(p.purchasePrice ?? p.purchase_price)} · {fmtDate(dateOf(p))}
                    </Text>
                  </Card>
                ))}
              </View>
            )}
          </>
        )}

        {tab === 'expenses' && (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <View>
                <Text style={{ color: theme.text2, fontSize: 12.5 }}>{t.expensesTotal}</Text>
                <Text style={{ color: theme.danger, fontSize: 21, fontWeight: '700' }}>
                  {fmtShort(
                    expensesList.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0),
                    lang
                  )}{' '}
                  {t.sum}
                </Text>
              </View>
              <Button title={t.addExpense} onPress={() => setExpenseOpen(true)} small icon="add" />
            </View>
            {expensesList.length === 0 ? (
              <EmptyState text={t.noExpenses} icon="card-outline" />
            ) : (
              <View style={{ gap: 8 }}>
                {expensesList.map((e) => (
                  <Card key={e.id}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }} numberOfLines={1}>
                          {expenseCategories.find((c) => c.key === e.category)?.label || e.category}
                          {e.description ? ` · ${e.description}` : ''}
                        </Text>
                        <Text style={{ color: theme.text3, fontSize: 12, marginTop: 3 }}>{fmtDate(dateOf(e))}</Text>
                      </View>
                      <Text style={{ color: theme.danger, fontWeight: '700', fontSize: 14, marginRight: 12 }}>
                        −{fmt(e.amount)}
                      </Text>
                      <Pressable onPress={() => deleteExpense(e.id)} hitSlop={6}>
                        <Ionicons name="trash-outline" size={18} color={theme.text3} />
                      </Pressable>
                    </View>
                  </Card>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Добавление расхода */}
      <Sheet visible={expenseOpen} onClose={() => setExpenseOpen(false)} title={t.addExpense}>
        <Input
          label={`${t.expenseAmount}, ${t.sum}`}
          value={expenseForm.amount}
          onChangeText={(v) => setExpenseForm({ ...expenseForm, amount: v.replace(/[^0-9.]/g, '') })}
          keyboardType="numeric"
          placeholder="100000"
        />
        <Text style={{ color: theme.text2, fontSize: 13, fontWeight: '500', marginBottom: 8 }}>
          {t.expenseCategory}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {expenseCategories.map((c) => (
            <Chip
              key={c.key}
              label={c.label}
              active={expenseForm.category === c.key}
              onPress={() => setExpenseForm({ ...expenseForm, category: c.key })}
            />
          ))}
        </View>
        <Input
          label={t.expenseDescription}
          value={expenseForm.description}
          onChangeText={(v) => setExpenseForm({ ...expenseForm, description: v })}
        />
        <Button title={t.save} onPress={submitExpense} loading={saving} icon="checkmark" />
      </Sheet>
    </View>
  );
}
