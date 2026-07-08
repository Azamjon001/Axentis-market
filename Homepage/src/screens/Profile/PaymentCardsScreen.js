import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Alert, TextInput, Modal, ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { getPaymentCards, addPaymentCard, deletePaymentCard, setDefaultCard } from '../../api';

const CARD_TYPES = [
  { id: 'uzcard', label: 'UzCard', color: '#1BA874' },
  { id: 'humo', label: 'Humo', color: '#FF6B00' },
  { id: 'visa', label: 'Visa', color: '#1A1F71' },
  { id: 'mastercard', label: 'Mastercard', color: '#EB001B' },
];

export default function PaymentCardsScreen() {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigation = useNavigation();

  const [cards, setCards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [cardType, setCardType] = useState('uzcard');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [holderName, setHolderName] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getPaymentCards(user.phone);
      setCards(data);
    } catch {
      setCards([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setCardType('uzcard');
    setCardNumber('');
    setExpiry('');
    setHolderName('');
  };

  const handleSave = async () => {
    if (!user) return;
    const digits = cardNumber.replace(/\s/g, '');
    if (digits.length !== 16 || !/^\d{16}$/.test(digits)) {
      Alert.alert(t('error'), t('enterCardNumber16'));
      return;
    }
    if (!/^\d{2}\/\d{2}$/.test(expiry)) {
      Alert.alert(t('error'), t('enterExpiryMMYY'));
      return;
    }
    if (!holderName.trim()) {
      Alert.alert(t('error'), t('enterCardHolderName'));
      return;
    }
    const nameParts = holderName.trim().split(/\s+/);
    const first = nameParts[0];
    const last = nameParts.slice(1).join(' ') || ' ';
    setSaving(true);
    try {
      const card = await addPaymentCard({
        userPhone: user.phone,
        cardNumber: digits,
        cardExpiry: expiry,
        cardHolderFirstName: first,
        cardHolderLastName: last,
        cardType,
      });
      setCards(prev => [...prev, card]);
      setShowForm(false);
      resetForm();
    } catch {
      Alert.alert(t('error'), t('cardAddFail'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (card) => {
    Alert.alert(t('deleteCard'), `${t('deleteCardQ')} ${card.cardNumberLast4}?`, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('deleteWord'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePaymentCard(card.id);
            setCards(prev => prev.filter(c => c.id !== card.id));
          } catch {
            Alert.alert(t('error'), t('cardDeleteFail'));
          }
        },
      },
    ]);
  };

  const handleSetDefault = async (card) => {
    if (card.isDefault) return;
    try {
      await setDefaultCard(card.id);
      setCards(prev => prev.map(c => ({ ...c, isDefault: c.id === card.id })));
    } catch {
      Alert.alert(t('error'), t('setDefaultCardFail'));
    }
  };

  const handleCardNumberChange = (text) => {
    const digits = text.replace(/\D/g, '').slice(0, 16);
    const formatted = digits.replace(/(.{4})/g, '$1 ').trim();
    setCardNumber(formatted);
  };

  const handleExpiryChange = (text) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length <= 2) {
      setExpiry(cleaned);
    } else {
      setExpiry(`${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`);
    }
  };

  const getCardColor = (type) => CARD_TYPES.find(c => c.id === type)?.color || colors.primary;

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
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { backgroundColor: colors.surface }]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{t('paymentMethods')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={cards}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="card-outline" size={52} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('noCards')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.cardItem, { backgroundColor: getCardColor(item.cardType) }]}
            onPress={() => handleSetDefault(item)}
            activeOpacity={0.85}
          >
            <View style={styles.cardTop}>
              <Text style={styles.cardTypeLabel}>
                {CARD_TYPES.find(c => c.id === item.cardType)?.label || item.cardType}
              </Text>
              {item.isDefault && (
                <View style={styles.defaultBadge}>
                  <Text style={styles.defaultBadgeText}>{t('mainBadge')}</Text>
                </View>
              )}
            </View>
            <Text style={styles.cardNumber}>**** **** **** {item.cardNumberLast4}</Text>
            <View style={styles.cardBottom}>
              <View>
                <Text style={styles.cardLabel}>{t('cardHolder')}</Text>
                <Text style={styles.cardValue}>
                  {item.cardHolderFirstName} {item.cardHolderLastName}
                </Text>
              </View>
              <View>
                <Text style={styles.cardLabel}>{t('expiryShort')}</Text>
                <Text style={styles.cardValue}>{item.cardExpiry}</Text>
              </View>
              <TouchableOpacity
                onPress={() => handleDelete(item)}
                style={styles.deleteBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={18} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
        ListFooterComponent={
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={() => setShowForm(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={22} color="#FFF" />
            <Text style={styles.addBtnText}>{t('addCardBtn')}</Text>
          </TouchableOpacity>
        }
      />

      <Modal
        visible={showForm}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setShowForm(false); resetForm(); }}
      >
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('newCard')}</Text>
            <TouchableOpacity onPress={() => { setShowForm(false); resetForm(); }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('cardTypeLabel')}</Text>
            <View style={styles.typeRow}>
              {CARD_TYPES.map((ct) => (
                <TouchableOpacity
                  key={ct.id}
                  style={[
                    styles.typeBtn,
                    {
                      borderColor: cardType === ct.id ? ct.color : colors.border,
                      backgroundColor: cardType === ct.id ? ct.color + '20' : colors.surface,
                    },
                  ]}
                  onPress={() => setCardType(ct.id)}
                >
                  <Text style={[styles.typeBtnText, { color: cardType === ct.id ? ct.color : colors.textSecondary }]}>
                    {ct.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('cardNumberLabel')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border, letterSpacing: 2 }]}
              placeholder="1234 5678 9012 3456"
              placeholderTextColor={colors.textMuted}
              value={cardNumber}
              onChangeText={handleCardNumberChange}
              keyboardType="number-pad"
              maxLength={19}
            />

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('expiryDateLabel')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder={t('expiryPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={expiry}
              onChangeText={handleExpiryChange}
              keyboardType="number-pad"
              maxLength={5}
            />

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('holderNameLabel')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder={t('holderNamePlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={holderName}
              onChangeText={setHolderName}
              autoCapitalize="words"
            />

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.primary }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.saveBtnText}>{t('saveWord')}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
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
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '700' },
  list: { padding: 16, gap: 12 },
  emptyBox: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 15 },
  cardItem: {
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTypeLabel: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  defaultBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  defaultBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  cardNumber: { color: '#FFF', fontSize: 18, fontWeight: '600', letterSpacing: 2 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  cardLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginBottom: 2 },
  cardValue: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  deleteBtn: { padding: 4 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 4,
  },
  addBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 24,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  form: { padding: 20, gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '500', marginBottom: 6, marginTop: 10 },
  typeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  typeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  typeBtnText: { fontSize: 13, fontWeight: '600' },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    fontSize: 15,
  },
  saveBtn: {
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
