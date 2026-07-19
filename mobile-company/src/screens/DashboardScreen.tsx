import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../api';
import { useI18n } from '../i18n';
import { SP, STATUS_COLOR, useTheme } from '../theme';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  fmt,
  fmtDate,
  fmtShort,
  haptic,
  KV,
  Loading,
  ProgressBar,
  SectionTitle,
  Sheet,
  StatCard,
} from '../ui';

// 📊 Дашборд — 1:1 с CompanyDashboardPanel веб-панели: метрики дня, разбор
// прибыли (онлайн/офлайн), «требует внимания», динамика продаж, статусы,
// лидеры, прогноз остатков, ABC-анализ, замороженные деньги, сегменты клиентов.
interface DashboardData {
  todayOrders: number;
  todayRevenue: number;
  pendingOrders: number;
  totalRevenue: number;
  pendingReturns: number;
  lowStock: number;
  unansweredQuestions: number;
  totalProducts: number;
  soldUnits: number;
  recentOrders: Array<{
    id: number;
    customerName: string;
    totalAmount: number;
    status: string;
    orderCode: string;
    createdAt: string;
  }>;
}

type SegmentKey = 'vip' | 'regular' | 'new' | 'sleeping' | 'lost';

export default function DashboardScreen({ companyId }: { companyId: number }) {
  const { theme } = useTheme();
  const { t, lang } = useI18n();

  const [data, setData] = useState<DashboardData | null>(null);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [insights, setInsights] = useState<any>(null);
  const [profit, setProfit] = useState<any>(null);
  const [segments, setSegments] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [profitOpen, setProfitOpen] = useState(false);
  const [openSegment, setOpenSegment] = useState<SegmentKey | null>(null);

  const load = useCallback(async () => {
    try {
      setError(false);
      // Тот же набор запросов, что в CompanyDashboardPanel.useEffect
      const [dash, ordersData, insightsData, profitData, segmentsData] = await Promise.all([
        api.analytics.dashboard(companyId),
        api.orders.list({ companyId: String(companyId) }).catch(() => []),
        api.analytics.inventoryInsights(companyId).catch(() => null),
        api.analytics.profit(companyId).catch(() => null),
        api.analytics.customerSegments(companyId).catch(() => null),
      ]);
      setData(dash);
      setAllOrders(Array.isArray(ordersData) ? ordersData : ordersData?.orders || []);
      setInsights(insightsData);
      setProfit(profitData);
      setSegments(segmentsData);
    } catch (e) {
      console.error('Dashboard load failed:', e);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const statusLabel = (s: string): string => {
    const map: Record<string, string> = {
      pending: t.statusPending,
      confirmed: t.statusConfirmed,
      processing: t.statusProcessing,
      shipped: t.statusShipped,
      delivered: t.statusDelivered,
      completed: t.statusCompleted,
      cancelled: t.statusCancelled,
    };
    return map[s] || s;
  };

  // Динамика продаж за 14 дней — из списка заказов (как в вебе)
  const chart = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      map.set(d.toISOString().slice(0, 10), 0);
    }
    for (const o of allOrders) {
      if (o.status === 'cancelled') continue;
      const iso = (o.createdAt || o.created_at || '').slice(0, 10);
      if (map.has(iso)) map.set(iso, (map.get(iso) || 0) + (o.totalAmount || o.total_amount || 0));
    }
    const points = Array.from(map.entries()).map(([date, v]) => ({ date, v }));
    return { points, max: Math.max(1, ...points.map((p) => p.v)) };
  }, [allOrders]);

  // Распределение статусов заказов
  const statusDist = useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of allOrders) counts.set(o.status, (counts.get(o.status) || 0) + 1);
    const total = allOrders.length || 1;
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([status, count]) => ({ status, count, ratio: count / total }));
  }, [allOrders]);

  if (loading) return <Loading />;

  if (error || !data) {
    return (
      <View style={{ padding: 20, alignItems: 'center' }}>
        <Text style={{ color: theme.text2, marginBottom: 14 }}>{t.failedToLoad}</Text>
        <Button title={t.retry} onPress={() => { setLoading(true); load(); }} />
      </View>
    );
  }

  const attentionItems = [
    { label: t.newOrders, value: data.pendingOrders, color: STATUS_COLOR.pending, icon: 'receipt-outline' as const },
    { label: t.returns, value: data.pendingReturns, color: theme.danger, icon: 'refresh-outline' as const },
    { label: t.lowStockAlert, value: data.lowStock, color: theme.warning, icon: 'alert-circle-outline' as const },
    { label: t.questions, value: data.unansweredQuestions, color: theme.opsAccent, icon: 'chatbubble-ellipses-outline' as const },
  ].filter((i) => (i.value || 0) > 0);

  const segmentDefs: { key: SegmentKey; label: string; color: string }[] = [
    { key: 'vip', label: t.segVip, color: '#FBBF24' },
    { key: 'regular', label: t.segRegular, color: theme.success },
    { key: 'new', label: t.segNew, color: theme.opsAccent },
    { key: 'sleeping', label: t.segSleeping, color: theme.mktAccent },
    { key: 'lost', label: t.segLost, color: theme.danger },
  ];

  const ABC_COLOR: Record<string, string> = { A: theme.success, B: theme.warning, C: theme.danger };

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
      {/* Метрики */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <StatCard label={t.todayOrders} value={fmt(data.todayOrders)} icon="receipt-outline" color={theme.opsAccent} />
        <StatCard
          label={t.todayRevenue}
          value={fmtShort(data.todayRevenue, lang)}
          hint={t.sum}
          icon="cash-outline"
          color={theme.success}
        />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
        {/* Нажатие открывает разбор «откуда деньги / сколько заработали» — как в вебе */}
        <Pressable style={{ flex: 1, minWidth: '46%' }} onPress={() => { haptic.light(); setProfitOpen(true); }}>
          <StatCard
            label={t.totalRevenue}
            value={fmtShort(profit?.total?.revenue ?? data.totalRevenue, lang)}
            hint={`${t.sum} · ⓘ`}
            icon="wallet-outline"
            style={{ minWidth: '100%' }}
          />
        </Pressable>
        <Pressable style={{ flex: 1, minWidth: '46%' }} onPress={() => { haptic.light(); setProfitOpen(true); }}>
          <StatCard
            label={t.netProfit}
            value={profit?.total ? fmtShort(profit.total.profit, lang) : '—'}
            hint={profit?.total ? `${t.margin}: ${Math.round(profit.total.margin || 0)}% · ⓘ` : undefined}
            icon="trending-up-outline"
            color={theme.primary}
            style={{ minWidth: '100%' }}
          />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
        <StatCard label={t.soldUnits} value={fmt(data.soldUnits)} icon="cube-outline" />
        <StatCard label={t.totalProducts} value={fmt(data.totalProducts)} icon="albums-outline" />
      </View>

      {/* Требует внимания */}
      <View style={{ marginTop: 20 }}>
        <SectionTitle text={t.attention} accent={theme.warning} />
        {attentionItems.length === 0 ? (
          <Card>
            <Text style={{ color: theme.success, fontSize: 14.5, fontWeight: '600' }}>{t.allGood}</Text>
          </Card>
        ) : (
          <View style={{ gap: 8 }}>
            {attentionItems.map((item) => (
              <Card key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 11,
                    backgroundColor: `${item.color}22`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name={item.icon} size={17} color={item.color} />
                </View>
                <Text style={{ color: theme.text, fontSize: 14.5, flex: 1 }}>{item.label}</Text>
                <Text style={{ color: item.color, fontWeight: '700', fontSize: 16 }}>{item.value}</Text>
              </Card>
            ))}
          </View>
        )}
      </View>

      {/* Динамика продаж */}
      <View style={{ marginTop: 20 }}>
        <SectionTitle text={t.salesChart} />
        <Card>
          {chart.points.every((p) => p.v === 0) ? (
            <EmptyState text={t.noData} icon="bar-chart-outline" />
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 110, gap: 3 }}>
                {chart.points.map((p) => (
                  <View
                    key={p.date}
                    style={{
                      flex: 1,
                      height: Math.max(3, (p.v / chart.max) * 106),
                      backgroundColor: p.v > 0 ? theme.primary : theme.border,
                      borderRadius: 3,
                    }}
                  />
                ))}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                <Text style={{ color: theme.text3, fontSize: 11 }}>
                  {chart.points[0].date.slice(5).split('-').reverse().join('.')}
                </Text>
                <Text style={{ color: theme.text3, fontSize: 11 }}>
                  {chart.points[chart.points.length - 1].date.slice(5).split('-').reverse().join('.')}
                </Text>
              </View>
            </>
          )}
        </Card>
      </View>

      {/* Статусы заказов */}
      {statusDist.length > 0 && (
        <View style={{ marginTop: 20 }}>
          <SectionTitle text={t.statusDist} />
          <Card style={{ gap: 10 }}>
            {statusDist.map(({ status, count, ratio }) => (
              <View key={status}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ color: theme.text2, fontSize: 13 }}>{statusLabel(status)}</Text>
                  <Text style={{ color: theme.text, fontSize: 13, fontWeight: '700' }}>{count}</Text>
                </View>
                <ProgressBar ratio={ratio} color={STATUS_COLOR[status] || theme.text3} />
              </View>
            ))}
          </Card>
        </View>
      )}

      {/* Лидеры продаж */}
      {insights?.topSellers?.length > 0 && (
        <View style={{ marginTop: 20 }}>
          <SectionTitle text={t.leaders} hint={t.leadersHint} accent={theme.success} />
          <Card>
            {insights.topSellers.slice(0, 5).map((p: any, idx: number) => (
              <View
                key={p.productId}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 7,
                  borderTopWidth: idx === 0 ? 0 : 1,
                  borderTopColor: theme.border,
                }}
              >
                <Text style={{ color: theme.text3, fontSize: 13, width: 24 }}>{idx + 1}.</Text>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{ color: theme.text, fontSize: 14 }} numberOfLines={1}>{p.name}</Text>
                  <Text style={{ color: theme.text3, fontSize: 12 }}>×{fmt(p.units)} {t.pcs}</Text>
                </View>
                <Text style={{ color: theme.success, fontWeight: '600', fontSize: 13.5 }}>
                  {fmtShort(p.revenue, lang)}
                </Text>
              </View>
            ))}
          </Card>
        </View>
      )}

      {/* Прогноз остатков */}
      {insights?.stockForecast?.length > 0 && (
        <View style={{ marginTop: 20 }}>
          <SectionTitle text={t.stockForecast} hint={t.stockForecastHint} accent={theme.warning} />
          <Card>
            {insights.stockForecast.slice(0, 6).map((r: any, idx: number) => (
              <View
                key={r.productId}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 7,
                  borderTopWidth: idx === 0 ? 0 : 1,
                  borderTopColor: theme.border,
                }}
              >
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{ color: theme.text, fontSize: 14 }} numberOfLines={1}>{r.name}</Text>
                  <Text style={{ color: theme.text3, fontSize: 12 }}>
                    {t.stockLeft}: {fmt(r.stock)} · {r.soldPerDay?.toFixed?.(1) ?? r.soldPerDay} {t.perDay}
                  </Text>
                </View>
                {r.outOfStock ? (
                  <Badge text={t.outOfStock} color={theme.danger} />
                ) : (
                  <Badge
                    text={`${Math.round(r.daysLeft)} ${t.daysLeft}`}
                    color={r.daysLeft <= 7 ? theme.danger : r.daysLeft <= 14 ? theme.warning : theme.success}
                  />
                )}
              </View>
            ))}
          </Card>
        </View>
      )}

      {/* ABC-анализ */}
      {insights?.abcAnalysis?.length > 0 && (
        <View style={{ marginTop: 20 }}>
          <SectionTitle text={t.abcTitle} hint={t.abcHint} accent={theme.mktAccent} />
          <Card>
            {insights.abcAnalysis.slice(0, 8).map((r: any, idx: number) => (
              <View
                key={r.productId}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 7,
                  borderTopWidth: idx === 0 ? 0 : 1,
                  borderTopColor: theme.border,
                }}
              >
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    backgroundColor: `${ABC_COLOR[r.class] || theme.text3}22`,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 10,
                  }}
                >
                  <Text style={{ color: ABC_COLOR[r.class] || theme.text3, fontWeight: '800', fontSize: 13 }}>
                    {r.class}
                  </Text>
                </View>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{ color: theme.text, fontSize: 14 }} numberOfLines={1}>{r.name}</Text>
                  <Text style={{ color: theme.text3, fontSize: 12 }}>
                    {Math.round((r.revenueShare || 0) * 100)}% · {fmtShort(r.revenue, lang)}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        </View>
      )}

      {/* Замороженные деньги */}
      {insights?.deadStock?.length > 0 && (
        <View style={{ marginTop: 20 }}>
          <SectionTitle text={t.deadStock} hint={t.deadStockHint} accent={theme.danger} />
          <Card>
            {insights.deadStockTotal > 0 && (
              <Text style={{ color: theme.danger, fontSize: 15, fontWeight: '700', marginBottom: 8 }}>
                {fmt(insights.deadStockTotal)} {t.sum} {t.frozenValue}
              </Text>
            )}
            {insights.deadStock.slice(0, 5).map((r: any, idx: number) => (
              <View
                key={r.productId}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: 6,
                  borderTopWidth: idx === 0 ? 0 : 1,
                  borderTopColor: theme.border,
                }}
              >
                <Text style={{ color: theme.text2, fontSize: 13.5, flex: 1, marginRight: 8 }} numberOfLines={1}>
                  {r.name} · {fmt(r.stock)} {t.pcs}
                </Text>
                <Text style={{ color: theme.danger, fontSize: 13.5, fontWeight: '600' }}>
                  {fmtShort(r.frozenValue, lang)}
                </Text>
              </View>
            ))}
          </Card>
        </View>
      )}

      {/* Сегменты клиентов */}
      {segments && (
        <View style={{ marginTop: 20 }}>
          <SectionTitle text={t.clients} accent={theme.opsAccent} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {segmentDefs.map((s) => {
              const list = segments[s.key] || [];
              const open = openSegment === s.key;
              return (
                <Pressable
                  key={s.key}
                  onPress={() => { haptic.light(); setOpenSegment(open ? null : s.key); }}
                  style={{
                    flexBasis: '31%',
                    flexGrow: 1,
                    backgroundColor: open ? `${s.color}22` : theme.card,
                    borderWidth: 1,
                    borderColor: open ? s.color : theme.border,
                    borderRadius: 14,
                    padding: 10,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: s.color, fontSize: 18, fontWeight: '800' }}>{list.length}</Text>
                  <Text style={{ color: theme.text2, fontSize: 11.5, marginTop: 2 }}>{s.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {openSegment && (segments[openSegment] || []).length > 0 && (
            <Card style={{ marginTop: 8 }}>
              {(segments[openSegment] || []).slice(0, 10).map((c: any, idx: number) => (
                <View
                  key={c.phone}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingVertical: 6,
                    borderTopWidth: idx === 0 ? 0 : 1,
                    borderTopColor: theme.border,
                  }}
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ color: theme.text, fontSize: 13.5 }} numberOfLines={1}>
                      {c.name || c.phone}
                    </Text>
                    <Text style={{ color: theme.text3, fontSize: 12 }}>
                      {c.orders} {t.ordersShort} · {c.phone}
                    </Text>
                  </View>
                  <Text style={{ color: theme.success, fontSize: 13, fontWeight: '600' }}>
                    {fmtShort(c.total, lang)}
                  </Text>
                </View>
              ))}
            </Card>
          )}
        </View>
      )}

      {/* Последние заказы */}
      <View style={{ marginTop: 20 }}>
        <SectionTitle text={t.recentOrders} />
        {!data.recentOrders || data.recentOrders.length === 0 ? (
          <EmptyState text={t.noOrders} icon="receipt-outline" />
        ) : (
          <View style={{ gap: 8 }}>
            {data.recentOrders.slice(0, 8).map((order) => (
              <Card key={order.id}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14.5 }}>
                    #{order.orderCode || order.id}
                  </Text>
                  <Badge text={statusLabel(order.status)} color={STATUS_COLOR[order.status] || theme.text3} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, alignItems: 'flex-end' }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ color: theme.text2, fontSize: 13 }} numberOfLines={1}>
                      {order.customerName || t.buyer}
                    </Text>
                    <Text style={{ color: theme.text3, fontSize: 12, marginTop: 2 }}>
                      {fmtDate(order.createdAt)}
                    </Text>
                  </View>
                  <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15 }}>
                    {fmt(order.totalAmount)} {t.sum}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>

      {/* Разбор прибыли: онлайн ↔ офлайн (как мини-панель в вебе) */}
      <Sheet visible={profitOpen} onClose={() => setProfitOpen(false)} title={`${t.revenue} · ${t.profit}`}>
        {profit ? (
          <View style={{ gap: 14 }}>
            {(['online', 'offline', 'total'] as const).map((k) => {
              const block = profit[k];
              if (!block) return null;
              const label = k === 'online' ? t.online : k === 'offline' ? t.offline : t.total;
              const color = k === 'online' ? theme.opsAccent : k === 'offline' ? theme.mktAccent : theme.primary;
              return (
                <Card key={k}>
                  <Text style={{ color, fontWeight: '700', fontSize: 14, marginBottom: 6 }}>{label}</Text>
                  <KV k={t.revenue} v={`${fmt(block.revenue)} ${t.sum}`} />
                  <KV k={t.profit} v={`${fmt(block.profit)} ${t.sum}`} vColor={theme.success} />
                  <KV k={t.margin} v={`${Math.round(block.margin || 0)}%`} />
                </Card>
              );
            })}
            {profit.today && (
              <Card>
                <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14, marginBottom: 6 }}>
                  {t.todayRevenue}
                </Text>
                <KV k={t.revenue} v={`${fmt(profit.today.revenue)} ${t.sum}`} />
                <KV k={t.profit} v={`${fmt(profit.today.profit)} ${t.sum}`} vColor={theme.success} />
              </Card>
            )}
          </View>
        ) : (
          <EmptyState text={t.noData} />
        )}
      </Sheet>
    </ScrollView>
  );
}
