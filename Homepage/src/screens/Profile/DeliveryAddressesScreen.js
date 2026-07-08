import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { getUserAddresses, deleteUserAddress, setDefaultAddress } from '../../api';

export default function DeliveryAddressesScreen() {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigation = useNavigation();

  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAddresses = useCallback(async () => {
    if (!user?.phone) return;
    try {
      const data = await getUserAddresses(user.phone);
      setAddresses(data);
    } catch {
      // silent — show empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.phone]);

  useFocusEffect(useCallback(() => {
    loadAddresses();
  }, [loadAddresses]));

  const handleDelete = (id) => {
    Alert.alert(t('deleteAddressQ'), t('irreversibleAction'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('deleteWord'),
        style: 'destructive',
        onPress: async () => {
          if (!user?.phone) return;
          try {
            await deleteUserAddress(user.phone, id);
            setAddresses(prev => prev.filter(a => a.id !== id));
          } catch {
            Alert.alert(t('error'), t('addressDeleteFail'));
          }
        },
      },
    ]);
  };

  const handleSetDefault = async (id) => {
    if (!user?.phone) return;
    try {
      const updated = await setDefaultAddress(user.phone, id);
      setAddresses(prev =>
        prev.map(a => ({ ...a, isDefault: a.id === updated.id })),
      );
    } catch {
      Alert.alert(t('error'), t('setDefaultAddrFail'));
    }
  };

  const handleAddNew = () => {
    navigation.navigate('MapLocationPicker', { returnTo: 'DeliveryAddresses' });
  };

  const renderItem = ({ item }) => (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: item.isDefault ? colors.primary : colors.border }]}>
      <View style={styles.cardTop}>
        <View style={styles.cardIcon}>
          <Ionicons name="location" size={20} color={item.isDefault ? colors.primary : colors.textSecondary} />
        </View>
        <View style={styles.cardText}>
          {item.title ? (
            <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
          ) : null}
          <Text style={[styles.cardAddress, { color: item.title ? colors.textSecondary : colors.text }]} numberOfLines={2}>
            {item.address}
          </Text>
          {item.isDefault && (
            <View style={[styles.defaultBadge, { backgroundColor: `${colors.primary}22` }]}>
              <Text style={[styles.defaultText, { color: colors.primary }]}>{t('byDefaultAddr')}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
        {!item.isDefault && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleSetDefault(item.id)}>
            <Ionicons name="checkmark-circle-outline" size={16} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>{t('byDefaultAddr')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item.id)}>
          <Ionicons name="trash-outline" size={16} color="#EF4444" />
          <Text style={[styles.actionText, { color: '#EF4444' }]}>{t('deleteWord')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: colors.surface }]}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('deliveryAddresses')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadAddresses(); }}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={[styles.list, addresses.length === 0 && styles.emptyList]}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="location-outline" size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('noSavedAddresses')}</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                {t('addAddressHint')}
              </Text>
            </View>
          }
        />
      )}

      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={handleAddNew}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={20} color="#FFF" />
          <Text style={styles.addBtnText}>{t('addAddressBtn')}</Text>
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
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, gap: 12 },
  emptyList: { flex: 1 },
  card: {
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  cardTop: { flexDirection: 'row', padding: 16, gap: 12 },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardAddress: { fontSize: 14, lineHeight: 20 },
  defaultBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
  },
  defaultText: { fontSize: 12, fontWeight: '600' },
  cardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 16,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontSize: 13, fontWeight: '600' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
  },
  addBtn: {
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
