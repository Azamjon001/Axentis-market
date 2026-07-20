import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api, { CashSaleItem } from '../api';
import { getPendingSales, submitCashSale, syncPendingSales } from '../offline';
import { useI18n } from '../i18n';
import { R, SP, useTheme } from '../theme';
import { Button, Chip, fmt, fmtDate, haptic, Segmented, Stepper } from '../ui';

// ============================================================================
// 📷 Касса-сканер — телефон как POS-терминал (принцип BarcodeSearchPanel).
//
// Наводим камеру на штрих-код → товар найден → корзина → оплата наличными
// или картой → /cash-sales. Работает и без интернета: продажи копятся в
// локальной очереди и досылаются автоматически (src/offline.ts), а карточки
// товаров берутся из офлайн-кэша последней загрузки.
// ============================================================================

interface Product {
  id: number;
  name: string;
  price: number;
  markupPercent?: number;
  quantity: number;
  barcode?: string;
  barid?: string;
}

interface CartLine {
  product: Product;
  qty: number;
  sellPrice: number; // цена продажи (с наценкой или из варианта)
  variantId?: number;
}

const CACHE_KEY = (companyId: number) => `axentis_products_cache_${companyId}`;

export default function ScannerScreen({
  companyId,
  visible,
  onClose,
}: {
  companyId: number;
  visible: boolean;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [manualCode, setManualCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [cardSubtype, setCardSubtype] = useState<'uzcard' | 'humo' | 'visa' | 'other'>('uzcard');
  const [selling, setSelling] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [flash, setFlash] = useState<string | null>(null); // подсветка найденного товара

  const lastScanRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });

  // 📦 Товары: сеть → кэш; кэш обновляется при каждом удачном ответе,
  // чтобы касса работала офлайн со «вчерашним» каталогом.
  const loadProducts = useCallback(async () => {
    try {
      const data = await api.products.list({ companyId: String(companyId), limit: 2000 });
      const list: Product[] = (Array.isArray(data) ? data : data?.products || []).filter(
        (p: any) => !p.name?.startsWith('__CATEGORY_MARKER__')
      );
      setProducts(list);
      AsyncStorage.setItem(CACHE_KEY(companyId), JSON.stringify(list)).catch(() => {});
    } catch {
      try {
        const raw = await AsyncStorage.getItem(CACHE_KEY(companyId));
        if (raw) setProducts(JSON.parse(raw));
      } catch {
        /* ни сети, ни кэша */
      }
    }
  }, [companyId]);

  const refreshPending = useCallback(async () => {
    setPendingCount((await getPendingSales()).length);
  }, []);

  useEffect(() => {
    if (!visible) return;
    loadProducts();
    refreshPending();
    // При открытии кассы пробуем дослать отложенные продажи
    syncPendingSales().then((n) => {
      if (n > 0) refreshPending();
    });
  }, [visible, loadProducts, refreshPending]);

  const sellPriceOf = (p: Product) => Math.round((p.price || 0) * (1 + (p.markupPercent || 0) / 100));

  const addToCart = useCallback(
    (product: Product, sellPrice: number, variantId?: number) => {
      haptic.success();
      setFlash(product.name);
      setTimeout(() => setFlash(null), 1200);
      setCart((prev) => {
        const idx = prev.findIndex((l) => l.product.id === product.id && l.variantId === variantId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
          return next;
        }
        return [...prev, { product, qty: 1, sellPrice, variantId }];
      });
    },
    []
  );

  // Поиск: сначала локально (работает офлайн), потом /find-by-barcode (варианты)
  const findByCode = useCallback(
    async (code: string) => {
      const q = code.trim().toLowerCase();
      if (!q) return;
      const local = products.find(
        (p) => p.barcode?.toLowerCase() === q || p.barid?.toLowerCase() === q
      );
      if (local) {
        addToCart(local, sellPriceOf(local));
        return;
      }
      try {
        const res = await api.products.findByBarcode(companyId, q);
        if (res?.found && res.productId) {
          const product = products.find((p) => p.id === res.productId);
          if (product) {
            const price = res.variantSellingPrice
              ? Math.round(res.variantSellingPrice)
              : sellPriceOf(product);
            addToCart(product, price, res.variantId);
            return;
          }
        }
        haptic.error();
        Alert.alert('❌', `${t.productNotFound}: ${code}`);
      } catch {
        haptic.error();
        Alert.alert('❌', `${t.productNotFound}: ${code}`);
      }
    },
    [products, companyId, addToCart, t]
  );

  const onBarcodeScanned = ({ data }: { data: string }) => {
    const now = Date.now();
    // Дебаунс: один и тот же код не чаще раза в 2 секунды
    if (lastScanRef.current.code === data && now - lastScanRef.current.at < 2000) return;
    lastScanRef.current = { code: data, at: now };
    findByCode(data);
  };

  const total = useMemo(() => cart.reduce((s, l) => s + l.qty * l.sellPrice, 0), [cart]);

  const setQty = (idx: number, qty: number) => {
    setCart((prev) => {
      const next = [...prev];
      if (qty <= 0) next.splice(idx, 1);
      else next[idx] = { ...next[idx], qty };
      return next;
    });
  };

  const buildReceipt = () => {
    const lines = [
      `🧾 ${t.receipt} — Axentis Business`,
      fmtDate(new Date().toISOString()),
      '────────────────',
      ...cart.map(
        (l) => `${l.product.name} ×${l.qty} = ${fmt(l.qty * l.sellPrice)} ${t.sum}`
      ),
      '────────────────',
      `${t.total}: ${fmt(total)} ${t.sum}`,
      paymentMethod === 'cash' ? `💵 ${t.paymentCash}` : `💳 ${t.paymentCard} (${cardSubtype})`,
    ];
    return lines.join('\n');
  };

  const sell = async () => {
    if (cart.length === 0) return;
    setSelling(true);
    const receipt = buildReceipt();
    try {
      const items: CashSaleItem[] = cart.map((l) => ({
        id: l.product.id,
        product_id: l.product.id,
        variant_id: l.variantId,
        name: l.product.name,
        productName: l.product.name,
        quantity: l.qty,
        price: l.product.price || 0,
        price_with_markup: l.sellPrice,
      }));
      const result = await submitCashSale({
        companyId,
        paymentMethod,
        cardSubtype: paymentMethod === 'card' ? cardSubtype : undefined,
        items,
      });
      haptic.success();
      setCart([]);
      refreshPending();
      if (result === 'sent') loadProducts(); // обновляем остатки
      Alert.alert(
        result === 'sent' ? `✅ ${t.saleDone}` : `📴 ${t.saleQueued}`,
        `${t.total}: ${fmt(total)} ${t.sum}`,
        [
          { text: t.shareReceipt, onPress: () => Share.share({ message: receipt }).catch(() => {}) },
          { text: 'OK' },
        ]
      );
    } catch (e) {
      haptic.error();
      Alert.alert(t.error, e instanceof Error ? e.message : String(e));
    } finally {
      setSelling(false);
    }
  };

  const syncNow = async () => {
    const n = await syncPendingSales();
    refreshPending();
    if (n > 0) {
      haptic.success();
      Alert.alert('✅', `${t.synced} (${n})`);
      loadProducts();
    }
  };

  const cameraGranted = permission?.granted;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {/* ── Камера ── */}
        <View style={{ height: 300 + insets.top, backgroundColor: '#000' }}>
          {cameraGranted ? (
            <CameraView
              style={{ flex: 1 }}
              enableTorch={torch}
              barcodeScannerSettings={{
                barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'itf14', 'qr'],
              }}
              onBarcodeScanned={onBarcodeScanned}
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 }}>
              <Ionicons name="videocam-off-outline" size={40} color="#8B8BAA" />
              <Text style={{ color: '#8B8BAA', fontSize: 14, textAlign: 'center' }}>{t.cameraDenied}</Text>
              <Button title={t.grantCamera} onPress={() => requestPermission()} small icon="videocam-outline" />
            </View>
          )}

          {/* Рамка прицела */}
          {cameraGranted && (
            <View pointerEvents="none" style={{ position: 'absolute', inset: 0 as any, alignItems: 'center', justifyContent: 'center' }}>
              <View
                style={{
                  width: 230,
                  height: 120,
                  borderWidth: 2.5,
                  borderColor: flash ? '#22C55E' : 'rgba(255,255,255,0.85)',
                  borderRadius: 18,
                }}
              />
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12.5, marginTop: 12 }}>
                {flash ? `✅ ${flash}` : t.scanHint}
              </Text>
            </View>
          )}

          {/* Верхние кнопки */}
          <View
            style={{
              position: 'absolute',
              top: insets.top + 8,
              left: 14,
              right: 14,
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}
          >
            <Pressable
              onPress={onClose}
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="close" size={21} color="#fff" />
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {pendingCount > 0 && (
                <Pressable
                  onPress={syncNow}
                  style={{
                    height: 38,
                    borderRadius: 19,
                    paddingHorizontal: 12,
                    backgroundColor: 'rgba(217,119,6,0.85)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 6,
                  }}
                >
                  <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 12.5, fontWeight: '700' }}>
                    {t.pendingSales}: {pendingCount}
                  </Text>
                </Pressable>
              )}
              {cameraGranted && (
                <Pressable
                  onPress={() => setTorch((v) => !v)}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    backgroundColor: torch ? '#FBBF24' : 'rgba(0,0,0,0.45)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name={torch ? 'flash' : 'flash-outline'} size={18} color="#fff" />
                </Pressable>
              )}
            </View>
          </View>
        </View>

        {/* ── Ручной ввод ── */}
        <View style={{ flexDirection: 'row', gap: 8, padding: SP.md, paddingBottom: 4 }}>
          <TextInput
            value={manualCode}
            onChangeText={setManualCode}
            placeholder={t.enterBarcode}
            placeholderTextColor={theme.text3}
            style={{
              flex: 1,
              backgroundColor: theme.input,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: R.md,
              paddingHorizontal: 14,
              paddingVertical: 9,
              color: theme.text,
              fontSize: 14.5,
            }}
            onSubmitEditing={() => {
              findByCode(manualCode);
              setManualCode('');
            }}
          />
          <Button
            title={t.find}
            onPress={() => {
              findByCode(manualCode);
              setManualCode('');
            }}
            small
            icon="search"
          />
        </View>

        {/* ── Корзина ── */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: SP.md, gap: 8 }}>
          {cart.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 28, gap: 8 }}>
              <Ionicons name="cart-outline" size={32} color={theme.text3} />
              <Text style={{ color: theme.text3, fontSize: 13.5 }}>{t.cartEmpty}</Text>
            </View>
          ) : (
            cart.map((line, idx) => {
              const overStock = line.qty > (line.product.quantity || 0);
              return (
                <View
                  key={`${line.product.id}_${line.variantId ?? 'p'}`}
                  style={{
                    backgroundColor: theme.card,
                    borderRadius: R.md,
                    borderWidth: 1,
                    borderColor: theme.border,
                    padding: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontSize: 13.5, fontWeight: '600' }} numberOfLines={1}>
                      {line.product.name}
                    </Text>
                    <Text style={{ color: theme.text3, fontSize: 12, marginTop: 2 }}>
                      {fmt(line.sellPrice)} {t.sum} · {t.inStock}: {fmt(line.product.quantity)}
                    </Text>
                    {overStock && (
                      <Text style={{ color: theme.warning, fontSize: 11.5, marginTop: 2 }}>
                        ⚠️ {t.notEnoughStock}
                      </Text>
                    )}
                  </View>
                  <Stepper value={line.qty} min={0} max={999} onChange={(v) => setQty(idx, v)} />
                  <Text style={{ color: theme.success, fontSize: 13.5, fontWeight: '700', minWidth: 70, textAlign: 'right' }}>
                    {fmt(line.qty * line.sellPrice)}
                  </Text>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* ── Оплата и итог ── */}
        <View
          style={{
            padding: SP.md,
            paddingBottom: Math.max(insets.bottom, 10) + 4,
            borderTopWidth: 1,
            borderTopColor: theme.border,
            backgroundColor: theme.sidebar,
            gap: 10,
          }}
        >
          <Segmented
            options={[
              { key: 'cash', label: `💵 ${t.paymentCash}`, icon: undefined },
              { key: 'card', label: `💳 ${t.paymentCard}`, icon: undefined },
            ]}
            value={paymentMethod}
            onChange={setPaymentMethod}
          />
          {paymentMethod === 'card' && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['uzcard', 'humo', 'visa', 'other'] as const).map((c) => (
                <Chip key={c} label={c.toUpperCase()} active={cardSubtype === c} onPress={() => setCardSubtype(c)} />
              ))}
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text3, fontSize: 12 }}>{t.total}</Text>
              <Text style={{ color: theme.text, fontSize: 21, fontWeight: '800' }}>
                {fmt(total)} {t.sum}
              </Text>
            </View>
            <Button
              title={t.sell}
              onPress={sell}
              loading={selling}
              disabled={cart.length === 0}
              variant="success"
              icon="checkmark-circle-outline"
              style={{ paddingHorizontal: 30 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
