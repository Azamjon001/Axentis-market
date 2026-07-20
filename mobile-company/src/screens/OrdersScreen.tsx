import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../api';
import { useI18n } from '../i18n';
import { SP, STATUS_COLOR, useTheme } from '../theme';
import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  fmt,
  fmtDate,
  fmtShort,
  haptic,
  Loading,
  Sheet,
  StatCard,
  Stepper,
} from '../ui';

// 🧾 Заказы — 1:1 с CompanyOrdersPanel веб-панели:
// поток статусов pending → confirmed («Принять») → shipped (confirm) →
// completed (mark-delivered с частичными возвратами) / cancelled,
// фильтры по статусу и периоду, звонок покупателю, автообновление.
interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
  color?: string;
  size?: string;
}

interface Order {
  id: number;
  order_code: string;
  user_name: string;
  user_phone: string;
  order_date?: string;
  total_amount: number;
  markup_profit: number;
  status: string;
  delivery_type?: string;
  delivery_address?: string;
  comment?: string;
  items: OrderItem[];
}

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'shipped' | 'completed' | 'cancelled';
type Period = 'day' | 'week' | 'month' | 'year' | 'all';

export default function OrdersScreen({ companyId }: { companyId: number }) {
  const { theme } = useTheme();
  const { t, lang } = useI18n();

  const [ordersList, setOrdersList] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [period, setPeriod] = useState<Period>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);

  // Модалка выдачи заказа (частичные возвраты) — как в вебе
  const [completing, setCompleting] = useState<Order | null>(null);
  const [returnQty, setReturnQty] = useState<Record<number, number>>({});

  const loadRef = useRef<() => Promise<void>>(async () => {});

  const load = useCallback(async () => {
    try {
      const data = await api.orders.list({ companyId: String(companyId) });
      const raw = Array.isArray(data) ? data : data?.orders || [];

      // Нормализация форматов — как в CompanyOrdersPanel.loadOrders()
      const mapped: Order[] = raw.map((order: any) => {
        let items = Array.isArray(order.items) ? order.items : [];
        if (typeof order.items === 'string' && order.items.length > 0) {
          try {
            const parsed = JSON.parse(order.items);
            items = Array.isArray(parsed) ? parsed : [];
          } catch {
            items = [];
          }
        }
        const mappedItems: OrderItem[] = items.map((item: any) => {
          const price = item.price_with_markup || item.priceWithMarkup || item.price || 0;
          const quantity = item.quantity || 1;
          return {
            name: item.productName || item.product_name || item.name || '—',
            quantity,
            price,
            total: item.total || quantity * price,
            color: item.color && !/любой/i.test(item.color) ? item.color : undefined,
            size: item.size && !/любой/i.test(item.size) ? item.size : undefined,
          };
        });
        return {
          id: order.id,
          order_code: order.orderCode || order.order_code || '',
          user_name: order.customerName || order.customer_name || order.user_name || '',
          user_phone: order.customerPhone || order.customer_phone || order.user_phone || '',
          order_date: order.createdAt || order.created_at || order.order_date,
          total_amount: order.totalAmount || order.total_amount || 0,
          markup_profit: order.markupProfit || order.markup_profit || 0,
          status: order.status,
          delivery_type: order.deliveryType || order.delivery_type,
          delivery_address: order.deliveryAddress || order.delivery_address,
          comment: order.comment || '',
          items: mappedItems,
        };
      });

      mapped.sort(
        (a, b) => new Date(b.order_date || '').getTime() - new Date(a.order_date || '').getTime()
      );
      setOrdersList(mapped);
    } catch (e) {
      console.error('Orders load failed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId]);

  loadRef.current = load;

  useEffect(() => {
    load();
    // Автообновление — как в вебе (там 3 c; в приложении реже, бережём батарею)
    const interval = setInterval(() => loadRef.current(), 15000);
    return () => clearInterval(interval);
  }, [load]);

  // Фильтр по периоду — как getPeriodRange в вебе
  const periodStart = useMemo(() => {
    const now = new Date();
    const start = new Date();
    if (period === 'day') start.setHours(0, 0, 0, 0);
    else if (period === 'week') { start.setDate(now.getDate() - 7); start.setHours(0, 0, 0, 0); }
    else if (period === 'month') { start.setMonth(now.getMonth() - 1); start.setHours(0, 0, 0, 0); }
    else if (period === 'year') { start.setFullYear(now.getFullYear() - 1); start.setHours(0, 0, 0, 0); }
    else return null;
    return start;
  }, [period]);

  const filtered = useMemo(() => {
    let list = ordersList;
    if (periodStart) {
      list = list.filter((o) => {
        const d = new Date(o.order_date || '');
        return !isNaN(d.getTime()) && d >= periodStart;
      });
    }
    if (filter === 'all') return list;
    if (filter === 'completed') return list.filter((o) => o.status === 'completed' || o.status === 'delivered');
    return list.filter((o) => o.status === filter);
  }, [ordersList, filter, periodStart]);

  // Итоги по отфильтрованному периоду
  const totals = useMemo(() => {
    const active = filtered.filter((o) => o.status !== 'cancelled');
    return {
      count: filtered.length,
      revenue: active.reduce((s, o) => s + (o.total_amount || 0), 0),
      markup: active.reduce((s, o) => s + (o.markup_profit || 0), 0),
    };
  }, [filtered]);

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

  const run = async (orderId: number, fn: () => Promise<any>, successMsg: string) => {
    setProcessingId(orderId);
    try {
      await fn();
      haptic.success();
      await load();
      Alert.alert('✅', successMsg);
    } catch (e) {
      haptic.error();
      Alert.alert(t.error, e instanceof Error ? e.message : String(e));
    } finally {
      setProcessingId(null);
    }
  };

  const acceptOrder = (o: Order) =>
    run(o.id, () => api.orders.updateStatus(String(o.id), 'confirmed'), t.orderAccepted);

  const shipOrder = (o: Order) => run(o.id, () => api.orders.confirmPayment(o.id), t.orderShipped);

  // Открыть диалог выдачи — по умолчанию возвраты 0 (выдано всё), как в вебе
  const openComplete = (o: Order) => {
    setReturnQty({});
    setCompleting(o);
  };

  const submitComplete = async () => {
    const order = completing;
    if (!order) return;
    const returns = Object.entries(returnQty)
      .map(([idx, q]) => ({ index: Number(idx), quantity: Number(q) }))
      .filter((r) => r.quantity > 0);
    setCompleting(null);
    await run(order.id, () => api.orders.markDelivered(order.id, returns), t.orderCompleted);
  };

  const cancelOrder = (o: Order) => {
    Alert.alert(t.cancelOrder, t.cancelOrderConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.cancelOrder,
        style: 'destructive',
        onPress: () => run(o.id, () => api.orders.cancel(o.id), t.orderCancelled),
      },
    ]);
  };

  const callCustomer = (phone: string) => {
    haptic.light();
    const clean = phone.replace(/\D/g, '');
    Linking.openURL(`tel:+998${clean.slice(-9)}`).catch(() => {});
  };

  const statusFilters: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: t.allOrders },
    { key: 'pending', label: t.statusPending },
    { key: 'confirmed', label: t.statusConfirmed },
    { key: 'shipped', label: t.statusShipped },
    { key: 'completed', label: t.statusCompleted },
    { key: 'cancelled', label: t.statusCancelled },
  ];

  const periodFilters: { key: Period; label: string }[] = [
    { key: 'all', label: t.periodAll },
    { key: 'day', label: t.periodDay },
    { key: 'week', label: t.periodWeek },
    { key: 'month', label: t.periodMonth },
    { key: 'year', label: t.periodYear },
  ];

  if (loading) return <Loading />;

  return (
    <View style={{ flex: 1 }}>
      {/* Фильтры: период + статус */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: SP.lg - 2, paddingTop: 10, gap: 8 }}
        >
          {periodFilters.map((f) => (
            <Chip key={f.key} label={f.label} active={period === f.key} onPress={() => setPeriod(f.key)} color={theme.opsAccent} />
          ))}
        </ScrollView>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: SP.lg - 2, paddingVertical: 10, gap: 8 }}
        >
          {statusFilters.map((f) => (
            <Chip key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(o) => String(o.id)}
        contentContainerStyle={{ padding: SP.lg - 2, paddingTop: 4, paddingBottom: 30, gap: 8 }}
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
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 6 }}>
            <StatCard label={t.ordersCount} value={fmt(totals.count)} icon="receipt-outline" />
            <StatCard label={t.revenue} value={fmtShort(totals.revenue, lang)} icon="cash-outline" color={theme.success} />
            <StatCard label={t.markupProfit} value={fmtShort(totals.markup, lang)} icon="trending-up-outline" color={theme.primary} />
          </View>
        }
        ListEmptyComponent={<EmptyState text={t.noOrders} icon="receipt-outline" />}
        renderItem={({ item: o }) => {
          const expanded = expandedId === o.id;
          const busy = processingId === o.id;
          return (
            <Card
              onPress={() => {
                haptic.light();
                setExpandedId(expanded ? null : o.id);
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15 }}>
                  #{o.order_code || o.id}
                </Text>
                <Badge text={statusLabel(o.status)} color={STATUS_COLOR[o.status] || theme.text3} />
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{ color: theme.text2, fontSize: 13.5 }} numberOfLines={1}>
                    {o.user_name || t.buyer}
                  </Text>
                  <Text style={{ color: theme.text3, fontSize: 12, marginTop: 2 }}>
                    {fmtDate(o.order_date)}
                  </Text>
                </View>
                <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15.5 }}>
                  {fmt(o.total_amount)} {t.sum}
                </Text>
              </View>

              {expanded && (
                <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 10 }}>
                  {/* Контакты и адрес */}
                  {!!o.user_phone && (
                    <Pressable
                      onPress={() => callCustomer(o.user_phone)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}
                    >
                      <View
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 10,
                          backgroundColor: `${theme.success}22`,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons name="call-outline" size={15} color={theme.success} />
                      </View>
                      <Text style={{ color: theme.success, fontSize: 13.5, fontWeight: '600' }}>
                        {t.call}: +998 {o.user_phone}
                      </Text>
                    </Pressable>
                  )}
                  {!!o.delivery_address && (
                    <Text style={{ color: theme.text2, fontSize: 13, marginBottom: 8 }}>
                      📍 {t.deliveryAddress}: {o.delivery_address}
                    </Text>
                  )}
                  {!!o.comment && (
                    <Text style={{ color: theme.text3, fontSize: 12.5, marginBottom: 8 }}>💬 {o.comment}</Text>
                  )}

                  <Text style={{ color: theme.text3, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>
                    {t.items.toUpperCase()}
                  </Text>
                  {o.items.map((item, idx) => (
                    <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ color: theme.text2, fontSize: 13.5, flex: 1, marginRight: 8 }} numberOfLines={1}>
                        {item.name}
                        {item.color ? ` · ${item.color}` : ''}
                        {item.size ? ` · ${item.size}` : ''} ×{item.quantity}
                      </Text>
                      <Text style={{ color: theme.text, fontSize: 13.5, fontWeight: '600' }}>{fmt(item.total)}</Text>
                    </View>
                  ))}
                  {o.markup_profit > 0 && (
                    <Text style={{ color: theme.primary, fontSize: 12.5, marginTop: 4 }}>
                      {t.markupProfit}: {fmt(o.markup_profit)} {t.sum}
                    </Text>
                  )}

                  {/* Действия — по статусу, как в веб-панели */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                    {o.status === 'pending' && (
                      <>
                        <Button title={t.accept} onPress={() => acceptOrder(o)} loading={busy} small variant="success" icon="checkmark" style={{ flex: 1 }} />
                        <Button title={t.cancelOrder} onPress={() => cancelOrder(o)} disabled={busy} small variant="danger" icon="close" style={{ flex: 1 }} />
                      </>
                    )}
                    {(o.status === 'confirmed' || o.status === 'processing') && (
                      <>
                        <Button title={t.ship} onPress={() => shipOrder(o)} loading={busy} small icon="paper-plane-outline" style={{ flex: 1 }} />
                        <Button title={t.cancelOrder} onPress={() => cancelOrder(o)} disabled={busy} small variant="danger" icon="close" style={{ flex: 1 }} />
                      </>
                    )}
                    {(o.status === 'shipped' || o.status === 'delivered') && (
                      <Button title={t.complete} onPress={() => openComplete(o)} loading={busy} small variant="success" icon="checkmark-done-outline" style={{ flex: 1 }} />
                    )}
                  </View>
                </View>
              )}
            </Card>
          );
        }}
      />

      {/* Диалог выдачи с частичными возвратами — submitComplete из веба */}
      <Sheet visible={completing !== null} onClose={() => setCompleting(null)} title={t.completeTitle}>
        {completing && (
          <>
            <Text style={{ color: theme.text3, fontSize: 13, marginBottom: 14 }}>{t.completeHint}</Text>
            <View style={{ gap: 10, marginBottom: 16 }}>
              {completing.items.map((item, idx) => (
                <Card key={idx} style={{ padding: 10 }}>
                  <Text style={{ color: theme.text, fontSize: 13.5, fontWeight: '600' }} numberOfLines={1}>
                    {item.name} ×{item.quantity}
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: 8,
                    }}
                  >
                    <Text style={{ color: theme.text2, fontSize: 13 }}>{t.returned}:</Text>
                    <Stepper
                      value={returnQty[idx] || 0}
                      min={0}
                      max={item.quantity}
                      onChange={(v) => setReturnQty((prev) => ({ ...prev, [idx]: v }))}
                    />
                  </View>
                </Card>
              ))}
            </View>
            <Button title={t.complete} onPress={submitComplete} variant="success" icon="checkmark-done-outline" />
          </>
        )}
      </Sheet>
    </View>
  );
}
