import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

export default function OrderConfirmedScreen() {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation();
  const route = useRoute();
  const { orderId, orderCode } = route.params;

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.content}>
        <Animated.View style={[styles.iconWrap, { transform: [{ scale: scaleAnim }] }]}>
          <LinearGradient colors={[colors.primary, colors.primaryDark || '#5B3DB8']} style={styles.iconCircle}>
            <Ionicons name="checkmark" size={56} color="#FFFFFF" />
          </LinearGradient>
        </Animated.View>

        <Animated.View style={[styles.textBlock, { opacity: fadeAnim }]}>
          <Text style={[styles.title, { color: colors.text }]}>{t('orderPlaced')}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('orderAcceptedThanks')}</Text>
          <Text style={[styles.orderCode, { color: colors.primary }]}>#{orderCode}</Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.buttons, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={[styles.ordersBtn, { backgroundColor: colors.surface, borderColor: colors.primary + '60' }]}
          onPress={() => navigation.navigate('AllOrders')}
          activeOpacity={0.8}
        >
          <Ionicons name="receipt-outline" size={18} color={colors.primary} />
          <Text style={[styles.ordersBtnText, { color: colors.primary }]}>{t('myOrders')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.homeBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Main' }] })}
          activeOpacity={0.8}
        >
          <Text style={[styles.homeBtnText, { color: colors.text }]}>{t('toHome')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between', padding: 24 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28 },
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7B5CF0',
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 12,
  },
  textBlock: { alignItems: 'center', gap: 8 },
  title: { fontSize: 26, fontWeight: '800' },
  subtitle: { fontSize: 15 },
  orderCode: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  buttons: { gap: 12, paddingBottom: 16 },
  ordersBtn: {
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
  },
  ordersBtnText: { fontSize: 16, fontWeight: '600' },
  homeBtn: {
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  homeBtnText: { fontSize: 16, fontWeight: '600' },
});
