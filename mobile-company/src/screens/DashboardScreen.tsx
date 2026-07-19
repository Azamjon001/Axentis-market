import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import api from '../api';
import { useI18n } from '../i18n';
import { STATUS_COLOR, useTheme } from '../theme';
import { Badge, Button, Card, EmptyState, fmt, fmtDate, Loading, SectionTitle, StatCard } from '../ui';

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

// 📊 Дашборд — тот же endpoint /analytics/company/:id/dashboard,
// что у CompanyDashboardPanel веб-панели.
export default function DashboardScreen({ companyId }: { companyId: number }) {
  const { theme } = useTheme();
  const { t } = useI18n();

  const [data, setData] = useState<DashboardData | null>(null);
  const [profit, setProfit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(false);
      const [dash, profitData] = await Promise.all([
        api.analytics.dashboard(companyId),
        api.analytics.profit(companyId).catch(() => null),
      ]);
      setData(dash);
      setProfit(profitData);
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

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

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
    { label: t.newOrders, value: data.pendingOrders, color: STATUS_COLOR.pending },
    { label: t.returns, value: data.pendingReturns, color: theme.danger },
    { label: t.lowStock, value: data.lowStock, color: theme.warning },
    { label: t.questions, value: data.unansweredQuestions, color: theme.opsAccent },
  ].filter((i) => (i.value || 0) > 0);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
      }
    >
      {/* Метрики */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <StatCard label={t.todayOrders} value={fmt(data.todayOrders)} color={theme.opsAccent} />
        <StatCard label={t.todayRevenue} value={`${fmt(data.todayRevenue)}`} hint={t.sum} color={theme.success} />
        <StatCard label={t.totalRevenue} value={`${fmt(data.totalRevenue)}`} hint={t.sum} />
        <StatCard
          label={t.profit}
          value={profit?.total ? fmt(profit.total.profit) : '—'}
          hint={profit?.total ? `${t.margin}: ${Math.round(profit.total.margin || 0)}%` : undefined}
          color={theme.primary}
        />
        <StatCard label={t.soldUnits} value={fmt(data.soldUnits)} />
        <StatCard label={t.totalProducts} value={fmt(data.totalProducts)} />
      </View>

      {/* Требует внимания */}
      <View style={{ marginTop: 18 }}>
        <SectionTitle text={t.attention} accent={theme.warning} />
        {attentionItems.length === 0 ? (
          <Card>
            <Text style={{ color: theme.success, fontSize: 14.5, fontWeight: '600' }}>{t.allGood}</Text>
          </Card>
        ) : (
          <View style={{ gap: 8 }}>
            {attentionItems.map((item) => (
              <Card
                key={item.label}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Text style={{ color: theme.text, fontSize: 14.5 }}>{item.label}</Text>
                <View
                  style={{
                    backgroundColor: `${item.color}26`,
                    borderRadius: 999,
                    minWidth: 30,
                    paddingHorizontal: 9,
                    paddingVertical: 3,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: item.color, fontWeight: '700', fontSize: 14 }}>{item.value}</Text>
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>

      {/* Последние заказы */}
      <View style={{ marginTop: 18 }}>
        <SectionTitle text={t.recentOrders} />
        {!data.recentOrders || data.recentOrders.length === 0 ? (
          <EmptyState text={t.noOrders} />
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
                <View
                  style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, alignItems: 'flex-end' }}
                >
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
    </ScrollView>
  );
}
