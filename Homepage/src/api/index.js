import axios from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';
import { ENDPOINTS } from '../constants/Api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// 🔐 Контекст маркетплейса (публичный ↔ закрытый).
// Закрытое (B2B) приложение — это то же приложение, вошедшее под пользователем
// с mode='private' и закреплённой компанией. Чтобы КАЖДЫЙ листинг (каталог,
// поиск, подсказки, категории, реклама, кампании, рекомендации, «ближайший
// магазин») показывал строго товары этой компании и ничего чужого, режим
// прокидывается централизованно во все GET-запросы — точно так же, как
// бэкенд фильтрует эти же эндпоинты. Публичные клиенты параметры не шлют и
// видят только публичные компании.
let __marketplaceContext = null; // { mode:'private', privateCompanyId } | null
let __contextHydrated = false;

export const setApiMarketplaceContext = (user) => {
  __contextHydrated = true;
  if (user?.mode === 'private' && user?.privateCompanyId) {
    __marketplaceContext = { mode: 'private', privateCompanyId: user.privateCompanyId };
  } else {
    __marketplaceContext = null;
  }
};

// Ленивая гидратация из хранилища на холодный старт — на случай, если запрос
// уйдёт раньше, чем AuthContext успеет вызвать setApiMarketplaceContext.
const hydrateContextFromStorage = async () => {
  if (__contextHydrated) return;
  try {
    const raw = await AsyncStorage.getItem('currentUser');
    if (raw) setApiMarketplaceContext(JSON.parse(raw));
    else __contextHydrated = true;
  } catch {
    __contextHydrated = true;
  }
};

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('userToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const method = (config.method || 'get').toLowerCase();
  if (method === 'get') {
    await hydrateContextFromStorage();
    if (__marketplaceContext) {
      config.params = { ...(config.params || {}) };
      if (config.params.mode == null) config.params.mode = __marketplaceContext.mode;
      if (config.params.privateCompanyId == null) {
        config.params.privateCompanyId = __marketplaceContext.privateCompanyId;
      }
    }
  }
  return config;
});

// ─── Auth ─────────────────────────────────────────────────────────────────────
// extra: { mode: 'private', privateCode: '...' } — вход в закрытую компанию.
export const loginUser = async (phone, password, extra = {}) => {
  const res = await api.post(ENDPOINTS.loginUser, { phone, password, ...extra });
  return res.data;
};

export const registerUser = async (phone, name, surname, password, extra = {}) => {
  const res = await api.post(ENDPOINTS.registerUser, { phone, name, surname, password, ...extra });
  return res.data;
};

// 📲 Вход по SMS-коду
export const requestOtp = async (phone) => {
  const res = await api.post('/auth/otp/request', { phone });
  return res.data; // { success, channel, ttlSeconds, devCode? }
};

export const verifyOtp = async (phone, code, extra = {}) => {
  const res = await api.post('/auth/otp/verify', { phone, code, ...extra });
  return res.data; // { success, user, token }
};

// 🔒 Проверка ID закрытой компании (перед входом/регистрацией)
export const verifyPrivateCode = async (privateCode) => {
  const res = await api.post('/companies/verify-private-code', { privateCode });
  return res.data; // { success, companyId, name, logoUrl? }
};

// ─── Products ─────────────────────────────────────────────────────────────────
export const getProducts = async (params = {}) => {
  const res = await api.get(ENDPOINTS.products, { params: { ...params, availableOnly: true } });
  return Array.isArray(res.data) ? res.data : (res.data?.products || []);
};

