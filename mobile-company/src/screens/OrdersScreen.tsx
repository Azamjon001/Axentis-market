import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import api from '../api';
import { useI18n } from '../i18n';
import { STATUS_COLOR, useTheme } from '../theme';
import { Badge, Button, Card, EmptyState, fmt, fmtDate, Loading } from '../ui';

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
}

interface Order {
  id: number;
  order_code: string;
  user_name: string;
  user_phone: string;
  order_date?: string;
  total_amount: number;
  status: string;
  delivery_address?: string;
  items: OrderItem[];
}

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'shipped' | 'completed' | 'cancelled';

// 🧾 Заказы — та же логика, что CompanyOrdersPanel веб-панели:
// pending → «Принять» (updateStatus confirmed) → «Отправить» (confirm) →
// «Завершить» (mark-delivered) / «Отменить» (cancel).
export default function OrdersScreen({ companyId }: { companyId: number }) {
  const { theme } = useTheme();
  const { t } = useI18n();

  const [ordersList, setOrdersList] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);

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
          };
        });
        return {
          id: order.id,
          order_code: order.orderCode || order.order_code || '',
          user_name: order.customerName || order.customer_name || order.user_name || '',
          user_phone: order.customerPhone || order.customer_phone || order.user_phone || '',
          order_date: order.createdAt || order.created_at || order.order_date,
          total_amount: order.totalAmount || order.total_amount || 0,
          status: order.status,
          delivery_address: order.deliveryAddress || order.delivery_address,
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

  useEffect(() => {
    load();
    // Фоновая подгрузка новых заказов — как в веб-панели (там 3 с; в мобильном
    // приложении реже, чтобы беречь батарею и трафик)
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === 'all') return ordersList;
    if (filter === 'completed') {
      return ordersList.filter((o) => o.status === 'completed' || o.status === 'delivered');
    }
    return ordersList.filter((o) => o.status === filter);
  }, [ordersList, filter]);

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
      await load();
      Alert.alert('✅', successMsg);
    } catch (e) {
      Alert.alert(t.error, e instanceof Error ? e.message : String(e));
    } finally {
      setProcessingId(null);
    }
  };

  const acceptOrder = (o: Order) =>
    run(o.id, () => api.orders.updateStatus(String(o.id), 'confirmed'), t.orderAccepted);

  const shipOrder = (o: Order) => run(o.id, () => api.orders.confirmPayment(o.id), t.orderShipped);

  const completeOrder = (o: Order) =>
    run(o.id, () => api.orders.markDelivered(o.id, []), t.orderCompleted);

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

  const filters: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: t.allOrders },
    { key: 'pending', label: t.statusPending },
    { key: 'confirmed', label: t.statusConfirmed },
    { key: 'shipped', label: t.statusShipped },
    { key: 'completed', label: t.statusCompleted },
    { key: 'cancelled', label: t.statusCancelled },
  ];

  if (loading) return <Loading />;

  return (
    <View style={{ flex: 1 }}>
      {/* Фильтр по статусу */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 10, gap: 8 }}
        >
          {filters.map((f) => {
            const on = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 999,
                  backgroundColor: on ? theme.primary : theme.card,
                  borderWidth: 1,
                  borderColor: on ? theme.primary : theme.border,
                }}
              >
                <Text style={{ color: on ? '#fff' : theme.text2, fontSize: 13, fontWeight: '600' }}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(o) => String(o.id)}
        contentContainerStyle={{ padding: 14, paddingTop: 4, paddingBottom: 30, gap: 8 }}
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
        ListEmptyComponent={<EmptyState text={t.noOrders} />}
        renderItem={({ item: o }) => {
          const expanded = expandedId === o.id;
          const busy = processingId === o.id;
          return (
            <Pressable onPress={() => setExpandedId(expanded ? null : o.id)}>
              <Card>
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
                      {o.user_phone ? ` · ${o.user_phone}` : ''}
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
                    {o.delivery_address ? (
                      <Text style={{ color: theme.text2, fontSize: 13, marginBottom: 8 }}>
                        📍 {t.deliveryAddress}: {o.delivery_address}
                      </Text>
                    ) : null}
                    <Text style={{ color: theme.text3, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>
                      {t.items.toUpperCase()}
                    </Text>
                    {o.items.map((item, idx) => (
                      <View
                        key={idx}
                        style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}
                      >
                        <Text style={{ color: theme.text2, fontSize: 13.5, flex: 1, marginRight: 8 }} numberOfLines={1}>
                          {item.name} ×{item.quantity}
                        </Text>
                        <Text style={{ color: theme.text, fontSize: 13.5, fontWeight: '600' }}>
                          {fmt(item.total)}
                        </Text>
                      </View>
                    ))}

                    {/* Действия — по статусу, как в веб-панели */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                      {o.status === 'pending' && (
                        <>
                          <Button title={t.accept} onPress={() => acceptOrder(o)} loading={busy} small variant="success" style={{ flex: 1 }} />
                          <Button title={t.cancelOrder} onPress={() => cancelOrder(o)} disabled={busy} small variant="danger" style={{ flex: 1 }} />
                        </>
                      )}
                      {(o.status === 'confirmed' || o.status === 'processing') && (
                        <>
                          <Button title={t.ship} onPress={() => shipOrder(o)} loading={busy} small style={{ flex: 1 }} />
                          <Button title={t.cancelOrder} onPress={() => cancelOrder(o)} disabled={busy} small variant="danger" style={{ flex: 1 }} />
                        </>
                      )}
                      {(o.status === 'shipped' || o.status === 'delivered') && (
                        <Button title={t.complete} onPress={() => completeOrder(o)} loading={busy} small variant="success" style={{ flex: 1 }} />
                      )}
                    </View>
                  </View>
                )}
              </Card>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
