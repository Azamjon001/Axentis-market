import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, Switch, Image, ActivityIndicator, Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { getImageUrl } from '../../utils/imageUrl';
import { getLoyalty, buildImageFormData, postFormData } from '../../api';
import { Radius, Spacing } from '../../constants/theme';

export default function ProfileScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, logout, refreshUser } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const navigation = useNavigation();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);
  // ⭐ Баланс кэшбэк-баллов
  const [points, setPoints] = useState(0);
  useEffect(() => {
    if (!user?.phone) { setPoints(0); return; }
    getLoyalty(user.phone).then((a) => setPoints(a?.pointsBalance || 0)).catch(() => {});
  }, [user?.phone]);

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('noGalleryAccess'), t('allowGallery'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    setUploadingAvatar(true);
    try {
      // Кросс-платформенная форма + токен авторизации: маршрут аватара защищён
      // (RequireSelfPhone), без Bearer-токена сервер отвечает 401.
      const formData = await buildImageFormData('avatar', asset.uri, 'avatar.jpg');
      await postFormData(`/users/${encodeURIComponent(user?.phone || '')}/avatar`, formData);
      await refreshUser();
    } catch (err) {
      Alert.alert(t('uploadError'), err?.response?.data?.error || t('uploadFail'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(t('logoutConfirmTitle'), t('logoutConfirmMsg'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('logoutBtn'), style: 'destructive', onPress: logout },
    ]);
  };

  const handleSelectLanguage = async (lang) => {
    await setLanguage(lang);
    setShowLangModal(false);
  };

  const MENU_ITEMS = [
    {
      id: 'orders',
      icon: 'receipt-outline',
      label: t('myOrders'),
      onPress: () => navigation.navigate('AllOrders'),
    },
    {
      id: 'favorites',
      icon: 'heart-outline',
      label: t('favorites'),
      onPress: () => navigation.navigate('Main', { screen: 'Favorites' }),
    },
    {
      id: 'notifications',
      icon: 'notifications-outline',
      label: t('notifications'),
      onPress: () => navigation.navigate('Notifications'),
    },
    {
      id: 'address',
      icon: 'location-outline',
      label: t('deliveryAddresses'),
      onPress: () => navigation.navigate('DeliveryAddresses'),
    },
    {
      id: 'cards',
      icon: 'card-outline',
      label: t('paymentMethods'),
      onPress: () => navigation.navigate('PaymentCards'),
    },
    {
      id: 'language',
      icon: 'language-outline',
      label: t('language'),
      sublabel: language === 'ru' ? 'Русский' : "O'zbek",
      onPress: () => setShowLangModal(true),
    },
    {
      id: 'support',
      icon: 'headset-outline',
      label: t('support'),
      onPress: () => Alert.alert(t('support'), t('supportContact')),
    },
  ];

  const getInitials = (name) => {
    return name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  };

  const langOptions = [
    { code: 'uz', label: "O'zbek", flag: '🇺🇿' },
    { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('profileTitle')}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Гость: приглашение войти вместо карточки профиля */}
        {!user && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Login')}
            style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 14 }]}
          >
            <View style={[styles.avatarFallback, { backgroundColor: colors.primary }]}>
              <Ionicons name="person" size={26} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.userName, { color: colors.text }]}>
                {language === 'uz' ? 'Hisobga kiring' : 'Войдите в аккаунт'}
              </Text>
              <Text style={[styles.userPhone, { color: colors.textSecondary }]}>
                {language === 'uz' ? 'Buyurtma berish uchun' : 'Чтобы покупать и отслеживать заказы'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        )}

        {user && (
        <View style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.avatarRow}>
            <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.8} style={styles.avatarWrap}>
              {user?.avatarUrl ? (
                <Image source={{ uri: getImageUrl(user.avatarUrl) || user.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarFallback, { backgroundColor: colors.primary }]}>
                  <Text style={styles.avatarInitials}>{getInitials(user?.name || '')}</Text>
                </View>
              )}
              <View style={[styles.avatarEditBadge, { backgroundColor: colors.primary }]}>
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Ionicons name="camera" size={11} color="#FFF" />
                )}
              </View>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[styles.userName, { color: colors.text }]}>{user?.name || t('defaultUser')}</Text>
              <Text style={[styles.userPhone, { color: colors.textSecondary }]}>
                {user?.phone ? `+${user.phone}` : ''}
              </Text>
            </View>
          </View>
        </View>
        )}

        {/* ⭐ Кэшбэк-баллы */}
        {user && (
          <View style={styles.loyaltyCard}>
            <View style={styles.loyaltyIconWrap}>
              <Ionicons name="star" size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.loyaltyLabel}>{t('yourPoints') || 'Ваши баллы'}</Text>
              <Text style={styles.loyaltyHint}>{t('pointsHint') || '1 балл = 1 сум скидки'}</Text>
            </View>
            <View style={styles.loyaltyValuePill}>
              <Text style={styles.loyaltyValue}>{points.toLocaleString('ru-RU')}</Text>
            </View>
          </View>
        )}

        <View style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity style={styles.menuItem} onPress={toggleTheme} activeOpacity={0.7}>
            <View style={[styles.menuIconBg, { backgroundColor: (isDark ? '#FFD700' : colors.primary) + '20' }]}>
              <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={20} color={isDark ? '#FFD700' : colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuLabel, { color: colors.text }]}>
                {isDark ? t('darkTheme') : t('lightTheme')}
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </TouchableOpacity>
          <View style={[styles.separator, { backgroundColor: colors.divider }]} />

          {MENU_ITEMS.map((item, index) => (
            <React.Fragment key={item.id}>
              <TouchableOpacity style={styles.menuItem} onPress={item.onPress} activeOpacity={0.7}>
                <View style={[styles.menuIconBg, { backgroundColor: (item.color || colors.primary) + '15' }]}>
                  <Ionicons name={item.icon} size={20} color={item.color || colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuLabel, { color: colors.text }]}>{item.label}</Text>
                  {item.sublabel && (
                    <Text style={[styles.menuSublabel, { color: colors.textSecondary }]}>{item.sublabel}</Text>
                  )}
                </View>
                {item.badge && (
                  <View style={[styles.badge, { backgroundColor: colors.badge }]}>
                    <Text style={styles.badgeText}>{item.badge}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
              {index < MENU_ITEMS.length - 1 && (
                <View style={[styles.separator, { backgroundColor: colors.divider }]} />
              )}
            </React.Fragment>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.logoutBtn, { borderColor: colors.error + '40' }]}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={[styles.logoutText, { color: colors.error }]}>{t('logout')}</Text>
        </TouchableOpacity>

        <Text style={[styles.version, { color: colors.textMuted }]}>{t('version')} 1.0.0</Text>
        <View style={{ height: 30 }} />
      </ScrollView>

      <Modal
        visible={showLangModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLangModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLangModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('language')}</Text>
            {langOptions.map((opt) => {
              const isActive = language === opt.code;
              return (
                <TouchableOpacity
                  key={opt.code}
                  style={[
                    styles.langOption,
                    { borderColor: isActive ? colors.primary : colors.border },
                    isActive && { backgroundColor: colors.primary + '12' },
                  ]}
                  onPress={() => handleSelectLanguage(opt.code)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.langFlag}>{opt.flag}</Text>
                  <Text style={[styles.langOptionLabel, { color: colors.text }]}>{opt.label}</Text>
                  {isActive && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 20 }} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  scroll: { padding: 16, gap: 12 },
  userCard: { borderRadius: Radius.card, borderWidth: 1, padding: Spacing.lg, gap: 12 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarFallback: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: '#FFF', fontSize: 24, fontWeight: '800' },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  userName: { fontSize: 18, fontWeight: '700' },
  userPhone: { fontSize: 14, marginTop: 2 },
  loyaltyCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: Radius.card, backgroundColor: '#F59E0B' },
  loyaltyIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  loyaltyLabel: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  loyaltyHint: { fontSize: 12.5, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  loyaltyValuePill: { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8 },
  loyaltyValue: { fontSize: 22, fontWeight: '900', color: '#FFFFFF' },
  menuCard: { borderRadius: Radius.card, borderWidth: 1, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  menuIconBg: { width: 40, height: 40, borderRadius: Radius.button, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { fontSize: 15, fontWeight: '500' },
  menuSublabel: { fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  separator: { height: 1, marginLeft: 66 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: Radius.button,
    borderWidth: 1,
    padding: 15,
  },
  logoutText: { fontSize: 15, fontWeight: '600' },
  version: { textAlign: 'center', fontSize: 12, marginTop: 4 },
  // Прозрачный backdrop — не затемняем весь экран чёрным прямоугольником,
  // лист просто всплывает снизу до конца своего контента.
  modalOverlay: { flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: Radius.sheet, borderTopRightRadius: Radius.sheet,
    padding: 20, paddingTop: 12, gap: 10,
    borderWidth: 1, borderBottomWidth: 0,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: -6 }, elevation: 24,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
  },
  langFlag: { fontSize: 28 },
  langOptionLabel: { flex: 1, fontSize: 16, fontWeight: '600' },
});