export const searchProducts = async (q, limit = 40, extra = {}) => {
  if (!q?.trim()) return [];
  // extra: { sort, minPrice, maxPrice, category, brand }
  const res = await api.get(ENDPOINTS.productSearch, { params: { q: q.trim(), limit, ...extra } });
  const raw = Array.isArray(res.data) ? res.data : [];
  // Бэкенд отдаёт images JSON-строкой и company_id в snake_case —
  // нормализуем к формату, который ждёт ProductCard.
  return raw.map((p) => {
    let images = p.images;
    if (typeof images === 'string') {
      try { images = JSON.parse(images); } catch { images = []; }
    }
    return {
      ...p,
      images: Array.isArray(images) ? images : [],
      companyId: p.companyId ?? p.company_id,
      sellingPrice: p.sellingPrice ?? p.price,
    };
  });
};

// 💡 Подсказки для поисковой строки (автодополнение): [{ label, type }]
export const suggestProducts = async (q) => {
  if (!q?.trim() || q.trim().length < 2) return [];
  const res = await api.get(ENDPOINTS.productSuggest, { params: { q: q.trim() } });
  return Array.isArray(res.data) ? res.data : [];
};

export const getFrequentlyBoughtWith = async (productId) => {
  const res = await api.get(ENDPOINTS.productFrequentlyBought(productId));
  return Array.isArray(res.data) ? res.data : [];
};

// 🚩 Пожаловаться на товар или магазин
export const submitComplaint = async ({ targetType, targetId, customerPhone, reason, message }) => {
  const res = await api.post(ENDPOINTS.complaints, { targetType, targetId, customerPhone, reason, message });
  return res.data;
};

// 🔔 Подписаться на уведомление о поступлении товара
export const notifyWhenInStock = async (productId, phone) => {
  const res = await api.post(ENDPOINTS.productNotifyStock(productId), { phone });
  return res.data;
};

// 🧩 Комплекты «вместе дешевле», в которые входит товар:
// [{ id, companyId, name, discountPercent, items: [{ id, name, price, image }] }]
export const getProductBundles = async (productId) => {
  try {
    const res = await api.get(`/products/${productId}/bundles`);
    return Array.isArray(res.data) ? res.data : [];
  } catch {
    return [];
  }
};

// ⚡ Флеш-распродажа товара (скидка с таймером). Возвращает { active, endsAt, ... }
export const getFlashSale = async (productId) => {
  try {
    const res = await api.get(ENDPOINTS.productFlashSale(productId));
    return res.data || { active: false };
  } catch {
    return { active: false };
  }
};

// 🎉 Активные скидочные кампании (именованные ряды на главной)
export const getCampaigns = async () => {
  try {
    const res = await api.get(ENDPOINTS.campaigns);
    return Array.isArray(res.data) ? res.data : [];
  } catch {
    return [];
  }
};

// 📸 Активные сторис магазинов (только от тех, на кого покупатель подписан)
export const getStories = async (phone) => {
  if (!phone) return [];
  try {
    const res = await api.get(ENDPOINTS.stories, { params: { phone } });
    return Array.isArray(res.data) ? res.data : [];
  } catch {
    return [];
  }
};

// 📸 Отметить просмотр сторис
export const viewStory = async (storyId) => {
  try { await api.post(ENDPOINTS.storyView(storyId)); } catch { /* ignore */ }
};

// 🎟️ Проверить промокод (возвращает { valid, promoId, discount, message })
export const validatePromo = async ({ code, userPhone, companyId, orderAmount }) => {
  const res = await api.post(ENDPOINTS.promoValidate, { code, userPhone, companyId, orderAmount });
  return res.data;
};

// 🎟️ Зафиксировать использование промокода (после оформления заказа)
export const redeemPromo = async ({ promoId, userPhone, orderId, discount }) => {
  try { await api.post(ENDPOINTS.promoRedeem, { promoId, userPhone, orderId, discount }); } catch { /* не блокируем */ }
};

export const getProductDetail = async (id) => {
  const res = await api.get(ENDPOINTS.productDetail(id));
  return res.data;
};

