import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, StatusBar, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { getCategories } from '../../api';
import { Spacing, Radius, Typography } from '../../constants/theme';
import CategoryIcon from '../../components/common/CategoryIcon';

export default function CatalogScreen() {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getCategories();
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      setCategories([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const GAP = Spacing.md;
  const PAD = Spacing.lg;
  const tileWidth = (width - PAD * 2 - GAP) / 2;

  const renderTile = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => navigation.navigate('CategoryProducts', { category: item.name, categoryName: item.name })}
      style={[styles.tile, { width: tileWidth, backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={[styles.tileIcon, { backgroundColor: colors.primary + '14' }]}>
        <CategoryIcon category={item} size={26} color={colors.primary} />
      </View>
      <Text style={[styles.tileName, { color: colors.text }]} numberOfLines={2}>{item.name}</Text>
      {item.description ? (
        <Text style={[styles.tileDesc, { color: colors.textMuted }]} numberOfLines={1}>{item.description}</Text>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={[styles.title, { color: colors.text }]}>{t('catalogTitle')}</Text>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Search')}
          style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <Text style={[styles.searchText, { color: colors.textMuted }]}>{t('searchProductsBrands')}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          renderItem={renderTile}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={{ padding: PAD, paddingBottom: insets.bottom + 24, gap: GAP }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="grid-outline" size={52} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('categoriesHere')}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, gap: Spacing.md },
  title: { ...Typography.h1 },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    height: 46, paddingHorizontal: 14, borderRadius: Radius.input, borderWidth: 1,
  },
  searchText: { fontSize: 15 },
  tile: {
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: 10,
    minHeight: 120,
  },
  tileIcon: {
    width: 48, height: 48, borderRadius: Radius.input,
    alignItems: 'center', justifyContent: 'center',
  },
  tileName: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  tileDesc: { fontSize: 12 },
  empty: { alignItems: 'center', paddingVertical: 80, gap: 12 },
  emptyText: { fontSize: 15 },
});
