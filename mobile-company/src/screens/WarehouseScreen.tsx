import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Switch,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ViewShot, { ViewShotRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import QRCode from 'react-native-qrcode-svg';
import InventoryScreen from './InventoryScreen';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api, { getImageUrl, Supplier } from '../api';
import { useI18n } from '../i18n';
import { MKT_GRAD, OPS_GRAD, R, SP, useTheme } from '../theme';
import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  fmt,
  fmtShort,
  haptic,
  Input,
  Loading,
  SearchBar,
  SectionTitle,
  Segmented,
  Sheet,
  StatCard,
} from '../ui';
import SalesScreen from './SalesScreen';

// 📦 «Склад и продажи» — 1:1 с DigitalWarehouse + SalesPanel веб-панели:
// статистика склада, поиск, категории, «залежавшиеся», CRUD товара,
// закупка (пополнение остатка), варианты (SKU), фото, массовые действия
// (в продажу / с продажи / удалить / скидка), витрина — в под-вкладке «Продажи».
interface Product {
  id: number;
  name: string;
  price: number;
  markupPercent?: number;
  quantity: number;
  category?: string;
  brand?: string;
  barcode?: string;
  barid?: string;
  description?: string;
  color?: string;
  size?: string;
  availableForCustomers?: boolean;
  hasColorOptions?: boolean;
  images?: string[];
  soldCount?: number;
  createdAt?: string;
  created_at?: string;
  inventoryCost?: number;
}

interface EditForm {
  name: string;
  price: string;
  markupPercent: string;
  quantity: string;
  category: string;
  brand: string;
  barcode: string;
  barid: string;
  description: string;
  color: string;
  size: string;
  available: boolean;
}

const emptyEdit: EditForm = {
  name: '',
  price: '',
  markupPercent: '0',
  quantity: '0',
  category: '',
  brand: '',
  barcode: '',
  barid: '',
  description: '',
  color: '',
  size: '',
  available: true,
};

// 🐌 «Залежавшийся» товар — критерий из DigitalWarehouse.isStale
function isStale(p: Product): boolean {
  if ((p.quantity || 0) <= 0) return false;
  if ((p.soldCount || 0) > 2) return false;
  const created = p.createdAt || p.created_at;
  if (!created) return false;
  return (Date.now() - new Date(created).getTime()) / 86400000 >= 30;
}

const isMarker = (p: Product) => p.name?.startsWith('__CATEGORY_MARKER__');