const mapReview = (r) => ({
  id: r.id,
  productId: r.productId ?? r.product_id,
  userPhone: r.userPhone ?? r.user_phone,
  userName: r.userName ?? r.user_name,
  userAvatarUrl: r.userAvatarUrl ?? r.user_avatar_url ?? null,
  rating: r.rating,
  comment: r.comment,
  likes: r.likes ?? 0,
  dislikes: r.dislikes ?? 0,
  createdAt: r.createdAt ?? r.created_at,
  userVote: r.user_vote ?? null,
  images: Array.isArray(r.images) ? r.images : [],
});

export const getProductReviews = async (id, userPhone) => {
  const res = await api.get(ENDPOINTS.productReviews(id), { params: userPhone ? { user_phone: userPhone } : undefined });
  const raw = Array.isArray(res.data) ? res.data : (res.data?.reviews || []);
  return raw.map(mapReview);
};

export const getProductReviewStats = async (id) => {
  const res = await api.get(ENDPOINTS.productReviewStats(id));
  const d = res.data || {};
  // Backend returns { count, average_rating }; normalize to the shape the UI expects.
  return {
    totalReviews: d.totalReviews ?? d.count ?? 0,
    averageRating: d.averageRating ?? d.average_rating ?? 0,
  };
};

export const getProductVariants = async (id) => {
  const res = await api.get(ENDPOINTS.productVariants(id));
  return Array.isArray(res.data) ? res.data : [];
};

export const getSimilarProducts = async (id) => {
  const res = await api.get(ENDPOINTS.productSimilar(id));
  return Array.isArray(res.data) ? res.data : (res.data?.products || []);
};

// Отметить просмотр товара (для «недавно смотрели» и рекомендаций). Fire-and-forget.
export const trackProductView = async (id, phone) => {
  if (!phone) return;
  try { await api.post(ENDPOINTS.productView(id), { phone }); } catch { /* ignore */ }
};

export const getRecentlyViewed = async (phone, limit = 12) => {
  const res = await api.get(ENDPOINTS.recentlyViewed(phone), { params: { limit } });
  return Array.isArray(res.data) ? res.data : [];
};

export const getRecommendations = async (phone, limit = 12) => {
  const res = await api.get(ENDPOINTS.recommendations(phone), { params: { limit } });
  return Array.isArray(res.data) ? res.data : [];
};

export const submitReview = async (data) => {
  const res = await api.post(ENDPOINTS.reviews, data);
  return mapReview(res.data);
};

// Собирает multipart-форму с одним изображением кросс-платформенно.
// Native (iOS/Android): FormData принимает { uri, name, type } — RN сам
// сериализует файл и подставит boundary. Web: браузерный FormData принимает
// только Blob/File, поэтому data:/blob:-URI сначала превращается в Blob.
export const buildImageFormData = async (field, uri, fallbackName = `photo_${Date.now()}.jpg`) => {
  const rawName = uri.split('/').pop() || fallbackName;
  const name = rawName.includes('.') ? rawName : fallbackName;
  const ext = (name.split('.').pop() || 'jpg').toLowerCase();
  const type =
    ext === 'png' ? 'image/png' :
    ext === 'webp' ? 'image/webp' :
    ext === 'heic' || ext === 'heif' ? 'image/heic' : 'image/jpeg';
  const form = new FormData();
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    form.append(field, new File([blob], name, { type: blob.type || type }));
  } else {
    form.append(field, { uri, name, type });
  }
  return form;
};

// POST multipart-формы. Content-Type НЕ выставляется вручную: и браузер, и
// нативный сетевой слой RN сами добавляют "multipart/form-data; boundary=…" —
// заголовок без boundary ломает разбор формы на сервере.
export const postFormData = async (endpoint, form, timeoutMs = 30000) => {
  const token = await AsyncStorage.getItem('userToken');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    });
    let data = null;
    try { data = await res.json(); } catch { /* пустой/не-JSON ответ */ }
    if (!res.ok) {
      const err = new Error(data?.error || `Upload failed (${res.status})`);
      err.status = res.status;
      err.response = { data };
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
};

