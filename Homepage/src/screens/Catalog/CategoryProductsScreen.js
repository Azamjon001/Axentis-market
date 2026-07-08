import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, RefreshControl, Modal, TextInput, Switch,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { getCategoryProducts, getProducts } from '../../api';
import ProductCard from '../../components/common/ProductCard';

const LIMIT = 20;

export default function CategoryProductsScreen() {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation();
  const route = useRoute();
  const { category, categoryName } = route.params;

  const [products, setProducts] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const offsetRef = useRef(0);
  const [sortBy, setSortBy] = useState('popular');

  // Применённые фильтры (по ним идёт запрос на сервер)
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [inStock, setInStock] = useState(false);
  // Черновик фильтров внутри модалки
  const [showFilters, setShowFilters] = useState(false);
  const [draftMin, setDraftMin] = useState('');
  const [draftMax, setDraftMax] = useState('');
  const [draftInStock, setDraftInStock] = useState(false);

  const buildParams = (off) => {
    const p = { limit: LIMIT, offset: off, sort: sortBy };
    if (minPrice.trim()) p.minPrice = minPrice.trim();
    if (maxPrice.trim()) p.maxPrice = maxPrice.trim();
    if (inStock) p.inStock = 'true';
    return p;
  };

  // Сортировка и фильтрация выполняются на сервере по всему набору товаров
  // (а не по одной странице), поэтому пагинация даёт корректный общий порядок.
  const load = useCallback(async (reset = false) => {
    const currentOffset = reset ? 0 : offsetRef.current;
    if (reset) setIsLoading(true); else setIsLoadingMore(true);
    try {
      const res = await getCategoryProducts(category, buildParams(currentOffset));
      const items = Array.isArray(res) ? res : (res?.products || []);
      setHasMore(items.length === LIMIT);
      offsetRef.current = currentOffset + items.length;
      setProducts(prev => (reset ? items : [...prev, ...items]));
    } catch {
      if (reset) {
        try {
          const res = await getProducts({ category, limit: LIMIT, availableOnly: true });
          const items = Array.isArray(res) ? res : (res?.products || []);
          setProducts(items);
          setHasMore(false);
        } catch {}
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, sortBy, minPrice, maxPrice, inStock]);

  useEffect(() => { load(true); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  const onEndReached = () => {
    if (!isLoadingMore && hasMore) load(false);
  };

  const openFilters = () => {
    setDraftMin(minPrice); setDraftMax(maxPrice); setDraftInStock(inStock);
    setShowFilters(true);
  };
  const applyFilters = () => {
    setMinPrice(draftMin); setMaxPrice(draftMax); setInStock(draftInStock);
    setShowFilters(false);
  };
  const resetFilters = () => {
    setDraftMin(''); setDraftMax(''); setDraftInStock(false);
    setMinPrice(''); setMaxPrice(''); setInStock(false);
    setShowFilters(false);
  };
  const activeFilterCount = (minPrice.trim() ? 1 : 0) + (maxPrice.trim() ? 1 : 0) + (inStock ? 1 : 0);

  const SORTS = [
    { key: 'popular', label: t('sortPopular') },
    { key: 'new', label: t('sortNew') },
    { key: 'price_asc', label: t('sortCheaper') },
    { key: 'price_desc', label: t('sortExpensive') },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {categoryName}
        </Text>
        <TouchableOpacity onPress={openFilters} style={styles.filterBtn} activeOpacity={0.7}>
          <Ionicons name="options-outline" size={22} color={colors.text} />
          {activeFilterCount > 0 && (
            <View style={[styles.filterDot, { backgroundColor: colors.primary }]}>
              <Text style={styles.filterDotText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.sortRow}>
        {SORTS.map((s) => (
          <TouchableOpacity
            key={s.key}
            style={[
              styles.sortChip,
              {
                backgroundColor: sortBy === s.key ? colors.primary : colors.surface,
                borderColor: sortBy === s.key ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setSortBy(s.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.sortChipText, { color: sortBy === s.key ? '#FFFFFF' : colors.textSecondary }]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {!isLoading && (
        <Text style={[styles.countText, { color: colors.textSecondary }]}>
          {products.length}{hasMore ? '+' : ''} {t('items')}
        </Text>
      )}

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          renderItem={({ item }) => (
            <View style={{ flex: 1 }}>
              <ProductCard
                product={item}
                onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
              />
            </View>
          )}
          ListFooterComponent={isLoadingMore ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
          ) : null}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="cube-outline" size={56} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('notFound')}</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {t('noProductsInCategory')}
              </Text>
            </View>
          }
        />
      )}

      <Modal
        visible={showFilters}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowFilters(false)} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.text }]}>{t('filters')}</Text>

          <View style={styles.priceRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('priceFromLabel')}</Text>
              <TextInput
                style={[styles.priceInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                value={draftMin}
                onChangeText={(v) => setDraftMin(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('priceToLabel')}</Text>
              <TextInput
                style={[styles.priceInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                value={draftMax}
                onChangeText={(v) => setDraftMax(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="∞"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>

          <View style={[styles.switchRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>{t('onlyInStock')}</Text>
            <Switch
              value={draftInStock}
              onValueChange={setDraftInStock}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.sheetActions}>
            <TouchableOpacity style={[styles.resetBtn, { borderColor: colors.border }]} onPress={resetFilters} activeOpacity={0.8}>
              <Text style={[styles.resetBtnText, { color: colors.textSecondary }]}>{t('resetBtn')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.applyBtn, { backgroundColor: colors.primary }]} onPress={applyFilters} activeOpacity={0.85}>
              <Text style={styles.applyBtnText}>{t('applyBtn')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 40 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  sortRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8, flexWrap: 'wrap' },
  sortChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  sortChipText: { fontSize: 13, fontWeight: '500' },
  countText: { fontSize: 13, paddingHorizontal: 16, marginBottom: 8 },
  grid: { paddingHorizontal: 16, paddingBottom: 20 },
  row: { gap: 12, marginBottom: 0 },
  emptyTitle: { fontSize: 17, fontWeight: '600' },
  emptyText: { fontSize: 14, textAlign: 'center' },
  filterBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  filterDot: { position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  filterDotText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 32 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  sheetTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  priceRow: { flexDirection: 'row', gap: 12 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  priceInput: { height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 15 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, marginTop: 16, borderTopWidth: 1 },
  switchLabel: { fontSize: 15, fontWeight: '600' },
  sheetActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  resetBtn: { flex: 1, height: 50, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  resetBtnText: { fontSize: 15, fontWeight: '700' },
  applyBtn: { flex: 2, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  applyBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