export default function WarehouseScreen({ companyId }: { companyId: number }) {
  const { theme } = useTheme();
  const { t, lang } = useI18n();

  const [view, setView] = useState<'inventory' | 'sales'>('inventory');
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [staleOnly, setStaleOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Выбранный товар (детальная карточка)
  const [detail, setDetail] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(emptyEdit);
  const [saving, setSaving] = useState(false);

  // Создание товара
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<EditForm>(emptyEdit);

  // Закупка
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchaseQty, setPurchaseQty] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseVariant, setPurchaseVariant] = useState<any | null>(null);

  // Варианты
  const [variants, setVariants] = useState<any[]>([]);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [variantFormOpen, setVariantFormOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<any | null>(null);
  const [variantForm, setVariantForm] = useState({ color: '', size: '', price: '', markupPercent: '0', stockQuantity: '0', barcode: '' });

  // Массовый выбор
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountPercent, setDiscountPercent] = useState('');

  // 📦 Инвентаризация сканером
  const [inventoryOpen, setInventoryOpen] = useState(false);

  // 🏷 Ценник товара
  const [priceTagFor, setPriceTagFor] = useState<Product | null>(null);
  const tagShotRef = React.useRef<ViewShotRef>(null);

  // 🤖 Умный советчик закупок
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorRows, setAdvisorRows] = useState<
    { productId: number; name: string; stock: number; soldPerDay: number; recommend: number; cost: number }[]
  >([]);

  // 🚚 Поставщики: справочник + привязки товаров (для автозаказа)
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
  const [supplierOf, setSupplierOf] = useState<Map<number, number>>(new Map());

  const loadSuppliers = useCallback(async () => {
    try {
      const [list, assignments] = await Promise.all([
        api.suppliers.list(companyId),
        api.suppliers.assignments(companyId),
      ]);
      setSuppliersList(Array.isArray(list) ? list : []);
      setSupplierOf(new Map((assignments || []).map((a) => [a.productId, a.supplierId])));
    } catch {
      /* поставщики опциональны */
    }
  }, [companyId]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const assignSupplier = async (productId: number, supplierId: number | null) => {
    haptic.light();
    try {
      await api.suppliers.assign(companyId, productId, supplierId);
      setSupplierOf((prev) => {
        const next = new Map(prev);
        if (supplierId === null) next.delete(productId);
        else next.set(productId, supplierId);
        return next;
      });
    } catch (e) {
      Alert.alert(t.error, e instanceof Error ? e.message : String(e));
    }
  };

  const load = useCallback(async () => {
    try {
      const data = await api.products.list({ companyId: String(companyId), limit: 2000 });
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

  const realProducts = useMemo(() => products.filter((p) => !isMarker(p)), [products]);

  const categories = useMemo(() => {
    const set = new Set(realProducts.map((p) => p.category || '—'));
    return Array.from(set).sort();
  }, [realProducts]);

  const staleCount = useMemo(() => realProducts.filter(isStale).length, [realProducts]);

  const stats = useMemo(
    () => ({
      totalProducts: realProducts.length,
      totalQuantity: realProducts.reduce((s, p) => s + (p.quantity || 0), 0),
      totalValue: realProducts.reduce((s, p) => s + (p.inventoryCost || (p.price || 0) * (p.quantity || 0)), 0),
      categories: categories.length,
    }),
    [realProducts, categories]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return realProducts.filter((p) => {
      const matchSearch =
        !q ||
        p.name?.toLowerCase().includes(q) ||
        p.barcode?.includes(q) ||
        p.barid?.includes(q) ||
        p.brand?.toLowerCase().includes(q);
      const matchCat = category === 'all' || (p.category || '—') === category;
      const matchStale = !staleOnly || isStale(p);
      return matchSearch && matchCat && matchStale;
    });
  }, [realProducts, search, category, staleOnly]);

  const priceWithMarkup = (price: number, markup: number) => Math.round(price * (1 + (markup || 0) / 100));

  // ── Детальная карточка товара ──────────────────────────────────────────────
  const openDetail = (p: Product) => {
    setDetail(p);
    setEditForm({
      name: p.name || '',
      price: String(p.price ?? ''),
      markupPercent: String(p.markupPercent ?? 0),
      quantity: String(p.quantity ?? 0),
      category: p.category || '',
      brand: p.brand || '',
      barcode: p.barcode || '',
      barid: p.barid || '',
      description: p.description || '',
      color: p.color || '',
      size: p.size || '',
      available: p.availableForCustomers !== false,
    });
    setVariants([]);
    loadVariants(p.id);
  };

  const loadVariants = async (productId: number) => {
    setVariantsLoading(true);
    try {
      const data = await api.products.getVariants(productId);
      setVariants(Array.isArray(data) ? data : []);
    } catch {
      setVariants([]);
    } finally {
      setVariantsLoading(false);
    }
  };

  const saveDetail = async () => {
    if (!detail) return;
    const price = parseFloat(editForm.price);
    if (!editForm.name.trim() || !price || price <= 0) {
      Alert.alert(t.error, t.nameAndPriceRequired);
      return;
    }
    // ✅ Валидация наценки 0–999.99 — как в вебе
    const markup = Math.min(Math.max(0, parseFloat(editForm.markupPercent) || 0), 999.99);
    setSaving(true);
    try {
      await api.products.update(detail.id, {
        name: editForm.name.trim(),
        price,
        markupPercent: markup,
        barcode: editForm.barcode.trim(),
        barid: editForm.barid.trim(),
        category: editForm.category.trim(),
        description: editForm.description.trim(),
        color: editForm.color.trim(),
        size: editForm.size.trim(),
        brand: editForm.brand.trim(),
        availableForCustomers: editForm.available,
      });
      haptic.success();
      setDetail(null);
      load();
    } catch (e) {
      haptic.error();
      Alert.alert(t.error, e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = (p: Product) => {
    Alert.alert(t.delete, t.deleteProductConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            await api.products.delete(p.id);
            haptic.success();
            setDetail(null);
            load();
          } catch (e) {
            Alert.alert(t.error, e instanceof Error ? e.message : String(e));
          }
        },
      },
    ]);
  };

  // ── Создание товара ────────────────────────────────────────────────────────
  const submitCreate = async () => {
    const price = parseFloat(createForm.price);
    if (!createForm.name.trim() || !price || price <= 0) {
      Alert.alert(t.error, t.nameAndPriceRequired);
      return;
    }
    setSaving(true);
    try {
      await api.products.create({
        companyId,
        name: createForm.name.trim(),
        price,
        markupPercent: parseFloat(createForm.markupPercent) || 0,
        quantity: parseInt(createForm.quantity, 10) || 0,
        category: createForm.category.trim(),
        brand: createForm.brand.trim(),
        barcode: createForm.barcode.trim(),
        barid: createForm.barid.trim(),
        description: createForm.description.trim(),
        color: createForm.color.trim(),
        size: createForm.size.trim(),
        availableForCustomers: createForm.available,
      });
      haptic.success();
      setCreateOpen(false);
      setCreateForm(emptyEdit);
      load();
    } catch (e) {
      haptic.error();
      Alert.alert(t.error, e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  // ── Закупка (товар или вариант) — логика handlePurchase из веба ────────────
  const submitPurchase = async () => {
    if (!detail) return;
    const qty = parseFloat(purchaseQty);
    const price = parseFloat(purchasePrice);
    if (!qty || qty <= 0 || !price || price <= 0) {
      Alert.alert(t.error, t.enterQtyAndPrice);
      return;
    }
    setSaving(true);
    try {
      const totalCost = qty * price;
      if (purchaseVariant) {
        // Закупка конкретного SKU-варианта
        await api.products.updateVariant(detail.id, purchaseVariant.id, {
          stockQuantity: Math.round((purchaseVariant.stockQuantity || 0) + qty),
          price,
        });
        const label = [purchaseVariant.color, purchaseVariant.size].filter(Boolean).join(', ');
        await api.productPurchases.create({
          companyId,
          productId: detail.id,
          variantId: purchaseVariant.id,
          productName: label ? `${detail.name} (${label})` : detail.name,
          quantity: qty,
          purchasePrice: price,
          totalCost,
        });
        loadVariants(detail.id);
      } else {
        // 1) запись о закупке для аналитики, 2) остаток += qty, цена закупки = price
        await api.productPurchases.create({
          companyId,
          productId: detail.id,
          productName: detail.name,
          quantity: qty,
          purchasePrice: price,
          totalCost,
        });
        await api.products.update(detail.id, {
          quantity: (detail.quantity || 0) + qty,
          price,
        });
        setDetail({ ...detail, quantity: (detail.quantity || 0) + qty, price });
        setEditForm((f) => ({ ...f, quantity: String((detail.quantity || 0) + qty), price: String(price) }));
      }
      haptic.success();
      setPurchaseOpen(false);
      setPurchaseQty('');
      setPurchasePrice('');
      setPurchaseVariant(null);
      load();
      Alert.alert('✅', t.purchaseSuccess);
    } catch (e) {
      haptic.error();
      Alert.alert(t.error, e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  // ── Варианты ───────────────────────────────────────────────────────────────
  const openVariantForm = (v: any | null) => {
    setEditingVariant(v);
    setVariantForm(
      v
        ? {
            color: v.color || '',
            size: v.size || '',
            price: String(v.price ?? ''),
            markupPercent: String(v.markupPercent ?? 0),
            stockQuantity: String(v.stockQuantity ?? 0),
            barcode: v.barcode || '',
          }
        : { color: '', size: '', price: '', markupPercent: '0', stockQuantity: '0', barcode: '' }
    );
    setVariantFormOpen(true);
  };

  const submitVariant = async () => {
    if (!detail) return;
    const price = parseFloat(variantForm.price);
    if (!price || price <= 0) {
      Alert.alert(t.error, t.nameAndPriceRequired);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        color: variantForm.color.trim(),
        size: variantForm.size.trim(),
        price,
        markupPercent: parseFloat(variantForm.markupPercent) || 0,
        stockQuantity: parseInt(variantForm.stockQuantity, 10) || 0,
        barcode: variantForm.barcode.trim(),
      };
      if (editingVariant) {
        await api.products.updateVariant(detail.id, editingVariant.id, payload);
      } else {
        await api.products.createVariant(detail.id, payload);
      }
      haptic.success();
      setVariantFormOpen(false);
      loadVariants(detail.id);
      load();
    } catch (e) {
      haptic.error();
      Alert.alert(t.error, e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const deleteVariant = (v: any) => {
    if (!detail) return;
    Alert.alert(t.delete, t.deleteVariantConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            await api.products.deleteVariant(detail.id, v.id);
            haptic.success();
            loadVariants(detail.id);
          } catch (e) {
            Alert.alert(t.error, e instanceof Error ? e.message : String(e));
          }
        },
      },
    ]);
  };

  // ── Фото товара (галерея → multipart upload, как ImageUploader в вебе) ─────
  const addPhotos = async () => {
    if (!detail) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 5,
    });
    if (result.canceled || !result.assets?.length) return;
    setSaving(true);
    try {
      const files = result.assets.map((a, i) => ({
        uri: a.uri,
        name: a.fileName || `photo_${Date.now()}_${i}.jpg`,
        type: a.mimeType || 'image/jpeg',
      }));
      await api.products.uploadImages(detail.id, files);
      haptic.success();
      // Обновляем карточку с сервера, чтобы получить пути новых фото
      const data = await api.products.list({ companyId: String(companyId), limit: 2000 });
      const list: Product[] = Array.isArray(data) ? data : data?.products || [];
      setProducts(list);
      const fresh = list.find((p) => p.id === detail.id);
      if (fresh) setDetail(fresh);
      Alert.alert('✅', t.photoUploaded);
    } catch (e) {
      haptic.error();
      Alert.alert(t.error, e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const deletePhoto = (filepath: string) => {
    if (!detail) return;
    Alert.alert(t.delete, t.deletePhotoConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            await api.products.deleteImage(detail.id, filepath);
            const nextImages = (detail.images || []).filter((i) => i !== filepath);
            setDetail({ ...detail, images: nextImages });
            haptic.success();
            load();
          } catch (e) {
            Alert.alert(t.error, e instanceof Error ? e.message : String(e));
          }
        },
      },
    ]);
  };

  // ── 🤖 Умный советчик закупок ──────────────────────────────────────────────
  // Прогноз остатков уже считается бэкендом (/inventory-insights, 90 дней).
  // Рекомендация: запас на 14 дней вперёд = ceil(soldPerDay × 14 − остаток).
  const openAdvisor = async () => {
    haptic.medium();
    setAdvisorOpen(true);
    setAdvisorLoading(true);
    try {
      const insights = await api.analytics.inventoryInsights(companyId);
      const priceOf = new Map<number, number>(realProducts.map((p) => [p.id, p.price || 0]));
      const rows = (insights?.stockForecast || [])
        .map((r: any) => {
          const recommend = Math.max(0, Math.ceil((r.soldPerDay || 0) * 14 - (r.stock || 0)));
          return {
            productId: r.productId,
            name: r.name,
            stock: r.stock || 0,
            soldPerDay: r.soldPerDay || 0,
            recommend,
            cost: recommend * (priceOf.get(r.productId) || 0),
          };
        })
        .filter((r: any) => r.recommend > 0)
        .sort((a: any, b: any) => b.cost - a.cost);
      setAdvisorRows(rows);
    } catch (e) {
      console.error('Advisor load failed:', e);
      setAdvisorRows([]);
    } finally {
      setAdvisorLoading(false);
    }
  };

  const advisorTotal = useMemo(() => advisorRows.reduce((s, r) => s + r.cost, 0), [advisorRows]);

  const shareAdvisorPlan = () => {
    const lines = [
      `🤖 ${t.advisorTitle} — Axentis Business`,
      '────────────────',
      ...advisorRows.map(
        (r) => `${r.name}: ${t.recommended} ${fmt(r.recommend)} ${t.pcs} (~${fmt(r.cost)} ${t.sum})`
      ),
      '────────────────',
      `${t.estimatedCost}: ${fmt(advisorTotal)} ${t.sum}`,
    ];
    Share.share({ message: lines.join('\n') }).catch(() => {});
  };

  // 🚚 Группировка плана закупки по поставщикам (автозаказ)
  const advisorGroups = useMemo(() => {
    const groups = new Map<number | 0, typeof advisorRows>();
    for (const r of advisorRows) {
      const sid = supplierOf.get(r.productId) || 0;
      if (!groups.has(sid)) groups.set(sid, []);
      groups.get(sid)!.push(r);
    }
    return Array.from(groups.entries())
      .map(([sid, rows]) => ({
        supplier: sid === 0 ? null : suppliersList.find((s) => s.id === sid) || null,
        rows,
        total: rows.reduce((s, r) => s + r.cost, 0),
      }))
      .sort((a, b) => (a.supplier ? 0 : 1) - (b.supplier ? 0 : 1) || b.total - a.total);
  }, [advisorRows, supplierOf, suppliersList]);

  // Отправка заказа поставщику: текст плана; если указан Telegram — сразу в чат
  const sendSupplierOrder = (group: (typeof advisorGroups)[number]) => {
    haptic.medium();
    const lines = [
      `📦 ${t.orderText}${group.supplier ? ` — ${group.supplier.name}` : ''}`,
      '────────────────',
      ...group.rows.map((r) => `• ${r.name} — ${fmt(r.recommend)} ${t.pcs}`),
      '────────────────',
      `${t.total}: ~${fmt(group.total)} ${t.sum}`,
    ];
    const text = lines.join('\n');
    if (group.supplier?.telegram) {
      const url = `https://t.me/${group.supplier.telegram}?text=${encodeURIComponent(text)}`;
      Linking.openURL(url).catch(() => Share.share({ message: text }).catch(() => {}));
    } else {
      Share.share({ message: text }).catch(() => {});
    }
  };

  // ── Массовые действия ──────────────────────────────────────────────────────
  const toggleSelect = (id: number) => {
    haptic.light();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkAvailability = async (available: boolean) => {
    setBulkBusy(true);
    try {
      await api.products.bulkToggleAvailability(Array.from(selected), available);
      haptic.success();
      setSelected(new Set());
      load();
    } catch (e) {
      Alert.alert(t.error, e instanceof Error ? e.message : String(e));
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkDelete = () => {
    Alert.alert(t.delete, t.bulkDeleteConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: async () => {
          setBulkBusy(true);
          try {
            await Promise.all(Array.from(selected).map((id) => api.products.delete(id)));
            haptic.success();
            setSelected(new Set());
            load();
          } catch (e) {
            Alert.alert(t.error, e instanceof Error ? e.message : String(e));
          } finally {
            setBulkBusy(false);
          }
        },
      },
    ]);
  };

  const bulkDiscount = async () => {
    const percent = parseFloat(discountPercent);
    if (!percent || percent <= 0 || percent >= 100) {
      Alert.alert(t.error, t.discountPercent);
      return;
    }
    setBulkBusy(true);
    try {
      await Promise.all(
        Array.from(selected).map((productId) =>
          api.discounts.create({ companyId, productId, discountPercent: percent })
        )
      );
      haptic.success();
      setDiscountOpen(false);
      setDiscountPercent('');
      setSelected(new Set());
      Alert.alert('✅', t.discountCreated);
    } catch (e) {
      haptic.error();
      Alert.alert(t.error, e instanceof Error ? e.message : String(e));
    } finally {
      setBulkBusy(false);
    }
  };

  // ── Форма товара (общая для создания/редактирования) ───────────────────────
  const renderProductForm = (
    form: EditForm,
    setForm: (f: EditForm) => void,
    isCreate: boolean
  ) => (
    <>
      <Input label={t.productName} value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Input
            label={t.purchasePrice}
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
      {/* Цена продажи — считается автоматически */}
      <Text style={{ color: theme.text3, fontSize: 12.5, marginTop: -6, marginBottom: 10 }}>
        {t.sellingPrice}:{' '}
        <Text style={{ color: theme.success, fontWeight: '700' }}>
          {fmt(priceWithMarkup(parseFloat(form.price) || 0, parseFloat(form.markupPercent) || 0))} {t.sum}
        </Text>
      </Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          {isCreate ? (
            <Input
              label={t.quantity}
              value={form.quantity}
              onChangeText={(v) => setForm({ ...form, quantity: v.replace(/\D/g, '') })}
              keyboardType="number-pad"
            />
          ) : (
            <View style={{ marginBottom: SP.md }}>
              <Text style={{ color: theme.text2, fontSize: 13, fontWeight: '500', marginBottom: 6 }}>
                {t.quantity}
              </Text>
              {/* ⚠️ Как в вебе: остаток меняется только через «Закупку» */}
              <View
                style={{
                  backgroundColor: theme.input,
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: R.md,
                  paddingHorizontal: 14,
                  paddingVertical: 11,
                }}
              >
                <Text style={{ color: theme.text3, fontSize: 15 }}>{form.quantity} {t.pcs}</Text>
              </View>
              <Text style={{ color: theme.text3, fontSize: 11.5, marginTop: 4 }}>{t.quantityHint}</Text>
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Input label={t.barcode} value={form.barcode} onChangeText={(v) => setForm({ ...form, barcode: v })} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Input label={t.category} value={form.category} onChangeText={(v) => setForm({ ...form, category: v })} />
        </View>
        <View style={{ flex: 1 }}>
          <Input label={t.brand} value={form.brand} onChangeText={(v) => setForm({ ...form, brand: v })} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Input label={t.color} value={form.color} onChangeText={(v) => setForm({ ...form, color: v })} />
        </View>
        <View style={{ flex: 1 }}>
          <Input label={t.size} value={form.size} onChangeText={(v) => setForm({ ...form, size: v })} />
        </View>
      </View>
      <Input label={t.barid} value={form.barid} onChangeText={(v) => setForm({ ...form, barid: v })} />
      <Input
        label={t.description}
        value={form.description}
        onChangeText={(v) => setForm({ ...form, description: v })}
        multiline
        numberOfLines={3}
        style={{ minHeight: 70, textAlignVertical: 'top' }}
      />
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}
      >
        <Text style={{ color: theme.text, fontSize: 14.5 }}>{t.availableForCustomers}</Text>
        <Switch
          value={form.available}
          onValueChange={(v) => setForm({ ...form, available: v })}
          trackColor={{ true: theme.primary, false: theme.border }}
          thumbColor="#fff"
        />
      </View>
    </>
  );

  const selectionActive = selected.size > 0;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: SP.lg - 2, paddingTop: SP.md }}>
        <Segmented
          options={[
            { key: 'inventory', label: t.warehouse, icon: 'cube-outline' },
            { key: 'sales', label: t.sales, icon: 'storefront-outline' },
          ]}
          value={view}
          onChange={setView}
        />
      </View>

      {view === 'sales' ? (
        <SalesScreen companyId={companyId} />
      ) : loading ? (
        <Loading />
      ) : (
        <>
          <FlatList
            data={filtered}
            keyExtractor={(p) => String(p.id)}
            contentContainerStyle={{ padding: SP.lg - 2, paddingBottom: selectionActive ? 110 : 90, gap: 8 }}
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
                {/* Статистика склада */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <StatCard label={t.totalProducts} value={fmt(stats.totalProducts)} icon="albums-outline" />
                  <StatCard label={t.totalQuantity} value={fmt(stats.totalQuantity)} icon="cube-outline" />
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <StatCard
                    label={t.totalValue}
                    value={fmtShort(stats.totalValue, lang)}
                    hint={t.sum}
                    icon="cash-outline"
                    color={theme.success}
                  />
                  <StatCard label={t.categoriesCount} value={fmt(stats.categories)} icon="pricetags-outline" />
                </View>

                {/* 🤖 Кнопка умного плана закупки */}
                <Pressable onPress={openAdvisor}>
                  <LinearGradient
                    colors={[...MKT_GRAD]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      borderRadius: R.lg,
                      padding: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 13,
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="sparkles" size={18} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#fff', fontSize: 14.5, fontWeight: '700' }}>{t.advisor}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>{t.advisorHint}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.8)" />
                  </LinearGradient>
                </Pressable>

                {/* 📦 Кнопка инвентаризации */}
                <Pressable
                  onPress={() => {
                    haptic.medium();
                    setInventoryOpen(true);
                  }}
                >
                  <LinearGradient
                    colors={[...OPS_GRAD]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ borderRadius: R.lg, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                  >
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 13,
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="scan" size={18} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#fff', fontSize: 14.5, fontWeight: '700' }}>{t.inventory}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>{t.inventoryHint}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.8)" />
                  </LinearGradient>
                </Pressable>

                <SearchBar value={search} onChangeText={setSearch} placeholder={t.searchProducts} />

                {/* Категории + «залежавшиеся» */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  <Chip label={t.allCategories} active={category === 'all'} onPress={() => setCategory('all')} />
                  {staleCount > 0 && (
                    <Chip
                      label={`🐌 ${t.stale} (${staleCount})`}
                      active={staleOnly}
                      onPress={() => setStaleOnly(!staleOnly)}
                      color={theme.warning}
                    />
                  )}
                  {categories.map((c) => (
                    <Chip key={c} label={c} active={category === c} onPress={() => setCategory(category === c ? 'all' : c)} />
                  ))}
                </ScrollView>
              </View>
            }
            ListEmptyComponent={<EmptyState text={t.noProducts} icon="cube-outline" />}
            renderItem={({ item: p }) => {
              const img = getImageUrl(Array.isArray(p.images) ? p.images[0] : null);
              const isSelected = selected.has(p.id);
              const available = p.availableForCustomers !== false;
              return (
                <Card
                  onPress={() => (selectionActive ? toggleSelect(p.id) : openDetail(p))}
                  onLongPress={() => toggleSelect(p.id)}
                  style={{
                    flexDirection: 'row',
                    gap: 12,
                    padding: 10,
                    borderColor: isSelected ? theme.primary : theme.border,
                    borderWidth: isSelected ? 2 : 1,
                  }}
                >
                  {/* Фото */}
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 12,
                      backgroundColor: theme.input,
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {img ? (
                      <Image source={{ uri: img }} style={{ width: 64, height: 64 }} resizeMode="cover" />
                    ) : (
                      <Ionicons name="cube-outline" size={24} color={theme.text3} />
                    )}
                    {isSelected && (
                      <View
                        style={{
                          position: 'absolute',
                          inset: 0 as any,
                          backgroundColor: 'rgba(124,92,240,0.45)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons name="checkmark-circle" size={26} color="#fff" />
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14.5 }} numberOfLines={2}>
                      {p.name}
                    </Text>
                    <Text style={{ color: theme.success, fontWeight: '700', fontSize: 14, marginTop: 3 }}>
                      {fmt(priceWithMarkup(p.price || 0, p.markupPercent || 0))} {t.sum}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                      <Text style={{ color: (p.quantity || 0) > 0 ? theme.text3 : theme.danger, fontSize: 12.5 }}>
                        {fmt(p.quantity)} {t.inStock}
                      </Text>
                      <Badge
                        text={available ? t.onSale : t.notOnSale}
                        color={available ? theme.success : theme.text3}
                      />
                      {isStale(p) && <Badge text="🐌" color={theme.warning} />}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={17} color={theme.text3} style={{ alignSelf: 'center' }} />
                </Card>
              );
            }}
          />

          {/* FAB: добавить товар */}
          {!selectionActive && (
            <Pressable
              onPress={() => {
                haptic.medium();
                setCreateForm(emptyEdit);
                setCreateOpen(true);
              }}
              style={({ pressed }) => ({
                position: 'absolute',
                right: 18,
                bottom: 20,
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: theme.primary,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.85 : 1,
                shadowColor: theme.primary,
                shadowOpacity: 0.45,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
                elevation: 8,
              })}
            >
              <Ionicons name="add" size={30} color="#fff" />
            </Pressable>
          )}

          {/* Панель массовых действий */}
          {selectionActive && (
            <View
              style={{
                position: 'absolute',
                left: 10,
                right: 10,
                bottom: 12,
                backgroundColor: theme.sidebar,
                borderRadius: R.lg,
                borderWidth: 1,
                borderColor: theme.border,
                padding: 10,
                gap: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14 }}>
                  {t.selectionMode}: {selected.size}
                </Text>
                <View style={{ flexDirection: 'row', gap: 14 }}>
                  <Pressable onPress={() => setSelected(new Set(filtered.map((p) => p.id)))}>
                    <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '600' }}>{t.selectAll}</Text>
                  </Pressable>
                  <Pressable onPress={() => setSelected(new Set())}>
                    <Text style={{ color: theme.text2, fontSize: 13, fontWeight: '600' }}>{t.deselectAll}</Text>
                  </Pressable>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button title={t.bulkOnSale} onPress={() => bulkAvailability(true)} small loading={bulkBusy} variant="success" style={{ flex: 1 }} />
                <Button title={t.bulkOffSale} onPress={() => bulkAvailability(false)} small disabled={bulkBusy} variant="warning" style={{ flex: 1 }} />
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button title={t.bulkDiscount} onPress={() => setDiscountOpen(true)} small disabled={bulkBusy} variant="ghost" style={{ flex: 1 }} />
                <Button title={t.bulkDelete} onPress={bulkDelete} small disabled={bulkBusy} variant="danger" style={{ flex: 1 }} />
              </View>
            </View>
          )}
        </>
      )}

      {/* ── Детальная карточка товара ── */}
      <Sheet visible={detail !== null} onClose={() => setDetail(null)} title={t.editProduct}>
        {detail && (
          <>
            {/* Фото */}
            <SectionTitle text={t.photos} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 14 }}>
              {(detail.images || []).map((img) => {
                const uri = getImageUrl(img);
                return (
                  <Pressable key={img} onLongPress={() => deletePhoto(img)}>
                    <Image
                      source={{ uri: uri || undefined }}
                      style={{ width: 84, height: 84, borderRadius: 12, backgroundColor: theme.input }}
                    />
                  </Pressable>
                );
              })}
              <Pressable
                onPress={addPhotos}
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderStyle: 'dashed',
                  borderColor: theme.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                }}
              >
                <Ionicons name="camera-outline" size={22} color={theme.primary} />
                <Text style={{ color: theme.primary, fontSize: 10.5, fontWeight: '600' }}>{t.addPhoto}</Text>
              </Pressable>
            </ScrollView>

            {renderProductForm(editForm, setEditForm, false)}

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <Button title={t.save} onPress={saveDetail} loading={saving} style={{ flex: 1 }} icon="checkmark" />
              <Button
                title={t.purchase}
                onPress={() => {
                  setPurchaseVariant(null);
                  setPurchaseQty('');
                  setPurchasePrice(String(detail.price || ''));
                  setPurchaseOpen(true);
                }}
                variant="success"
                icon="download-outline"
                style={{ flex: 1 }}
              />
            </View>
            {/* 🏷 Ценник с QR-кодом */}
            <Button
              title={t.priceTag}
              onPress={() => setPriceTagFor(detail)}
              variant="ghost"
              icon="pricetag-outline"
              style={{ marginBottom: 18 }}
            />

            {/* 🚚 Поставщик товара — для автозаказа */}
            {suppliersList.length > 0 && (
              <>
                <SectionTitle text={t.supplierFor} accent={theme.success} />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
                  {suppliersList.map((s) => {
                    const active = supplierOf.get(detail.id) === s.id;
                    return (
                      <Chip
                        key={s.id}
                        label={s.name}
                        active={active}
                        onPress={() => assignSupplier(detail.id, active ? null : s.id)}
                        color={theme.success}
                      />
                    );
                  })}
                </View>
              </>
            )}

            {/* Варианты */}
            <SectionTitle text={t.variants} accent={theme.mktAccent} />
            {variantsLoading ? (
              <Loading />
            ) : variants.length === 0 ? (
              <Text style={{ color: theme.text3, fontSize: 13, marginBottom: 10 }}>{t.noVariants}</Text>
            ) : (
              <View style={{ gap: 8, marginBottom: 10 }}>
                {variants.map((v) => (
                  <Card key={v.id} style={{ padding: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.text, fontWeight: '600', fontSize: 13.5 }}>
                          {[v.color, v.size].filter(Boolean).join(' · ') || `SKU #${v.id}`}
                        </Text>
                        <Text style={{ color: theme.text3, fontSize: 12, marginTop: 2 }}>
                          {fmt(priceWithMarkup(v.price || 0, v.markupPercent || 0))} {t.sum} · {fmt(v.stockQuantity)} {t.pcs}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <Pressable
                          onPress={() => {
                            setPurchaseVariant(v);
                            setPurchaseQty('');
                            setPurchasePrice(String(v.price || ''));
                            setPurchaseOpen(true);
                          }}
                          hitSlop={6}
                        >
                          <Ionicons name="download-outline" size={19} color={theme.success} />
                        </Pressable>
                        <Pressable onPress={() => openVariantForm(v)} hitSlop={6}>
                          <Ionicons name="pencil-outline" size={19} color={theme.primary} />
                        </Pressable>
                        <Pressable onPress={() => deleteVariant(v)} hitSlop={6}>
                          <Ionicons name="trash-outline" size={19} color={theme.danger} />
                        </Pressable>
                      </View>
                    </View>
                  </Card>
                ))}
              </View>
            )}
            <Button title={t.addVariant} onPress={() => openVariantForm(null)} variant="ghost" icon="add" small />

            <View style={{ height: 18 }} />
            <Button title={t.delete} onPress={() => deleteProduct(detail)} variant="danger" icon="trash-outline" />
          </>
        )}
      </Sheet>

      {/* ── Создание товара ── */}
      <Sheet visible={createOpen} onClose={() => setCreateOpen(false)} title={t.addProduct}>
        {renderProductForm(createForm, setCreateForm, true)}
        <Button title={t.save} onPress={submitCreate} loading={saving} icon="checkmark" />
      </Sheet>

      {/* ── Закупка ── */}
      <Sheet
        visible={purchaseOpen}
        onClose={() => setPurchaseOpen(false)}
        title={purchaseVariant ? `${t.purchaseTitle} · ${[purchaseVariant.color, purchaseVariant.size].filter(Boolean).join(' ')}` : t.purchaseTitle}
      >
        <Text style={{ color: theme.text3, fontSize: 13, marginBottom: 14 }}>{t.purchaseHint}</Text>
        <Input
          label={t.purchaseQty}
          value={purchaseQty}
          onChangeText={(v) => setPurchaseQty(v.replace(/\D/g, ''))}
          keyboardType="number-pad"
          placeholder="10"
        />
        <Input
          label={`${t.purchasePrice}, ${t.sum}`}
          value={purchasePrice}
          onChangeText={(v) => setPurchasePrice(v.replace(/[^0-9.]/g, ''))}
          keyboardType="numeric"
          placeholder="50000"
        />
        {!!purchaseQty && !!purchasePrice && (
          <>
            <Text style={{ color: theme.text2, fontSize: 13.5, marginBottom: 12 }}>
              {t.total}:{' '}
              <Text style={{ color: theme.success, fontWeight: '700' }}>
                {fmt((parseFloat(purchaseQty) || 0) * (parseFloat(purchasePrice) || 0))} {t.sum}
              </Text>
            </Text>
            {/* 🧮 Калькулятор наценки: сколько заработаете с партии при разных % */}
            <Card style={{ marginBottom: 14, padding: 12 }}>
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13, marginBottom: 2 }}>
                🧮 {t.calcTitle}
              </Text>
              <Text style={{ color: theme.text3, fontSize: 11.5, marginBottom: 8 }}>{t.calcHint}</Text>
              {[10, 20, 30, 50].map((m) => {
                const qty = parseFloat(purchaseQty) || 0;
                const price = parseFloat(purchasePrice) || 0;
                const sell = Math.round(price * (1 + m / 100));
                const profit = Math.round((sell - price) * qty);
                return (
                  <View key={m} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
                    <Text style={{ color: theme.primary, fontSize: 12.5, fontWeight: '700', width: 44 }}>
                      +{m}%
                    </Text>
                    <Text style={{ color: theme.text2, fontSize: 12.5, flex: 1 }}>
                      {t.calcSellAt}: {fmt(sell)}
                    </Text>
                    <Text style={{ color: theme.success, fontSize: 12.5, fontWeight: '700' }}>
                      {t.calcProfit}: {fmt(profit)}
                    </Text>
                  </View>
                );
              })}
            </Card>
          </>
        )}
        <Button title={t.purchase} onPress={submitPurchase} loading={saving} variant="success" icon="download-outline" />
      </Sheet>

      {/* ── Вариант: создание/редактирование ── */}
      <Sheet
        visible={variantFormOpen}
        onClose={() => setVariantFormOpen(false)}
        title={editingVariant ? `${t.edit} · SKU` : t.addVariant}
      >
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Input label={t.color} value={variantForm.color} onChangeText={(v) => setVariantForm({ ...variantForm, color: v })} />
          </View>
          <View style={{ flex: 1 }}>
            <Input label={t.size} value={variantForm.size} onChangeText={(v) => setVariantForm({ ...variantForm, size: v })} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Input
              label={t.purchasePrice}
              value={variantForm.price}
              onChangeText={(v) => setVariantForm({ ...variantForm, price: v.replace(/[^0-9.]/g, '') })}
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label={t.markupPercent}
              value={variantForm.markupPercent}
              onChangeText={(v) => setVariantForm({ ...variantForm, markupPercent: v.replace(/[^0-9.]/g, '') })}
              keyboardType="numeric"
            />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Input
              label={t.quantity}
              value={variantForm.stockQuantity}
              onChangeText={(v) => setVariantForm({ ...variantForm, stockQuantity: v.replace(/\D/g, '') })}
              keyboardType="number-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input label={t.barcode} value={variantForm.barcode} onChangeText={(v) => setVariantForm({ ...variantForm, barcode: v })} />
          </View>
        </View>
        <Button title={t.save} onPress={submitVariant} loading={saving} icon="checkmark" />
      </Sheet>

      {/* ── 🤖 Умный план закупки ── */}
      <Sheet visible={advisorOpen} onClose={() => setAdvisorOpen(false)} title={t.advisorTitle}>
        <Text style={{ color: theme.text3, fontSize: 13, marginBottom: 14 }}>{t.advisorHint}</Text>
        {advisorLoading ? (
          <Loading />
        ) : advisorRows.length === 0 ? (
          <Text style={{ color: theme.success, fontSize: 14.5, fontWeight: '600', paddingVertical: 20, textAlign: 'center' }}>
            {t.advisorEmpty}
          </Text>
        ) : (
          <>
            <Card style={{ marginBottom: 12 }}>
              <Text style={{ color: theme.text2, fontSize: 12.5, marginBottom: 4 }}>{t.estimatedCost}</Text>
              <Text style={{ color: theme.warning, fontSize: 21, fontWeight: '800' }}>
                {fmt(advisorTotal)} {t.sum}
              </Text>
              <Text style={{ color: theme.text3, fontSize: 12, marginTop: 2 }}>
                {advisorRows.length} {t.pcs} · {t.advisorFor14Days}
              </Text>
            </Card>
            {/* Группы по поставщикам — «автозаказ» */}
            <View style={{ gap: 14, marginBottom: 14 }}>
              {advisorGroups.map((group, gi) => (
                <View key={group.supplier?.id ?? `none-${gi}`}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Ionicons
                      name={group.supplier ? 'cube' : 'help-circle-outline'}
                      size={15}
                      color={group.supplier ? theme.success : theme.text3}
                    />
                    <Text style={{ color: theme.text, fontSize: 13.5, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                      {group.supplier ? group.supplier.name : t.withoutSupplier}
                    </Text>
                    <Text style={{ color: theme.text3, fontSize: 12 }}>~{fmt(group.total)} {t.sum}</Text>
                  </View>
                  <View style={{ gap: 8 }}>
                    {group.rows.map((r) => (
                      <Card key={r.productId} style={{ padding: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={{ flex: 1, marginRight: 10 }}>
                            <Text style={{ color: theme.text, fontSize: 13.5, fontWeight: '600' }} numberOfLines={1}>
                              {r.name}
                            </Text>
                            <Text style={{ color: theme.text3, fontSize: 12, marginTop: 2 }}>
                              {t.stockLeft}: {fmt(r.stock)} · {r.soldPerDay.toFixed(1)} {t.perDay}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ color: theme.primary, fontSize: 15, fontWeight: '800' }}>
                              +{fmt(r.recommend)} {t.pcs}
                            </Text>
                            {r.cost > 0 && (
                              <Text style={{ color: theme.text3, fontSize: 11.5 }}>~{fmt(r.cost)} {t.sum}</Text>
                            )}
                          </View>
                        </View>
                      </Card>
                    ))}
                  </View>
                  <Button
                    title={`${t.sendOrder}${group.supplier?.telegram ? ' · Telegram' : ''}`}
                    onPress={() => sendSupplierOrder(group)}
                    small
                    variant="success"
                    icon="paper-plane-outline"
                    style={{ marginTop: 8 }}
                  />
                </View>
              ))}
            </View>
            <Button title={t.sharePlan} onPress={shareAdvisorPlan} icon="share-social-outline" variant="ghost" />
          </>
        )}
      </Sheet>

      {/* ── Массовая скидка ── */}
      <Sheet visible={discountOpen} onClose={() => setDiscountOpen(false)} title={t.bulkDiscountTitle}>
        <Text style={{ color: theme.text3, fontSize: 13, marginBottom: 14 }}>{t.bulkDiscountHint}</Text>
        <Input
          label={t.discountPercent}
          value={discountPercent}
          onChangeText={(v) => setDiscountPercent(v.replace(/[^0-9.]/g, ''))}
          keyboardType="numeric"
          placeholder="10"
        />
        <Button title={`${t.bulkDiscount} (${selected.size})`} onPress={bulkDiscount} loading={bulkBusy} icon="pricetag-outline" />
      </Sheet>

      {/* ── 🏷 Ценник товара (изображение для печати/отправки) ── */}
      <Sheet visible={priceTagFor !== null} onClose={() => setPriceTagFor(null)} title={t.priceTag}>
        {priceTagFor && (
          <>
            <ViewShot
              ref={tagShotRef}
              options={{ format: 'png', quality: 1 }}
              style={{ backgroundColor: '#FFFFFF', borderRadius: 14, padding: 20, marginBottom: 6 }}
            >
              <Text style={{ color: '#0F172A', fontSize: 17, fontWeight: '700' }} numberOfLines={2}>
                {priceTagFor.name}
              </Text>
              {!!priceTagFor.brand && (
                <Text style={{ color: '#64748B', fontSize: 12.5, marginTop: 2 }}>{priceTagFor.brand}</Text>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#0F172A', fontSize: 30, fontWeight: '900' }}>
                    {fmt(priceWithMarkup(priceTagFor.price || 0, priceTagFor.markupPercent || 0))}
                  </Text>
                  <Text style={{ color: '#64748B', fontSize: 13, fontWeight: '600' }}>{t.sum}</Text>
                  {!!priceTagFor.barcode && (
                    <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 10, letterSpacing: 2, fontVariant: ['tabular-nums'] }}>
                      {priceTagFor.barcode}
                    </Text>
                  )}
                </View>
                <QRCode value={`https://axentis.uz/product/${priceTagFor.id}`} size={92} backgroundColor="#FFFFFF" color="#0F172A" />
              </View>
              <Text style={{ color: '#94A3B8', fontSize: 10.5, marginTop: 12 }}>axentis.uz · Axentis Market</Text>
            </ViewShot>
            <Text style={{ color: theme.text3, fontSize: 12, marginBottom: 14 }}>💡 {t.priceTagHint}</Text>
            <Button
              title={t.priceTagShare}
              onPress={async () => {
                try {
                  const uri = await tagShotRef.current?.capture?.();
                  if (uri) await Sharing.shareAsync(uri.startsWith('file://') ? uri : `file://${uri}`);
                } catch (e) {
                  Alert.alert(t.error, e instanceof Error ? e.message : String(e));
                }
              }}
              icon="share-social-outline"
            />
          </>
        )}
      </Sheet>

      {/* ── 📦 Инвентаризация ── */}
      <InventoryScreen
        companyId={companyId}
        visible={inventoryOpen}
        onClose={() => setInventoryOpen(false)}
        onApplied={load}
      />
    </View>
  );
}
