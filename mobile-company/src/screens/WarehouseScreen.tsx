import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import api from '../api';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';
import { Badge, Button, Card, EmptyState, fmt, Input, Loading, Segmented } from '../ui';
import SalesScreen from './SalesScreen';

interface Product {
  id: number;
  name: string;
  price: number;
  markup_percent?: number;
  markupPercent?: number;
  price_with_markup?: number;
  priceWithMarkup?: number;
  quantity: number;
  category?: string;
  brand?: string;
  barcode?: string;
  description?: string;
  available_for_customers?: boolean;
  availableForCustomers?: boolean;
}

interface FormState {
  id: number | null;
  name: string;
  price: string;
  markupPercent: string;
  quantity: string;
  category: string;
  brand: string;
  barcode: string;
  description: string;
  available: boolean;
}

const emptyForm: FormState = {
  id: null,
  name: '',
  price: '',
  markupPercent: '0',
  quantity: '0',
  category: '',
  brand: '',
  barcode: '',
  description: '',
  available: true,
};

// 📦 «Склад и продажи» — объединённый раздел, как в веб-панели:
// сегментированный переключатель Склад ↔ Продажи (принцип CompanyPanel.tsx).
export default function WarehouseScreen({ companyId }: { companyId: number }) {
  const { theme } = useTheme();
  const { t } = useI18n();

  const [view, setView] = useState<'inventory' | 'sales'>('inventory');
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.products.list({ companyId: String(companyId), limit: 1000 });
      const list = Array.isArray(data) ? data : data?.products || [];
      setProducts(list);
    } catch (e) {
      console.error('Products load failed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q)
    );
  }, [products, search]);

  const priceWithMarkup = (p: Product) => {
    const explicit = p.price_with_markup ?? p.priceWithMarkup;
    if (explicit) return explicit;
    const markup = p.markup_percent ?? p.markupPercent ?? 0;
    return Math.round((p.price || 0) * (1 + markup / 100));
  };

  const isAvailable = (p: Product) => p.available_for_customers ?? p.availableForCustomers ?? true;

  const openCreate = () => setForm({ ...emptyForm });

  const openEdit = (p: Product) =>
    setForm({
      id: p.id,
      name: p.name || '',
      price: String(p.price ?? ''),
      markupPercent: String(p.markup_percent ?? p.markupPercent ?? 0),
      quantity: String(p.quantity ?? 0),
      category: p.category || '',
      brand: p.brand || '',
      barcode: p.barcode || '',
      description: p.description || '',
      available: isAvailable(p),
    });

  const submitForm = async () => {
    if (!form) return;
    const price = parseFloat(form.price);
    if (!form.name.trim() || !price || price <= 0) {
      Alert.alert(t.error, t.nameAndPriceRequired);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        price,
        markupPercent: parseFloat(form.markupPercent) || 0,
        quantity: parseInt(form.quantity, 10) || 0,
        category: form.category.trim(),
        brand: form.brand.trim(),
        barcode: form.barcode.trim(),
        description: form.description.trim(),
        availableForCustomers: form.available,
      };
      if (form.id) {
        await api.products.update(form.id, payload);
      } else {
        await api.products.create({ companyId, ...payload });
      }
      setForm(null);
      load();
    } catch (e) {
      Alert.alert(t.error, e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (p: Product) => {
    Alert.alert(t.delete, t.deleteProductConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            await api.products.delete(p.id);
            load();
          } catch (e) {
            Alert.alert(t.error, e instanceof Error ? e.message : String(e));
          }
        },
      },
    ]);
  };

  const toggleAvailability = async (p: Product) => {
    try {
      await api.products.update(p.id, { availableForCustomers: !isAvailable(p) });
      setProducts((prev) =>
        prev.map((x) =>
          x.id === p.id
            ? { ...x, available_for_customers: !isAvailable(p), availableForCustomers: !isAvailable(p) }
            : x
        )
      );
    } catch (e) {
      Alert.alert(t.error, e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 14, paddingTop: 12 }}>
        <Segmented
          options={[
            { key: 'inventory', label: t.warehouse },
            { key: 'sales', label: t.sales },
          ]}
          value={view}
          onChange={setView}
        />
      </View>

      {view === 'sales' ? (
        <SalesScreen companyId={companyId} />
      ) : (
        <>
          {/* Поиск + добавление */}
          <View style={{ flexDirection: 'row', gap: 8, padding: 14, paddingBottom: 8 }}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t.searchProducts}
              placeholderTextColor={theme.text3}
              style={{
                flex: 1,
                backgroundColor: theme.input,
                borderWidth: 1,
                borderColor: theme.border,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 10,
                color: theme.text,
                fontSize: 14.5,
              }}
            />
            <Button title="＋" onPress={openCreate} style={{ paddingHorizontal: 16 }} />
          </View>

          {loading ? (
            <Loading />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(p) => String(p.id)}
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
              ListEmptyComponent={<EmptyState text={t.noProducts} />}
              renderItem={({ item: p }) => (
                <Pressable onPress={() => openEdit(p)}>
                  <Card>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Text
                        style={{ color: theme.text, fontWeight: '600', fontSize: 15, flex: 1, marginRight: 8 }}
                        numberOfLines={2}
                      >
                        {p.name}
                      </Text>
                      {!isAvailable(p) && <Badge text={t.hidden} color={theme.warning} />}
                    </View>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: 10,
                      }}
                    >
                      <View>
                        <Text style={{ color: theme.text2, fontSize: 12.5 }}>
                          {t.priceWithMarkup}:{' '}
                          <Text style={{ color: theme.success, fontWeight: '700' }}>
                            {fmt(priceWithMarkup(p))} {t.sum}
                          </Text>
                        </Text>
                        <Text style={{ color: theme.text3, fontSize: 12.5, marginTop: 2 }}>
                          {fmt(p.quantity)} {t.inStock}
                          {p.category ? ` · ${p.category}` : ''}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Switch
                          value={isAvailable(p)}
                          onValueChange={() => toggleAvailability(p)}
                          trackColor={{ true: theme.primary, false: theme.border }}
                          thumbColor="#fff"
                        />
                        <Pressable onPress={() => confirmDelete(p)} hitSlop={8}>
                          <Text style={{ fontSize: 17 }}>🗑️</Text>
                        </Pressable>
                      </View>
                    </View>
                  </Card>
                </Pressable>
              )}
            />
          )}
        </>
      )}

      {/* Модалка создания/редактирования */}
      <Modal visible={form !== null} animationType="slide" transparent onRequestClose={() => setForm(null)}>
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View
            style={{
              backgroundColor: theme.surface,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              maxHeight: '88%',
            }}
          >
            <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 34 }} keyboardShouldPersistTaps="handled">
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 14,
                }}
              >
                <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>
                  {form?.id ? t.editProduct : t.addProduct}
                </Text>
                <Pressable onPress={() => setForm(null)} hitSlop={8}>
                  <Text style={{ color: theme.text2, fontSize: 20 }}>✕</Text>
                </Pressable>
              </View>

              {form && (
                <>
                  <Input label={t.productName} value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Input
                        label={t.price}
                        value={form.price}
                        onChangeText={(v) => setForm({ ...form, price: v.replace(/[^0-9.]/g, '') })}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Input
                        label={t.markupPercent}
                        value={form.markupPercent}
                        onChangeText={(v) => setForm({ ...form, markupPercent: v.replace(/[^0-9.]/g, '') })}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Input
                        label={t.quantity}
                        value={form.quantity}
                        onChangeText={(v) => setForm({ ...form, quantity: v.replace(/\D/g, '') })}
                        keyboardType="number-pad"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Input
                        label={t.barcode}
                        value={form.barcode}
                        onChangeText={(v) => setForm({ ...form, barcode: v })}
                      />
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Input
                        label={t.category}
                        value={form.category}
                        onChangeText={(v) => setForm({ ...form, category: v })}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Input label={t.brand} value={form.brand} onChangeText={(v) => setForm({ ...form, brand: v })} />
                    </View>
                  </View>
                  <Input
                    label={t.description}
                    value={form.description}
                    onChangeText={(v) => setForm({ ...form, description: v })}
                    multiline
                    numberOfLines={3}
                    style={{ minHeight: 70, textAlignVertical: 'top' }}
                  />

                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 16,
                    }}
                  >
                    <Text style={{ color: theme.text, fontSize: 14.5 }}>{t.availableForCustomers}</Text>
                    <Switch
                      value={form.available}
                      onValueChange={(v) => setForm({ ...form, available: v })}
                      trackColor={{ true: theme.primary, false: theme.border }}
                      thumbColor="#fff"
                    />
                  </View>

                  <Button title={t.save} onPress={submitForm} loading={saving} />
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
