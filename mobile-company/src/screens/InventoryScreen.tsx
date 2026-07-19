import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../api';
import { useI18n } from '../i18n';
import { R, SP, useTheme } from '../theme';
import { Badge, Button, fmt, fmtDate, haptic, Stepper } from '../ui';

// 📦 Инвентаризация сканером: проходим по складу и сканируем всё подряд —
// приложение сверяет фактические остатки с базой, показывает недостачу и
// излишек, формирует акт и (по желанию) применяет фактические остатки.
interface Product {
  id: number;
  name: string;
  quantity: number;
  price: number;
  barcode?: string;
  barid?: string;
}

export default function InventoryScreen({
  companyId,
  visible,
  onClose,
  onApplied,
}: {
  companyId: number;
  visible: boolean;
  onClose: () => void;
  onApplied?: () => void;
}) {
  const { theme } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  const [permission, requestPermission] = useCameraPermissions();
  const [products, setProducts] = useState<Product[]>([]);
  const [counts, setCounts] = useState<Record<number, number>>({}); // фактические остатки
  const [manualCode, setManualCode] = useState('');
  const [applying, setApplying] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });

  const load = useCallback(async () => {
    try {
      const data = await api.products.list({ companyId: String(companyId), limit: 2000 });
      const list: Product[] = (Array.isArray(data) ? data : data?.products || []).filter(
        (p: any) => !p.name?.startsWith('__CATEGORY_MARKER__')
      );
      setProducts(list);
    } catch (e) {
      console.error('Inventory products load failed:', e);
    }
  }, [companyId]);

  useEffect(() => {
    if (visible) {
      setCounts({});
      load();
    }
  }, [visible, load]);

  const bump = useCallback(
    (p: Product) => {
      haptic.success();
      setFlash(p.name);
      setTimeout(() => setFlash(null), 1000);
      setCounts((prev) => ({ ...prev, [p.id]: (prev[p.id] || 0) + 1 }));
    },
    []
  );

  const findByCode = useCallback(
    (code: string) => {
      const q = code.trim().toLowerCase();
      if (!q) return;
      const p = products.find(
        (x) => x.barcode?.toLowerCase() === q || x.barid?.toLowerCase() === q
      );
      if (p) bump(p);
      else {
        haptic.error();
        Alert.alert('❌', `${t.productNotFound}: ${code}`);
      }
    },
    [products, bump, t]
  );

  const onBarcodeScanned = ({ data }: { data: string }) => {
    const now = Date.now();
    // Дебаунс 1.2с — при инвентаризации один товар сканируют много раз подряд,
    // но нужно защититься от «дребезга» камеры на одном кадре
    if (lastScanRef.current.code === data && now - lastScanRef.current.at < 1200) return;
    lastScanRef.current = { code: data, at: now };
    findByCode(data);
  };

  const scannedRows = useMemo(
    () =>
      Object.entries(counts)
        .map(([id, actual]) => {
          const p = products.find((x) => x.id === Number(id));
          if (!p) return null;
          return { product: p, actual, expected: p.quantity || 0, diff: actual - (p.quantity || 0) };
        })
        .filter(Boolean) as { product: Product; actual: number; expected: number; diff: number }[],
    [counts, products]
  );

  const summary = useMemo(() => {
    const match = scannedRows.filter((r) => r.diff === 0).length;
    const shortage = scannedRows.filter((r) => r.diff < 0);
    const surplus = scannedRows.filter((r) => r.diff > 0);
    const shortageValue = shortage.reduce((s, r) => s + Math.abs(r.diff) * (r.product.price || 0), 0);
    return { match, shortage: shortage.length, surplus: surplus.length, shortageValue };
  }, [scannedRows]);

  const shareAct = () => {
    const lines = [
      `📦 ${t.shareAct} — Axentis Business`,
      fmtDate(new Date().toISOString()),
      '────────────────',
      ...scannedRows.map(
        (r) =>
          `${r.product.name}: ${t.inventoryExpected} ${r.expected}, ${t.inventoryActual} ${r.actual}` +
          (r.diff !== 0 ? ` (${r.diff > 0 ? '+' : ''}${r.diff})` : ' ✓')
      ),
      '────────────────',
      `${t.inventoryMatch}: ${summary.match} · ${t.inventoryShortage}: ${summary.shortage} · ${t.inventorySurplus}: ${summary.surplus}`,
      summary.shortageValue > 0 ? `${t.inventoryShortage}: ~${fmt(summary.shortageValue)} ${t.sum}` : '',
    ].filter(Boolean);
    Share.share({ message: lines.join('\n') }).catch(() => {});
  };

  // Применяем фактические остатки в базу (products.update quantity)
  const applyCorrections = () => {
    const changed = scannedRows.filter((r) => r.diff !== 0);
    if (changed.length === 0) return;
    Alert.alert(t.applyCorrections, t.applyCorrectionsConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.applyCorrections,
        onPress: async () => {
          setApplying(true);
          try {
            await Promise.all(
              changed.map((r) => api.products.update(r.product.id, { quantity: r.actual }))
            );
            haptic.success();
            Alert.alert('✅', t.correctionsApplied);
            onApplied?.();
            load();
          } catch (e) {
            haptic.error();
            Alert.alert(t.error, e instanceof Error ? e.message : String(e));
          } finally {
            setApplying(false);
          }
        },
      },
    ]);
  };

  const cameraGranted = permission?.granted;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {/* Камера */}
        <View style={{ height: 240 + insets.top, backgroundColor: '#000' }}>
          {cameraGranted ? (
            <CameraView
              style={{ flex: 1 }}
              barcodeScannerSettings={{
                barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'itf14', 'qr'],
              }}
              onBarcodeScanned={onBarcodeScanned}
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
              <Ionicons name="videocam-off-outline" size={36} color="#8B8BAA" />
              <Text style={{ color: '#8B8BAA', fontSize: 13.5, textAlign: 'center' }}>{t.cameraDenied}</Text>
              <Button title={t.grantCamera} onPress={() => requestPermission()} small icon="videocam-outline" />
            </View>
          )}
          {cameraGranted && (
            <View pointerEvents="none" style={{ position: 'absolute', inset: 0 as any, alignItems: 'center', justifyContent: 'center' }}>
              <View
                style={{
                  width: 220,
                  height: 100,
                  borderWidth: 2.5,
                  borderColor: flash ? '#22C55E' : 'rgba(255,255,255,0.85)',
                  borderRadius: 16,
                }}
              />
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12.5, marginTop: 10 }}>
                {flash ? `✅ ${flash}` : t.inventoryHint}
              </Text>
            </View>
          )}
          <Pressable
            onPress={onClose}
            style={{
              position: 'absolute',
              top: insets.top + 8,
              left: 14,
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: 'rgba(0,0,0,0.45)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={21} color="#fff" />
          </Pressable>
        </View>

        {/* Ручной ввод + сводка */}
        <View style={{ padding: SP.md, paddingBottom: 4, gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
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
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Badge text={`${t.inventoryScanned}: ${scannedRows.length}`} color={theme.opsAccent} />
            <Badge text={`✓ ${summary.match}`} color={theme.success} />
            <Badge text={`${t.inventoryShortage}: ${summary.shortage}`} color={theme.danger} />
            <Badge text={`${t.inventorySurplus}: ${summary.surplus}`} color={theme.warning} />
          </View>
        </View>

        {/* Список отсканированного */}
        <FlatList
          data={scannedRows}
          keyExtractor={(r) => String(r.product.id)}
          contentContainerStyle={{ padding: SP.md, gap: 8, paddingBottom: 12 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 24, gap: 8 }}>
              <Ionicons name="scan-outline" size={30} color={theme.text3} />
              <Text style={{ color: theme.text3, fontSize: 13.5 }}>{t.inventoryEmpty}</Text>
            </View>
          }
          renderItem={({ item: r }) => (
            <View
              style={{
                backgroundColor: theme.card,
                borderRadius: R.md,
                borderWidth: 1,
                borderColor:
                  r.diff === 0 ? theme.border : r.diff < 0 ? 'rgba(220,38,38,0.4)' : 'rgba(217,119,6,0.4)',
                padding: 10,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontSize: 13.5, fontWeight: '600' }} numberOfLines={1}>
                  {r.product.name}
                </Text>
                <Text style={{ color: theme.text3, fontSize: 12, marginTop: 2 }}>
                  {t.inventoryExpected}: {fmt(r.expected)} · {t.inventoryActual}: {fmt(r.actual)}
                  {r.diff !== 0 && (
                    <Text style={{ color: r.diff < 0 ? theme.danger : theme.warning, fontWeight: '700' }}>
                      {'  '}({r.diff > 0 ? '+' : ''}
                      {r.diff})
                    </Text>
                  )}
                </Text>
              </View>
              <Stepper
                value={r.actual}
                min={0}
                max={99999}
                onChange={(v) => setCounts((prev) => ({ ...prev, [r.product.id]: v }))}
              />
            </View>
          )}
        />

        {/* Нижняя панель действий */}
        <View
          style={{
            padding: SP.md,
            paddingBottom: Math.max(insets.bottom, 10) + 4,
            borderTopWidth: 1,
            borderTopColor: theme.border,
            backgroundColor: theme.sidebar,
            flexDirection: 'row',
            gap: 8,
          }}
        >
          <Button
            title={t.shareAct}
            onPress={shareAct}
            variant="ghost"
            small
            icon="share-social-outline"
            disabled={scannedRows.length === 0}
            style={{ flex: 1 }}
          />
          <Button
            title={t.applyCorrections}
            onPress={applyCorrections}
            variant="success"
            small
            icon="checkmark-done-outline"
            loading={applying}
            disabled={scannedRows.every((r) => r.diff === 0)}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </Modal>
  );
}
