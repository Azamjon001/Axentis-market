import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useFavorites } from '../../context/FavoritesContext';
import { useLanguage } from '../../context/LanguageContext';
import ProductCard from '../../components/common/ProductCard';

export default function FavoritesScreen() {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation();
  const { products, isLoading, toggle, refresh } = useFavorites();
  const { t } = useLanguage();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('favoritesTitle')}</Text>
        {products.length > 0 && (
          <Text style={[styles.countLabel, { color: colors.textSecondary }]}>{products.length} {t('items')}</Text>
        )}
      </View>

      {products.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconBg, { backgroundColor: colors.error + '15' }]}>
            <Ionicons name="heart-outline" size={64} color={colors.error} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('listEmpty')}</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('favoritesHint')}</Text>
          <TouchableOpacity
            style={[styles.browseBtn, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('Main', { screen: 'Home' })}
            activeOpacity={0.85}
          >
            <Ionicons name="storefront-outline" size={18} color="#FFF" />
            <Text style={styles.browseBtnText}>{t('goToHome')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap: 12 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          renderItem={({ item }) => (
            <View style={{ flex: 1 }}>
              <ProductCard
                product={item}
                onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
                onFavorite={() => toggle(item.id)}
                isFavorite={true}
              />
            </View>
          )}
          ListFooterComponent={<View style={{ height: 20 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 28, fontWeight: '800' },
  countLabel: { fontSize: 14 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  emptyIconBg: {
    width: 120,
    height: 120,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyText: { textAlign: 'center', fontSize: 14, lineHeight: 21 },
  browseBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
  },
  browseBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  grid: { paddingHorizontal: 16, paddingBottom: 20 },
});
