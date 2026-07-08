import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  TextInput, ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { searchProducts, suggestProducts } from '../../api';
import ProductCard from '../../components/common/ProductCard';

const POPULAR_SEARCHES = ['AirPods', 'Samsung', 'iPhone', 'Nike', 'Adidas', 'PlayStation'];

// Варианты сортировки выдачи — как у больших маркетплейсов.
const SORT_OPTIONS = [
  { key: 'relevance', icon: 'sparkles-outline' },
  { key: 'popular', icon: 'flame-outline' },
  { key: 'price_asc', icon: 'arrow-down-outline' },
  { key: 'price_desc', icon: 'arrow-up-outline' },
  { key: 'new', icon: 'time-outline' },
];

export default function SearchScreen() {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation();
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [sort, setSort] = useState('relevance');
  const searchTimer = useRef(null);
  const suggestTimer = useRef(null);

  const sortLabel = (key) => {
    const labels = {
      relevance: t('sortRelevance') || 'По релевантности',
      popular: t('sortPopular') || 'Популярные',
      price_asc: t('sortCheaper') || 'Дешевле',
      price_desc: t('sortExpensive') || 'Дороже',
      new: t('sortNew') || 'Новинки',
    };
    return labels[key];
  };

  const doSearch = useCallback(async (q, sortKey = sort) => {
    if (!q.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    setSuggestions([]);
    setIsLoading(true);
    setHasSearched(true);
    try {
      const extra = sortKey && sortKey !== 'relevance' ? { sort: sortKey } : {};
      const res = await searchProducts(q, 40, extra);
      setResults(res);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [sort]);

  const handleChange = (text) => {
    setQuery(text);
    clearTimeout(searchTimer.current);
    clearTimeout(suggestTimer.current);
    // Подсказки — быстро (200мс), полный поиск — после паузы (500мс)
    suggestTimer.current = setTimeout(async () => {
      try {
        setSuggestions(await suggestProducts(text));
      } catch { /* ignore */ }
    }, 200);
    searchTimer.current = setTimeout(() => doSearch(text), 500);
  };

  const handleSubmit = () => {
    clearTimeout(searchTimer.current);
    clearTimeout(suggestTimer.current);
    setSuggestions([]);
    doSearch(query);
  };

  const handleSort = (key) => {
    setSort(key);
    if (query.trim()) doSearch(query, key);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: colors.text }]}
            value={query}
            onChangeText={handleChange}
            onSubmitEditing={handleSubmit}
            placeholder={t('searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setHasSearched(false); }}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={[styles.cancelText, { color: colors.primary }]}>{t('cancel')}</Text>
        </TouchableOpacity>
      </View>

      {suggestions.length > 0 && (
        <View style={[styles.suggestBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {suggestions.map((s, i) => (
            <TouchableOpacity
              key={`${s.type}-${s.label}-${i}`}
              style={styles.suggestRow}
              activeOpacity={0.7}
              onPress={() => {
                setQuery(s.label);
                clearTimeout(searchTimer.current);
                doSearch(s.label);
              }}
            >
              <Ionicons
                name={s.type === 'brand' ? 'pricetag-outline' : s.type === 'category' ? 'grid-outline' : 'search-outline'}
                size={15}
                color={colors.textMuted}
              />
              <Text style={[styles.suggestText, { color: colors.text }]} numberOfLines={1}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {!hasSearched ? (
        <View style={styles.idle}>
          <Text style={[styles.popularTitle, { color: colors.text }]}>{t('popularQueries')}</Text>
          <View style={styles.tagsWrap}>
            {POPULAR_SEARCHES.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[styles.tag, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => { setQuery(tag); doSearch(tag); }}
                activeOpacity={0.7}
              >
                <Ionicons name="trending-up-outline" size={14} color={colors.primary} />
                <Text style={[styles.tagText, { color: colors.text }]}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : results.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="search-outline" size={56} color={colors.textMuted} />
          <Text style={[styles.noResultTitle, { color: colors.text }]}>{t('nothingFound')}</Text>
          <Text style={[styles.noResultText, { color: colors.textMuted }]}>
            {t('byQuery')} «{query}» {t('notFoundProducts')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap: 12 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={{ flex: 1 }}>
              <ProductCard
                product={item}
                onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
              />
            </View>
          )}
          ListHeaderComponent={
            <View>
              <View style={styles.sortRow}>
                {SORT_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.sortChip,
                      {
                        backgroundColor: sort === opt.key ? colors.primary : colors.surface,
                        borderColor: sort === opt.key ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => handleSort(opt.key)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={opt.icon} size={13} color={sort === opt.key ? '#fff' : colors.textMuted} />
                    <Text style={[styles.sortChipText, { color: sort === opt.key ? '#fff' : colors.text }]}>
                      {sortLabel(opt.key)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.resultCount, { color: colors.textSecondary }]}>
                {t('foundLabel')} {results.length} {t('productsWord')}
              </Text>
            </View>
          }
          ListFooterComponent={<View style={{ height: 20 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, height: 46, borderRadius: 14, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 15 },
  cancelText: { fontSize: 15, fontWeight: '500' },
  idle: { padding: 16 },
  popularTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  tagText: { fontSize: 14 },
  grid: { paddingHorizontal: 16, paddingBottom: 20 },
  resultCount: { fontSize: 13, marginBottom: 12 },
  suggestBox: { marginHorizontal: 16, marginBottom: 8, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  suggestText: { fontSize: 14, flex: 1 },
  sortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  sortChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  sortChipText: { fontSize: 12, fontWeight: '500' },
  noResultTitle: { fontSize: 18, fontWeight: '600' },
  noResultText: { fontSize: 14, textAlign: 'center' },
});
