import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Animated,
  TextInput,
  Pressable,
  useWindowDimensions,
  StatusBar,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useFavorites } from '../../context/FavoritesContext';
import { useLanguage } from '../../context/LanguageContext';
import { getProducts, getCategories, getApprovedAds, getRecentlyViewed, getRecommendations, getCampaigns, getDeliveryRegions } from '../../api';
import { useLocationRegion } from '../../context/LocationContext';
import { ALL_REGION_NAMES } from '../../utils/region';
import ProductCard from '../../components/common/ProductCard';
import BannerCarousel from '../../components/common/BannerCarousel';
import CategoryIcon from '../../components/common/CategoryIcon';
import HomeSkeleton from '../../components/common/HomeSkeleton';
import StoriesBar from '../../components/common/StoriesBar';
import { SectionHeader, Chip } from '../../components/ui';
import { Spacing, Radius, Typography } from '../../constants/theme';

const LIMIT = 20;
const DEBOUNCE_MS = 300;

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { isFavorite, toggle: toggleFav } = useFavorites();
  const { t, language } = useLanguage();
  const navigation = useNavigation();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [ads, setAds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [campaigns, setCampaigns] = useState([]);

  // 🎉 Активные скидочные кампании (именованные ряды на главной)
  useEffect(() => {
    getCampaigns().then(setCampaigns).catch(() => setCampaigns([]));
  }, []);

  // Drawer
  const DRAWER_WIDTH = Math.min(width * 0.82, 340);
  const drawerX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Debounce search
  const debounceTimer = useRef(null);
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(search), DEBOUNCE_MS);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [search]);

  // 🗺️ Регион покупателя (GPS ИЛИ выбранный вручную). Товары строго его региона.
  const { region, displayRegion, manualRegion, coords, status: locStatus, requestLocation, setManualRegion } = useLocationRegion();
  const [regionPickerOpen, setRegionPickerOpen] = useState(false);
  const [adminZones, setAdminZones] = useState([]); // зоны, нарисованные админом (для ручного выбора)
  // В приватном режиме (закрытая компания) фильтрация по региону не нужна.
  const isPrivateMode = user?.mode === 'private' && !!user?.privateCompanyId;
  // Готовы показывать товары, когда есть регион (определён/выбран вручную)
  // ЛИБО координаты — бэкенд сам сверит точку с нарисованными зонами доставки.
  const regionReady = isPrivateMode || !!region || !!coords;

  // Список зон админа для ручного выбора (Карасу, Андижан и т.п.).
  useEffect(() => {
    getDeliveryRegions()
      .then((list) => setAdminZones(list.filter((r) => r?.name)))
      .catch(() => setAdminZones([]));
  }, []);

  const getModeParams = useCallback(() => {
    const params = {};
    if (user?.mode === 'private' && user.privateCompanyId) {
      params.mode = 'private';
      params.privateCompanyId = user.privateCompanyId;
    }
    if (region) params.region = region;
    // Координаты передаём только в автоматическом режиме: если покупатель выбрал
    // регион вручную, показываем строго его выбор, без примеси GPS-зон.
    if (!manualRegion && coords) {
      params.lat = coords.lat;
      params.lng = coords.lng;
    }
    return params;
  }, [user?.mode, user?.privateCompanyId, region, manualRegion, coords]);

  const loadInitial = useCallback(async () => {
    try {
      // Пока регион не определён — товары не запрашиваем (строгая фильтрация).
      const prodPromise = regionReady
        ? getProducts({ limit: LIMIT, offset: 0, availableOnly: true, ...getModeParams() })
        : Promise.resolve([]);
      const [prodRes, catRes, adsRes] = await Promise.allSettled([
        prodPromise,
        getCategories(),
        getApprovedAds(),
      ]);
      if (prodRes.status === 'fulfilled') {
        setProducts(prodRes.value);
        setOffset(LIMIT);
        setHasMore(regionReady && prodRes.value.length === LIMIT);
      }
      if (catRes.status === 'fulfilled') setCategories(catRes.value);
      if (adsRes.status === 'fulfilled') setAds(adsRes.value);
    } finally {
      setIsLoading(false);
    }
  }, [getModeParams, regionReady]);

  useEffect(() => { loadInitial(); }, [loadInitial]);

  // «Недавно смотрели» + «Рекомендуем вам» — обновляем при возврате на главную,
  // чтобы только что просмотренные товары сразу появлялись в ленте.
  const loadPersonalized = useCallback(async () => {
    if (!user?.phone) { setRecentlyViewed([]); setRecommendations([]); return; }
    const [rv, rc] = await Promise.allSettled([
      getRecentlyViewed(user.phone, 10),
      getRecommendations(user.phone, 12),
    ]);
    if (rv.status === 'fulfilled') setRecentlyViewed(rv.value);
    if (rc.status === 'fulfilled') setRecommendations(rc.value);
  }, [user?.phone]);

  useFocusEffect(useCallback(() => { loadPersonalized(); }, [loadPersonalized]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setOffset(0);
    setHasMore(true);
    setActiveCategory(null);
    try {
      const prodPromise = regionReady
        ? getProducts({ limit: LIMIT, offset: 0, availableOnly: true, ...getModeParams() })
        : Promise.resolve([]);
      const [prodRes, catRes, adsRes] = await Promise.allSettled([
        prodPromise,
        getCategories(),
        getApprovedAds(),
      ]);
      if (prodRes.status === 'fulfilled') {
        setProducts(prodRes.value);
        setOffset(LIMIT);
        setHasMore(regionReady && prodRes.value.length === LIMIT);
      }
      if (catRes.status === 'fulfilled') setCategories(catRes.value);
      if (adsRes.status === 'fulfilled') setAds(adsRes.value);
    } finally {
      setRefreshing(false);
    }
  }, [getModeParams, regionReady]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || debouncedSearch.trim() || activeCategory || !regionReady) return;
    setIsLoadingMore(true);
    try {
      const more = await getProducts({ limit: LIMIT, offset, availableOnly: true, ...getModeParams() });
      if (more.length > 0) {
        setProducts(prev => [...prev, ...more]);
        setOffset(prev => prev + LIMIT);
        setHasMore(more.length === LIMIT);
      } else {
        setHasMore(false);
      }
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, debouncedSearch, activeCategory, offset, getModeParams, regionReady]);

  const displayProducts = useMemo(() => {
    let list = products;
    if (debouncedSearch.trim()) {
      list = list.filter(p => p.name.toLowerCase().includes(debouncedSearch.toLowerCase()));
    }
    if (activeCategory) {
      list = list.filter(p => p.category === activeCategory);
    }
    return list;
  }, [products, debouncedSearch, activeCategory]);

  // 🗂️ Готовые подборки для главной: со скидкой, новинки, до 100 000 сум.
  const collections = useMemo(() => {
    const real = (products || []).filter(
      p => p && p.id != null && !String(p.name || '').startsWith('__CATEGORY_MARKER__') && p.availableForCustomers !== false,
    );
    const price = p => p.sellingPrice || p.price || 0;
    return {
      discounted: real.filter(p => (p.discountPercent || 0) > 0).slice(0, 10),
      newest: [...real].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 10),
      budget: real.filter(p => price(p) > 0 && price(p) <= 100000).slice(0, 10),
    };
  }, [products]);

  // 📢 Лента = пары товаров + сплошной рекламный баннер каждые 20 рядов (40 товаров).
  const feedData = useMemo(() => {
    const rows = [];
    let productRows = 0;
    const showAds = ads.length > 0 && !debouncedSearch.trim();
    for (let i = 0; i < displayProducts.length; i += 2) {
      rows.push({ type: 'row', key: 'r' + (displayProducts[i]?.id ?? i), items: displayProducts.slice(i, i + 2) });
      productRows++;
      if (showAds && productRows % 20 === 0) {
        rows.push({ type: 'ad', key: 'ad' + productRows });
      }
    }
    return rows;
  }, [displayProducts, ads, debouncedSearch]);

  // Drawer
  const openDrawer = () => {
    setDrawerOpen(true);
    Animated.parallel([
      Animated.spring(drawerX, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
      Animated.timing(overlayOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  const closeDrawer = () => {
    Animated.parallel([
      Animated.spring(drawerX, { toValue: -DRAWER_WIDTH, useNativeDriver: true, tension: 80, friction: 12 }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setDrawerOpen(false));
  };

  const CARD_GAP = 10;
  const HORIZONTAL_PADDING = 12;
  const cardWidth = (width - HORIZONTAL_PADDING * 2 - CARD_GAP) / 2;

  // Ad banner carousel — shown at the top of the feed (hidden while searching or
  // filtering by category, and when there are no approved ads).
  const ListHeader = useMemo(() => {
    // Регион не определён → ничего, кроме сообщения (его рисует ListEmptyComponent).
    if (!regionReady) return <View />;
    // Баннер показываем и на главной, и в категориях (скрываем только в поиске),
    // чтобы строка каталога везде стояла одинаково ровно.
    const showBanner = !debouncedSearch.trim() && ads.length > 0;
    let sectionTitle = t('popularProducts');
    if (debouncedSearch.trim()) sectionTitle = t('searchResults');
    else if (activeCategory) sectionTitle = activeCategory;
    const showFeeds = !debouncedSearch.trim() && !activeCategory;
    const renderFeedRow = (title, data) => (
      <View style={styles.feedSection}>
        <Text style={[styles.feedTitle, { color: colors.text }]}>{title}</Text>
        <FlatList
          data={data}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => 'feed-' + String(item.id)}
          contentContainerStyle={styles.feedRow}
          renderItem={({ item }) => (
            <View style={{ width: 132 }}>
              <ProductCard
                product={item}
                compact
                onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
                onFavorite={() => toggleFav(item.id, item)}
                isFavorite={isFavorite(item.id)}
              />
            </View>
          )}
        />
      </View>
    );
    return (
      <View>
        {/* 🗺️ Просим включить геолокацию, чтобы показывать товары в регионе
            покупателя. В закрытом магазине регион не нужен — баннер скрыт. */}
        {!isPrivateMode && (locStatus === 'denied' || locStatus === 'unavailable') && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={requestLocation}
            style={[styles.locationBanner, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '40' }]}
          >
            <Text style={[styles.locationBannerText, { color: colors.text }]}>
              {t('enableLocationForRegion')}
            </Text>
            <Text style={[styles.locationBannerAction, { color: colors.primary }]}>
              {t('enableLocationBtn')}
            </Text>
          </TouchableOpacity>
        )}
        {/* 📸 Сторис магазинов — только в основной ленте (не в поиске/категории) */}
        {showFeeds && (
          <StoriesBar onOpenProduct={(pid) => navigation.navigate('ProductDetail', { productId: pid })} />
        )}
        {showBanner && (
          <View style={styles.bannerWrap}>
            <BannerCarousel ads={ads} />
          </View>
        )}
        {showFeeds && recentlyViewed.length > 0 && renderFeedRow(t('recentlyViewed'), recentlyViewed)}
        {showFeeds && recommendations.length > 0 && renderFeedRow(t('recommendedForYou'), recommendations)}
        {/* 🎉 Именованные скидочные кампании (Летняя распродажа и т.п.) */}
        {showFeeds && campaigns.map((camp) =>
          camp.products?.length >= 2 ? (
            <React.Fragment key={'camp' + camp.id}>
              {renderFeedRow(`${camp.emoji || '🎉'} ${camp.name}`, camp.products)}
            </React.Fragment>
          ) : null
        )}
        {/* 🗂️ Подборки — оживляют главную и увеличивают просмотры товаров */}
        {showFeeds && collections.discounted.length >= 3 && renderFeedRow(`🔥 ${t('collectionDiscounted') || 'Со скидкой'}`, collections.discounted)}
        {showFeeds && collections.budget.length >= 3 && renderFeedRow(`💰 ${t('collectionBudget') || 'До 100 000 сум'}`, collections.budget)}
        <SectionHeader title={sectionTitle} style={{ marginTop: showBanner ? Spacing.sm : Spacing.xs }} />
      </View>
    );
  }, [ads, debouncedSearch, activeCategory, t, recentlyViewed, recommendations, collections, campaigns, colors, navigation, isFavorite, toggleFav, locStatus, requestLocation, regionReady, isPrivateMode]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <HomeSkeleton />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ── Top bar ── */}
      <View style={[styles.topBarWrap, { backgroundColor: colors.background, paddingTop: insets.top + 12 }]}>
        {/* Greeting + actions */}
        <View style={styles.greetingRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greetingHello, { color: colors.textMuted }]}>{t('welcome')}</Text>
            <Text style={[styles.greetingName, { color: colors.text }]} numberOfLines={1}>
              {user?.name ? user.name : 'Axentis Market'}
            </Text>
            {/* 📍 Регион всегда можно сменить вручную — например, покупатель
                зарегистрировался в поездке, а дома магазины «пропали» */}
            {!isPrivateMode && (
              <TouchableOpacity
                style={styles.regionChip}
                onPress={() => setRegionPickerOpen(true)}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              >
                <Ionicons name="location-outline" size={13} color={colors.primary} />
                <Text style={[styles.regionChipText, { color: colors.primary }]} numberOfLines={1}>
                  {displayRegion || (language === 'uz' ? 'Hududni tanlash' : 'Выбрать регион')}
                </Text>
                <Ionicons name="chevron-down" size={12} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => navigation.navigate('Notifications')}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Search row */}
        <View style={styles.searchRow}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={openDrawer}
            activeOpacity={0.7}
          >
            <Ionicons name="menu-outline" size={22} color={colors.text} />
          </TouchableOpacity>

          <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={18} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder={t('searchPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={17} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* ── Category chips ── */}
      {categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          style={styles.chipsScroll}
        >
          <Chip label={t('tabAll')} active={activeCategory === null} onPress={() => setActiveCategory(null)} icon="apps-outline" />
          {categories.map(cat => (
            <Chip
              key={cat.id}
              label={cat.name}
              active={activeCategory === cat.name}
              onPress={() => setActiveCategory(activeCategory === cat.name ? null : cat.name)}
              category={cat}
            />
          ))}
        </ScrollView>
      )}

      {/* ── Products FlatList (пары товаров + баннеры каждые 20 рядов) ── */}
      <FlatList
        data={feedData}
        keyExtractor={item => item.key}
        contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 16 }]}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          !regionReady ? (
            // Регион не определён → товары не показываем, объясняем почему.
            <View style={styles.empty}>
              <Ionicons
                name={locStatus === 'requesting' || locStatus === 'idle' ? 'navigate-circle-outline' : 'location-outline'}
                size={52}
                color={colors.textMuted}
              />
              <Text style={[styles.emptyText, { color: colors.textMuted, textAlign: 'center', paddingHorizontal: 24 }]}>
                {locStatus === 'requesting' || locStatus === 'idle'
                  ? t('detectingRegion')
                  : locStatus === 'granted'
                    ? t('regionUndetected')
                    : t('enableLocationForRegion')}
              </Text>
              {locStatus !== 'requesting' && locStatus !== 'idle' && (
                <TouchableOpacity
                  onPress={requestLocation}
                  style={[styles.retryLocationBtn, { backgroundColor: colors.primary }]}
                  activeOpacity={0.85}
                >
                  <Text style={styles.retryLocationBtnText}>{t('enableLocationBtn')}</Text>
                </TouchableOpacity>
              )}
              {/* Ручной выбор региона — если GPS не сработал */}
              <TouchableOpacity
                onPress={() => setRegionPickerOpen(true)}
                style={[styles.retryLocationBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary, marginTop: 10 }]}
                activeOpacity={0.85}
              >
                <Text style={[styles.retryLocationBtnText, { color: colors.primary }]}>
                  {language === 'uz' ? 'Hududni qoʻlda tanlash' : 'Выбрать регион вручную'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={52} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted, textAlign: 'center', paddingHorizontal: 24 }]}>
                {debouncedSearch.trim()
                  ? t('nothingFound')
                  : isPrivateMode
                    ? (language === 'uz' ? 'Doʻkonda hozircha mahsulotlar yoʻq' : 'В магазине пока нет товаров')
                    : t('noPartnersInRegion')}
              </Text>
              {/* Смена региона — только в публичном режиме: в закрытом магазине
                  товары не зависят от региона */}
              {!debouncedSearch.trim() && !isPrivateMode && (
                <TouchableOpacity
                  onPress={() => setRegionPickerOpen(true)}
                  style={[styles.retryLocationBtn, { backgroundColor: colors.primary, marginTop: 12 }]}
                  activeOpacity={0.85}
                >
                  <Text style={styles.retryLocationBtnText}>
                    {language === 'uz' ? 'Boshqa hududni tanlash' : 'Выбрать другой регион'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )
        }
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.loadMore}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          if (item.type === 'ad') {
            // Сплошной рекламный баннер в ленте (клик → ссылка/товар)
            return (
              <View style={styles.inFeedBanner}>
                <BannerCarousel ads={ads} />
              </View>
            );
          }
          return (
            <View style={styles.feedRow}>
              {item.items.map(p => (
                <View key={p.id} style={{ width: cardWidth }}>
                  <ProductCard
                    product={p}
                    onPress={() => navigation.navigate('ProductDetail', { productId: p.id })}
                    onFavorite={() => toggleFav(p.id, p)}
                    isFavorite={isFavorite(p.id)}
                  />
                </View>
              ))}
              {item.items.length === 1 && <View style={{ width: cardWidth }} />}
            </View>
          );
        }}
      />

      {/* ── Drawer overlay ── */}
      {drawerOpen && (
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} pointerEvents="box-none">
          <Pressable style={{ flex: 1 }} onPress={closeDrawer} />
        </Animated.View>
      )}

      {/* ── Drawer panel ── */}
      <Animated.View
        style={[
          styles.drawer,
          {
            backgroundColor: colors.surface,
            width: DRAWER_WIDTH,
            transform: [{ translateX: drawerX }],
            paddingTop: insets.top,
          },
        ]}
      >
        {/* Drawer header */}
        <View style={[styles.drawerHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.drawerTitle, { color: colors.text }]}>{t('catalogTitle')}</Text>
          <TouchableOpacity
            onPress={closeDrawer}
            style={[styles.closeBtn, { backgroundColor: colors.inputBg }]}
          >
            <Ionicons name="close" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* All products */}
        <TouchableOpacity
          style={[styles.drawerRow, { borderBottomColor: colors.divider }]}
          onPress={() => { closeDrawer(); setActiveCategory(null); setSearch(''); }}
          activeOpacity={0.7}
        >
          <View style={[styles.drawerIconBox, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="apps-outline" size={20} color={colors.primary} />
          </View>
          <Text style={[styles.drawerRowText, { color: colors.text }]}>{t('allProducts')}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Categories */}
        <FlatList
          data={categories}
          keyExtractor={item => String(item.id)}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.drawerRow,
                { borderBottomColor: colors.divider },
                activeCategory === item.name && { backgroundColor: colors.primary + '12' },
              ]}
              onPress={() => {
                closeDrawer();
                setActiveCategory(item.name);
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.drawerIconBox, { backgroundColor: colors.primary + '15' }]}>
                <CategoryIcon category={item} size={20} color={colors.primary} />
              </View>
              <Text style={[styles.drawerRowText, { color: colors.text }]}>{item.name}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        />
      </Animated.View>

      {/* 🗺️ Ручной выбор региона доставки */}
      <Modal visible={regionPickerOpen} transparent animationType="slide" onRequestClose={() => setRegionPickerOpen(false)}>
        <Pressable style={styles.regionOverlay} onPress={() => setRegionPickerOpen(false)}>
          <Pressable style={[styles.regionSheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.regionHeader}>
              <Text style={[styles.regionTitle, { color: colors.text }]}>
                {language === 'uz' ? 'Hududingizni tanlang' : 'Выберите ваш регион'}
              </Text>
              <TouchableOpacity onPress={() => setRegionPickerOpen(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 380 }}>
              {/* 📍 Зоны доставки, нарисованные админом (районы/города) — первыми */}
              {adminZones.length > 0 && (
                <Text style={[styles.regionGroupLabel, { color: colors.textMuted }]}>
                  {language === 'uz' ? 'Yetkazib berish hududlari' : 'Зоны доставки'}
                </Text>
              )}
              {adminZones.map((zone) => {
                const name = language === 'uz' && zone.nameUz ? zone.nameUz : zone.name;
                const active = region === zone.name || region === zone.nameUz;
                return (
                  <TouchableOpacity
                    key={`zone-${zone.id}`}
                    onPress={() => { setManualRegion(zone.name); setRegionPickerOpen(false); }}
                    style={[styles.regionRow, { borderBottomColor: colors.border }]}
                  >
                    <Ionicons name="location-outline" size={16} color={colors.primary} style={{ marginRight: 8 }} />
                    <Text style={{ color: active ? colors.primary : colors.text, fontWeight: active ? '700' : '400', flex: 1 }}>
                      {name}
                    </Text>
                    {active && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
              {adminZones.length > 0 && (
                <Text style={[styles.regionGroupLabel, { color: colors.textMuted }]}>
                  {language === 'uz' ? 'Viloyatlar' : 'Области'}
                </Text>
              )}
              {ALL_REGION_NAMES.map((name) => {
                const active = region === name;
                return (
                  <TouchableOpacity
                    key={name}
                    onPress={() => { setManualRegion(name); setRegionPickerOpen(false); }}
                    style={[styles.regionRow, { borderBottomColor: colors.border }]}
                  >
                    <Text style={{ color: active ? colors.primary : colors.text, fontWeight: active ? '700' : '400', flex: 1 }}>
                      {name}
                    </Text>
                    {active && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {manualRegion ? (
              <TouchableOpacity
                onPress={() => { setManualRegion(null); setRegionPickerOpen(false); requestLocation(); }}
                style={styles.regionAuto}
              >
                <Ionicons name="navigate-outline" size={16} color={colors.primary} />
                <Text style={{ color: colors.primary, marginLeft: 6 }}>
                  {language === 'uz' ? 'Avtomatik (GPS) ga qaytish' : 'Определять автоматически (GPS)'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },

  topBarWrap: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  greetingHello: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  greetingName: {
    ...Typography.h2,
  },
  // 📍 Чип текущего региона — всегда виден, тап открывает выбор региона
  regionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 3,
    marginTop: 3,
    maxWidth: '100%',
  },
  regionChipText: { fontSize: 12.5, fontWeight: '600', flexShrink: 1 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBtn: {
    width: 46,
    height: 46,
    borderRadius: Radius.input,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: Radius.input,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  chipsScroll: {
    flexGrow: 0,
    // Фиксированная высота = высота чипа (38) + вертикальные отступы (12·2).
    // Без этого на вебе строка категорий рендерится то компактнее, то выше
    // в зависимости от того, что под ней (баннер / товары) — и «прыгает».
    height: 38 + Spacing.md * 2,
  },
  chipsRow: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerWrap: {
    // Отступ сверху опускает баннер чуть ниже строки категорий,
    // чтобы каталог не был прижат к рекламе.
    paddingTop: 12,
    paddingBottom: 6,
  },
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  locationBannerText: { flex: 1, fontSize: 13, fontWeight: '600', marginRight: 10 },
  locationBannerAction: { fontSize: 13, fontWeight: '800' },
  feedSection: { marginTop: 8, marginBottom: 4 },
  feedTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3, paddingHorizontal: 16, marginBottom: 10 },
  feedRow: { gap: 12, paddingHorizontal: 16 },

  grid: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  row: {
    gap: 10,
    marginBottom: 10,
  },
  feedRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  inFeedBanner: {
    marginVertical: 6,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: { fontSize: 15 },
  retryLocationBtn: { marginTop: 14, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 12 },
  regionOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  regionSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 28 },
  regionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  regionTitle: { fontSize: 17, fontWeight: '700' },
  regionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  regionGroupLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 12, marginBottom: 4 },
  regionAuto: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 16 },
  retryLocationBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  loadMore: { paddingVertical: 20, alignItems: 'center' },

  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 10,
  },
  drawer: {
    position: 'absolute',
    top: 0, left: 0, bottom: 0,
    zIndex: 20,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  drawerTitle: { fontSize: 22, fontWeight: '800' },
  closeBtn: {
    width: 36, height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 14,
  },
  drawerIconBox: {
    width: 40, height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerRowText: { flex: 1, fontSize: 15, fontWeight: '500' },
});