// Загрузка одного фото отзыва (multipart) → возвращает URL на сервере.
export const uploadReviewImage = async (uri) => {
  const form = await buildImageFormData('image', uri, `review_${Date.now()}.jpg`);
  const data = await postFormData(ENDPOINTS.reviewUploadImage, form);
  return data?.url;
};

export const voteReview = async (reviewId, phone, voteType) => {
  const res = await api.post(ENDPOINTS.reviewVote(reviewId), { user_phone: phone, vote_type: voteType });
  return res.data;
};

// ─── Categories ───────────────────────────────────────────────────────────────
export const getCategories = async () => {
  const res = await api.get(ENDPOINTS.categories);
  return Array.isArray(res.data) ? res.data : (res.data?.categories || []);
};

export const getCategoryProducts = async (category, params = {}) => {
  const res = await api.get(ENDPOINTS.categoryProducts, { params: { category, availableOnly: true, ...params } });
  return Array.isArray(res.data) ? res.data : (res.data?.products || []);
};

// ─── Cart ─────────────────────────────────────────────────────────────────────
const mapCartItem = (item) => {
  const productId = item.productId ?? item.product_id ?? 0;
  const product = item.product ?? {
    id: productId,
    companyId: item.companyId ?? item.company_id ?? 0,
    name: item.product_name ?? item.productName ?? '',
    // product_base_price = себестоимость (закупочная), product_price = продажная (с наценкой)
    price: item.product_base_price ?? item.productBasePrice ?? item.product_price ?? item.productPrice ?? 0,
    sellingPrice: item.product_price ?? item.sellingPrice ?? 0,
    markupPercent: item.markup_percent ?? item.markupPercent ?? 0,
    markupAmount: 0,
    quantity: 0,
    hasColorOptions: false,
    availableForCustomers: true,
    soldCount: 0,
    images: item.product_images ?? item.productImages ?? [],
    createdAt: '',
    updatedAt: '',
  };
  return {
    id: item.id,
    userPhone: item.userPhone ?? item.user_phone ?? '',
    productId,
    quantity: item.quantity,
    selected_color: item.selected_color ?? item.selectedColor ?? undefined,
    selected_size: item.selected_size ?? item.selectedSize ?? undefined,
    stockQuantity: item.stock_quantity ?? item.stockQuantity ?? undefined,
    product,
  };
};

export const getCart = async (phone) => {
  const res = await api.get(ENDPOINTS.cart(phone));
  const raw = Array.isArray(res.data) ? res.data : (res.data?.items || []);
  return raw.map(mapCartItem);
};

export const getCartCount = async (phone) => {
  const res = await api.get(ENDPOINTS.cartCount(phone));
  return res.data?.count || 0;
};

export const addToCart = async (data) => {
  const res = await api.post(ENDPOINTS.cartAdd, data);
  return res.data;
};

export const setCartItem = async (data) => {
  await api.post(ENDPOINTS.cartSet, data);
};

export const removeCartItem = async (itemId) => {
  await api.delete(ENDPOINTS.cartDeleteItem(itemId));
};

export const clearCart = async (phone) => {
  await api.delete(ENDPOINTS.cartClear(phone));
};

// ─── Favorites ────────────────────────────────────────────────────────────────
export const getFavorites = async (phone) => {
  const res = await api.get(ENDPOINTS.favorites(phone));
  return Array.isArray(res.data) ? res.data : (res.data?.products || res.data?.items || []);
};

export const getFavoritesCount = async (phone) => {
  const res = await api.get(ENDPOINTS.favoritesCount(phone));
  return res.data?.count || 0;
};

export const toggleFavorite = async (phone, productId) => {
  const res = await api.post(ENDPOINTS.favoritesToggle, { user_phone: phone, product_id: productId });
  return { added: res.data?.is_favorite ?? res.data?.added ?? false };
};

export const checkFavorite = async (phone, productId) => {
  const res = await api.get(ENDPOINTS.favoritesCheck, { params: { phone, product_id: productId } });
  return res.data?.is_favorite || false;
};

