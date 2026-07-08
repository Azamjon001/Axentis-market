import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Image, ActivityIndicator, Linking, Alert, TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { getOrderDetail, createReturn, getCompanyDetail, getOrderCourierLocation } from '../../api';
import { UPLOADS_URL } from '../../constants/Api';
import { getImageUrl } from '../../utils/imageUrl';
import CourierTrackMap from '../../components/common/CourierTrackMap';

// "lat,lng" → { lat, lng }
function parseCoords(str) {
  if (!str || typeof str !== 'string') return null;
  const [a, b] = str.split(',').map((x) => parseFloat(x.trim()));
  if (isNaN(a) || isNaN(b)) return null;
  return { lat: a, lng: b };
}

const STATUS_CONFIG = {
  pending: { labelKey: 'statusPendingFull', color: '#FFA726', icon: 'time-outline', step: 0 },
  confirmed: { labelKey: 'statusConfirmed', color: '#7B5CF0', icon: 'checkmark-circle-outline', step: 1 },
  processing: { labelKey: 'statusProcessing', color: '#7B5CF0', icon: 'refresh-outline', step: 1 },
  shipped: { labelKey: 'statusShipped', color: '#2196F3', icon: 'bicycle-outline', step: 2 },
  delivered: { labelKey: 'statusDelivered', color: '#4CAF50', icon: 'checkmark-done-outline', step: 3 },
  completed: { labelKey: 'statusDelivered', color: '#4CAF50', icon: 'checkmark-done-outline', step: 3 },
  cancelled: { labelKey: 'statusCancelled', color: '#FF5252', icon: 'close-circle-outline', step: -1 },
};

