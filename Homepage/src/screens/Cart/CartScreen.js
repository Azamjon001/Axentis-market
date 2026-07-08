import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  Image, ActivityIndicator, Alert, RefreshControl, TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { getImageUrl } from '../../utils/imageUrl';
import { Radius } from '../../constants/theme';

export default function CartScreen() {
  const { colors, isDark } = useTheme();
  const { items, count, total, isLoading, updateItem, removeItem, clearAllItems, refresh } = useCart();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const navigation = useNavigation();

  // Оформление заказа требует входа. Гость наполняет корзину свободно —
  // вход просим только на этом шаге, после входа корзина переносится.
  const goCheckout = () => {
    if (!user) { navigation.navigate('Login'); return; }
    navigation.navigate('Checkout');
  };
  const [updatingId, setUpdatingId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [qtyInputs, setQtyInputs] = useState({});

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const handleQuantityChange = async (item, delta) => {
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      await removeItem(item.id);
      return;
    }
    // Block increment if it would exceed known variant stock
    if (delta > 0 && item.stockQuantity !== undefined && newQty > item.stockQuantity) {
      Alert.alert(t('notEnoughStock'), `${t('inStockOnlyPrefix')} ${item.stockQuantity} ${t('inStockOnlySuffix')}`);
      return;
    }
    setUpdatingId(item.id);
    try {
      await updateItem(item.productId, newQty, item.selected_color || undefined, item.selected_size || undefined);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleQtyInputChange = (item, text) => {
    setQtyInputs(prev => ({ ...prev, [item.id]: text }));
  };

  const handleQtyInputBlur = async (item) => {
    const raw = qtyInputs[item.id];
    if (raw === undefined) return;
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed !== item.quantity) {
      if (item.stockQuantity !== undefined && parsed > item.stockQuantity) {
        Alert.alert(t('notEnoughStock'), `${t('inStockOnlyPrefix')} ${item.stockQuantity} ${t('inStockOnlySuffix')}`);
        setQtyInputs(prev => { const n = { ...prev }; delete n[item.id]; return n; });
        return;
      }
      setUpdatingId(item.id);
      try {
        await updateItem(item.productId, parsed, item.selected_color || undefined, item.selected_size || undefined);
      } finally {
        setUpdatingId(null);
      }
    }
    setQtyInputs(prev => { const n = { ...prev }; delete n[item.id]; return n; });
  };

  const handleRemove = async (item) => {
    await removeItem(item.id);
  };

  const handleClearCart = () => {
    Alert.alert(
      t('clearCart'),
      t('clearCartMsg'),
      [
        { text: t('no'), style: 'cancel' },
        {
          text: t('clear'),
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllItems();
            } catch {
              Alert.alert(t('error'), t('error'));
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const formatPrice = (p) => `${p.toLocaleString(language === 'uz' ? 'uz-UZ' : 'ru-RU')} ${t('sum')}`;

  const renderItem = ({ item }) => {
    const product = item.product;
    const price = product?.discountedPrice || product?.sellingPrice || product?.price || 0;
    const itemTotal = price * item.quantity;
    const imageUri = getImageUrl(product?.images?.[0]);
    const qtyDisplay = qtyInputs[item.id] !== undefined ? qtyInputs[item.id] : String(item.quantity);

    return (
      <View style={[styles.cartItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.itemImg, { backgroundColor: colors.cardAlt }]}
          onPress={() => navigation.navigate('ProductDetail', { productId: item.productId })}
          activeOpacity={0.8}
        >
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.img} resizeMode="contain" />
          ) : (
            <Ionicons name="cube-outline" size={32} color={colors.textMuted} />
          )}
        </TouchableOpacity>

        <View style={styles.itemInfo}>
          <View style={styles.itemNameRow}>
            <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={2}>
              {product?.name || t('productWord')}
            </Text>
            <TouchableOpacity
              onPress={() => handleRemove(item)}
              style={[styles.deleteBtn, { backgroundColor: colors.error + '18' }]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="trash-outline" size={16} color={colors.error} />
            </TouchableOpacity>
          </View>
          {(item.selected_color || item.selected_size) && (
            <Text style={[styles.itemColor, { color: colors.textMuted }]}>
              {[
                item.selected_color ? `${t('colorLabel')}: ${item.selected_color}` : null,
                item.selected_size ? `${t('sizeLabel')}: ${item.selected_size}` : null,
              ].filter(Boolean).join(' · ')}
            </Text>
          )}

          <View style={styles.itemBottom}>
            <View style={[styles.qtyControl, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <TouchableOpacity
                onPress={() => handleQuantityChange(item, -1)}
                style={styles.qtyBtn}
                disabled={updatingId === item.id}
              >
                <Ionicons name="remove" size={16} color={item.quantity <= 1 ? colors.error : colors.text} />
              </TouchableOpacity>
              {updatingId === item.id ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ width: 32 }} />
              ) : (
                <TextInput
                  style={[styles.qtyInput, { color: colors.text }]}
                  value={qtyDisplay}
                  onChangeText={(txt) => handleQtyInputChange(item, txt)}
                  onBlur={() => handleQtyInputBlur(item)}
                  keyboardType="number-pad"
                  selectTextOnFocus
                />
              )}
              <TouchableOpacity
                onPress={() => handleQuantityChange(item, 1)}
                style={styles.qtyBtn}
                disabled={updatingId === item.id}
              >
                <Ionicons name="add" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.itemTotal, { color: colors.text }]}>{formatPrice(itemTotal)}</Text>
          </View>
        </View>
      </View>
    );
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('cartTitle')}</Text>
        {items.length > 0 && (
          <TouchableOpacity
            onPress={handleClearCart}
            style={[styles.trashHeader, { backgroundColor: colors.error + '15' }]}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={18} color={colors.error} />
          </TouchableOpacity>
        )}
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconBg, { backgroundColor: colors.primary + '15' }]}>
            <Ionicons name="cart-outline" size={64} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('emptyCart')}</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('emptyCartHint')}</Text>
          <TouchableOpacity
            style={[styles.shopBtn, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('Main', { screen: 'Home' })}
            activeOpacity={0.85}
          >
            <Ionicons name="storefront-outline" size={18} color="#FFF" />
            <Text style={styles.shopBtnText}>{t('goToHome')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={items}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            ListFooterComponent={<View style={{ height: 8 }} />}
          />

          <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Stripe-style order review */}
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                {t('productsTitle')} · {count} {t('pcs')}
              </Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{formatPrice(total)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{t('deliveryWord')}</Text>
              <Text style={[styles.summaryValue, { color: colors.textMuted }]}>{t('atCheckout')}</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.totalRow}>
              <Text style={[styles.bottomTotalLabel, { color: colors.text }]}>{t('total')}</Text>
              <Text style={[styles.bottomTotal, { color: colors.text }]}>{formatPrice(total)}</Text>
            </View>
            <TouchableOpacity
              style={[styles.checkoutBtn, { backgroundColor: colors.primary }]}
              onPress={goCheckout}
              activeOpacity={0.85}
            >
              <Text style={styles.checkoutBtnText}>{t('checkout')}</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
        </>
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
  headerTitle: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  trashHeader: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  emptyIconBg: {
    width: 110,
    height: 110,
    borderRadius: Radius.sheet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyText: { textAlign: 'center', fontSize: 14, lineHeight: 21 },
  shopBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: Radius.button,
  },
  shopBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  list: { padding: 16, paddingBottom: 0 },
  cartItem: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    padding: 12,
    gap: 12,
    alignItems: 'flex-start',
  },
  itemImg: {
    width: 80,
    height: 80,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  img: { width: '100%', height: '100%', borderRadius: 12 },
  itemInfo: { flex: 1 },
  itemNameRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  itemName: { flex: 1, fontSize: 14, fontWeight: '500', lineHeight: 19 },
  itemColor: { fontSize: 12, marginBottom: 8 },
  deleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  qtyBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  qtyInput: {
    width: 36,
    height: 32,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 0,
  },
  itemTotal: { fontSize: 16, fontWeight: '700' },
  bottomBar: {
    padding: 16,
    borderTopWidth: 1,
    paddingBottom: 28,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14, fontWeight: '600' },
  summaryDivider: { height: 1, marginVertical: 6 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  bottomTotalLabel: { fontSize: 16, fontWeight: '600' },
  bottomTotal: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  checkoutBtn: {
    height: 54,
    borderRadius: Radius.button,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