// ─── Orders ───────────────────────────────────────────────────────────────────
export const createOrder = async (data) => {
  const res = await api.post(ENDPOINTS.orders, data);
  return res.data;
};

const mapOrder = (o) => ({
  id: o.id,
  companyId: o.companyId ?? o.company_id ?? 0,
  customerName: o.customerName ?? o.customer_name ?? '',
  customerPhone: o.customerPhone ?? o.customer_phone ?? '',
  address: o.address,
  items: Array.isArray(o.items) ? o.items.map((i) => {
    // price = себестоимость (закупочная) — НИКОГДА не показываем покупателю.
    // priceWithMarkup = продажная цена с наценкой — её видит покупатель.
    const basePrice = i.price ?? 0;
    const sellPrice = i.price_with_markup ?? i.priceWithMarkup ?? i.sellingPrice ?? basePrice;
    return {
      productId: i.productId ?? i.product_id ?? 0,
      productName: i.productName ?? i.product_name ?? i.name ?? 'Товар',
      quantity: i.quantity ?? 1,
      price: basePrice,
      priceWithMarkup: sellPrice,
      color: i.color ?? i.selected_color ?? i.selectedColor ?? undefined,
      size: i.size ?? i.selected_size ?? i.selectedSize ?? undefined,
      imageUrl: i.imageUrl ?? i.image_url,
    };
  }) : [],
  totalAmount: o.totalAmount ?? o.total_amount ?? 0,
  status: o.status ?? 'pending',
  comment: o.comment,
  orderCode: o.orderCode ?? o.order_code ?? '',
  deliveryCost: o.deliveryCost ?? o.delivery_cost,
  deliveryType: o.deliveryType ?? o.delivery_type,
  recipientName: o.recipientName ?? o.recipient_name,
  deliveryAddress: o.deliveryAddress ?? o.delivery_address,
  paymentMethod: o.paymentMethod ?? o.payment_method,
  cardSubtype: o.cardSubtype ?? o.card_subtype,
  createdAt: o.createdAt ?? o.created_at ?? '',
  updatedAt: o.updatedAt ?? o.updated_at ?? o.createdAt ?? o.created_at ?? '',
});

export const getUserOrders = async (phone, status) => {
  const res = await api.get(ENDPOINTS.orders, { params: { customer_phone: phone, status } });
  const raw = Array.isArray(res.data) ? res.data : (res.data?.orders || []);
  return raw.map(mapOrder);
};

export const getOrderDetail = async (id) => {
  const res = await api.get(ENDPOINTS.orderDetail(id));
  return mapOrder(res.data);
};

// 🚴 Живое положение курьера по заказу (для отслеживания на карте)
export const getOrderCourierLocation = async (id) => {
  const res = await api.get(ENDPOINTS.orderCourierLocation(id));
  return res.data;
};

// ─── Notifications ────────────────────────────────────────────────────────────
export const getNotifications = async (phone) => {
  const res = await api.get(ENDPOINTS.notifications, { params: { userPhone: phone } });
  return Array.isArray(res.data) ? res.data : (res.data?.notifications || []);
};

export const getUnreadCount = async (phone) => {
  const res = await api.get(ENDPOINTS.notificationsUnread, { params: { userPhone: phone } });
  return res.data?.count || 0;
};

export const markNotificationRead = async (id) => {
  await api.put(ENDPOINTS.notificationRead(id));
};

export const markAllNotificationsRead = async (phone) => {
  await api.put(ENDPOINTS.notificationsMarkAll, { user_phone: phone });
};

export const savePushToken = async (phone, token) => {
  await api.post(ENDPOINTS.pushToken, { user_phone: phone, expo_push_token: token });
};