export default function OrderDetailScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const navigation = useNavigation();
  const route = useRoute();
  const { orderId } = route.params;
  const dateLocale = language === 'uz' ? 'uz-UZ' : 'ru-RU';

  const [order, setOrder] = useState(null);
  const [company, setCompany] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // ↩️ Возврат: форма причины + статус отправки
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [returnRequested, setReturnRequested] = useState(false);

  // 🚴 Живое отслеживание курьера (только когда заказ в пути)
  const [courierTrack, setCourierTrack] = useState(null);

  const submitReturn = async () => {
    if (!returnReason.trim()) {
      Alert.alert(t('returnWord'), t('describeReturnReason'));
      return;
    }
    setSubmittingReturn(true);
    try {
      await createReturn({
        orderId: order.id,
        // Не шлём companyId=0 — бэкенд сам выведет его из заказа (иначе FK-ошибка).
        companyId: order.companyId > 0 ? order.companyId : undefined,
        customerPhone: user?.phone || order.customerPhone,
        reason: returnReason.trim(),
        refundAmount: order.totalAmount || 0,
      });
      setReturnRequested(true);
      setShowReturnForm(false);
      setReturnReason('');
      Alert.alert(t('returnWord'), t('returnSentMsg'));
    } catch (e) {
      Alert.alert(t('error'), t('returnFailMsg'));
    } finally {
      setSubmittingReturn(false);
    }
  };

  useEffect(() => {
    getOrderDetail(orderId)
      .then((o) => {
        setOrder(o);
        if (o?.companyId) {
          getCompanyDetail(o.companyId).then(setCompany).catch(() => {});
        }
      })
      .catch(() => setOrder(null))
      .finally(() => setIsLoading(false));
  }, [orderId]);

  // Пока заказ «в пути» (shipped) — опрашиваем положение курьера каждые 10 сек
  useEffect(() => {
    if (order?.status !== 'shipped') { setCourierTrack(null); return; }
    let active = true;
    const load = () => {
      getOrderCourierLocation(orderId)
        .then((d) => { if (active) setCourierTrack(d); })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 10000);
    return () => { active = false; clearInterval(iv); };
  }, [order?.status, orderId]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>{t('orderNotFound')}</Text>
      </View>
    );
  }

  const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const orderItems = Array.isArray(order.items) ? order.items : [];
  const PROGRESS_STEPS = [t('stepPlaced'), t('stepConfirmed'), t('stepInTransit'), t('stepDelivered')];

  // Возврат разрешён политикой компании: включён + статус доставлен/выполнен + не истёк срок
  const returnEnabled = company ? company.returnEnabled !== false : true;
  const returnWindowHours = company?.returnWindowHours ?? 24;
  const isDeliveredOrDone = order.status === 'delivered' || order.status === 'completed';
  const hoursSinceOrder = order.createdAt
    ? (Date.now() - new Date(order.createdAt).getTime()) / 3_600_000
    : 0;
  const withinWindow = returnWindowHours <= 0 || hoursSinceOrder <= returnWindowHours;
  const canReturn = returnEnabled && isDeliveredOrDone && withinWindow;
  const returnWindowExpired = returnEnabled && isDeliveredOrDone && !withinWindow;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {t('orderLabel')} №{order.orderCode}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: statusCfg.color + '40' }]}>
          <View style={[styles.statusIconBg, { backgroundColor: statusCfg.color + '20' }]}>
            <Ionicons name={statusCfg.icon} size={28} color={statusCfg.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusLabel, { color: statusCfg.color }]}>{t(statusCfg.labelKey)}</Text>
            <Text style={[styles.statusDate, { color: colors.textMuted }]}>
              {t('orderFrom')} {new Date(order.createdAt).toLocaleDateString(dateLocale, {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </Text>
          </View>
        </View>

        {/* 🚴 Живое отслеживание курьера — пока заказ в пути */}
        {order.status === 'shipped' && courierTrack && (courierTrack.hasCourier || courierTrack.deliveryCoords) && (
          <View style={[styles.trackCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.trackHeader}>
              <Ionicons name="bicycle-outline" size={20} color={colors.primary} />
              <Text style={[styles.trackTitle, { color: colors.text }]}>
                {language === 'uz' ? 'Kuryer yoʻlda' : 'Курьер в пути'}
              </Text>
            </View>
            <CourierTrackMap
              courier={courierTrack.hasCourier ? { lat: courierTrack.courier.lat, lng: courierTrack.courier.lng } : null}
              destination={parseCoords(courierTrack.deliveryCoords)}
            />
            {courierTrack.courier?.name ? (
              <View style={styles.courierRow}>
                <Text style={{ color: colors.text, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                  {courierTrack.courier.name}
                </Text>
                {courierTrack.courier.phone ? (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`tel:${courierTrack.courier.phone}`)}
                    style={[styles.callBtn, { backgroundColor: colors.primary }]}
                  >
                    <Ionicons name="call-outline" size={16} color="#FFF" />
                    <Text style={styles.callTxt}>{courierTrack.courier.phone}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              <Text style={{ color: colors.textMuted, marginTop: 8, fontSize: 13 }}>
                {language === 'uz' ? 'Kuryerning joylashuvi kutilmoqda…' : 'Ожидаем координаты курьера…'}
              </Text>
            )}
          </View>
        )}

        {order.status !== 'cancelled' && (
          <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Линия рисуется ПЕРВОЙ и лежит ПОД точками, чтобы галочки были сверху */}
            <View style={styles.progressLineWrap} pointerEvents="none">
              {PROGRESS_STEPS.slice(0, -1).map((_, i) => (
                <View key={i} style={[styles.progressLine, { backgroundColor: i < statusCfg.step ? colors.primary : colors.border }]} />
              ))}
            </View>
            <View style={styles.progressSteps}>
              {PROGRESS_STEPS.map((label, i) => (
                <View key={i} style={styles.progressStep}>
                  <View style={[
                    styles.progressDot,
                    {
                      backgroundColor: i <= statusCfg.step ? colors.primary : colors.border,
                      borderColor: i <= statusCfg.step ? colors.primary : colors.border,
                    },
                  ]}>
                    {i < statusCfg.step && (
                      <Ionicons name="checkmark" size={10} color="#FFF" />
                    )}
                  </View>
                  <Text style={[styles.progressLabel, { color: i <= statusCfg.step ? colors.text : colors.textMuted }]}>
                    {label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('deliveryTitle')}</Text>
          <View style={styles.infoRow}>
            <Ionicons name="bicycle-outline" size={18} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              {order.deliveryType === 'delivery' ? t('byCourier') : t('pickup')}
            </Text>
          </View>
          {order.deliveryAddress && (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={18} color={colors.textMuted} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>{order.deliveryAddress}</Text>
            </View>
          )}
          {order.recipientName && (
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={18} color={colors.textMuted} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>{order.recipientName}</Text>
            </View>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('productsTitle')}</Text>
          {orderItems.map((item, i) => {
            // Цена для покупателя — продажная (с наценкой). Себестоимость (item.price)
            // НИКОГДА не показываем. Старые заказы без markup → fallback на price.
            const unitPrice = item.priceWithMarkup ?? item.price ?? 0;
            // Вариант (цвет/размер) — показываем, если есть и не «Любой».
            const color = item.color && item.color !== 'Любой' && item.color !== 'любой' ? item.color : null;
            const size = item.size || null;
            const variantParts = [];
            if (color) variantParts.push(`${t('colorLabel')}: ${color}`);
            if (size) variantParts.push(`${t('sizeLabel')}: ${size}`);
            return (
              <View key={i} style={[styles.orderItem, i > 0 && { borderTopWidth: 1, borderTopColor: colors.divider }]}>
                {item.imageUrl ? (
                  <Image
                    source={{ uri: getImageUrl(item.imageUrl) || '' }}
                    style={[styles.itemImg, { backgroundColor: colors.cardAlt }]}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={[styles.itemImg, { backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="cube-outline" size={24} color={colors.textMuted} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemName, { color: colors.text }]}>{item.productName}</Text>
                  {variantParts.length > 0 && (
                    <View style={styles.variantRow}>
                      {variantParts.map((vp, vi) => (
                        <View key={vi} style={[styles.variantChip, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
                          <Text style={[styles.variantChipText, { color: colors.textSecondary }]}>{vp}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  <Text style={[styles.itemQty, { color: colors.textMuted }]}>{item.quantity} {t('pcs')}</Text>
                  {/* ⭐ После доставки предлагаем оценить каждый товар — форма
                      отзыва (с фото) уже есть на странице товара */}
                  {isDeliveredOrDone && item.productId ? (
                    <TouchableOpacity
                      style={[styles.rateBtn, { backgroundColor: colors.primary + '18' }]}
                      onPress={() => navigation.navigate('ProductDetail', { productId: item.productId, openReview: true })}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="star-outline" size={13} color={colors.primary} />
                      <Text style={[styles.rateBtnText, { color: colors.primary }]}>{t('ratePurchase')}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <Text style={[styles.itemPrice, { color: colors.text }]}>
                  {(unitPrice * item.quantity).toLocaleString(dateLocale)} {t('sum')}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('paymentTitle')}</Text>
          <View style={styles.infoRow}>
            <Ionicons name={order.paymentMethod === 'card' ? 'card-outline' : 'cash-outline'} size={18} color={colors.textMuted} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              {order.paymentMethod === 'card'
                ? `${t('paymentCard')} (${(order.cardSubtype || 'card').toUpperCase()})`
                : t('paymentCash')}
            </Text>
          </View>
          <View style={[styles.totalRow, { borderTopColor: colors.divider }]}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>{t('total')}</Text>
            <Text style={[styles.totalValue, { color: colors.text }]}>
              {order.totalAmount.toLocaleString(dateLocale)} {t('sum')}
            </Text>
          </View>
        </View>

        {/* ↩️ Возврат — по политике компании (включён + в течение N часов) */}
        {canReturn && !returnRequested && (
          showReturnForm ? (
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('returnTitle')}</Text>
              <Text style={[styles.infoText, { color: colors.textMuted }]}>
                {t('returnPossibleWithin')} {returnWindowHours} {t('hoursShort')} {t('afterOrder')}
              </Text>
              <TextInput
                value={returnReason}
                onChangeText={setReturnReason}
                placeholder={t('returnReasonPlaceholder')}
                placeholderTextColor={colors.textMuted}
                multiline
                style={[styles.returnInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.cardAlt }]}
              />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <TouchableOpacity
                  style={[styles.returnBtn, { backgroundColor: colors.primary, flex: 1, opacity: submittingReturn ? 0.6 : 1 }]}
                  onPress={submitReturn}
                  disabled={submittingReturn}
                  activeOpacity={0.8}
                >
                  <Text style={styles.returnBtnText}>{submittingReturn ? t('sending') : t('sendRequest')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.returnBtn, { backgroundColor: colors.cardAlt }]}
                  onPress={() => { setShowReturnForm(false); setReturnReason(''); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.returnBtnText, { color: colors.text }]}>{t('cancel')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.supportBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setShowReturnForm(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="return-down-back-outline" size={20} color="#FF7043" />
              <Text style={[styles.supportText, { color: '#FF7043' }]}>{t('returnTitle')}</Text>
            </TouchableOpacity>
          )
        )}

        {returnRequested && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
            <Ionicons name="checkmark-circle-outline" size={22} color="#4CAF50" />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>{t('returnRequestedMsg')}</Text>
          </View>
        )}

        {returnWindowExpired && !returnRequested && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
            <Ionicons name="time-outline" size={20} color={colors.textMuted} />
            <Text style={[styles.infoText, { color: colors.textMuted }]}>
              {t('returnExpired')} ({returnWindowHours} {t('hoursShort')})
            </Text>
          </View>
        )}

        {isDeliveredOrDone && !returnEnabled && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
            <Ionicons name="information-circle-outline" size={20} color={colors.textMuted} />
            <Text style={[styles.infoText, { color: colors.textMuted }]}>{t('noReturnsAccepted')}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.supportBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => Linking.openURL('tel:+74951234567').catch(() => Alert.alert(t('supportTitle'), t('supportPhoneMsg')))}
          activeOpacity={0.8}
        >
          <Ionicons name="headset-outline" size={20} color={colors.primary} />
          <Text style={[styles.supportText, { color: colors.primary }]}>{t('contactSupport')}</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  scroll: { padding: 16, gap: 12 },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: 1.5, padding: 16 },
  trackCard: { borderRadius: 18, borderWidth: 1, padding: 14, marginTop: 12 },
  trackHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  trackTitle: { fontSize: 15, fontWeight: '700' },
  courierRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  callBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  callTxt: { color: '#FFF', fontWeight: '600', fontSize: 13 },
  statusIconBg: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statusLabel: { fontSize: 16, fontWeight: '700' },
  statusDate: { fontSize: 12, marginTop: 2 },
  progressCard: { borderRadius: 18, borderWidth: 1, padding: 16, position: 'relative' },
  progressSteps: { flexDirection: 'row', justifyContent: 'space-between', zIndex: 1 },
  progressStep: { alignItems: 'center', gap: 6, flex: 1, zIndex: 1 },
  progressDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center', zIndex: 2, elevation: 2 },
  progressLabel: { fontSize: 10, textAlign: 'center' },
  progressLineWrap: { position: 'absolute', top: 28, left: 40, right: 40, flexDirection: 'row', zIndex: 0 },
  progressLine: { flex: 1, height: 2, marginHorizontal: 4 },
  section: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  infoText: { flex: 1, fontSize: 14, lineHeight: 20 },
  orderItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10 },
  itemImg: { width: 60, height: 60, borderRadius: 10 },
  itemName: { fontSize: 14, fontWeight: '500', lineHeight: 19 },
  variantRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 5 },
  variantChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  variantChipText: { fontSize: 11, fontWeight: '600' },
  itemQty: { fontSize: 12, marginTop: 4 },
  rateBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9, marginTop: 6 },
  rateBtnText: { fontSize: 12, fontWeight: '600' },
  itemPrice: { fontSize: 15, fontWeight: '700' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, paddingTop: 10 },
  totalLabel: { fontSize: 16, fontWeight: '700' },
  totalValue: { fontSize: 18, fontWeight: '800' },
  supportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 18, borderWidth: 1, padding: 16 },
  supportText: { fontSize: 15, fontWeight: '600' },
  returnInput: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 70, fontSize: 14, textAlignVertical: 'top' },
  returnBtn: { borderRadius: 14, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  returnBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
