import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import api from '../api';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';
import { Badge, Card, EmptyState, fmt, fmtDate, Loading } from '../ui';

interface Sale {
  id: number;
  total_amount?: number;
  totalAmount?: number;
  payment_method?: string;
  paymentMethod?: string;
  created_at?: string;
  createdAt?: string;
  items?: any[] | string;
}

// 💵 Продажи — список офлайн-продаж компании (endpoint /sales, как SalesPanel).
export default function SalesScreen({ companyId }: { companyId: number }) {
  const { theme } = useTheme();
  const { t } = useI18n();

  const [salesList, setSalesList] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.sales.list({ companyId: String(companyId), limit: 200 });
      const list = Array.isArray(data) ? data : data?.sales || [];
      setSalesList(list);
    } catch (e) {
      console.error('Sales load failed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const amount = (s: Sale) => s.total_amount ?? s.totalAmount ?? 0;
  const method = (s: Sale) => s.payment_method ?? s.paymentMethod ?? '';
  const date = (s: Sale) => s.created_at ?? s.createdAt;

  const totalSum = useMemo(() => salesList.reduce((acc, s) => acc + amount(s), 0), [salesList]);

  const parseItems = (s: Sale): any[] => {
    if (Array.isArray(s.items)) return s.items;
    if (typeof s.items === 'string') {
      try {
        const parsed = JSON.parse(s.items);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  if (loading) return <Loading />;

  return (
    <FlatList
      data={salesList}
      keyExtractor={(s) => String(s.id)}
      contentContainerStyle={{ padding: 14, paddingBottom: 30, gap: 8 }}
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
        <Card style={{ marginBottom: 6 }}>
          <Text style={{ color: theme.text2, fontSize: 12.5, marginBottom: 6 }}>{t.salesForPeriod}</Text>
          <Text style={{ color: theme.success, fontSize: 21, fontWeight: '700' }}>
            {fmt(totalSum)} {t.sum}
          </Text>
          <Text style={{ color: theme.text3, fontSize: 12, marginTop: 4 }}>
            {t.total}: {salesList.length}
          </Text>
        </Card>
      }
      ListEmptyComponent={<EmptyState text={t.noSales} />}
      renderItem={({ item: s }) => {
        const items = parseItems(s);
        const isCash = /cash|нал/i.test(method(s));
        return (
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15.5 }}>
                {fmt(amount(s))} {t.sum}
              </Text>
              <Badge
                text={isCash ? t.paymentCash : t.paymentCard}
                color={isCash ? theme.success : theme.opsAccent}
              />
            </View>
            {items.length > 0 && (
              <Text style={{ color: theme.text2, fontSize: 13, marginTop: 6 }} numberOfLines={2}>
                {items
                  .map((i: any) => `${i.productName || i.product_name || i.name || '—'} ×${i.quantity || 1}`)
                  .join(', ')}
              </Text>
            )}
            <Text style={{ color: theme.text3, fontSize: 12, marginTop: 6 }}>{fmtDate(date(s))}</Text>
          </Card>
        );
      }}
    />
  );
}