// ─── Ads ──────────────────────────────────────────────────────────────────────
// Бэкенд отдаёт snake_case — приводим к единому camelCase, иначе картинки/ссылки
// и переход на товар в баннере не работают.
const mapAd = (a) => ({
  id: a.id,
  title: a.title,
  content: a.content ?? a.caption ?? '',
  imageUrl: a.image_url ?? a.imageUrl ?? null,
  linkUrl: a.link_url ?? a.linkUrl ?? null,
  adType: a.ad_type ?? a.adType ?? 'company',
  companyId: a.company_id ?? a.companyId ?? null,
  productId: a.product_id ?? a.productId ?? null,
  productImage: a.product_image ?? a.productImage ?? null,
});

export const getAds = async () => {
  const res = await api.get(ENDPOINTS.ads);
  const raw = Array.isArray(res.data) ? res.data : (res.data?.ads || []);
  return raw.map(mapAd);
};

// Одобренные рекламные баннеры для главного экрана.
// ВАЖНО: запрашиваем только status=approved, иначе бэкенд (без фильтра) отдаёт
// вообще все объявления, включая удалённые (status='deleted') и ожидающие —
// из-за чего удалённая в админ-панели реклама не исчезала в приложении.
export const getApprovedAds = async () => {
  const res = await api.get(ENDPOINTS.ads, { params: { status: 'approved' } });
  const raw = Array.isArray(res.data) ? res.data : (res.data?.ads || []);
  // Доп. защита на стороне клиента — отбрасываем всё, что не одобрено.
  return raw
    .filter((a) => (a.status ?? 'approved') === 'approved')
    .map(mapAd);
};

// ─── Discounts ────────────────────────────────────────────────────────────────
export const getApprovedDiscounts = async () => {
  const res = await api.get(ENDPOINTS.approvedDiscounts);
  return Array.isArray(res.data) ? res.data : (res.data?.discounts || []);
};

export const getAggressiveDiscounts = async () => {
  const res = await api.get(ENDPOINTS.approvedAggressiveDiscounts);
  return Array.isArray(res.data) ? res.data : (res.data?.discounts || []);
};

// ─── Companies ────────────────────────────────────────────────────────────────
export const getCompanies = async (params = {}) => {
  const res = await api.get(ENDPOINTS.companies, { params: { approved: true, ...params } });
  return Array.isArray(res.data) ? res.data : (res.data?.companies || []);
};

export const getCompanyDetail = async (id) => {
  const res = await api.get(ENDPOINTS.companyDetail(id));
  return res.data;
};

export const getCompanyStats = async (id) => {
  const res = await api.get(ENDPOINTS.companyStats(id));
  return res.data;
};

// Отзыв + оценка магазина
export const rateCompany = async (companyId, { userPhone, userName, rating, comment }) => {
  const res = await api.post(`${ENDPOINTS.companyDetail(companyId)}/rate`, {
    user_phone: userPhone,
    user_name: userName,
    rating,
    comment: comment || '',
  });
  return res.data;
};

export const getCompanyReviews = async (companyId) => {
  const res = await api.get(`${ENDPOINTS.companyDetail(companyId)}/reviews`);
  const raw = Array.isArray(res.data) ? res.data : (res.data?.reviews || []);
  return raw.map((r) => ({
    userName: r.user_name ?? r.userName ?? '',
    userPhone: r.user_phone ?? r.userPhone ?? '',
    userAvatarUrl: r.user_avatar_url ?? r.userAvatarUrl ?? null,
    rating: r.rating ?? 0,
    comment: r.comment ?? '',
    createdAt: r.created_at ?? r.createdAt ?? '',
  }));
};

export const subscribeToCompany = async (companyId, userPhone) => {
  await api.post(ENDPOINTS.companySubscribe(companyId), { user_phone: userPhone });
};

export const unsubscribeFromCompany = async (companyId, userPhone) => {
  await api.post(ENDPOINTS.companyUnsubscribe(companyId), { user_phone: userPhone });
};

// ─── User Profile ─────────────────────────────────────────────────────────────
export const getUserProfile = async (phone) => {
  const res = await api.get(ENDPOINTS.userProfile(phone));
  return res.data;
};

