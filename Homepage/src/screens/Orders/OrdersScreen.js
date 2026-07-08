import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  Image, ActivityIndicator, RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../context/LanguageContext';
import { getUserOrders } from '../../api';
import { UPLOADS_URL } from '../../constants/Api';
import { getImageUrl } from '../../utils/imageUrl';

const TABS = [
  { key: '', labelKey: 'tabAll' },
  { key: 'pending,confirmed,processing,shipped', labelKey: 'tabActive' },
  { key: 'delivered,completed', labelKey: 'tabDelivered' },
  { key: 'cancelled', labelKey: 'tabCancelled' },
];

const STATUS_CONFIG = {
  pending: { labelKey: 'statusPending', color: '#FFA726', icon: 'time-outline' },
  confirmed: { labelKey: 'statusConfirmed', color: '#7B5CF0', icon: 'checkmark-circle-outline' },
  processing: { labelKey: 'statusProcessing', color: '#7B5CF0', icon: 'refresh-outline' },
  shipped: { labelKey: 'statusShipped', color: '#2196F3', icon: 'bicycle-outline' },
  delivered: { labelKey: 'statusDelivered', color: '#4CAF50', icon: 'checkmark-done-outline' },
  completed: { labelKey: 'statusDelivered', color: '#4CAF50', icon: 'checkmark-done-outline' },
  cancelled: { labelKey: 'statusCancelled', color: '#FF5252', icon: 'close-circle-outline' },
};

export default function OrdersScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { addItem } = useCart();
  const { t, language } = useLanguage();
  const navigation = useNavigation();
  const dateLocale = language === 'uz' ? 'uz-UZ' : 'ru-RU';
  const [activeTab, setActiveTab] = useState('');
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [reorderingId, setReorderingId] = useState(null);

  // 🔁 «Повторить заказ»: кладёт все позиции завершённого заказа в корзину
  // и открывает её — одна кнопка вместо повторного поиска товаров.
  const handleReorder = async (order) => {
    if (reorderingId) return;
    setReorderingId(order.id);
    try {
      const items = Array.isArray(order.items) ? order.items : [];
      for (const it of items) {
        if (!it.productId) continue;
        try {
          await addItem(it.productId, it.quantity || 1, it.color, it.size);
        } catch { /* товар мог закончиться — пропускаем */ }
      }
      navigation.navigate('Main', { screen: 'Cart' });
    } finally {
      setReorderingId(null);
    }
  };

  const load = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getUserOrders(user.phone);
      setOrders(data);
    } catch (e) {
      setError(t('errorLoadOrders'));
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered = activeTab
    ? orders.filter(o => activeTab.split(',').includes(o.status))
    : orders;

  const renderOrder = ({ item }) => {
    const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    const orderItems = Array.isArray(item.items) ? item.items : [];
    const firstItem = orderItems[0];

    return (
      <TouchableOpacity
        style={[styles.orderCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
        activeOpacity={0.8}
      >
        <View style={styles.cardTop}>
          <View style={[styles.thumbnail, { backgroundColor: colors.cardAlt }]}>
            {firstItem?.imageUrl ? (
              <Image
                source={{ uri: getImageUrl(firstItem.imageUrl) || '' }}
                style={styles.thumbnailImg}
                resizeMode="contain"
              />
            ) : (
              <Ionicons name="cube-outline" size={28} color={colors.textMuted} />
            )}
          </View>

          <View style={styles.cardInfo}>
            <View style={styles.cardTopRow}>
              <Text style={[styles.orderNum, { color: colors.text }]}>{t('orderLabel')} №{item.orderCode}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusCfg.color + '20' }]}>
                <Ionicons name={statusCfg.icon} size={12} color={statusCfg.color} />
                <Text style={[styles.statusText, { color: statusCfg.color }]}>{t(statusCfg.labelKey)}</Text>
              </View>
            </View>
            <Text style={[styles.orderDate, { color: colors.textMuted }]}>
              {new Date(item.createdAt).toLocaleDateString(dateLocale, {
                day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
              })}
            </Text>
            {orderItems.length > 0 && (
              <Text style={[styles.orderItems, { color: colors.textSecondary }]} numberOfLines={1}>
                {orderItems.map(i => i.productName).join(', ')}
              </Text>
            )}
          </View>
        </View>

        <View style={[styles.cardDivider, { backgroundColor: colors.divider }]} />

        <View style={styles.cardBottom}>
          <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>{t('total')}</Text>
          <Text style={[styles.totalValue, { color: colors.text }]}>
            {item.totalAmount.toLocaleString(dateLocale)} {t('sum')}
          </Text>
          {item.deliveryType && (
            <Text style={[styles.deliveryInfo, { color: colors.textMuted }]}>
              · {item.deliveryType === 'delivery' ? t('deliveryWord') : t('pickup')}
            </Text>
          )}
          {['delivered', 'completed', 'cancelled'].includes(item.status) && orderItems.length > 0 && (
            <TouchableOpacity
              style={[styles.reorderBtn, { backgroundColor: colors.primary + '18' }]}
              onPress={() => handleReorder(item)}
              disabled={reorderingId === item.id}
              activeOpacity={0.7}
            >
              {reorderingId === item.id ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="repeat-outline" size={14} color={colors.primary} />
                  <Text style={[styles.reorderText, { color: colors.primary }]}>
                    {t('reorderBtn') || (language === 'uz' ? 'Qayta buyurtma' : 'Повторить')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('myOrders')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabsWrap}>
        <FlatList
          data={TABS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.tabs}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.tab,
                {
                  backgroundColor: activeTab === item.key ? colors.primary : colors.surface,
                  borderColor: activeTab === item.key ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setActiveTab(item.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, { color: activeTab === item.key ? '#FFF' : colors.textSecondary }]}>
                {t(item.labelKey)}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="wifi-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('errorLoading')}</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>{error}</Text>
          <TouchableOpacity onPress={load} style={[styles.retryBtn, { backgroundColor: colors.primary }]} activeOpacity={0.8}>
            <Text style={styles.retryBtnText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderOrder}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="receipt-outline" size={64} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('noOrders')}</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {activeTab ? t('noOrdersInCategory') : t('neverOrdered')}
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 40 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  tabsWrap: { marginBottom: 8 },
  tabs: { paddingHorizontal: 16, gap: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  tabText: { fontSize: 13, fontWeight: '500' },
  list: { paddingHorizontal: 16, gap: 10 },
  orderCard: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', gap: 12, padding: 14 },
  thumbnail: { width: 70, height: 70, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  thumbnailImg: { width: '100%', height: '100%', borderRadius: 12 },
  cardInfo: { flex: 1, gap: 4 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderNum: { fontSize: 15, fontWeight: '700' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '600' },
  orderDate: { fontSize: 12 },
  orderItems: { fontSize: 13 },
  cardDivider: { height: 1, marginHorizontal: 14 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 6 },
  reorderBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, marginLeft: 'auto' },
  reorderText: { fontSize: 12, fontWeight: '600' },
  totalLabel: { fontSize: 13 },
  totalValue: { fontSize: 16, fontWeight: '700' },
  deliveryInfo: { fontSize: 13 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptyText: { fontSize: 14, textAlign: 'center' },
  retryBtn: { marginTop: 8, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 14 },
  retryBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});
