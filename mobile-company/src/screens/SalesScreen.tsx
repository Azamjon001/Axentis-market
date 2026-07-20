import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  RefreshControl,
  Share,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api, { getImageUrl } from '../api';
import { useI18n } from '../i18n';
import { SP, useTheme } from '../theme';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  fmt,
  fmtDate,
  fmtShort,
  haptic,
  Loading,
  SearchBar,
  Segmented,
  Sheet,
  StatCard,
} from '../ui';

// 💵 «Продажи» — 1:1 с SalesPanel веб-панели:
// • Витрина — выбор товаров и массовое выставление/снятие с продажи
// • История — офлайн-продажи с итогами и экспортом CSV
interface Product {
  id: number;
  name: string;
  quantity: number;
  price: number;
  markupPercent?: number;
  availableForCustomers?: boolean;
  images?: string[];
}

export default function SalesScreen({ companyId }: { companyId: number }) {
  const { theme } = useTheme();
  const { t, lang } = useI18n();

  const [view, setView] = useState<'showcase' | 'history'>('showcase');
  const [products, setProducts] = useState<Product[]>([]);
  const [salesList, setSalesList] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [productsData, salesData] = await Promise.all([
        api.products.list({ companyId: String(companyId), limit: 2000 }),
        api.sales.list({ companyId: String(companyId), limit: 500 }).catch(() => []),
      ]);
      const list: Product[] = Array.isArray(productsData) ? productsData : productsData?.products || [];
      // Как в вебе: витрина показывает только товары с остатком > 0
      setProducts(list.filter((p) => (p.quantity || 0) > 0 && !p.name?.startsWith('__CATEGORY_MARKER__')));
      setSalesList(Array.isArray(salesData) ? salesData : salesData?.sales || []);
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

  const priceWithMarkup = (p: Product) => Math.round((p.price || 0) * (1 + (p.markupPercent || 0) / 100));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name?.toLowerCase().includes(q) || String(p.price).includes(q) || String(p.quantity).includes(q)
    );
  }, [products, search]);

  const onSaleCount = products.filter((p) => p.availableForCustomers).length;

  const toggleSelect = (id: number) => {
    haptic.light();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    haptic.light();
    if (selected.size === products.length) setSelected(new Set());
    else setSelected(new Set(products.map((p) => p.id)));
  };

  const bulkToggle = async (available: boolean) => {
    if (selected.size === 0) {
      Alert.alert('', t.selectProductsFirst);
      return;
    }
    setBusy(true);
    try {
      await api.products.bulkToggleAvailability(Array.from(selected), available);
      haptic.success();
      setSelected(new Set());
      setConfirmOpen(false);
      await load();
      Alert.alert('✅', available ? t.successfullyListed : t.removedFromSale);
    } catch (e) {
      haptic.error();
      Alert.alert(t.error, e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // ── История продаж ─────────────────────────────────────────────────────────
  const amount = (s: any) => s.total_amount ?? s.totalAmount ?? 0;
  const historyTotal = useMemo(() => salesList.reduce((acc, s) => acc + amount(s), 0), [salesList]);

  const parseItems = (s: any): any[] => {
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

  // 📄 Экспорт истории продаж (CSV) — как exportSalesCSV в вебе, через системный Share
  const exportCsv = async () => {
    const rows: string[][] = [['Дата', 'Товары', 'Кол-во', 'Сумма', 'Прибыль', 'Оплата']];
    for (const s of salesList) {
      const items = parseItems(s);
      rows.push([
        fmtDate(s.created_at || s.createdAt),
        items.map((i) => `${i.productName || i.product_name || i.name || '—'} x${i.quantity || 1}`).join('; '),
        String(items.reduce((n, i) => n + (i.quantity || 1), 0)),
        String(amount(s)),
        String(s.markup_profit ?? s.markupProfit ?? 0),
        s.payment_method === 'card' || s.paymentMethod === 'card' ? 'Карта' : 'Наличные',
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    try {
      await Share.share({ message: csv, title: `sales_${new Date().toISOString().slice(0, 10)}.csv` });
    } catch {
      /* пользователь закрыл шэринг */
    }
  };

  if (loading) return <Loading />;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: SP.lg - 2, paddingTop: SP.sm }}>
        <Segmented
          options={[
            { key: 'showcase', label: t.showcase, icon: 'storefront-outline' },
            { key: 'history', label: t.salesHistory, icon: 'time-outline' },
          ]}
          value={view}
          onChange={setView}
        />
      </View>

      {view === 'showcase' ? (
        <>
          <FlatList
            data={filtered}
            key="grid"
            numColumns={2}
            keyExtractor={(p) => String(p.id)}
            columnWrapperStyle={{ gap: 10 }}
            contentContainerStyle={{ padding: SP.lg - 2, paddingBottom: selected.size > 0 ? 130 : 30, gap: 10 }}
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
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <StatCard label={t.productsAvailable} value={fmt(products.length)} icon="cube-outline" />
                  <StatCard label={t.availableForCustomers} value={fmt(onSaleCount)} icon="eye-outline" color={theme.success} />
                  <StatCard label={t.productsSelected} value={fmt(selected.size)} icon="checkbox-outline" color={theme.primary} />
                </View>
                <SearchBar value={search} onChangeText={setSearch} placeholder={t.searchProducts} />
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                  <Button
                    title={selected.size === products.length && products.length > 0 ? t.deselectAll : t.selectAll}
                    onPress={selectAll}
                    variant="ghost"
                    small
                    icon={selected.size === products.length && products.length > 0 ? 'square-outline' : 'checkbox-outline'}
                  />
                </View>
              </View>
            }
            ListEmptyComponent={<EmptyState text={t.noProductsInStock} icon="storefront-outline" />}
            renderItem={({ item: p }) => {
              const img = getImageUrl(Array.isArray(p.images) ? p.images[0] : null);
              const isSelected = selected.has(p.id);
              return (
                <Card
                  onPress={() => toggleSelect(p.id)}
                  style={{
                    flex: 1,
                    padding: 0,
                    overflow: 'hidden',
                    borderColor: isSelected ? theme.primary : theme.border,
                    borderWidth: isSelected ? 2 : 1,
                  }}
                >
                  <View
                    style={{
                      height: 110,
                      backgroundColor: theme.input,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {img ? (
                      <Image source={{ uri: img }} style={{ width: '100%', height: 110 }} resizeMode="cover" />
                    ) : (
                      <Ionicons name="cube-outline" size={34} color={theme.text3} />
                    )}
                    <View style={{ position: 'absolute', top: 8, right: 8 }}>
                      <Ionicons
                        name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={22}
                        color={isSelected ? theme.primary : 'rgba(255,255,255,0.75)'}
                      />
                    </View>
                  </View>
                  <View style={{ padding: 10 }}>
                    <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }} numberOfLines={2}>
                      {p.name}
                    </Text>
                    <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 13.5, marginTop: 3 }}>
                      {fmt(priceWithMarkup(p))} {t.sum}
                    </Text>
                    <Text style={{ color: theme.text3, fontSize: 11.5, marginTop: 2 }}>
                      {t.inStock}: {fmt(p.quantity)} {t.pcs}
                    </Text>
                    <View style={{ marginTop: 6 }}>
                      <Badge
                        text={p.availableForCustomers ? t.onSale : t.notOnSale}
                        color={p.availableForCustomers ? theme.success : theme.text3}
                      />
                    </View>
                  </View>
                </Card>
              );
            }}
          />

          {/* Панель действий при выборе */}
          {selected.size > 0 && (
            <View
              style={{
                position: 'absolute',
                left: 10,
                right: 10,
                bottom: 12,
                backgroundColor: theme.sidebar,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: theme.border,
                padding: 10,
                gap: 8,
              }}
            >
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14 }}>
                {t.productsSelected}: {selected.size}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  title={t.putOnSale}
                  onPress={() => setConfirmOpen(true)}
                  small
                  icon="eye-outline"
                  style={{ flex: 1.4 }}
                />
                <Button
                  title={t.removeFromSale}
                  onPress={() => bulkToggle(false)}
                  small
                  loading={busy}
                  variant="danger"
                  icon="eye-off-outline"
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          )}
        </>
      ) : (
        <FlatList
          data={salesList}
          key="list"
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={{ padding: SP.lg - 2, paddingBottom: 30, gap: 8 }}
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
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ color: theme.text2, fontSize: 12.5, marginBottom: 6 }}>{t.salesForPeriod}</Text>
                    <Text style={{ color: theme.success, fontSize: 21, fontWeight: '700' }}>
                      {fmtShort(historyTotal, lang)} {t.sum}
                    </Text>
                    <Text style={{ color: theme.text3, fontSize: 12, marginTop: 4 }}>
                      {t.total}: {salesList.length}
                    </Text>
                  </View>
                  <Button
                    title={t.exportCsv}
                    onPress={exportCsv}
                    variant="ghost"
                    small
                    icon="download-outline"
                    disabled={salesList.length === 0}
                  />
                </View>
              </Card>
            </View>
          }
          ListEmptyComponent={<EmptyState text={t.noSales} icon="receipt-outline" />}
          renderItem={({ item: s }) => {
            const items = parseItems(s);
            const isCash = !((s.payment_method || s.paymentMethod) === 'card');
            return (
              <Card>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15.5 }}>
                    {fmt(amount(s))} {t.sum}
                  </Text>
                  <Badge text={isCash ? t.paymentCash : t.paymentCard} color={isCash ? theme.success : theme.opsAccent} />
                </View>
                {items.length > 0 && (
                  <Text style={{ color: theme.text2, fontSize: 13, marginTop: 6 }} numberOfLines={2}>
                    {items
                      .map((i: any) => `${i.productName || i.product_name || i.name || '—'} ×${i.quantity || 1}`)
                      .join(', ')}
                  </Text>
                )}
                <Text style={{ color: theme.text3, fontSize: 12, marginTop: 6 }}>
                  {fmtDate(s.created_at || s.createdAt)}
                </Text>
              </Card>
            );
          }}
        />
      )}

      {/* Подтверждение выставления — как модалка в вебе */}
      <Sheet visible={confirmOpen} onClose={() => setConfirmOpen(false)} title={t.putOnSale}>
        <Text style={{ color: theme.text3, fontSize: 13.5, marginBottom: 14 }}>{t.listForCustomersDesc}</Text>
        <View style={{ gap: 8, marginBottom: 16 }}>
          {Array.from(selected)
            .slice(0, 20)
            .map((id) => {
              const p = products.find((x) => x.id === id);
              if (!p) return null;
              return (
                <Card key={id} style={{ padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontSize: 13.5, fontWeight: '600' }} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={{ color: theme.text3, fontSize: 12 }}>
                      {fmt(priceWithMarkup(p))} {t.sum} · {fmt(p.quantity)} {t.pcs}
                    </Text>
                  </View>
                  <Badge
                    text={p.availableForCustomers ? t.alreadyOnSale : t.willBeListed}
                    color={p.availableForCustomers ? theme.success : theme.warning}
                  />
                </Card>
              );
            })}
        </View>
        <Button title={`${t.putOnSale} (${selected.size})`} onPress={() => bulkToggle(true)} loading={busy} icon="eye-outline" />
      </Sheet>
    </View>
  );
}