// ─── Payment Cards ────────────────────────────────────────────────────────────
export const getPaymentCards = async (phone) => {
  const res = await api.get(ENDPOINTS.paymentCards(phone));
  return Array.isArray(res.data) ? res.data : (res.data?.cards || []);
};

export const addPaymentCard = async (data) => {
  const res = await api.post(ENDPOINTS.paymentCardsAdd, data);
  return res.data;
};

export const deletePaymentCard = async (id) => {
  await api.delete(ENDPOINTS.paymentCardDelete(id));
};

export const setDefaultCard = async (id) => {
  await api.put(ENDPOINTS.paymentCardDefault(id));
};

// ─── Delivery Addresses ────────────────────────────────────────────────────────
export const getUserAddresses = async (phone) => {
  const res = await api.get(ENDPOINTS.userAddresses(phone));
  return Array.isArray(res.data) ? res.data : [];
};

export const addUserAddress = async (phone, data) => {
  const res = await api.post(ENDPOINTS.userAddresses(phone), data);
  return res.data;
};

export const updateUserAddress = async (phone, id, data) => {
  const res = await api.put(ENDPOINTS.userAddressDetail(phone, id), data);
  return res.data;
};

export const deleteUserAddress = async (phone, id) => {
  await api.delete(ENDPOINTS.userAddressDetail(phone, id));
};

export const setDefaultAddress = async (phone, id) => {
  const res = await api.put(ENDPOINTS.userAddressDefault(phone, id));
  return res.data;
};

// 📍 Частые места доставки (топ-3 из истории заказов)
export const getFrequentLocations = async (phone) => {
  const res = await api.get(ENDPOINTS.userFrequentLocations(phone));
  return Array.isArray(res.data) ? res.data : [];
};

// ─── ❓ Вопросы к товару ────────────────────────────────────────────────────────
export const getProductQuestions = async (productId, userPhone) => {
  // Приватность: вопросы видны только их автору — передаём user_phone.
  const res = await api.get(ENDPOINTS.productQuestions(productId), {
    params: userPhone ? { user_phone: userPhone } : undefined,
  });
  return Array.isArray(res.data) ? res.data : (res.data?.questions || []);
};

export const askProductQuestion = async (productId, data) => {
  // data: { userPhone, userName, question }
  const res = await api.post(ENDPOINTS.productQuestions(productId), data);
  return res.data;
};

// ─── ↩️ Возвраты / возврат средств ──────────────────────────────────────────────
// ─── Зоны доставки (границы рисует админ) ────────────────────────────────────
// Список зон — для ручного выбора региона в шапке каталога.
export const getDeliveryRegions = async () => {
  const res = await api.get(ENDPOINTS.regions);
  return Array.isArray(res.data) ? res.data : [];
};

// Точка покупателя → зоны, внутри которых он находится: [{ id, name, nameUz }]
export const resolveDeliveryZones = async (lat, lng) => {
  const res = await api.get(ENDPOINTS.regionsResolve, { params: { lat, lng } });
  return Array.isArray(res.data?.matched) ? res.data.matched : [];
};

// ─── Политика конфиденциальности ─────────────────────────────────────────────
export const getPolicy = async (audience = 'customer') => {
  const res = await api.get(ENDPOINTS.policy(audience));
  return res.data;
};

// Фиксируем принятие политики (subject — телефон покупателя)
export const acceptPolicy = async (audience, subject) => {
  const res = await api.post(ENDPOINTS.policyAccept(audience), { subject });
  return res.data;
};

export const createReturn = async (data) => {
  // data: { orderId, companyId, customerPhone, reason, refundAmount }
  const res = await api.post(ENDPOINTS.returns, data);
  return res.data;
};

export const getUserReturns = async (phone) => {
  const res = await api.get(`${ENDPOINTS.returns}?customerPhone=${encodeURIComponent(phone)}`);
  return Array.isArray(res.data) ? res.data : (res.data?.returns || []);
};

export default api;
