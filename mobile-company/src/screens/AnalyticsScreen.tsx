import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import api from '../api';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';
import { Card, EmptyState, fmt, Loading, SectionTitle, Segmented, StatCard } from '../ui';

type Period = '7' | '30' | '90';

interface DayPoint {
  date: string;
  revenue: number;
}

// 📈 Аналитика — endpoint /analytics/company/:id (+profit), как AnalyticsPanel.
// Графики нарисованы нативными View-барами: без тяжёлых chart-библиотек.
export default function AnalyticsScreen({ companyId }: { companyId: number }) {
  const { theme } = useTheme();
  const { t } = useI18n();

  const [period, setPeriod] = useState<Period>('30');
  const [analytics, setAnalytics] = useState<any>(null);
  const [profit, setProfit] = useState<any>(null);
  const [salesList, setSalesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - parseInt(period, 10));
      const startDate = start.toISOString().slice(0, 10);
      const endDate = end.toISOString().slice(0, 10);

      const [analyticsData, profitData, salesData] = await Promise.all([
        api.analytics.company(companyId, { startDate, endDate }).catch(() => null),
        api.analytics.profit(companyId).catch(() => null),
        api.sales.list({ companyId: String(companyId), startDate, endDate, limit: 1000 }).catch(() => []),
      ]);
      setAnalytics(analyticsData);
      setProfit(profitData);
      setSalesList(Array.isArray(salesData) ? salesData : salesData?.sales || []);
    } catch (e) {
      console.error('Analytics load failed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId, period]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Выручка по дням из списка продаж
  const dayPoints: DayPoint[] = useMemo(() => {
    const days = parseInt(period, 10);
    const map = new Map<string, number>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      map.set(d.toISOString().slice(0, 10), 0);
    }
    for (const s of salesList) {
      const iso = (s.created_at || s.createdAt || '').slice(0, 10);
      if (map.has(iso)) {
        map.set(iso, (map.get(iso) || 0) + (s.total_amount ?? s.totalAmount ?? 0));
      }
    }
    return Array.from(map.entries()).map(([date, revenue]) => ({ date, revenue }));
  }, [salesList, period]);

  const maxRevenue = useMemo(() => Math.max(1, ...dayPoints.map((p) => p.revenue)), [dayPoints]);
  const periodRevenue = useMemo(() => dayPoints.reduce((a, p) => a + p.revenue, 0), [dayPoints]);
  const avgCheck = salesList.length > 0 ? Math.round(periodRevenue / salesList.length) : 0;

  // Топ товаров за период — агрегируем позиции продаж
  const topProducts = useMemo(() => {
    const agg = new Map<string, { units: number; revenue: number }>();
    for (const s of salesList) {
      let items: any[] = Array.isArray(s.items) ? s.items : [];
      if (typeof s.items === 'string') {
        try {
          const parsed = JSON.parse(s.items);
          items = Array.isArray(parsed) ? parsed : [];
        } catch {
          items = [];
        }
      }
      for (const i of items) {
        const name = i.productName || i.product_name || i.name || '—';
        const qty = i.quantity || 1;
        const price = i.price_with_markup || i.priceWithMarkup || i.price || 0;
        const cur = agg.get(name) || { units: 0, revenue: 0 };
        cur.units += qty;
        cur.revenue += i.total || qty * price;
        agg.set(name, cur);
      }
    }
    return Array.from(agg.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [salesList]);

  if (loading) return <Loading />;

  const totalBlock = profit?.total;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
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
      <Segmented
        options={[
          { key: '7', label: t.period7 },
          { key: '30', label: t.period30 },
          { key: '90', label: t.period90 },
        ]}
        value={period}
        onChange={setPeriod}
      />

      {/* Ключевые метрики за период */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
        <StatCard label={t.revenue} value={fmt(periodRevenue)} hint={t.sum} color={theme.success} />
        <StatCard label={t.ordersCount} value={fmt(analytics?.totalOrders ?? salesList.length)} />
        <StatCard label={t.avgCheck} value={fmt(avgCheck)} hint={t.sum} />
        <StatCard
          label={t.profit}
          value={totalBlock ? fmt(totalBlock.profit) : '—'}
          hint={totalBlock ? `${t.margin}: ${Math.round(totalBlock.margin || 0)}%` : undefined}
          color={theme.primary}
        />
      </View>

      {/* Онлайн / офлайн разбор прибыли */}
      {profit?.online && profit?.offline && (
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <StatCard
            label={t.online}
            value={fmt(profit.online.revenue)}
            hint={`${t.profit}: ${fmt(profit.online.profit)}`}
            color={theme.opsAccent}
          />
          <StatCard
            label={t.offline}
            value={fmt(profit.offline.revenue)}
            hint={`${t.profit}: ${fmt(profit.offline.profit)}`}
            color={theme.mktAccent}
          />
        </View>
      )}

      {/* График выручки по дням */}
      <View style={{ marginTop: 18 }}>
        <SectionTitle text={t.revenueByDay} />
        <Card>
          {periodRevenue === 0 ? (
            <EmptyState text={t.noData} />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 2 }}>
              {dayPoints.map((p) => (
                <View
                  key={p.date}
                  style={{
                    flex: 1,
                    height: Math.max(3, (p.revenue / maxRevenue) * 116),
                    backgroundColor: p.revenue > 0 ? theme.primary : theme.border,
                    borderRadius: 3,
                  }}
                />
              ))}
            </View>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={{ color: theme.text3, fontSize: 11 }}>
              {dayPoints[0]?.date.slice(5).split('-').reverse().join('.')}
            </Text>
            <Text style={{ color: theme.text3, fontSize: 11 }}>
              {dayPoints[dayPoints.length - 1]?.date.slice(5).split('-').reverse().join('.')}
            </Text>
          </View>
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
                  <Text style={{ color: theme.text, fontSize: 14 }} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={{ color: theme.text3, fontSize: 12 }}>×{fmt(p.units)}</Text>
                </View>
                <Text style={{ color: theme.success, fontWeight: '600', fontSize: 13.5 }}>
                  {fmt(p.revenue)}
                </Text>
              </View>
            ))}
          </Card>
        )}
      </View>
    </ScrollView>
  );
}
