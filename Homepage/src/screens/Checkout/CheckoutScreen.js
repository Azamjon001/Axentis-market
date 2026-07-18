import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, ActivityIndicator, Linking, Platform,
} from 'react-native';
import { Alert } from '../../utils/alert';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../context/LanguageContext';
import { createOrder, getPaymentCards, addPaymentCard, getCompanyDetail, getUserAddresses, getFrequentLocations, validatePromo, redeemPromo } from '../../api';

// Парсит строку координат "lat,lng" в объект { lat, lng }
function parseCoords(str) {
  if (!str || typeof str !== 'string') return null;
  const [lat, lng] = str.split(',').map(s => parseFloat(s.trim()));
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return null;
}

const DELIVERY_COST_PER_KM = 1500;
const DEFAULT_FREE_RADIUS_KM = 2;

const CARD_TYPES = [
  { key: 'visa', label: 'Visa', color: '#1A1F71' },
  { key: 'mastercard', label: 'Mastercard', color: '#EB001B' },
  { key: 'uzcard', label: 'Uzcard', color: '#1BA874' },
  { key: 'humo', label: 'Humo', color: '#FF6B00' },
];

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function CheckoutScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { items, total, clearAllItems } = useCart();
  const { t, language } = useLanguage();
  const navigation = useNavigation();
  const route = useRoute();
  const STEPS = [t('stepDelivery'), t('stepPayment'), t('stepConfirm')];
  const dateLocale = language === 'uz' ? 'uz-UZ' : 'ru-RU';

  const [step, setStep] = useState(0);
  const [address, setAddress] = useState(user?.defaultDeliveryAddress || '');
  const [recipientName, setRecipientName] = useState(user?.defaultRecipientName || user?.name || '');
  const [recipientPhone, setRecipientPhone] = useState(user?.phone || '');
  const [comment, setComment] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [isPlacing, setIsPlacing] = useState(false);

  const [deliveryCoords, setDeliveryCoords] = useState(() => parseCoords(user?.defaultDeliveryCoordinates));
  const [companyInfo, setCompanyInfo] = useState(null);

  const [savedAddresses, setSavedAddresses] = useState([]);
  const [frequentLocations, setFrequentLocations] = useState([]);

  const [savedCards, setSavedCards] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [cardsLoading, setCardsLoading] = useState(false);

  const [inlineCardType, setInlineCardType] = useState('uzcard');
  const [inlineCardNumber, setInlineCardNumber] = useState('');
  const [inlineExpiry, setInlineExpiry] = useState('');
  const [inlineHolderName, setInlineHolderName] = useState('');
  const [inlineCardSaved, setInlineCardSaved] = useState(false);
  const [savingInlineCard, setSavingInlineCard] = useState(false);
  const [showAddCardForm, setShowAddCardForm] = useState(false);

  useEffect(() => {
    if (route.params?.selectedCoords) {
      setDeliveryCoords(route.params.selectedCoords);
    }
    if (route.params?.selectedAddress) {
      setAddress(route.params.selectedAddress);
    }
  }, [route.params?.selectedCoords, route.params?.selectedAddress]);

  useEffect(() => {
    const companyId = items[0]?.product?.companyId;
    if (companyId) {
      getCompanyDetail(companyId).then(setCompanyInfo).catch(() => {});
    }
  }, [items]);

  // Загружаем сохранённые адреса и частые места доставки для быстрого выбора
  useEffect(() => {
    if (!user?.phone) return;
    getUserAddresses(user.phone).then(setSavedAddresses).catch(() => {});
    getFrequentLocations(user.phone).then(setFrequentLocations).catch(() => {});
  }, [user?.phone]);

  // Если у пользователя сохранён адрес по умолчанию с координатами — подставляем сразу
  useEffect(() => {
    if (!deliveryCoords && user?.defaultDeliveryCoordinates) {
      const c = parseCoords(user.defaultDeliveryCoordinates);
      if (c) setDeliveryCoords(c);
    }
  }, [user?.defaultDeliveryCoordinates]);

  useEffect(() => {
    if (!user) return;
    setCardsLoading(true);
    getPaymentCards(user.phone)
      .then(cards => {
        setSavedCards(cards);
        const def = cards.find(c => c.isDefault) || cards[0];
        if (def) setSelectedCard(def);
      })
      .catch(() => {})
      .finally(() => setCardsLoading(false));
  }, [user]);

  const deliveryCost = useMemo(() => {
    if (!deliveryCoords || !companyInfo?.latitude || !companyInfo?.longitude) return 0;
    const dist = haversineKm(companyInfo.latitude, companyInfo.longitude, deliveryCoords.lat, deliveryCoords.lng);
    // Бесплатный радиус и цена за км задаются самой компанией
    const radius = companyInfo.deliveryRadiusKm ?? companyInfo.deliveryRadius ?? DEFAULT_FREE_RADIUS_KM;
    const perKm = companyInfo.deliveryCostPerKm ?? DELIVERY_COST_PER_KM;
    if (dist <= radius) return 0;
    return Math.ceil(dist - radius) * perKm;
  }, [deliveryCoords, companyInfo]);

  // 🎟️ Промокод
  const firstCompanyId = useMemo(() => {
    for (const it of items) { const cid = it.product?.companyId; if (cid) return Number(cid); }
    return null;
  }, [items]);
  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState(null); // { promoId, discount, code }
  const [promoMsg, setPromoMsg] = useState('');
  const [applyingPromo, setApplyingPromo] = useState(false);
  const promoDiscount = promo?.discount || 0;

  const applyPromo = async () => {
    const code = promoInput.trim();
    if (!code) return;
    setApplyingPromo(true);
    setPromoMsg('');
    try {
      const r = await validatePromo({ code, userPhone: user?.phone, companyId: firstCompanyId, orderAmount: total });
      if (r?.valid) {
        setPromo({ promoId: r.promoId, discount: r.discount, code: r.code });
        setPromoMsg('');
      } else {
        setPromo(null);
        setPromoMsg(r?.message || t('promoInvalid') || 'Промокод недействителен');
      }
    } catch {
      setPromo(null);
      setPromoMsg(t('promoInvalid') || 'Промокод недействителен');
    } finally {
      setApplyingPromo(false);
    }
  };

  const grandTotal = Math.max(0, total + deliveryCost - promoDiscount);

  const formatPrice = (p) => `${p.toLocaleString(dateLocale)} ${t('sum')}`;

  const canContinue = useMemo(() => {
    if (step === 1) {
      if (paymentMethod === 'cash') return true;
      if (paymentMethod === 'card') {
        if (showAddCardForm) return inlineCardSaved;
        return !!selectedCard || inlineCardSaved;
      }
      return false;
    }
    return true;
  }, [step, paymentMethod, selectedCard, inlineCardSaved, showAddCardForm]);

  const handlePickLocation = () => {
    navigation.navigate('MapLocationPicker', {
      initialCoords: deliveryCoords ?? undefined,
    });
  };

  // Быстрый выбор адреса из сохранённых / частых мест
  const selectLocation = (addr, lat, lng) => {
    setAddress(addr || '');
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      setDeliveryCoords({ lat, lng });
    } else {
      setDeliveryCoords(null);
    }
  };

  // Объединяем сохранённые адреса и частые места без дублей (по тексту адреса)
  const locationSuggestions = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const a of savedAddresses) {
      const key = (a.address || '').trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: `saved-${a.id}`,
        title: a.title || (a.isDefault ? t('byDefaultAddr') : t('savedAddress')),
        address: a.address,
        lat: a.latitude,
        lng: a.longitude,
        icon: a.isDefault ? 'star' : 'bookmark',
      });
    }
    for (const f of frequentLocations) {
      const key = (f.address || '').trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: `freq-${key}`,
        title: `${t('frequentPlace')}${f.count ? ` · ${f.count} ${t('ordersShort')}` : ''}`,
        address: f.address,
        lat: f.latitude,
        lng: f.longitude,
        icon: 'time',
      });
    }
    return out.slice(0, 6);
  }, [savedAddresses, frequentLocations]);

  const openInMaps = () => {
    if (deliveryCoords) {
      Linking.openURL(`https://maps.google.com/?q=${deliveryCoords.lat},${deliveryCoords.lng}`);
    } else if (address.trim()) {
      Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(address.trim())}`);
    }
  };

  const handleNext = () => {
    if (step === 0 && !address.trim()) {
      Alert.alert(t('specifyDeliveryAddress'));
      return;
    }
    if (step < 2) setStep(s => s + 1);
  };

  const handleCardNumberChange = (text) => {
    const digits = text.replace(/\D/g, '').slice(0, 16);
    setInlineCardNumber(digits.replace(/(.{4})/g, '$1 ').trim());
  };

  const handleExpiryChange = (text) => {
    const cleaned = text.replace(/\D/g, '');
    setInlineExpiry(cleaned.length <= 2 ? cleaned : `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`);
  };

  const handleSaveInlineCard = async () => {
    if (!user) return;
    const digits = inlineCardNumber.replace(/\s/g, '');
    if (digits.length !== 16) {
      Alert.alert(t('error'), t('enterFullCardNumber'));
      return;
    }
    if (!/^\d{2}\/\d{2}$/.test(inlineExpiry)) {
      Alert.alert(t('error'), t('enterExpiry'));
      return;
    }
    if (!inlineHolderName.trim()) {
      Alert.alert(t('error'), t('enterCardHolder'));
      return;
    }
    const nameParts = inlineHolderName.trim().split(/\s+/);
    setSavingInlineCard(true);
    try {
      const card = await addPaymentCard({
        userPhone: user.phone,
        cardNumber: digits,
        cardExpiry: inlineExpiry,
        cardHolderFirstName: nameParts[0],
        cardHolderLastName: nameParts.slice(1).join(' ') || ' ',
        cardType: inlineCardType,
      });
      setSelectedCard(card);
      setSavedCards(prev => [...prev, card]);
      setInlineCardSaved(true);
    } catch {
      Alert.alert(t('error'), t('cardAddFailed'));
    } finally {
      setSavingInlineCard(false);
    }
  };

  const getCardColor = (type) =>
    CARD_TYPES.find(ct => ct.key === type)?.color || colors.primary;

  const handlePlaceOrder = async () => {
    if (!user || items.length === 0) return;
    setIsPlacing(true);
    try {
      // 🛒 Корзина может содержать товары РАЗНЫХ компаний. Каждая компания
      // должна получить ОТДЕЛЬНЫЙ заказ ТОЛЬКО со своими товарами и своей
      // суммой — иначе заказ и вся сумма ошибочно уходят одной компании,
      // а остальные продавцы вообще не видят заказ.
      const groupsMap = {};
      for (const item of items) {
        const cid = Number(item.product?.companyId || 1);
        if (!groupsMap[cid]) groupsMap[cid] = [];
        groupsMap[cid].push(item);
      }
      const groups = Object.entries(groupsMap); // [ [companyId, items], ... ]

      // Стоимость единицы товара с наценкой (её видит покупатель).
      const unitSell = (i) => Number(i.product?.sellingPrice || i.product?.price || 0);
      const lineSubtotal = (arr) => arr.reduce((s, i) => s + unitSell(i) * i.quantity, 0);

      // Скидку промокода распределяем между компаниями
      // пропорционально их доле в общей сумме товаров.
      const totalDiscount = promoDiscount;
      const grandSubtotal = total; // сумма всех товаров до скидок и доставки

      const created = [];
      let distributedDiscount = 0;

      for (let g = 0; g < groups.length; g++) {
        const [companyIdStr, companyItems] = groups[g];
        const companyId = Number(companyIdStr);
        const groupSubtotal = lineSubtotal(companyItems);

        // Последней группе отдаём остаток скидки, чтобы избежать ошибок округления.
        const groupDiscount = g === groups.length - 1
          ? Math.max(0, totalDiscount - distributedDiscount)
          : Math.round(totalDiscount * (grandSubtotal > 0 ? groupSubtotal / grandSubtotal : 0));
        distributedDiscount += groupDiscount;

        // Доставку считаем только для первой компании (companyInfo относится
        // к первому товару корзины) — не дублируем её на каждый заказ.
        const groupDelivery = g === 0 ? deliveryCost : 0;
        const groupTotal = Math.max(0, groupSubtotal - groupDiscount + groupDelivery);

        const order = await createOrder({
          companyId: companyId || undefined,
          customerName: recipientName || user?.name || user?.phone || '',
          customerPhone: user.phone,
          items: companyItems.map(i => ({
            productId: i.productId,
            productName: i.product?.name || t('productWord'),
            quantity: i.quantity,
            price: i.product?.price || 0,
            price_with_markup: i.product?.sellingPrice || i.product?.price || 0,
            imageUrl: i.product?.images?.[0] || undefined,
            color: i.selected_color || undefined,
            size: i.selected_size || undefined,
          })),
          totalAmount: groupTotal,
          deliveryType: 'delivery',
          deliveryAddress: address,
          deliveryCoordinates: deliveryCoords
            ? `${deliveryCoords.lat},${deliveryCoords.lng}`
            : undefined,
          deliveryCost: groupDelivery,
          paymentMethod,
          cardSubtype: paymentMethod === 'card' && selectedCard ? selectedCard.cardType : undefined,
          recipientName,
          comment: comment || undefined,
        });
        created.push(order);
      }

      // Промокод списываем ОДИН раз, относя его к первому заказу.
      const firstOrder = created[0];
      if (firstOrder) {
        // 🎟️ Фиксируем использование промокода.
        if (promo?.promoId) {
          try { await redeemPromo({ promoId: promo.promoId, userPhone: user.phone, orderId: firstOrder.id, discount: promoDiscount }); } catch { /* не блокируем заказ */ }
        }
      }

      await clearAllItems();
      const codes = created.map(o => o.orderCode).filter(Boolean);
      navigation.replace('OrderConfirmed', {
        orderId: firstOrder?.id,
        orderCode: codes.length > 1 ? codes.join(', ') : (codes[0] || ''),
        orderCount: created.length,
      });
    } catch (err) {
      Alert.alert(t('error'), err?.response?.data?.error || t('orderFailed'));
    } finally {
      setIsPlacing(false);
    }
  };

  const paymentOptions = [
    { key: 'card', label: t('bankCard'), icon: 'card-outline' },
    { key: 'cash', label: t('cashOnDelivery'), icon: 'cash-outline' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <TouchableOpacity
          onPress={() => step > 0 ? setStep(s => s - 1) : navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('checkoutTitle')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.stepper}>
        {STEPS.map((label, i) => (
          <React.Fragment key={i}>
            <View style={styles.stepItem}>
              <View style={[
                styles.stepCircle,
                {
                  backgroundColor: i <= step ? colors.primary : colors.surface,
                  borderColor: i <= step ? colors.primary : colors.border,
                },
              ]}>
                {i < step
                  ? <Ionicons name="checkmark" size={14} color="#FFF" />
                  : <Text style={[styles.stepNum, { color: i <= step ? '#FFF' : colors.textSecondary }]}>{i + 1}</Text>
                }
              </View>
              <Text style={[styles.stepLabel, { color: i <= step ? colors.primary : colors.textMuted }]}>
                {label}
              </Text>
            </View>
            {i < STEPS.length - 1 && (
              <View style={[styles.stepLine, { backgroundColor: i < step ? colors.primary : colors.border }]} />
            )}
          </React.Fragment>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {step === 0 && (
          <>
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.deliveryBadge, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]}>
                <Ionicons name="bicycle-outline" size={18} color={colors.primary} />
                <Text style={[styles.deliveryBadgeText, { color: colors.primary }]}>
                  {deliveryCost > 0 ? `${t('deliveryWord')}: ${formatPrice(deliveryCost)}` : t('courierDeliveryFree')}
                </Text>
              </View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('deliveryAddressTitle')}</Text>

              {locationSuggestions.length > 0 && (
                <View style={styles.suggestList}>
                  {locationSuggestions.map(s => {
                    const active = address.trim() === (s.address || '').trim();
                    return (
                      <TouchableOpacity
                        key={s.id}
                        style={[
                          styles.suggestRow,
                          {
                            borderColor: active ? colors.primary : colors.border,
                            backgroundColor: active ? colors.primary + '10' : colors.inputBg,
                          },
                        ]}
                        onPress={() => selectLocation(s.address, s.lat, s.lng)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name={s.icon} size={16} color={active ? colors.primary : colors.textSecondary} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.suggestTitle, { color: active ? colors.primary : colors.textSecondary }]}>
                            {s.title}
                          </Text>
                          <Text style={[styles.suggestAddr, { color: colors.text }]} numberOfLines={1}>
                            {s.address}
                          </Text>
                        </View>
                        {active && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <View style={[styles.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={address}
                  onChangeText={text => { setAddress(text); setDeliveryCoords(null); }}
                  placeholder={t('addressPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  multiline
                />
              </View>

              <TouchableOpacity
                style={[styles.mapPickBtn, { borderColor: colors.primary + '60', backgroundColor: colors.primary + '08' }]}
                onPress={handlePickLocation}
                activeOpacity={0.85}
              >
                <Ionicons name="map" size={18} color={colors.primary} />
                <Text style={[styles.mapPickText, { color: colors.primary }]}>
                  {deliveryCoords ? t('changePlaceOnMap') : t('selectPlaceOnMap')}
                </Text>
              </TouchableOpacity>

              {deliveryCoords && (
                <View style={styles.coordsConfirmRow}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success || '#4CAF50'} />
                  <Text style={[styles.coordsConfirmText, { color: colors.textSecondary }]}>
                    {t('placeSelectedOnMap')} ({deliveryCoords.lat.toFixed(4)}, {deliveryCoords.lng.toFixed(4)})
                  </Text>
                </View>
              )}
            </View>

            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('recipient')}</Text>
              <View style={[styles.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <Ionicons name="person-outline" size={18} color={colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={recipientName}
                  onChangeText={setRecipientName}
                  placeholder={t('recipientNamePlaceholder')}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={[styles.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <Ionicons name="call-outline" size={18} color={colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={recipientPhone}
                  onChangeText={setRecipientPhone}
                  placeholder="+998 (__) ___-__-__"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('orderComment')}</Text>
              <View style={[styles.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border, minHeight: 80, alignItems: 'flex-start', paddingTop: 12 }]}>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={comment}
                  onChangeText={setComment}
                  placeholder={t('commentPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>
          </>
        )}

        {step === 1 && (
          <>
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('paymentMethodTitle')}</Text>
              {paymentOptions.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.optionRow,
                    {
                      borderColor: paymentMethod === opt.key ? colors.primary : colors.border,
                      backgroundColor: paymentMethod === opt.key ? colors.primary + '10' : colors.surface,
                    },
                  ]}
                  onPress={() => setPaymentMethod(opt.key)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.radioOuter, { borderColor: paymentMethod === opt.key ? colors.primary : colors.border }]}>
                    {paymentMethod === opt.key && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
                  </View>
                  <Ionicons name={opt.icon} size={20} color={colors.textSecondary} style={{ marginHorizontal: 8 }} />
                  <Text style={[styles.optionLabel, { color: colors.text }]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {paymentMethod === 'card' && (
              <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {cardsLoading ? (
                  <ActivityIndicator color={colors.primary} style={{ paddingVertical: 8 }} />
                ) : savedCards.length > 0 ? (
                  <>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('selectCard')}</Text>
                    {savedCards.map(card => (
                      <TouchableOpacity
                        key={card.id}
                        style={[
                          styles.savedCardRow,
                          {
                            borderColor: selectedCard?.id === card.id ? colors.primary : colors.border,
                            backgroundColor: selectedCard?.id === card.id ? colors.primary + '10' : colors.inputBg,
                          },
                        ]}
                        onPress={() => { setSelectedCard(card); setShowAddCardForm(false); }}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.radioOuter, { borderColor: selectedCard?.id === card.id ? colors.primary : colors.border }]}>
                          {selectedCard?.id === card.id && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
                        </View>
                        <View style={[styles.cardDot, { backgroundColor: getCardColor(card.cardType) }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.cardRowLabel, { color: colors.text }]}>
                            {CARD_TYPES.find(ct => ct.key === card.cardType)?.label} **** {card.cardNumberLast4}
                          </Text>
                          <Text style={[styles.cardRowSub, { color: colors.textMuted }]}>
                            {card.cardHolderFirstName} {card.cardHolderLastName}
                          </Text>
                        </View>
                        {card.isDefault && (
                          <View style={[styles.defaultBadge, { backgroundColor: colors.primary + '20' }]}>
                            <Text style={[styles.defaultBadgeText, { color: colors.primary }]}>{t('mainCard')}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}

                    <TouchableOpacity
                      style={[styles.addCardBtn, { borderColor: colors.primary + '60', backgroundColor: colors.primary + '08' }]}
                      onPress={() => { setShowAddCardForm(v => !v); setSelectedCard(null); setInlineCardSaved(false); }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name={showAddCardForm ? 'remove-circle-outline' : 'add-circle-outline'} size={20} color={colors.primary} />
                      <Text style={[styles.addCardBtnText, { color: colors.primary }]}>
                        {showAddCardForm ? t('cancel') : t('addNewCard')}
                      </Text>
                    </TouchableOpacity>

                    {showAddCardForm && (
                      <>
                        <View style={styles.cardTypesGrid}>
                          {CARD_TYPES.map(ct => (
                            <TouchableOpacity
                              key={ct.key}
                              style={[
                                styles.cardTypeBtn,
                                {
                                  backgroundColor: inlineCardType === ct.key ? ct.color + '20' : colors.inputBg,
                                  borderColor: inlineCardType === ct.key ? ct.color : colors.border,
                                },
                              ]}
                              onPress={() => setInlineCardType(ct.key)}
                              activeOpacity={0.8}
                            >
                              <View style={[styles.cardDot, { backgroundColor: ct.color }]} />
                              <Text style={[styles.cardTypeLabel, { color: inlineCardType === ct.key ? ct.color : colors.text }]}>
                                {ct.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <View style={[styles.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                          <Ionicons name="card-outline" size={18} color={colors.textSecondary} />
                          <TextInput
                            style={[styles.input, { color: colors.text, letterSpacing: 2 }]}
                            placeholder="1234 5678 9012 3456"
                            placeholderTextColor={colors.textMuted}
                            value={inlineCardNumber}
                            onChangeText={handleCardNumberChange}
                            keyboardType="number-pad"
                            maxLength={19}
                          />
                        </View>
                        <View style={[styles.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                          <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                          <TextInput
                            style={[styles.input, { color: colors.text }]}
                            placeholder={t('expiryPlaceholder')}
                            placeholderTextColor={colors.textMuted}
                            value={inlineExpiry}
                            onChangeText={handleExpiryChange}
                            keyboardType="number-pad"
                            maxLength={5}
                          />
                        </View>
                        <View style={[styles.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                          <Ionicons name="person-outline" size={18} color={colors.textSecondary} />
                          <TextInput
                            style={[styles.input, { color: colors.text }]}
                            placeholder={t('holderNamePlaceholder')}
                            placeholderTextColor={colors.textMuted}
                            value={inlineHolderName}
                            onChangeText={setInlineHolderName}
                            autoCapitalize="words"
                          />
                        </View>
                        {!inlineCardSaved ? (
                          <TouchableOpacity
                            style={[styles.saveCardBtn, { backgroundColor: colors.primary }]}
                            onPress={handleSaveInlineCard}
                            disabled={savingInlineCard}
                            activeOpacity={0.85}
                          >
                            {savingInlineCard
                              ? <ActivityIndicator color="#FFF" />
                              : <Text style={styles.saveCardBtnText}>{t('saveCard')}</Text>
                            }
                          </TouchableOpacity>
                        ) : (
                          <View style={[styles.savedBadge, { backgroundColor: (colors.success || '#4CAF50') + '20', borderColor: (colors.success || '#4CAF50') + '60' }]}>
                            <Ionicons name="checkmark-circle" size={18} color={colors.success || '#4CAF50'} />
                            <Text style={[styles.savedBadgeText, { color: colors.success || '#4CAF50' }]}>{t('cardSaved')}</Text>
                          </View>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('cardData')}</Text>
                    <View style={styles.cardTypesGrid}>
                      {CARD_TYPES.map(ct => (
                        <TouchableOpacity
                          key={ct.key}
                          style={[
                            styles.cardTypeBtn,
                            {
                              backgroundColor: inlineCardType === ct.key ? ct.color + '20' : colors.inputBg,
                              borderColor: inlineCardType === ct.key ? ct.color : colors.border,
                            },
                          ]}
                          onPress={() => setInlineCardType(ct.key)}
                          activeOpacity={0.8}
                        >
                          <View style={[styles.cardDot, { backgroundColor: ct.color }]} />
                          <Text style={[styles.cardTypeLabel, { color: inlineCardType === ct.key ? ct.color : colors.text }]}>
                            {ct.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={[styles.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                      <Ionicons name="card-outline" size={18} color={colors.textSecondary} />
                      <TextInput
                        style={[styles.input, { color: colors.text, letterSpacing: 2 }]}
                        placeholder="1234 5678 9012 3456"
                        placeholderTextColor={colors.textMuted}
                        value={inlineCardNumber}
                        onChangeText={handleCardNumberChange}
                        keyboardType="number-pad"
                        maxLength={19}
                      />
                    </View>
                    <View style={[styles.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                      <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                      <TextInput
                        style={[styles.input, { color: colors.text }]}
                        placeholder={t('expiryPlaceholder')}
                        placeholderTextColor={colors.textMuted}
                        value={inlineExpiry}
                        onChangeText={handleExpiryChange}
                        keyboardType="number-pad"
                        maxLength={5}
                      />
                    </View>
                    <View style={[styles.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                      <Ionicons name="person-outline" size={18} color={colors.textSecondary} />
                      <TextInput
                        style={[styles.input, { color: colors.text }]}
                        placeholder={t('holderNamePlaceholder')}
                        placeholderTextColor={colors.textMuted}
                        value={inlineHolderName}
                        onChangeText={setInlineHolderName}
                        autoCapitalize="words"
                      />
                    </View>
                    {!inlineCardSaved ? (
                      <TouchableOpacity
                        style={[styles.saveCardBtn, { backgroundColor: colors.primary }]}
                        onPress={handleSaveInlineCard}
                        disabled={savingInlineCard}
                        activeOpacity={0.85}
                      >
                        {savingInlineCard
                          ? <ActivityIndicator color="#FFF" />
                          : <Text style={styles.saveCardBtnText}>{t('saveCard')}</Text>
                        }
                      </TouchableOpacity>
                    ) : (
                      <View style={[styles.savedBadge, { backgroundColor: (colors.success || '#4CAF50') + '20', borderColor: (colors.success || '#4CAF50') + '60' }]}>
                        <Ionicons name="checkmark-circle" size={18} color={colors.success || '#4CAF50'} />
                        <Text style={[styles.savedBadgeText, { color: colors.success || '#4CAF50' }]}>{t('cardSaved')}</Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('yourOrder')}</Text>
              {items.map(item => (
                <View key={item.id} style={styles.orderItemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.orderItemName, { color: colors.text }]} numberOfLines={2}>
                      {item.product?.name}
                    </Text>
                    {(item.selected_color || item.selected_size) && (
                      <Text style={[styles.orderItemVariant, { color: colors.textMuted }]}>
                        {[item.selected_color, item.selected_size].filter(Boolean).join(' / ')}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.orderItemQty, { color: colors.textSecondary }]}>× {item.quantity}</Text>
                  <Text style={[styles.orderItemPrice, { color: colors.text }]}>
                    {((item.product?.sellingPrice || item.product?.price || 0) * item.quantity).toLocaleString(dateLocale)} {t('sum')}
                  </Text>
                </View>
              ))}
            </View>

            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('deliveryWord')}</Text>
              <View style={styles.confirmRow}>
                <Ionicons name="bicycle-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.confirmText, { color: colors.textSecondary, flex: 1 }]} numberOfLines={2}>
                  {address || t('addressNotSet')}
                </Text>
                {(deliveryCoords || address.trim()) && (
                  <TouchableOpacity onPress={openInMaps} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="map-outline" size={20} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('paymentTitle')}</Text>
              <View style={styles.confirmRow}>
                <Ionicons name={paymentMethod === 'card' ? 'card-outline' : 'cash-outline'} size={16} color={colors.textSecondary} />
                <Text style={[styles.confirmText, { color: colors.textSecondary }]}>
                  {paymentMethod === 'cash'
                    ? t('cashOnDelivery')
                    : selectedCard
                      ? `${CARD_TYPES.find(ct => ct.key === selectedCard.cardType)?.label} **** ${selectedCard.cardNumberLast4}`
                      : t('bankCard')
                  }
                </Text>
              </View>
            </View>

            <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {items.map(item => (
                <View key={item.id} style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary, flex: 1 }]} numberOfLines={1}>
                    {item.product?.name}
                  </Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>
                    {((item.product?.sellingPrice || item.product?.price || 0) * item.quantity).toLocaleString(dateLocale)} {t('sum')}
                  </Text>
                </View>
              ))}
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{t('deliveryWord')}</Text>
                {deliveryCost > 0
                  ? <Text style={[styles.summaryValue, { color: colors.text }]}>{formatPrice(deliveryCost)}</Text>
                  : <Text style={[styles.freeText, { color: colors.success || '#4CAF50' }]}>{t('free')}</Text>
                }
              </View>

              {/* 🎟️ Промокод */}
              <View style={{ marginTop: 6 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    value={promoInput}
                    onChangeText={(v) => setPromoInput(v.toUpperCase())}
                    placeholder={t('promoPlaceholder') || 'Промокод'}
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="characters"
                    editable={!promo}
                    style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, color: colors.text, fontSize: 14 }}
                  />
                  {promo ? (
                    <TouchableOpacity onPress={() => { setPromo(null); setPromoInput(''); setPromoMsg(''); }} style={{ paddingHorizontal: 14, justifyContent: 'center', borderRadius: 10, backgroundColor: colors.border }}>
                      <Ionicons name="close" size={18} color={colors.text} />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={applyPromo} disabled={applyingPromo || !promoInput.trim()} style={{ paddingHorizontal: 16, justifyContent: 'center', borderRadius: 10, backgroundColor: colors.primary, opacity: applyingPromo || !promoInput.trim() ? 0.6 : 1 }}>
                      {applyingPromo ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>{t('applyBtn') || 'Применить'}</Text>}
                    </TouchableOpacity>
                  )}
                </View>
                {promoMsg ? <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>{promoMsg}</Text> : null}
              </View>

              {promo && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: '#22C55E' }]}>🎟️ {promo.code}</Text>
                  <Text style={[styles.summaryValue, { color: '#22C55E' }]}>−{formatPrice(promoDiscount)}</Text>
                </View>
              )}

              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryRow}>
                <Text style={[styles.totalLabel, { color: colors.text }]}>{t('total')}</Text>
                <Text style={[styles.totalValue, { color: colors.text }]}>{formatPrice(grandTotal)}</Text>
              </View>
            </View>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.bottomTotal}>
          <Text style={[styles.bottomTotalLabel, { color: colors.textSecondary }]}>{t('total')}</Text>
          <Text style={[styles.bottomTotalValue, { color: colors.text }]}>{formatPrice(grandTotal)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: canContinue ? colors.primary : colors.border }]}
          onPress={canContinue ? (step < 2 ? handleNext : handlePlaceOrder) : undefined}
          disabled={isPlacing}
          activeOpacity={0.85}
        >
          {isPlacing ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={[styles.nextBtnText, { color: canContinue ? '#FFF' : colors.textMuted }]}>
              {step < 2 ? t('continueBtn') : `${t('payAction')} ${formatPrice(grandTotal)}`}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  stepItem: { alignItems: 'center', gap: 4 },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: { fontSize: 13, fontWeight: '700' },
  stepLabel: { fontSize: 11, fontWeight: '500' },
  stepLine: { flex: 1, height: 2, marginHorizontal: 6, marginBottom: 18 },
  scroll: { paddingHorizontal: 16 },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  deliveryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  deliveryBadgeText: { fontSize: 14, fontWeight: '600' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    minHeight: 50,
    paddingVertical: 8,
  },
  input: { flex: 1, fontSize: 15 },
  suggestList: { gap: 8 },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  suggestTitle: { fontSize: 11, fontWeight: '600' },
  suggestAddr: { fontSize: 14, marginTop: 1 },
  mapPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    paddingVertical: 12,
  },
  mapPickText: { fontSize: 14, fontWeight: '600' },
  coordsConfirmRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  coordsConfirmText: { fontSize: 12, flex: 1 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    gap: 10,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  optionLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  savedCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
  },
  cardDot: { width: 10, height: 10, borderRadius: 5 },
  cardRowLabel: { fontSize: 14, fontWeight: '600' },
  cardRowSub: { fontSize: 12, marginTop: 2 },
  defaultBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  defaultBadgeText: { fontSize: 11, fontWeight: '600' },
  addCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    paddingVertical: 12,
  },
  addCardBtnText: { fontSize: 14, fontWeight: '600' },
  cardTypesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cardTypeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  cardTypeLabel: { fontSize: 13, fontWeight: '600' },
  saveCardBtn: { height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  saveCardBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  savedBadgeText: { fontSize: 14, fontWeight: '600' },
  orderItemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  orderItemName: { fontSize: 14, lineHeight: 20 },
  orderItemVariant: { fontSize: 12, marginTop: 2 },
  orderItemQty: { fontSize: 13, marginTop: 2 },
  orderItemPrice: { fontSize: 14, fontWeight: '600' },
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  confirmText: { fontSize: 14, lineHeight: 20 },
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    marginBottom: 12,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14 },
  freeText: { fontSize: 14, fontWeight: '600' },
  divider: { height: 1, marginVertical: 2 },
  totalLabel: { fontSize: 16, fontWeight: '700' },
  totalValue: { fontSize: 18, fontWeight: '800' },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    paddingBottom: 28,
  },
  bottomTotal: { flex: 1 },
  bottomTotalLabel: { fontSize: 12 },
  bottomTotalValue: { fontSize: 18, fontWeight: '800' },
  nextBtn: {
    flex: 2,
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnText: { fontSize: 15, fontWeight: '700' },
});
