import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  Image, ActivityIndicator, Alert, Share, RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useFavorites } from '../../context/FavoritesContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  getCompanyDetail, getProducts, getCompanyStats, subscribeToCompany, unsubscribeFromCompany,
  rateCompany, getCompanyReviews,
} from '../../api';
import { getImageUrl } from '../../utils/imageUrl';
import ProductCard from '../../components/common/ProductCard';
import { Radius, Spacing } from '../../constants/theme';
import { TextInput } from 'react-native';

const SUBS_KEY = 'subscribedCompanies';

async function getLocalSubs() {
  try {
    const d = await AsyncStorage.getItem(SUBS_KEY);
    return d ? JSON.parse(d) : [];
  } catch { return []; }
}

async function saveLocalSubs(ids) {
  await AsyncStorage.setItem(SUBS_KEY, JSON.stringify(ids));
}

export default function CompanyStoreScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { isFavorite, toggle: toggleFav } = useFavorites();
  const { t } = useLanguage();
  const navigation = useNavigation();
  const route = useRoute();
  const { companyId } = route.params;

  const [company, setCompany] = useState(null);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [companyStats, setCompanyStats] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [activeTab, setActiveTab] = useState('products'); // products | about | reviews
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadReviews = useCallback(async () => {
    try { setReviews(await getCompanyReviews(companyId)); } catch { /* ignore */ }
  }, [companyId]);

  const load = useCallback(async () => {
    try {
      const [compRes, prodRes, statsRes] = await Promise.allSettled([
        getCompanyDetail(companyId),
        getProducts({ companyId }),
        getCompanyStats(companyId),
      ]);
      if (compRes.status === 'fulfilled') setCompany(compRes.value);
      if (prodRes.status === 'fulfilled') setProducts(prodRes.value);
      if (statsRes.status === 'fulfilled') setCompanyStats(statsRes.value);
      loadReviews();

      const subs = await getLocalSubs();
      setIsSubscribed(subs.includes(companyId));
    } finally {
      setIsLoading(false);
    }
  }, [companyId, loadReviews]);

  const handleSubmitReview = async () => {
    if (!user) {
      Alert.alert(t('authRequired'), t('loginToReview'));
      return;
    }
    setSubmittingReview(true);
    try {
      await rateCompany(companyId, {
        userPhone: user.phone,
        userName: user.name,
        rating: newRating,
        comment: newComment.trim(),
      });
      setNewComment('');
      setNewRating(5);
      await Promise.all([loadReviews(), getCompanyDetail(companyId).then(setCompany).catch(() => {})]);
      Alert.alert(t('thanksWord'), t('storeReviewSaved'));
    } catch (err) {
      Alert.alert(t('error'), err?.response?.data?.error || t('reviewSendFail'));
    } finally {
      setSubmittingReview(false);
    }
  };

  useEffect(() => { load(); }, [load]);

  // 🎬 Тихо подтягиваем свежий профиль компании (в т.ч. видео-декорацию)
  // каждый раз, когда экран снова в фокусе — чтобы новая анимация появлялась
  // без перезахода в приложение.
  const refreshCompany = useCallback(() => {
    getCompanyDetail(companyId).then(setCompany).catch(() => {});
  }, [companyId]);

  useFocusEffect(
    useCallback(() => {
      refreshCompany();
    }, [refreshCompany])
  );

  // ⤵️ Pull-to-refresh — обновляет товары и профиль (видео) вручную
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  const handleSubscribe = async () => {
    if (!user) {
      Alert.alert(t('authRequired'), t('loginToSubscribe'));
      return;
    }
    setIsSubscribing(true);
    try {
      const subs = await getLocalSubs();
      if (isSubscribed) {
        await unsubscribeFromCompany(companyId, user.phone);
        await saveLocalSubs(subs.filter(id => id !== companyId));
        setIsSubscribed(false);
      } else {
        await subscribeToCompany(companyId, user.phone);
        await saveLocalSubs([...subs, companyId]);
        setIsSubscribed(true);
      }
    } catch {
      Alert.alert(t('error'), t('tryLater'));
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleShareStore = async () => {
    try {
      // Умная ссылка: с приложением откроется приложение, без — сайт магазина.
      const url = `https://axentis.uz/company/${companyId}`;
      await Share.share({
        title: company?.name || t('storeWord'),
        message: `${company?.name || t('storeWord')}\n${url}`,
        url,
      });
    } catch { /* ignore */ }
  };

  const logoUri = getImageUrl(company?.logoUrl);
  const coverUri = getImageUrl(company?.coverUrl);
  const coverVideoUri = getImageUrl(company?.coverVideoUrl ?? company?.cover_video_url); // 🎬 видео-декорация (если выбрана)
  const companyRating = Number(company?.averageRating ?? company?.rating ?? companyStats?.rating ?? 0);
  const productsCount = companyStats?.total_products ?? products.length;
  const subsCount = Number(companyStats?.subscribers ?? 0);
  const subscribersLabel = subsCount >= 1000 ? `${(subsCount / 1000).toFixed(1)}K` : String(subsCount);
  const ordersCount = Number(companyStats?.completedOrders ?? 0);
  const ordersLabel = ordersCount >= 1000 ? `${(ordersCount / 1000).toFixed(1)}K` : String(ordersCount);
  const positivePct = companyRating > 0 ? Math.round((companyRating / 5) * 100) : null;

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

      <FlatList
        data={activeTab === 'products' ? products : []}
        numColumns={2}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
        ListHeaderComponent={
          <View>
            {/* ── Обложка-баннер: тянется до самого верха экрана, ЗА прозрачной
                 шапкой (кнопка назад / название / меню рисуются поверх фото). ── */}
            <View style={styles.cover}>
              {coverVideoUri ? (
                <Video
                  key={coverVideoUri}
                  source={{ uri: coverVideoUri }}
                  style={styles.coverImg}
                  resizeMode={ResizeMode.COVER}
                  shouldPlay
                  isLooping
                  isMuted
                  useNativeControls={false}
                />
              ) : coverUri ? (
                <Image source={{ uri: coverUri }} style={styles.coverImg} resizeMode="cover" />
              ) : (
                <View style={[styles.coverAccent, { backgroundColor: colors.primary + '22' }]} />
              )}
              {/* Затемнение сверху — приглушает обложку под шапкой и держит
                  иконки/название читаемыми поверх любого фото. */}
              <LinearGradient
                colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0.15)', 'transparent']}
                locations={[0, 0.45, 1]}
                style={styles.coverTopTint}
                pointerEvents="none"
              />
              {/* Нижняя грань обложки плавно и долго растворяется в фоне приложения */}
              <LinearGradient
                colors={['transparent', colors.background + 'CC', colors.background]}
                locations={[0, 0.68, 1]}
                style={styles.coverFade}
                pointerEvents="none"
              />
            </View>

            {/* ── Карточка 1: логотип + имя + рейтинг (полупрозрачная, наезжает на обложку) ── */}
            <View style={[styles.identityCard, { backgroundColor: isDark ? 'rgba(23,28,42,0.55)' : 'rgba(255,255,255,0.72)', borderColor: isDark ? 'rgba(255,255,255,0.08)' : colors.border }]}>
              {logoUri ? (
                <Image source={{ uri: logoUri }} style={[styles.logo, { borderColor: colors.border }]} />
              ) : (
                <View style={[styles.logoFallback, { backgroundColor: colors.primary, borderColor: colors.border }]}>
                  <Text style={styles.logoInitial}>{company?.name?.charAt(0).toUpperCase() || '?'}</Text>
                </View>
              )}

              <View style={styles.headInfo}>
                <View style={styles.nameRow}>
                  <Text style={[styles.companyName, { color: colors.text }]} numberOfLines={1}>{company?.name}</Text>
                  {/* ✅ Настоящий значок: выдаёт админ (is_verified), а не рейтинг */}
                  {!!company?.isVerified && (
                    <Ionicons name="checkmark-circle" size={18} color="#3B82F6" />
                  )}
                </View>
                {company?.address ? (
                  <View style={styles.addressRow}>
                    <Ionicons name="location-outline" size={13} color={colors.textMuted} />
                    <Text style={[styles.addressText, { color: colors.textMuted }]} numberOfLines={1}>{company.address}</Text>
                  </View>
                ) : null}
                {!!company?.isVerified && (
                  <View style={[styles.verifiedBadge, { backgroundColor: '#3B82F6' + '18' }]}>
                    <Ionicons name="shield-checkmark" size={11} color="#3B82F6" />
                    <Text style={styles.verifiedText}>{t('storeVerified')}</Text>
                  </View>
                )}
              </View>

              <View style={styles.ratingBox}>
                <View style={styles.ratingValue}>
                  <Ionicons name="star" size={18} color={colors.star} />
                  <Text style={[styles.ratingBoxNum, { color: colors.text }]}>{companyRating.toFixed(1)}</Text>
                </View>
                <Text style={[styles.ratingBoxLabel, { color: colors.textMuted }]}>{t('storeRating')}</Text>
              </View>
            </View>

            {/* ── Карточка 2: статистика + кнопка подписки ── */}
            <View style={[styles.statsCard, { backgroundColor: isDark ? 'rgba(20,24,38,0.6)' : 'rgba(255,255,255,0.72)', borderColor: isDark ? 'rgba(255,255,255,0.07)' : colors.border }]}>
              <View style={styles.statTiles}>
                <View style={styles.statTile}>
                  <View style={[styles.statIconCircle, { backgroundColor: colors.primary + '1A', borderWidth: 1, borderColor: colors.primary + '3A' }]}>
                    <Ionicons name="bag-handle" size={20} color={colors.primaryLight} />
                  </View>
                  <Text style={[styles.statValue, { color: colors.text }]}>{productsCount}</Text>
                  <Text style={[styles.statTileLabel, { color: colors.textMuted }]}>{t('productsWord')}</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
                <View style={styles.statTile}>
                  <View style={[styles.statIconCircle, { backgroundColor: '#3B82F6' + '16', borderWidth: 1, borderColor: '#3B82F6' + '3A' }]}>
                    <Ionicons name="people" size={20} color="#5C9BFF" />
                  </View>
                  <Text style={[styles.statValue, { color: colors.text }]}>{subscribersLabel}</Text>
                  <Text style={[styles.statTileLabel, { color: colors.textMuted }]}>{t('subscribersWord')}</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
                <View style={styles.statTile}>
                  <View style={[styles.statIconCircle, { backgroundColor: '#F59E0B' + '16', borderWidth: 1, borderColor: '#F59E0B' + '3A' }]}>
                    <Ionicons name="checkmark-done" size={20} color="#F59E0B" />
                  </View>
                  <Text style={[styles.statValue, { color: colors.text }]}>{ordersLabel}</Text>
                  <Text style={[styles.statTileLabel, { color: colors.textMuted }]} numberOfLines={2}>{t('completedOrdersWord') || 'Заказов'}</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
                <View style={styles.statTile}>
                  <View style={[styles.statIconCircle, { backgroundColor: '#22C55E' + '16', borderWidth: 1, borderColor: '#22C55E' + '3A' }]}>
                    <Ionicons name="thumbs-up" size={20} color="#3DDC84" />
                  </View>
                  <Text style={[styles.statValue, { color: colors.text }]}>{positivePct != null ? `${positivePct}%` : '—'}</Text>
                  <Text style={[styles.statTileLabel, { color: colors.textMuted }]} numberOfLines={2}>{t('positiveReviewsWord')}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.subscribeBtnWrap}
                onPress={handleSubscribe}
                disabled={isSubscribing}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={isSubscribed ? [colors.cardAlt, colors.cardAlt] : [colors.primary, colors.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.subscribeBtn, isSubscribed && { borderWidth: 1, borderColor: colors.border }]}
                >
                  {isSubscribing ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <>
                      <Ionicons
                        name={isSubscribed ? 'checkmark-circle-outline' : 'add-circle-outline'}
                        size={20}
                        color={isSubscribed ? colors.textSecondary : '#FFF'}
                      />
                      <Text style={[styles.subscribeBtnText, { color: isSubscribed ? colors.textSecondary : '#FFF' }]}>
                        {isSubscribed ? t('subscribed') : t('subscribe')}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Вкладки */}
            <View style={[styles.tabsRow, { borderBottomColor: colors.border }]}>
              {[
                { key: 'products', label: t('productsTitle') },
                { key: 'about', label: t('aboutStore') },
                { key: 'reviews', label: `${t('reviewsTitle')}${reviews.length > 0 ? ` ${reviews.length}` : ''}` },
              ].map((tab) => {
                const active = activeTab === tab.key;
                return (
                  <TouchableOpacity key={tab.key} style={styles.tabBtn} onPress={() => setActiveTab(tab.key)} activeOpacity={0.7}>
                    <Text style={[styles.tabText, { color: active ? colors.primary : colors.textMuted }]}>{tab.label}</Text>
                    {active && <View style={[styles.tabUnderline, { backgroundColor: colors.primary }]} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={
          activeTab === 'products' ? (
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={52} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('noProducts')}</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          activeTab === 'about' ? (
            <View style={styles.reviewsWrap}>
              <Text style={[styles.productsLabel, { color: colors.text, paddingHorizontal: 0, marginBottom: 10 }]}>{t('aboutStore')}</Text>
              {company?.description ? (
                <Text style={[styles.companyDesc, { color: colors.textSecondary, marginBottom: 16 }]}>{company.description}</Text>
              ) : (
                <Text style={[styles.companyDesc, { color: colors.textMuted, marginBottom: 16 }]}>{t('descNotAdded')}</Text>
              )}
              {company?.address ? (
                <View style={[styles.aboutRow, { borderTopColor: colors.divider }]}>
                  <Ionicons name="location-outline" size={18} color={colors.primary} />
                  <Text style={[styles.aboutText, { color: colors.text }]}>{company.address}</Text>
                </View>
              ) : null}
              <View style={[styles.aboutRow, { borderTopColor: colors.divider }]}>
                <Ionicons name="cube-outline" size={18} color={colors.primary} />
                <Text style={[styles.aboutText, { color: colors.text }]}>{productsCount} {t('productsInCatalog')}</Text>
              </View>
              <View style={[styles.aboutRow, { borderTopColor: colors.divider }]}>
                <Ionicons name="star-outline" size={18} color={colors.primary} />
                <Text style={[styles.aboutText, { color: colors.text }]}>{t('storeRatingLine')} {companyRating.toFixed(1)} / 5</Text>
              </View>
            </View>
          ) : activeTab !== 'reviews' ? null : (
          <View style={styles.reviewsWrap}>
            <Text style={[styles.productsLabel, { color: colors.text, paddingHorizontal: 0, marginBottom: 4 }]}>
              {t('storeReviewsTitle')} {reviews.length > 0 ? `(${reviews.length})` : ''}
            </Text>

            {/* Оцените магазин */}
            <View style={styles.rateCard}>
              <Text style={[styles.rateTitle, { color: colors.text }]}>{t('rateStore')}</Text>
              <Text style={[styles.rateSub, { color: colors.textMuted }]}>
                {t('reviewHelps')}
              </Text>
              <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <TouchableOpacity key={s} onPress={() => setNewRating(s)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                    <Ionicons name={s <= newRating ? 'star' : 'star-outline'} size={30} color={colors.star} />
                  </TouchableOpacity>
                ))}
              </View>
              <View style={[styles.reviewInputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <TextInput
                  style={[styles.reviewInput, { color: colors.text }]}
                  placeholder={t('storeReviewPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  multiline
                  maxLength={500}
                  value={newComment}
                  onChangeText={setNewComment}
                />
                <Text style={[styles.charCounter, { color: colors.textMuted }]}>{newComment.length}/500</Text>
              </View>
              <View style={styles.tipsRow}>
                {[t('tipQuality'), t('tipDeliverySpeed'), t('tipService'), t('tipPrices')].map((tip) => (
                  <TouchableOpacity
                    key={tip}
                    style={[styles.tipChip, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                    activeOpacity={0.7}
                    onPress={() => setNewComment((prev) => (prev ? `${prev} ${tip}.` : `${tip}.`))}
                  >
                    <Text style={[styles.tipChipText, { color: colors.textSecondary }]}>{tip}</Text>
                    <Ionicons name="add" size={13} color={colors.primary} />
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: submittingReview ? 0.6 : 1 }]}
                onPress={handleSubmitReview}
                disabled={submittingReview}
                activeOpacity={0.85}
              >
                {submittingReview
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={styles.submitBtnText}>{t('submitReviewBtn')}</Text>}
              </TouchableOpacity>
            </View>

            {/* Список отзывов */}
            {reviews.map((r, i) => (
              <View key={i} style={[styles.reviewItem, { borderTopColor: colors.divider, borderTopWidth: i === 0 ? 0 : 1 }]}>
                <View style={styles.reviewHead}>
                  {getImageUrl(r.userAvatarUrl) ? (
                    <Image
                      source={{ uri: getImageUrl(r.userAvatarUrl) }}
                      style={styles.reviewAvatar}
                    />
                  ) : (
                    <View style={[styles.reviewAvatar, { backgroundColor: colors.primary + '30' }]}>
                      <Text style={[styles.reviewAvatarText, { color: colors.primary }]}>
                        {(r.userName || 'U').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.reviewName, { color: colors.text }]}>{r.userName || t('buyer')}</Text>
                    <View style={styles.reviewStars}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Ionicons key={s} name={s <= r.rating ? 'star' : 'star-outline'} size={11} color={colors.star} />
                      ))}
                    </View>
                  </View>
                  {r.createdAt ? (
                    <Text style={[styles.reviewDate, { color: colors.textMuted }]}>
                      {new Date(r.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                    </Text>
                  ) : null}
                </View>
                {r.comment ? <Text style={[styles.reviewComment, { color: colors.textSecondary }]}>{r.comment}</Text> : null}
              </View>
            ))}
          </View>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <ProductCard
              product={item}
              onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
              onFavorite={() => toggleFav(item.id, item)}
              isFavorite={isFavorite(item.id)}
            />
          </View>
        )}
      />

      {/* ── Прозрачная шапка поверх обложки: фон отсутствует, фото видно насквозь ── */}
      <View style={styles.topBarOverlay} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.overlayBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.overlayTitle} numberOfLines={1}>
          {company?.name || t('storeWord')}
        </Text>
        <TouchableOpacity
          style={styles.overlayBtn}
          onPress={handleShareStore}
          activeOpacity={0.8}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  // Прозрачная шапка-оверлей поверх обложки
  topBarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 20,
  },
  overlayBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  overlayTitle: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  // Обложка тянется до верха экрана и заходит под прозрачную шапку
  cover: {
    height: 320,
    overflow: 'hidden',
  },
  coverAccent: { flex: 1 },
  coverImg: { width: '100%', height: '100%' },
  // Верхнее затемнение — держит иконки/название читаемыми поверх фото
  coverTopTint: { position: 'absolute', left: 0, right: 0, top: 0, height: 150 },
  // Нижняя часть обложки плавно и долго растворяется в фоне приложения
  coverFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 180 },
  // Карточка 1 — логотип/имя/рейтинг (frosted, наезжает на растворяющийся низ обложки)
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 16,
    marginTop: -58,
    borderRadius: 26,
    borderWidth: 1,
    padding: 18,
  },
  // Карточка 2 — статистика + подписка (frosted)
  statsCard: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 16,
    borderRadius: 26,
    borderWidth: 1,
    padding: 18,
    gap: 16,
  },
  headInfo: { flex: 1, gap: 5 },
  logo: { width: 78, height: 78, borderRadius: 39, borderWidth: 1 },
  logoFallback: { width: 78, height: 78, borderRadius: 39, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  logoInitial: { fontSize: 30, fontWeight: '800', color: '#FFFFFF' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  companyName: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4, flexShrink: 1 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, marginTop: 2 },
  verifiedText: { color: '#3B82F6', fontSize: 11.5, fontWeight: '700' },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addressText: { fontSize: 13, flex: 1 },
  ratingBox: { alignItems: 'center', justifyContent: 'center', paddingLeft: 8, paddingVertical: 4 },
  ratingBoxNum: { fontSize: 24, fontWeight: '800' },
  ratingBoxLabel: { fontSize: 11, fontWeight: '600', marginTop: 3, textAlign: 'center', lineHeight: 14 },
  statTiles: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  statTile: { flex: 1, paddingVertical: 4, paddingHorizontal: 4, alignItems: 'center', gap: 7 },
  statDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: 8 },
  statIconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  ratingValue: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statTileLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  companyDesc: { fontSize: 14, lineHeight: 20 },
  subscribeBtnWrap: { borderRadius: 16, overflow: 'hidden' },
  subscribeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 16 },
  subscribeBtnText: { fontSize: 16, fontWeight: '700' },
  productsLabel: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3, paddingHorizontal: 16, marginBottom: 12 },
  tabsRow: { flexDirection: 'row', paddingHorizontal: 16, borderBottomWidth: 1, marginBottom: 12 },
  tabBtn: { paddingVertical: 12, marginRight: 22, alignItems: 'center' },
  tabText: { fontSize: 14, fontWeight: '600' },
  tabUnderline: { height: 2.5, borderRadius: 2, alignSelf: 'stretch', marginTop: 8 },
  aboutRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: 1 },
  aboutText: { fontSize: 14, flex: 1 },
  listContent: { paddingBottom: 24 },
  row: { paddingHorizontal: 16, gap: 12 },
  cardWrap: { flex: 1 },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 15 },
  reviewsWrap: { paddingHorizontal: 16, paddingTop: 20 },
  rateCard: { paddingVertical: 4, marginBottom: 12 },
  rateTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  rateSub: { fontSize: 12.5, lineHeight: 18, marginBottom: 12 },
  starRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  reviewInputWrap: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 },
  reviewInput: { fontSize: 14, minHeight: 64, textAlignVertical: 'top', padding: 0 },
  charCounter: { fontSize: 11, alignSelf: 'flex-end', marginTop: 4 },
  tipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 14 },
  tipChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 12, paddingRight: 8, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  tipChipText: { fontSize: 11.5, fontWeight: '500' },
  submitBtn: { paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  reviewItem: { paddingVertical: 12 },
  reviewHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  reviewAvatarText: { fontSize: 16, fontWeight: '700' },
  reviewName: { fontSize: 14, fontWeight: '600' },
  reviewStars: { flexDirection: 'row', gap: 2, marginTop: 2 },
  reviewDate: { fontSize: 12 },
  reviewComment: { fontSize: 14, lineHeight: 20 },
});
