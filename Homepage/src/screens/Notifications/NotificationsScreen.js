import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../../api';

const NOTIF_ICONS = {
  order: { icon: 'receipt-outline', color: '#7B5CF0' },
  delivery: { icon: 'bicycle-outline', color: '#2196F3' },
  promotion: { icon: 'pricetag-outline', color: '#FF9500' },
  system: { icon: 'information-circle-outline', color: '#4CAF50' },
  default: { icon: 'notifications-outline', color: '#7B5CF0' },
};

export default function NotificationsScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const navigation = useNavigation();
  const dateLocale = language === 'uz' ? 'uz-UZ' : 'ru-RU';
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await getNotifications(user.phone);
      setNotifications(data);
    } catch {
      setNotifications([]);
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

  const handleRead = async (notif) => {
    if (notif.isRead) return;
    try {
      await markNotificationRead(notif.id);
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
    } catch {}
  };

  const handleMarkAll = async () => {
    if (!user) return;
    try {
      await markAllNotificationsRead(user.phone);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch {}
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const renderItem = ({ item }) => {
    const iconCfg = NOTIF_ICONS[item.type] || NOTIF_ICONS.default;

    return (
      <TouchableOpacity
        style={[
          styles.notifCard,
          {
            backgroundColor: item.isRead ? colors.surface : colors.primary + '08',
            borderColor: item.isRead ? colors.border : colors.primary + '30',
          },
        ]}
        onPress={() => handleRead(item)}
        activeOpacity={0.8}
      >
        <View style={[styles.notifIconBg, { backgroundColor: iconCfg.color + '20' }]}>
          <Ionicons name={iconCfg.icon} size={22} color={iconCfg.color} />
        </View>
        <View style={styles.notifContent}>
          <View style={styles.notifTop}>
            <Text style={[styles.notifTitle, { color: colors.text }]} numberOfLines={1}>
              {item.title}
            </Text>
            {!item.isRead && (
              <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
            )}
          </View>
          <Text style={[styles.notifMessage, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.message}
          </Text>
          <Text style={[styles.notifDate, { color: colors.textMuted }]}>
            {new Date(item.createdAt).toLocaleDateString(dateLocale, {
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
            })}
          </Text>
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('notifications')}</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAll} activeOpacity={0.7}>
            <Text style={[styles.markAllText, { color: colors.primary }]}>{t('markAllRead')}</Text>
          </TouchableOpacity>
        )}
        {unreadCount === 0 && <View style={{ width: 80 }} />}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="notifications-off-outline" size={64} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('noNotifications')}</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {t('notificationsHint')}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700' },
  markAllText: { fontSize: 13, fontWeight: '500' },
  list: { padding: 16, gap: 10 },
  notifCard: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    alignItems: 'flex-start',
  },
  notifIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  notifContent: { flex: 1, gap: 4 },
  notifTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notifTitle: { flex: 1, fontSize: 14, fontWeight: '600' },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  notifMessage: { fontSize: 13, lineHeight: 18 },
  notifDate: { fontSize: 11, marginTop: 2 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
