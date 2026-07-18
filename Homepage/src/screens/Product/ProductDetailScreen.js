import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Image,
  FlatList, Dimensions, ActivityIndicator, Share, TextInput, Modal, Platform, Animated,
} from 'react-native';
import { Alert } from '../../utils/alert';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useCart } from '../../context/CartContext';
import { useFavorites } from '../../context/FavoritesContext';
import {
  getProductDetail, getProductReviews, getProductReviewStats,
  getSimilarProducts, submitReview, voteReview, getProductVariants,
  getProductQuestions, askProductQuestion, getFrequentlyBoughtWith,
  getCompanyDetail, uploadReviewImage, trackProductView, submitComplaint,
  getFlashSale, notifyWhenInStock, getProductBundles,
} from '../../api';
import { getImageUrl } from '../../utils/imageUrl';
import { tryOpenInApp } from '../../utils/openInApp';
import { tapLight, tapMedium, notifySuccess, notifyError } from '../../utils/haptics';
import ProductCard from '../../components/common/ProductCard';

const { width } = Dimensions.get('window');

export default function ProductDetailScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { addItem, items } = useCart();
  const { isFavorite: ctxIsFavorite, toggle: toggleFav } = useFavorites();
  const navigation = useNavigation();
  const route = useRoute();
  const { productId, openReview } = route.params;
  // 🔗 «Оцените покупку» из заказа: после загрузки скроллим к форме отзыва
  const scrollRef = useRef(null);
  const reviewScrolled = useRef(false);

  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [frequentlyBought, setFrequentlyBought] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [variants, setVariants] = useState([]);
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [imgIndex, setImgIndex] = useState(0);
  const [addedToCart, setAddedToCart] = useState(false);
  const toastAnim = useRef(new Animated.Value(0)).current;

  // Всплывающий тост «Добавлено в корзину» при успешном добавлении.
  useEffect(() => {
    if (addedToCart) {
      Animated.sequence([
        Animated.spring(toastAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
        Animated.delay(1400),
        Animated.timing(toastAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [addedToCart, toastAnim]);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [votedReviews, setVotedReviews] = useState({});
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewImages, setReviewImages] = useState([]);      // локальные URI выбранных фото
  const [reviewFilter, setReviewFilter] = useState('all');   // 'all' | 'photo' | '5'..'1'
  const [reviewPhotoZoom, setReviewPhotoZoom] = useState(null);
  // ❓ Вопросы о товаре
  const [questions, setQuestions] = useState([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [isSubmittingQuestion, setIsSubmittingQuestion] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);
  const [imgErrors, setImgErrors] = useState({});
  const [company, setCompany] = useState(null);
  const [companyLogoError, setCompanyLogoError] = useState(false);
  const [reviewAvatarErrors, setReviewAvatarErrors] = useState({});
  const [zoomVisible, setZoomVisible] = useState(false);
  const imgRef = useRef(null);
  const imgIndexRef = useRef(0);

  const inCart = items.some(i => i.productId === productId);

  // ⚡ Флеш-распродажа + 🔔 подписка на поступление
  const [flashSale, setFlashSale] = useState(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [stockNotified, setStockNotified] = useState(false);

  // 🧩 Комплекты «вместе дешевле», в которые входит этот товар
  const [bundles, setBundles] = useState([]);
  const [addingBundleId, setAddingBundleId] = useState(null);

  useEffect(() => {
    loadAll();
    getFlashSale(productId).then((fs) => setFlashSale(fs?.active ? fs : null)).catch(() => {});
    getProductBundles(productId).then(setBundles).catch(() => setBundles([]));
    setStockNotified(false);
    // 🔗 Ссылка «Поделиться» открыта в браузере → пробуем открыть приложение.
    tryOpenInApp(`product/${productId}`);
  }, [productId]);

  // Добавить весь комплект в корзину — скидка применится сама при оформлении.
  const handleAddBundle = async (bundle) => {
    if (!bundle?.items?.length) return;
    setAddingBundleId(bundle.id);
    tapMedium();
    try {
      for (const it of bundle.items) {
        if (!items.some((ci) => ci.productId === it.id)) {
          await addItem(it.id, 1);
        }
      }
      notifySuccess();
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 2000);
    } catch (err) {
      notifyError();
      Alert.alert(t('error'), err?.response?.data?.error || t('addToCartFail'));
    } finally {
      setAddingBundleId(null);
    }
  };

  // Тикаем раз в секунду, пока идёт флеш-распродажа — для обратного отсчёта.
  useEffect(() => {
    if (!flashSale?.endsAt) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [flashSale]);

  // Оставшееся время флеш-распродажи в формате Чч Мм Сс (или null, если истекло).
  const flashRemaining = React.useMemo(() => {
    if (!flashSale?.endsAt) return null;
    const diff = new Date(flashSale.endsAt).getTime() - nowTick;
    if (diff <= 0) return null;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, [flashSale, nowTick]);

  // 📋 Авто-характеристики (без ИИ): из полей товара + вариантов + разбор
  // названия/описания по словарю. Ленивый продавец ничего не пишет — заполнится само.
  const characteristics = React.useMemo(() => {
    if (!product) return [];
    const rows = [];
    const add = (label, value) => { if (value) rows.push({ label, value: String(value) }); };
    add(t('articleLabel') || 'Артикул', product.article);
    add(t('brandLabel') || 'Бренд', product.brand);
    add(t('categoryLabel') || 'Категория', product.category);
    // Цвета/размеры — из вариантов, если есть, иначе из полей.
    const colors2 = [...new Set(variants.map(v => v.color).filter(Boolean))];
    const sizes2 = [...new Set(variants.map(v => v.size).filter(Boolean))];
    add(t('colorLabel') || 'Цвет', colors2.length ? colors2.join(', ') : product.color);
    // Размеры разделяем точкой с запятой — читается аккуратнее, чем запятая.
    add(t('sizeLabel') || 'Размер', sizes2.length ? sizes2.join('; ') : product.size);

    // Разбор названия+описания по словарю (чистый алгоритм).
    const text = `${product.name || ''} ${product.description || ''}`.toLowerCase();
    const materials = { 'хлопок': 'Хлопок', 'кожа': 'Кожа', 'шерсть': 'Шерсть', 'лён': 'Лён', 'полиэстер': 'Полиэстер', 'металл': 'Металл', 'пластик': 'Пластик', 'дерев': 'Дерево', 'стекло': 'Стекло', 'силикон': 'Силикон', 'алюмин': 'Алюминий', 'керамик': 'Керамика', 'титан': 'Титан', 'paxta': 'Paxta', 'charm': 'Charm' };
    for (const [k, v] of Object.entries(materials)) { if (text.includes(k)) { add(t('materialLabel') || 'Материал', v); break; } }
    const mem = text.match(/(\d+)\s?(тб|tb|гб|gb)\b/i);
    if (mem) add(t('memoryLabel') || 'Память', `${mem[1]} ${mem[2].toUpperCase()}`);
    const ram = text.match(/(\d+)\s?(гб|gb)\s?(ram|озу)/i);
    if (ram) add('RAM', `${ram[1]} ${ram[2].toUpperCase()}`);
    const diag = text.match(/(\d{1,2}[.,]?\d?)\s?("|дюйм|inch|″)/i);
    if (diag) add(t('screenLabel') || 'Экран', `${diag[1].replace(',', '.')}"`);
    return rows;
  }, [product, variants, t]);

  // Товар полностью закончился (нет ни базового остатка, ни вариантов в наличии).
  const isOutOfStock = React.useMemo(() => {
    if (variants && variants.length > 0) {
      return !variants.some((v) => (v.stockQuantity || 0) > 0);
    }
    return product ? (product.quantity || 0) <= 0 : false;
  }, [product, variants]);

  // Суммарный остаток (по вариантам, если они есть) — для метки «Осталось N шт.»
  const totalStock = React.useMemo(() => {
    if (variants && variants.length > 0) {
      return variants.reduce((s, v) => s + (v.stockQuantity || 0), 0);
    }
    return product ? (product.quantity || 0) : 0;
  }, [product, variants]);

  // 🔔 Подписаться на уведомление о поступлении
  const handleNotifyStock = async () => {
    if (!user?.phone) {
      Alert.alert(t('notifyStockTitle') || 'Уведомить о поступлении',
        t('notifyStockNeedLogin') || 'Войдите, чтобы получить уведомление, когда товар появится.');
      return;
    }
    try {
      tapLight();
      await notifyWhenInStock(productId, user.phone);
      setStockNotified(true);
      notifySuccess();
    } catch (e) {
      notifyError();
      Alert.alert(t('error') || 'Ошибка', 'Не удалось подписаться');
    }
  };

  // Фиксируем просмотр товара для «недавно смотрели» и персональных рекомендаций.
  useEffect(() => {
    if (user?.phone && productId) trackProductView(productId, user.phone);
  }, [productId, user?.phone]);

  // Автопрокрутка фото товара каждые 6 сек, если фото больше одного
  useEffect(() => {
    const count = product?.images?.length || 0;
    if (count <= 1 || zoomVisible) return;
    const t = setInterval(() => {
      const next = (imgIndexRef.current + 1) % count;
      imgIndexRef.current = next;
      setImgIndex(next);
      imgRef.current?.scrollTo({ x: next * width, animated: true });
    }, 6000);
    return () => clearInterval(t);
  }, [product?.images?.length, zoomVisible]);

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const [prodData, revData, statsData, simData, varData, qData, freqData] = await Promise.allSettled([
        getProductDetail(productId),
        getProductReviews(productId, user?.phone),
        getProductReviewStats(productId),
        getSimilarProducts(productId),
        getProductVariants(productId),
        // Вопросы приватны: грузим только свои (по телефону). Гость — пустой список.
        user?.phone ? getProductQuestions(productId, user.phone) : Promise.resolve([]),
        getFrequentlyBoughtWith(productId),
      ]);
      if (qData.status === 'fulfilled') setQuestions(qData.value);
      if (prodData.status === 'fulfilled') setProduct(prodData.value);
      if (revData.status === 'fulfilled') {
        setReviews(revData.value);
        const initialVotes = {};
        revData.value.forEach(r => {
          if (r.userVote) initialVotes[r.id] = r.userVote;
        });
        setVotedReviews(initialVotes);
      }
      if (statsData.status === 'fulfilled') setStats(statsData.value);
      if (simData.status === 'fulfilled') setSimilar(simData.value.slice(0, 6));
      if (varData.status === 'fulfilled') setVariants(varData.value);
      if (freqData.status === 'fulfilled') setFrequentlyBought(freqData.value.slice(0, 6));
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  // Подгружаем данные магазина (логотип, рейтинг) для блока «Продавец».
  useEffect(() => {
    const cid = product?.companyId;
    if (!cid) return;
    let active = true;
    setCompanyLogoError(false);
    getCompanyDetail(cid)
      .then((c) => { if (active) setCompany(c); })
      .catch(() => { if (active) setCompany(null); });
    return () => { active = false; };
  }, [product?.companyId]);

  const handleFavorite = () => {
    // Избранное привязано к аккаунту — гостю предлагаем войти, а не молча
    // игнорируем нажатие (раньше кнопка казалась «сломанной»).
    if (!user) {
      Alert.alert(
        t('favorites') || 'Избранное',
        t('loginToFavorite') || 'Войдите, чтобы добавлять товары в избранное.',
        [
          { text: t('cancel') || 'Отмена', style: 'cancel' },
          { text: t('login') || 'Войти', onPress: () => navigation.navigate('Login') },
        ],
      );
      return;
    }
    tapMedium();
    toggleFav(productId, product ?? undefined);
  };

  const uniqueColors = [...new Set(variants.map(v => v.color).filter(Boolean))];
  const sizesForColor = (color) =>
    color
      ? [...new Set(variants.filter(v => v.color === color).map(v => v.size).filter(Boolean))]
      : [...new Set(variants.map(v => v.size).filter(Boolean))];
  const hasVariants = variants.length > 0;

  const handleSelectColor = (color) => {
    tapLight();
    const next = selectedColor === color ? null : color;
    setSelectedColor(next);
    setSelectedSize(null);
    setSelectedVariant(null);
  };

  const handleSelectSize = (size) => {
    tapLight();
    const next = selectedSize === size ? null : size;
    setSelectedSize(next);
    if (next) {
      // Цвет необязателен: если он выбран — ищем вариант внутри цвета,
      // иначе берём первый вариант с таким размером (в наличии — приоритет).
      const match = selectedColor
        ? variants.find(v => v.color === selectedColor && v.size === next)
        : (variants.find(v => v.size === next && (v.stockQuantity || 0) > 0)
          ?? variants.find(v => v.size === next));
      setSelectedVariant(match ?? null);
    } else {
      setSelectedVariant(null);
    }
  };

  const handleAddToCart = async () => {
    if (!product) return;
    // Гость тоже может добавлять — корзина хранится локально и переносится
    // на сервер после входа (вход спросим только при оформлении).
    if (hasVariants && !selectedVariant) {
      Alert.alert(t('selectVariant'), t('selectSize'));
      return;
    }
    if (inCart) {
      navigation.navigate('Main', { screen: 'Cart' });
      return;
    }
    setIsAddingToCart(true);
    try {
      await addItem(
        productId, 1,
        selectedVariant?.color || selectedColor || undefined,
        selectedVariant?.size || selectedSize || undefined,
      );
      notifySuccess(); // 📳 тактильное «готово»
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 2000);
    } catch (err) {
      notifyError();
      Alert.alert(t('error'), err?.response?.data?.error || t('addToCartFail'));
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleBuyNow = async () => {
    if (!product) return;
    if (hasVariants && !selectedVariant) {
      Alert.alert(t('selectVariant'), t('selectSize'));
      return;
    }
    tapMedium();
    if (!inCart) {
      try {
        await addItem(
          productId, 1,
          selectedVariant?.color || selectedColor || undefined,
          selectedVariant?.size || selectedSize || undefined,
        );
      } catch (err) {
        notifyError();
        Alert.alert(t('error'), err?.response?.data?.error || t('addToCartFail'));
        return;
      }
    }
    navigation.navigate('Main', { screen: 'Cart' });
  };

  // 🚩 Пожаловаться на товар: выбор причины → отправка админу.
  const handleReport = () => {
    const reasons = [
      { key: 'fake', label: t('reportFake') || 'Подделка / обман' },
      { key: 'prohibited', label: t('reportProhibited') || 'Запрещённый товар' },
      { key: 'wrong_info', label: t('reportWrongInfo') || 'Неверное описание/цена' },
      { key: 'other', label: t('reportOther') || 'Другое' },
    ];
    Alert.alert(
      t('reportTitle') || 'Пожаловаться на товар',
      t('reportSubtitle') || 'Выберите причину — администратор проверит.',
      [
        ...reasons.map(r => ({
          text: r.label,
          onPress: async () => {
            try {
              await submitComplaint({ targetType: 'product', targetId: productId, customerPhone: user?.phone, reason: r.label });
              notifySuccess();
              Alert.alert(t('reportSentTitle') || 'Жалоба отправлена', t('reportSentMsg') || 'Спасибо! Мы проверим этот товар.');
            } catch {
              Alert.alert(t('error'), t('reportFailMsg') || 'Не удалось отправить жалобу');
            }
          },
        })),
        { text: t('cancel') || 'Отмена', style: 'cancel' },
      ],
    );
  };

  // Назад: если экран открыт по внешней ссылке и снизу ничего нет — уводим
  // на главную (с таб-баром), а не оставляем в тупике.
  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Main', { screen: 'Home' });
  };

  const handleShare = async () => {
    if (!product) return;
    const price = (selectedVariant?.sellingPrice || selectedVariant?.price || product.sellingPrice || product.price || 0).toLocaleString('ru-RU');
    // Умная ссылка: у кого установлено приложение — откроется приложение
    // (App Links/deep linking), у остальных — сайт с карточкой товара.
    const url = `https://axentis.uz/product/${productId}`;
    await Share.share({
      title: product.name,
      message: `${product.name}\n${price} ${t('sum')}\n\n${url}`,
      url,
    });
  };

  const handleVote = async (reviewId, voteType) => {
    if (!user) return;
    const currentVote = votedReviews[reviewId] ?? null;
    const newVote = currentVote === voteType ? null : voteType;
    setVotedReviews(prev => ({ ...prev, [reviewId]: newVote }));
    setReviews(prev => prev.map(r => {
      if (r.id !== reviewId) return r;
      let likes = r.likes;
      let dislikes = r.dislikes;
      if (currentVote === 'like') likes = Math.max(0, likes - 1);
      if (currentVote === 'dislike') dislikes = Math.max(0, dislikes - 1);
      if (newVote === 'like') likes = likes + 1;
      if (newVote === 'dislike') dislikes = dislikes + 1;
      return { ...r, likes, dislikes };
    }));
    try {
      await voteReview(reviewId, user.phone, voteType);
    } catch {
      setVotedReviews(prev => ({ ...prev, [reviewId]: currentVote }));
      await loadAll();
    }
  };

  const pickReviewImage = async () => {
    if (reviewImages.length >= 5) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('noGalleryAccess'), t('allowGallery'));
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!res.canceled && res.assets?.[0]?.uri) {
      setReviewImages(prev => [...prev, res.assets[0].uri].slice(0, 5));
    }
  };

  const removeReviewImage = (uri) => {
    setReviewImages(prev => prev.filter(u => u !== uri));
  };

  const handleSubmitReview = async () => {
    if (!user || !product) return;
    if (!newComment.trim() && reviewImages.length === 0) {
      Alert.alert(t('error'), t('emptyReviewError'));
      return;
    }
    const userReviewCount = reviews.filter(r => r.userPhone === user.phone).length;
    if (userReviewCount >= 2) {
      Alert.alert(t('limitTitle'), t('reviewLimitMsg'));
      return;
    }
    setIsSubmittingReview(true);
    try {
      // Сначала грузим фотографии (если есть) и собираем их URL-ы.
      let uploaded = [];
      if (reviewImages.length > 0) {
        const results = await Promise.all(reviewImages.map(uri => uploadReviewImage(uri).catch(() => null)));
        uploaded = results.filter(Boolean);
      }
      const review = await submitReview({
        product_id: productId,
        user_phone: user.phone,
        user_name: user.name,
        rating: newRating,
        comment: newComment.trim() || undefined,
        images: uploaded,
      });
      setReviews(prev => [review, ...prev]);
      setNewComment('');
      setNewRating(5);
      setReviewImages([]);
      Alert.alert(t('thanksWord'), t('reviewAdded'));
    } catch (err) {
      Alert.alert(t('error'), err?.response?.data?.error || t('reviewSendFail'));
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!user) {
      Alert.alert(t('loginWord'), t('loginToAskMsg'));
      return;
    }
    if (!newQuestion.trim()) {
      Alert.alert(t('questionWord'), t('enterQuestion'));
      return;
    }
    setIsSubmittingQuestion(true);
    try {
      await askProductQuestion(productId, {
        userPhone: user.phone,
        userName: user.name,
        question: newQuestion.trim(),
      });
      setNewQuestion('');
      // Обновляем список вопросов с сервера
      try { setQuestions(await getProductQuestions(productId, user.phone)); } catch { /* ignore */ }
      Alert.alert(t('thanksWord'), t('questionSentMsg'));
    } catch (err) {
      Alert.alert(t('error'), err?.response?.data?.error || t('uploadFail'));
    } finally {
      setIsSubmittingQuestion(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>{t('productNotFound')}</Text>
      </View>
    );
  }

  const images = product.images?.length > 0 ? product.images : [];
  const basePrice = product.discountedPrice || product.sellingPrice || product.price;
  const variantPrice = selectedVariant ? (selectedVariant.sellingPrice || selectedVariant.price) : null;
  const displayPrice = variantPrice ?? basePrice;
  const originalPrice = product.discountedPrice ? (product.sellingPrice || product.price) : null;
  const discount = product.discountPercent;
  const minVariantPrice = variants.length > 0 ? Math.min(...variants.map(v => v.sellingPrice || v.price)) : null;
  const maxVariantPrice = variants.length > 0 ? Math.max(...variants.map(v => v.sellingPrice || v.price)) : null;
  const bottomDisplayPrice = selectedVariant
    ? (selectedVariant.sellingPrice || selectedVariant.price)
    : (hasVariants && minVariantPrice !== null ? minVariantPrice : basePrice);
  const hasReviews = (stats?.totalReviews ?? 0) > 0;
  const displayRating = hasReviews ? (stats?.averageRating ?? 5) : 5;
  const reviewsWithPhotos = reviews.filter(r => (r.images?.length || 0) > 0).length;
  const filteredReviews = reviews.filter(r => {
    if (reviewFilter === 'all') return true;
    if (reviewFilter === 'photo') return (r.images?.length || 0) > 0;
    return String(r.rating) === reviewFilter;
  });

  // Ширина карточки в блоках «Похожие» / «С этим покупают» — примерно на 30%
  // меньше карточки на главной (там 2 в ряд), но та же раскладка ProductCard.
  const SIM_CARD_W = Math.round((width - 32) / 2.85);
  const IMG_W = Math.round((width - 32) * 0.46); // (устар.) фото в двухколоночной шапке
  const IMG_FULL = width - 32; // фото на всю ширину контента
  const normalizeImages = (imgs) =>
    Array.isArray(imgs) ? imgs : imgs ? [imgs] : [];

  // Цена с приставкой/суффиксом «от» / «до» в зависимости от языка
  // (ru: «от 12 000 сум», uz: «12 000 so'mdan»).
  const fmtSum = (p) => `${(p || 0).toLocaleString('ru-RU')} ${t('sum')}`;
  const fromPrice = (p) => language === 'uz'
    ? `${fmtSum(p)}${t('priceFrom')}`
    : `${t('priceFrom')} ${fmtSum(p)}`;
  const toPrice = (p) => language === 'uz'
    ? `${fmtSum(p)}${t('toWord')}`
    : `${t('toWord')} ${fmtSum(p)}`;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={[styles.topBar, { backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={goBack} style={[styles.topBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.topActions}>
          <TouchableOpacity onPress={handleShare} style={[styles.topBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}>
            <Ionicons name="share-outline" size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleFavorite} style={[styles.topBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}>
            <Ionicons
              name={ctxIsFavorite(productId) ? 'heart' : 'heart-outline'}
              size={20}
              color={ctxIsFavorite(productId) ? colors.error : colors.text}
            />
          </TouchableOpacity>
          {/* 🛒 Быстрый переход в корзину — не нужно возвращаться на главную */}
          <TouchableOpacity
            onPress={() => navigation.navigate('Main', { screen: 'Cart' })}
            style={[styles.topBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
          >
            <Ionicons name="cart-outline" size={20} color={colors.text} />
            {items.length > 0 && (
              <View style={[styles.cartBadge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
                <Text style={styles.cartBadgeText}>{items.length > 99 ? '99+' : items.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
        <View style={styles.body}>
          {/* ── Фото товара на всю ширину ── */}
          <View style={[styles.imgColFull, { width: IMG_FULL, backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
            {images.length > 0 ? (
              <>
                <ScrollView
                  ref={imgRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(e) => {
                    const i = Math.round(e.nativeEvent.contentOffset.x / IMG_FULL);
                    imgIndexRef.current = i;
                    setImgIndex(i);
                  }}
                >
                  {images.map((img, i) => (
                    imgErrors[i] ? (
                      <View key={i} style={[styles.noImg, { width: IMG_FULL, height: IMG_FULL }]}>
                        <Ionicons name="cube-outline" size={64} color={colors.textMuted} />
                      </View>
                    ) : (
                      <TouchableOpacity key={i} activeOpacity={0.95} onPress={() => setZoomVisible(true)}>
                        <Image
                          source={{ uri: getImageUrl(img) || '' }}
                          style={{ width: IMG_FULL, height: IMG_FULL }}
                          resizeMode="cover"
                          onError={() => setImgErrors(prev => ({ ...prev, [i]: true }))}
                        />
                      </TouchableOpacity>
                    )
                  ))}
                </ScrollView>
                {images.length > 1 && (
                  <View style={styles.imgDots}>
                    {images.map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.imgDot,
                          { backgroundColor: i === imgIndex ? colors.primary : colors.border },
                          i === imgIndex && { width: 14 },
                        ]}
                      />
                    ))}
                  </View>
                )}
              </>
            ) : (
              <View style={[styles.noImg, { width: IMG_FULL, height: IMG_FULL }]}>
                <Ionicons name="cube-outline" size={64} color={colors.textMuted} />
              </View>
            )}
            {discount && discount > 0 && (
              <View style={[styles.badge, styles.badgeAbs, { backgroundColor: colors.error }]}>
                <Text style={styles.badgeText}>-{discount}%</Text>
              </View>
            )}
          </View>

          {/* ── Информация о товаре под фото ── */}
          <View style={styles.infoColFull}>
              <Text style={[styles.prodName, { color: colors.text }]} numberOfLines={3}>{product.name}</Text>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={13} color={colors.star} />
                <Text style={[styles.ratingNum, { color: colors.textSecondary }]}>{displayRating.toFixed(1)}</Text>
                <Text style={[styles.ratingCount, { color: colors.textMuted }]}>
                  · {hasReviews ? `${stats.totalReviews} ${t('reviewsWord')}` : t('noReviewsShort')}
                </Text>
              </View>
              <Text style={[styles.priceFrom, { color: colors.textMuted }]}>{t('priceFrom')}</Text>
              {selectedVariant ? (
                <Text style={[styles.price, { color: colors.primary }]}>{fmtSum(displayPrice)}</Text>
              ) : hasVariants && minVariantPrice !== null && minVariantPrice !== maxVariantPrice ? (
                <Text style={[styles.price, { color: colors.text }]}>
                  {minVariantPrice.toLocaleString('ru-RU')} — {fmtSum(maxVariantPrice)}
                </Text>
              ) : (
                <Text style={[styles.price, { color: colors.text }]}>
                  {fmtSum(hasVariants && minVariantPrice !== null ? minVariantPrice : displayPrice)}
                </Text>
              )}
              {originalPrice && !selectedVariant && (
                <Text style={[styles.oldPrice, { color: colors.textMuted }]}>{fmtSum(originalPrice)}</Text>
              )}
              {/* 🔥 Срочность: честный низкий остаток подталкивает к покупке */}
              {!isOutOfStock && totalStock > 0 && totalStock <= 5 && (
                <View style={styles.lowStockRow}>
                  <Ionicons name="flame" size={14} color="#F97316" />
                  <Text style={styles.lowStockText}>
                    {(t('onlyLeftStock') || 'Осталось всего {n} шт.').replace('{n}', String(totalStock))}
                  </Text>
                </View>
              )}
          </View>

          {/* ⚡ Флеш-распродажа с обратным отсчётом */}
          {flashSale && flashRemaining && (
            <View style={styles.flashBanner}>
              <View style={styles.flashLeft}>
                <Ionicons name="flash" size={18} color="#FFF" />
                <Text style={styles.flashText}>
                  {t('flashSale') || 'Флеш-распродажа'} −{Math.round(flashSale.discountPercent)}%
                </Text>
              </View>
              <View style={styles.flashTimer}>
                <Ionicons name="time-outline" size={14} color="#FFF" />
                <Text style={styles.flashTimerText}>{flashRemaining}</Text>
              </View>
            </View>
          )}

          {hasVariants && (
            <View style={styles.variantSection}>
              {uniqueColors.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={[styles.variantLabel, { color: colors.text }]}>{t('colorLabel')}</Text>
                  <View style={styles.chipRow}>
                    {uniqueColors.map((c) => {
                      const isSel = selectedColor === c;
                      return (
                        <TouchableOpacity
                          key={c}
                          onPress={() => handleSelectColor(c)}
                          style={[
                            styles.colorChip,
                            {
                              backgroundColor: colors.inputBg,
                              borderColor: isSel ? colors.primary : colors.border,
                              borderWidth: isSel ? 2 : 1,
                            },
                          ]}
                          activeOpacity={0.75}
                        >
                          <Text style={[styles.colorChipText, { color: colors.text }]} numberOfLines={1}>{c}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {sizesForColor(selectedColor).length > 0 && (
                <View>
                  <Text style={[styles.variantLabel, { color: colors.text }]}>
                    {sizesForColor(selectedColor).some(s => /gb|гб|tb|тб|\d\/\d/i.test(String(s))) ? t('memoryLabel') : t('sizeLabel')}
                  </Text>
                  <View style={styles.chipRow}>
                    {sizesForColor(selectedColor).map((s) => {
                      const v = variants.find(vv => vv.color === selectedColor && vv.size === s)
                        ?? variants.find(vv => vv.size === s);
                      const outOfStock = v ? v.stockQuantity === 0 : false;
                      const isSel = selectedSize === s;
                      const sizePrice = v ? (v.sellingPrice || v.price) : null;
                      return (
                        <TouchableOpacity
                          key={s}
                          onPress={() => !outOfStock && handleSelectSize(s)}
                          style={[
                            styles.sizeChip,
                            {
                              backgroundColor: colors.inputBg,
                              borderColor: isSel ? colors.primary : colors.border,
                              borderWidth: isSel ? 2 : 1,
                              opacity: outOfStock ? 0.4 : 1,
                            },
                          ]}
                          activeOpacity={outOfStock ? 1 : 0.75}
                        >
                          <Text style={[styles.sizeChipText, { color: colors.text }]}>{s}</Text>
                          {sizePrice ? (
                            <Text style={[styles.sizeChipPrice, { color: isSel ? colors.primary : colors.textMuted }]}>
                              {fmtSum(sizePrice)}
                            </Text>
                          ) : null}
                          {outOfStock && <Text style={[styles.chipSub, { color: colors.textMuted }]}>{t('outOfStockShort')}</Text>}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {selectedVariant && (
                <View style={[styles.variantInfo, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={[styles.variantInfoText, { color: colors.text }]}>
                    {[selectedVariant.color, selectedVariant.size].filter(Boolean).join(' / ')}
                    {' · '}
                    <Text style={{ color: colors.primary, fontWeight: '700' }}>
                      {fmtSum(selectedVariant.sellingPrice || selectedVariant.price)}
                    </Text>
                    {selectedVariant.stockQuantity > 0
                      ? <Text style={{ color: colors.success }}>{`  · ${selectedVariant.stockQuantity} ${t('pcs')}`}</Text>
                      : <Text style={{ color: colors.error }}>{`  · ${t('outOfStock')}`}</Text>
                    }
                  </Text>
                </View>
              )}

              {!selectedVariant && (
                <Text style={[styles.variantHint, { color: colors.textMuted }]}>
                  {t('selectSize')}
                </Text>
              )}
            </View>
          )}

          <View style={[styles.deliveryBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="bicycle-outline" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.deliveryTitle, { color: colors.text }]}>{t('deliveryAvailable')}</Text>
              <Text style={[styles.deliverySub, { color: colors.textMuted }]}>{t('deliveryByCourierAddr')}</Text>
            </View>
            <Text style={[styles.deliveryFree, { color: colors.success }]}>{t('free')}</Text>
          </View>

          {/* 🧩 Комплекты «вместе дешевле» */}
          {bundles.map((b) => {
            const setSum = (b.items || []).reduce((s, it) => s + (it.price || 0), 0);
            const discounted = Math.round(setSum * (1 - (b.discountPercent || 0) / 100));
            return (
              <View key={`bundle-${b.id}`} style={[styles.bundleCard, { backgroundColor: colors.surface, borderColor: colors.primary + '55' }]}>
                <View style={styles.bundleHeader}>
                  <Text style={[styles.bundleTitle, { color: colors.text }]}>
                    🧩 {b.name || t('bundleTitle') || 'Вместе дешевле'}
                  </Text>
                  <View style={[styles.bundleBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.bundleBadgeText}>−{Math.round(b.discountPercent)}%</Text>
                  </View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bundleItemsRow}>
                  {(b.items || []).map((it, i) => (
                    <React.Fragment key={it.id}>
                      {i > 0 && <Text style={[styles.bundlePlus, { color: colors.textMuted }]}>+</Text>}
                      <TouchableOpacity
                        style={styles.bundleItem}
                        activeOpacity={0.8}
                        onPress={() => it.id !== productId && navigation.push('ProductDetail', { productId: it.id })}
                      >
                        <View style={[styles.bundleImgWrap, { backgroundColor: colors.cardAlt, borderColor: it.id === productId ? colors.primary : colors.border }]}>
                          {it.image ? (
                            <Image source={{ uri: getImageUrl(it.image) || '' }} style={styles.bundleImg} resizeMode="cover" />
                          ) : (
                            <Ionicons name="cube-outline" size={24} color={colors.textMuted} />
                          )}
                        </View>
                        <Text style={[styles.bundleItemName, { color: colors.text }]} numberOfLines={2}>{it.name}</Text>
                        <Text style={[styles.bundleItemPrice, { color: colors.textMuted }]}>{fmtSum(it.price)}</Text>
                      </TouchableOpacity>
                    </React.Fragment>
                  ))}
                </ScrollView>
                <View style={styles.bundleTotalRow}>
                  <Text style={[styles.bundleOldSum, { color: colors.textMuted }]}>{fmtSum(setSum)}</Text>
                  <Text style={[styles.bundleNewSum, { color: colors.primary }]}>{fmtSum(discounted)}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.bundleBtn, { backgroundColor: colors.primary, opacity: addingBundleId === b.id ? 0.6 : 1 }]}
                  onPress={() => handleAddBundle(b)}
                  disabled={addingBundleId === b.id}
                  activeOpacity={0.85}
                >
                  {addingBundleId === b.id ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="cart" size={16} color="#FFF" />
                      <Text style={styles.bundleBtnText}>{t('bundleAddAll') || 'Добавить комплект в корзину'}</Text>
                    </>
                  )}
                </TouchableOpacity>
                <Text style={[styles.bundleHint, { color: colors.textMuted }]}>
                  {t('bundleHint') || 'Скидка применится автоматически при оформлении заказа'}
                </Text>
              </View>
            );
          })}

          <View style={[styles.aboutCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.text, marginBottom: 12 }]}>{t('aboutProduct')}</Text>
            <View style={styles.aboutGrid}>
              <View style={styles.aboutCell}>
                <Ionicons name="pricetag-outline" size={16} color={colors.textMuted} />
                <Text style={[styles.aboutCellLabel, { color: colors.textMuted }]}>{t('categoryLabel')}</Text>
                <Text style={[styles.aboutCellValue, { color: colors.text }]} numberOfLines={1}>{product.category || t('generalCategory')}</Text>
              </View>
              <View style={[styles.aboutCell, { borderLeftColor: colors.border, borderLeftWidth: 1, borderRightColor: colors.border, borderRightWidth: 1 }]}>
                <Ionicons name="barcode-outline" size={16} color={colors.textMuted} />
                <Text style={[styles.aboutCellLabel, { color: colors.textMuted }]}>{t('articleLabel') || 'Артикул'}</Text>
                <Text style={[styles.aboutCellValue, { color: colors.text }]} numberOfLines={1}>{product.article || product.barcode || product.id}</Text>
              </View>
              <View style={styles.aboutCell}>
                <Ionicons name="cube-outline" size={16} color={colors.textMuted} />
                <Text style={[styles.aboutCellLabel, { color: colors.textMuted }]}>{t('availableLabel')}</Text>
                <Text style={[styles.aboutCellValue, { color: colors.text }]} numberOfLines={1}>{product.quantity} {t('pcs')}</Text>
              </View>
            </View>
            {product.description ? (
              <>
                <Text
                  style={[styles.desc, { color: colors.textSecondary, marginTop: 12 }]}
                  numberOfLines={showFullDesc ? undefined : 3}
                >
                  {product.description}
                </Text>
                <TouchableOpacity onPress={() => setShowFullDesc(p => !p)}>
                  <Text style={[styles.showMore, { color: colors.primary }]}>
                    {showFullDesc ? t('collapse') : t('readFull')}
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>

          {/* 📋 Характеристики (авто-заполнение) */}
          {characteristics.length > 0 && (
            <View style={[styles.aboutCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.text, marginBottom: 8 }]}>
                {t('characteristics') || 'Характеристики'}
              </Text>
              {characteristics.map((row, i) => (
                <View
                  key={row.label + i}
                  style={{
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    paddingVertical: 9,
                    borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.textMuted, fontSize: 14, flex: 1 }}>{row.label}</Text>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', flex: 1, textAlign: 'right' }} numberOfLines={2}>{row.value}</Text>
                </View>
              ))}
            </View>
          )}

          {product.companyId ? (
            <View style={[styles.companyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TouchableOpacity
                style={styles.companyTop}
                onPress={() => navigation.navigate('CompanyStore', { companyId: product.companyId })}
                activeOpacity={0.8}
              >
                <View style={[styles.companyLogo, { backgroundColor: colors.primary + '18', borderColor: colors.border }]}>
                  {company?.logoUrl && !companyLogoError ? (
                    <Image
                      source={{ uri: getImageUrl(company.logoUrl) || '' }}
                      style={styles.companyLogoImg}
                      onError={() => setCompanyLogoError(true)}
                    />
                  ) : (
                    <Text style={[styles.companyLogoText, { color: colors.primary }]}>
                      {(company?.name || product.companyName || 'M').charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.companyLabel, { color: colors.textMuted }]}>{t('seller')}</Text>
                  <View style={styles.companyNameRow}>
                    <Text style={[styles.companyName, { color: colors.text }]} numberOfLines={1}>
                      {company?.name || product.companyName || `${t('storeWord')} #${product.companyId}`}
                    </Text>
                    {Number(company?.averageRating || 0) >= 4.5 && (
                      <Ionicons name="checkmark-circle" size={16} color="#3B82F6" />
                    )}
                  </View>
                  {company?.ratingCount > 0 ? (
                    <View style={styles.companyMetaRow}>
                      <Ionicons name="star" size={12} color={colors.star} />
                      <Text style={[styles.companyMetaText, { color: colors.textSecondary }]}>
                        {Number(company.averageRating || 0).toFixed(1)} · {company.ratingCount} {t('ratingsWord')}
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.companyMetaText, { color: colors.textMuted }]}>{t('goToStore')}</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.companyAllBtn, { borderColor: colors.border }]}
                onPress={() => navigation.navigate('CompanyStore', { companyId: product.companyId })}
                activeOpacity={0.8}
              >
                <Ionicons name="storefront-outline" size={16} color={colors.primary} />
                <Text style={[styles.companyAllBtnText, { color: colors.primary }]}>{t('allSellerProducts')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {user && reviews.filter(r => r.userPhone === user.phone).length < 2 ? (
            <View
              style={styles.writeReviewCard}
              onLayout={(e) => {
                // Открыто из «Оцените покупку» в заказе — подводим к форме отзыва
                if (openReview && !reviewScrolled.current && scrollRef.current) {
                  reviewScrolled.current = true;
                  const y = e.nativeEvent.layout.y;
                  setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(y - 60, 0), animated: true }), 400);
                }
              }}
            >
              <Text style={[styles.writeReviewTitle, { color: colors.text }]}>{t('leaveReview')}</Text>
              <Text style={[styles.writeReviewSub, { color: colors.textMuted }]}>
                {t('reviewHelps')}
              </Text>

              {/* Оценка */}
              <View style={styles.ratingBlock}>
                <View style={styles.ratingHeader}>
                  <Text style={[styles.ratingFieldLabel, { color: colors.textSecondary }]}>{t('yourRating')}</Text>
                  <Text style={[styles.ratingValueHint, { color: colors.textMuted }]}>
                    {['', t('ratingPoor'), t('ratingFair'), t('ratingOk'), t('ratingGood'), t('ratingExcellent')][newRating] || t('selectRating')}
                  </Text>
                </View>
                <View style={styles.starRow}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <TouchableOpacity key={s} onPress={() => setNewRating(s)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                      <Ionicons name={s <= newRating ? 'star' : 'star-outline'} size={32} color={colors.star} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Комментарий */}
              <View style={styles.commentHeader}>
                <Text style={[styles.ratingFieldLabel, { color: colors.textSecondary }]}>{t('commentLabel')}</Text>
                <Text style={[styles.optionalLabel, { color: colors.textMuted }]}>{t('optional')}</Text>
              </View>
              <View style={[styles.reviewInputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <TextInput
                  style={[styles.reviewInput, { color: colors.text }]}
                  placeholder={t('reviewPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                  value={newComment}
                  onChangeText={setNewComment}
                />
                <Text style={[styles.charCounter, { color: colors.textMuted }]}>{newComment.length}/500</Text>
              </View>

              {/* Фото к отзыву */}
              <View style={styles.reviewPhotosRow}>
                {reviewImages.map((uri) => (
                  <View key={uri} style={styles.reviewPhotoThumbWrap}>
                    <Image source={{ uri }} style={styles.reviewPhotoThumb} />
                    <TouchableOpacity
                      style={styles.reviewPhotoRemove}
                      onPress={() => removeReviewImage(uri)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="close" size={12} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                ))}
                {reviewImages.length < 5 && (
                  <TouchableOpacity
                    style={[styles.addPhotoBtn, { borderColor: colors.border, backgroundColor: colors.inputBg }]}
                    onPress={pickReviewImage}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="camera-outline" size={20} color={colors.primary} />
                    <Text style={[styles.addPhotoText, { color: colors.textSecondary }]}>{t('addPhotoBtn')}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Подсказки */}
              <View style={styles.tipsRow}>
                {[
                  { icon: 'happy-outline', label: t('tipPolite') },
                  { icon: 'checkmark-circle-outline', label: t('tipOnTopic') },
                  { icon: 'people-outline', label: t('tipHelpOthers') },
                ].map((tip) => (
                  <View key={tip.label} style={[styles.tipChip, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                    <Ionicons name={tip.icon} size={13} color={colors.textMuted} />
                    <Text style={[styles.tipChipText, { color: colors.textSecondary }]}>{tip.label}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: isSubmittingReview ? 0.6 : 1 }]}
                onPress={handleSubmitReview}
                disabled={isSubmittingReview}
                activeOpacity={0.85}
              >
                {isSubmittingReview ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.submitBtnText}>{t('submitReviewBtn')}</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.reviewsSection}>
            <Text style={[styles.sectionLabel, { color: colors.text }]}>
              {t('reviewsTitle')} {reviews.length > 0 ? `(${reviews.length})` : ''}
            </Text>
            {reviews.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.reviewFilterRow}
              >
                {[
                  { key: 'all', label: t('tabAll') },
                  ...(reviewsWithPhotos > 0 ? [{ key: 'photo', label: `${t('withPhoto')} ${reviewsWithPhotos}` }] : []),
                  { key: '5', label: '5 ★' },
                  { key: '4', label: '4 ★' },
                  { key: '3', label: '3 ★' },
                  { key: '2', label: '2 ★' },
                  { key: '1', label: '1 ★' },
                ].map((f) => {
                  const active = reviewFilter === f.key;
                  return (
                    <TouchableOpacity
                      key={f.key}
                      style={[styles.reviewFilterChip, { backgroundColor: active ? colors.primary : colors.inputBg, borderColor: active ? colors.primary : colors.border }]}
                      onPress={() => setReviewFilter(f.key)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.reviewFilterText, { color: active ? '#FFF' : colors.textSecondary }]}>{f.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
            {reviews.length === 0 ? (
              <Text style={[styles.noReviews, { color: colors.textMuted }]}>{t('noReviewsBeFirst')}</Text>
            ) : (
              filteredReviews.map((review) => (
                <View key={review.id} style={[styles.reviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.reviewHeader}>
                    <View style={[styles.reviewAvatar, { backgroundColor: colors.primary + '30' }]}>
                      {review.userAvatarUrl && !reviewAvatarErrors[review.id] ? (
                        <Image
                          source={{ uri: getImageUrl(review.userAvatarUrl) || '' }}
                          style={styles.reviewAvatarImg}
                          onError={() => setReviewAvatarErrors(prev => ({ ...prev, [review.id]: true }))}
                        />
                      ) : (
                        <Text style={[styles.reviewAvatarText, { color: colors.primary }]}>
                          {review.userName?.charAt(0).toUpperCase() || 'U'}
                        </Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.reviewName, { color: colors.text }]}>{review.userName}</Text>
                      <View style={styles.reviewStars}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Ionicons key={s} name={s <= review.rating ? 'star' : 'star-outline'} size={11} color={colors.star} />
                        ))}
                      </View>
                    </View>
                    <Text style={[styles.reviewDate, { color: colors.textMuted }]}>
                      {new Date(review.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                  {review.comment ? (
                    <Text style={[styles.reviewComment, { color: colors.textSecondary }]}>{review.comment}</Text>
                  ) : null}
                  {review.images?.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reviewImagesRow}>
                      {review.images.map((img, idx) => (
                        <TouchableOpacity key={idx} onPress={() => setReviewPhotoZoom(getImageUrl(img))} activeOpacity={0.9}>
                          <Image source={{ uri: getImageUrl(img) }} style={styles.reviewImageThumb} />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                  <View style={styles.voteRow}>
                    <TouchableOpacity
                      style={[styles.voteBtn, { backgroundColor: votedReviews[review.id] === 'like' ? colors.primary + '20' : colors.inputBg }]}
                      onPress={() => handleVote(review.id, 'like')}
                    >
                      <Ionicons name={votedReviews[review.id] === 'like' ? 'thumbs-up' : 'thumbs-up-outline'} size={14} color={votedReviews[review.id] === 'like' ? colors.primary : colors.textMuted} />
                      <Text style={[styles.voteCount, { color: votedReviews[review.id] === 'like' ? colors.primary : colors.textMuted }]}>{review.likes}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.voteBtn, { backgroundColor: votedReviews[review.id] === 'dislike' ? colors.error + '20' : colors.inputBg }]}
                      onPress={() => handleVote(review.id, 'dislike')}
                    >
                      <Ionicons name={votedReviews[review.id] === 'dislike' ? 'thumbs-down' : 'thumbs-down-outline'} size={14} color={votedReviews[review.id] === 'dislike' ? colors.error : colors.textMuted} />
                      <Text style={[styles.voteCount, { color: votedReviews[review.id] === 'dislike' ? colors.error : colors.textMuted }]}>{review.dislikes}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* ❓ Вопросы о товаре — раскрываются по кнопке */}
          <View style={styles.reviewsSection}>
            <TouchableOpacity
              style={[styles.questionToggleBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setShowQuestions((v) => !v)}
              activeOpacity={0.8}
            >
              <Ionicons name="help-circle-outline" size={20} color={colors.primary} />
              <Text style={[styles.questionToggleText, { color: colors.text }]}>
                {t('questionsTitle')}{questions.length > 0 ? ` (${questions.length})` : ''}
              </Text>
              <Ionicons
                name={showQuestions ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textMuted}
              />
            </TouchableOpacity>

            {showQuestions && (
              <View style={{ marginTop: 12, gap: 10 }}>
                <View style={[styles.questionInputRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                  <TextInput
                    style={[styles.questionInput, { color: colors.text }]}
                    value={newQuestion}
                    onChangeText={setNewQuestion}
                    placeholder={user ? t('askPlaceholder') : t('loginToAskPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    editable={!!user}
                    multiline
                  />
                  <TouchableOpacity
                    style={[styles.questionSendBtn, { backgroundColor: colors.primary, opacity: isSubmittingQuestion || !user ? 0.5 : 1 }]}
                    onPress={handleAskQuestion}
                    disabled={isSubmittingQuestion || !user}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="send" size={18} color="#FFF" />
                  </TouchableOpacity>
                </View>

                {questions.length === 0 ? (
                  <Text style={[styles.noReviews, { color: colors.textMuted }]}>{t('noQuestionsYet')}</Text>
                ) : (
                  questions.map((q) => (
                    <View key={q.id} style={[styles.reviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <View style={styles.questionRow}>
                        <Ionicons name="help-circle-outline" size={18} color={colors.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.reviewName, { color: colors.text }]}>{q.userName || t('buyer')}</Text>
                          <Text style={[styles.reviewComment, { color: colors.textSecondary, marginTop: 2 }]}>{q.question}</Text>
                        </View>
                      </View>
                      {q.isAnswered && q.answer ? (
                        <View style={[styles.answerBox, { backgroundColor: colors.cardAlt, borderLeftColor: colors.primary }]}>
                          <Text style={[styles.answerLabel, { color: colors.primary }]}>{t('sellerAnswer')}</Text>
                          <Text style={[styles.reviewComment, { color: colors.textSecondary }]}>{q.answer}</Text>
                        </View>
                      ) : (
                        <Text style={[styles.reviewDate, { color: colors.textMuted, marginTop: 6 }]}>{t('awaitingSellerAnswer')}</Text>
                      )}
                    </View>
                  ))
                )}
              </View>
            )}
          </View>

          {frequentlyBought.length > 0 && (
            <View style={styles.similarSection}>
              <Text style={[styles.sectionLabel, { color: colors.text }]}>{t('boughtWith')}</Text>
              <FlatList
                data={frequentlyBought}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => 'freq-' + String(item.id)}
                contentContainerStyle={{ gap: 12, paddingVertical: 2 }}
                renderItem={({ item }) => (
                  <View style={{ width: SIM_CARD_W }}>
                    <ProductCard
                      product={{ ...item, images: normalizeImages(item.images) }}
                      compact
                      onPress={() => navigation.replace('ProductDetail', { productId: item.id })}
                      onFavorite={() => toggleFav(item.id, item)}
                      isFavorite={ctxIsFavorite(item.id)}
                    />
                  </View>
                )}
              />
            </View>
          )}

          {similar.length > 0 && (
            <View style={styles.similarSection}>
              <Text style={[styles.sectionLabel, { color: colors.text }]}>{t('similarProducts')}</Text>
              <FlatList
                data={similar}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={{ gap: 12, paddingVertical: 2 }}
                renderItem={({ item }) => (
                  <View style={{ width: SIM_CARD_W }}>
                    <ProductCard
                      product={{ ...item, images: normalizeImages(item.images) }}
                      compact
                      onPress={() => navigation.replace('ProductDetail', { productId: item.id })}
                      onFavorite={() => toggleFav(item.id, item)}
                      isFavorite={ctxIsFavorite(item.id)}
                    />
                  </View>
                )}
              />
            </View>
          )}

          {/* 🚩 Пожаловаться на товар */}
          <TouchableOpacity onPress={handleReport} style={styles.reportBtn} activeOpacity={0.7}>
            <Ionicons name="flag-outline" size={15} color={colors.textMuted} />
            <Text style={[styles.reportText, { color: colors.textMuted }]}>
              {t('reportTitle') || 'Пожаловаться на товар'}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* ✅ Всплывающий тост подтверждения */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.cartToast,
          {
            backgroundColor: colors.success || '#22C55E',
            opacity: toastAnim,
            transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
          },
        ]}
      >
        <Ionicons name="checkmark-circle" size={18} color="#FFF" />
        <Text style={styles.cartToastText}>{t('addedToCart') || 'Добавлено в корзину'}</Text>
      </Animated.View>

      <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.bottomPriceBlock}>
          <Text style={[styles.bottomPrice, { color: selectedVariant ? colors.primary : colors.text }]}>
            {hasVariants && !selectedVariant && minVariantPrice !== maxVariantPrice
              ? fromPrice(bottomDisplayPrice)
              : fmtSum(bottomDisplayPrice)
            }
          </Text>
          {hasVariants && !selectedVariant && minVariantPrice !== maxVariantPrice && (
            <Text style={[styles.bottomOldPrice, { color: colors.textMuted }]}>
              {toPrice(maxVariantPrice)}
            </Text>
          )}
          {originalPrice && !selectedVariant && (
            <Text style={[styles.bottomOldPrice, { color: colors.textMuted }]}>
              {fmtSum(originalPrice)}
            </Text>
          )}
        </View>
        {isOutOfStock ? (
          <TouchableOpacity
            style={[styles.notifyStockBtn, {
              backgroundColor: stockNotified ? colors.success : colors.primary + '18',
              borderColor: stockNotified ? colors.success : colors.primary,
            }]}
            onPress={handleNotifyStock}
            disabled={stockNotified}
            activeOpacity={0.85}
          >
            <Ionicons
              name={stockNotified ? 'checkmark-circle' : 'notifications-outline'}
              size={20}
              color={stockNotified ? '#FFF' : colors.primary}
            />
            <Text style={[styles.notifyStockText, { color: stockNotified ? '#FFF' : colors.primary }]}>
              {stockNotified
                ? (t('notifyStockDone') || 'Сообщим о поступлении')
                : (t('notifyStockCta') || 'Уведомить о поступлении')}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.ctaButtons}>
            <TouchableOpacity
              style={[
                styles.addBtn,
                {
                  backgroundColor: (inCart || addedToCart) ? colors.success : colors.primary + '20',
                  borderWidth: 1,
                  borderColor: (inCart || addedToCart) ? colors.success : colors.primary,
                },
              ]}
              onPress={handleAddToCart}
              disabled={isAddingToCart}
              activeOpacity={0.85}
            >
              {isAddingToCart ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Ionicons name={inCart || addedToCart ? 'checkmark' : 'bag-outline'} size={20} color={(inCart || addedToCart) ? '#FFF' : colors.primary} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.buyNowBtn, { backgroundColor: colors.primary }]}
              onPress={handleBuyNow}
              activeOpacity={0.85}
            >
              <Text style={styles.buyNowText}>{t('buyNow')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Полноэкранный просмотр фото товара с увеличением */}
      <Modal visible={zoomVisible} transparent animationType="fade" onRequestClose={() => setZoomVisible(false)}>
        <View style={styles.zoomBackdrop}>
          <TouchableOpacity style={styles.zoomClose} onPress={() => setZoomVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: imgIndex * width, y: 0 }}
          >
            {(product?.images || []).map((img, i) => (
              <ScrollView
                key={i}
                style={{ width, height: '100%' }}
                contentContainerStyle={styles.zoomPage}
                maximumZoomScale={3}
                minimumZoomScale={1}
                showsVerticalScrollIndicator={false}
                centerContent
              >
                <Image
                  source={{ uri: getImageUrl(img) || '' }}
                  style={{ width, height: width }}
                  resizeMode="contain"
                />
              </ScrollView>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Просмотр фото из отзыва */}
      <Modal visible={!!reviewPhotoZoom} transparent animationType="fade" onRequestClose={() => setReviewPhotoZoom(null)}>
        <View style={styles.zoomBackdrop}>
          <TouchableOpacity style={styles.zoomClose} onPress={() => setReviewPhotoZoom(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>
          <ScrollView
            style={{ width, height: '100%' }}
            contentContainerStyle={styles.zoomPage}
            maximumZoomScale={3}
            minimumZoomScale={1}
            showsVerticalScrollIndicator={false}
            centerContent
          >
            {reviewPhotoZoom ? (
              <Image source={{ uri: reviewPhotoZoom }} style={{ width, height: width }} resizeMode="contain" />
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', justifyContent: 'space-between',
    // На вебе нет статус-бара телефона — убираем лишний отступ сверху
    paddingTop: Platform.OS === 'web' ? 14 : 52,
    paddingHorizontal: 16, paddingBottom: 8,
  },
  topBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  topActions: { flexDirection: 'row', gap: 8 },
  cartBadge: {
    position: 'absolute', top: -5, right: -5,
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2,
  },
  cartBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  imgGallery: { paddingTop: 100 },
  mainImg: { height: width },
  noImg: { height: width, alignItems: 'center', justifyContent: 'center' },
  zoomBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' },
  zoomClose: {
    position: 'absolute', top: 50, right: 20, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  zoomPage: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  imgDots: { flexDirection: 'row', justifyContent: 'center', gap: 5, paddingVertical: 8 },
  imgDot: { width: 6, height: 6, borderRadius: 3 },
  badges: { position: 'absolute', top: 110, left: 16, flexDirection: 'row', gap: 6 },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgeAbs: { position: 'absolute', top: 8, left: 8 },
  badgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  // Двухколоночная шапка (устар.)
  topHeader: { flexDirection: 'row', gap: 14, marginBottom: 18 },
  imgCol: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  infoCol: { flex: 1, paddingTop: 2 },
  // Фото на всю ширину + информация под ним
  imgColFull: { borderRadius: 20, borderWidth: 1, overflow: 'hidden', alignSelf: 'center' },
  infoColFull: { paddingTop: 16, marginBottom: 18 },
  priceFrom: { fontSize: 12, marginTop: 8, marginBottom: 2 },
  variantStrip: { flexShrink: 0 },
  variantStripContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  variantPill: { borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 8, minWidth: 90, maxWidth: 140, gap: 2 },
  variantPillColor: { fontSize: 13, fontWeight: '700' },
  variantPillSizes: { fontSize: 10 },
  variantPillPrice: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  variantPillOos: { fontSize: 10, fontWeight: '500' },
  body: { padding: 16, paddingTop: 104 },
  prodName: { fontSize: 19, fontWeight: '700', letterSpacing: -0.3, marginBottom: 6, lineHeight: 24 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 4 },
  ratingNum: { fontSize: 13, fontWeight: '600', marginLeft: 2 },
  ratingCount: { fontSize: 12 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginBottom: 16 },
  price: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  oldPrice: { fontSize: 14, textDecorationLine: 'line-through', marginTop: 2 },
  lowStockRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  lowStockText: { fontSize: 13, fontWeight: '700', color: '#F97316' },
  // 🧩 Комплект «вместе дешевле»
  bundleCard: { borderRadius: 16, borderWidth: 1.5, padding: 14, marginBottom: 16 },
  bundleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  bundleTitle: { fontSize: 15.5, fontWeight: '800', flex: 1 },
  bundleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  bundleBadgeText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  bundleItemsRow: { alignItems: 'center', gap: 8, paddingBottom: 4 },
  bundleItem: { width: 92 },
  bundleImgWrap: { width: 92, height: 92, borderRadius: 12, borderWidth: 1.5, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  bundleImg: { width: '100%', height: '100%' },
  bundleItemName: { fontSize: 11.5, fontWeight: '600', marginTop: 5, lineHeight: 14 },
  bundleItemPrice: { fontSize: 11, marginTop: 2 },
  bundlePlus: { fontSize: 20, fontWeight: '700', marginHorizontal: 2 },
  bundleTotalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 10 },
  bundleOldSum: { fontSize: 13.5, textDecorationLine: 'line-through' },
  bundleNewSum: { fontSize: 18, fontWeight: '800' },
  bundleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 12, marginTop: 10 },
  bundleBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  bundleHint: { fontSize: 11.5, marginTop: 8, textAlign: 'center' },
  sectionLabel: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  variantSection: { marginBottom: 16 },
  variantLabel: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, alignItems: 'center' },
  chipText: { fontSize: 14, fontWeight: '600' },
  chipSub: { fontSize: 10, marginTop: 1 },
  // Цвет: текстовая пилюля (без образца цвета — только текст)
  colorChip: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 11, borderRadius: 14 },
  colorChipText: { fontSize: 15, fontWeight: '600' },
  // Память/размер: пилюля с ценой снизу
  sizeChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, alignItems: 'flex-start', minWidth: 96 },
  sizeChipText: { fontSize: 15, fontWeight: '700' },
  sizeChipPrice: { fontSize: 11, fontWeight: '600', marginTop: 3 },
  variantInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 10, borderRadius: 10, borderWidth: 1 },
  variantInfoText: { fontSize: 13, flex: 1 },
  variantHint: { fontSize: 12, marginTop: 8, fontStyle: 'italic' },
  deliveryBox: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 16 },
  deliveryText: { fontSize: 14 },
  deliveryTitle: { fontSize: 14, fontWeight: '700' },
  deliverySub: { fontSize: 12, marginTop: 2 },
  deliveryFree: { fontSize: 14, fontWeight: '700' },
  aboutCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16 },
  aboutGrid: { flexDirection: 'row' },
  aboutCell: { flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: 6 },
  aboutCellLabel: { fontSize: 11 },
  aboutCellValue: { fontSize: 13, fontWeight: '700' },
  descSection: { marginBottom: 16 },
  desc: { fontSize: 14, lineHeight: 21 },
  showMore: { fontSize: 13, fontWeight: '500', marginTop: 6 },
  companyCard: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 16 },
  companyTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  companyLogo: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1 },
  companyLogoImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  companyLogoText: { fontSize: 20, fontWeight: '800' },
  companyLabel: { fontSize: 11, marginBottom: 2 },
  companyNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  companyName: { fontSize: 16, fontWeight: '700', maxWidth: '82%' },
  companyMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  companyMetaText: { fontSize: 12, marginTop: 2 },
  companyAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  companyAllBtnText: { fontSize: 13, fontWeight: '700' },
  writeReviewCard: { paddingVertical: 8, marginBottom: 16 },
  writeReviewTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  writeReviewSub: { fontSize: 12.5, lineHeight: 18, marginBottom: 14 },
  ratingBlock: { marginBottom: 14 },
  ratingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  ratingFieldLabel: { fontSize: 13, fontWeight: '600' },
  ratingValueHint: { fontSize: 12 },
  starRow: { flexDirection: 'row', gap: 8 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  optionalLabel: { fontSize: 11 },
  reviewInputWrap: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 },
  reviewInput: { fontSize: 14, minHeight: 76, textAlignVertical: 'top', padding: 0 },
  charCounter: { fontSize: 11, alignSelf: 'flex-end', marginTop: 4 },
  tipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 14 },
  tipChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  tipChipText: { fontSize: 11.5, fontWeight: '500' },
  submitBtn: { paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  reviewsSection: { marginBottom: 20 },
  noReviews: { fontSize: 14, marginTop: 4 },
  reviewCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  reviewHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  reviewAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  reviewAvatarText: { fontSize: 16, fontWeight: '700' },
  reviewName: { fontSize: 14, fontWeight: '600' },
  reviewStars: { flexDirection: 'row', gap: 2, marginTop: 2 },
  reviewDate: { fontSize: 12 },
  reviewComment: { fontSize: 14, lineHeight: 20, marginBottom: 10 },
  reviewPhotosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4, marginBottom: 4 },
  reviewPhotoThumbWrap: { position: 'relative' },
  reviewPhotoThumb: { width: 64, height: 64, borderRadius: 10 },
  reviewPhotoRemove: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center' },
  addPhotoBtn: { width: 64, height: 64, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 2 },
  addPhotoText: { fontSize: 9, fontWeight: '600', textAlign: 'center' },
  reviewFilterRow: { gap: 8, paddingVertical: 10 },
  reviewFilterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  reviewFilterText: { fontSize: 12.5, fontWeight: '600' },
  reviewImagesRow: { gap: 8, marginBottom: 10 },
  reviewImageThumb: { width: 72, height: 72, borderRadius: 10 },
  voteRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  voteBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  voteCount: { fontSize: 12, fontWeight: '600' },
  questionToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14 },
  questionToggleText: { flex: 1, fontSize: 15, fontWeight: '700' },
  questionInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderWidth: 1, borderRadius: 12, padding: 8 },
  questionInput: { flex: 1, fontSize: 14, minHeight: 38, maxHeight: 100, paddingHorizontal: 6, textAlignVertical: 'top' },
  questionSendBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  questionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  answerBox: { marginTop: 8, padding: 10, borderRadius: 10, borderLeftWidth: 3 },
  answerLabel: { fontSize: 12, fontWeight: '700', marginBottom: 3 },
  similarSection: { marginBottom: 20 },
  similarCard: { width: 130, borderRadius: 14, borderWidth: 1, overflow: 'hidden', padding: 8 },
  similarImg: { width: '100%', height: 100, borderRadius: 8 },
  similarName: { fontSize: 12, fontWeight: '500', marginTop: 6, marginBottom: 4, lineHeight: 17 },
  similarPrice: { fontSize: 13, fontWeight: '700' },
  bottomBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, paddingBottom: 28, gap: 12 },
  cartToast: { position: 'absolute', bottom: 100, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 24, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6, zIndex: 50 },
  cartToastText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  reportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, marginTop: 8 },
  reportText: { fontSize: 13, fontWeight: '500' },
  bottomPriceBlock: { flex: 1 },
  bottomPrice: { fontSize: 22, fontWeight: '800' },
  bottomOldPrice: { fontSize: 13, textDecorationLine: 'line-through' },
  ctaButtons: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addBtn: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  buyNowBtn: { height: 48, paddingHorizontal: 20, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  buyNowText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  notifyStockBtn: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  notifyStockText: { fontSize: 15, fontWeight: '700' },
  flashBanner: { marginTop: 12, marginHorizontal: 2, backgroundColor: '#EF4444', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  flashLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flashText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  flashTimer: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8 },
  flashTimerText: { color: '#FFF', fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
