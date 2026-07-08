import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const { width } = Dimensions.get('window');
const CARD_W = (width - 16 * 2 - 12) / 2;

// 💀 Скелетон главной: мягкое «дыхание» серых блоков вместо крутящегося
// колеса — ощущение скорости, как у Uzum/Ozon. Работает и в приложении, и
// на сайте (Expo Web).
function Block({ style }) {
  const { colors, isDark } = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={[{ backgroundColor: isDark ? colors.cardAlt : '#E9EAEE', opacity, borderRadius: 12 }, style]}
    />
  );
}

export default function HomeSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      {/* Поиск */}
      <Block style={{ height: 44, borderRadius: 14, marginBottom: 16 }} />
      {/* Категории */}
      <View style={styles.row}>
        {[...Array(5)].map((_, i) => (
          <Block key={i} style={{ width: 74, height: 36, borderRadius: 18 }} />
        ))}
      </View>
      {/* Баннер */}
      <Block style={{ height: 150, borderRadius: 16, marginBottom: 20 }} />
      {/* Заголовок секции */}
      <Block style={{ width: 180, height: 20, marginBottom: 14 }} />
      {/* Сетка карточек */}
      <View style={styles.grid}>
        {[...Array(6)].map((_, i) => (
          <View key={i} style={{ width: CARD_W, marginBottom: 16 }}>
            <Block style={{ width: '100%', height: CARD_W * 1.25, borderRadius: 16, marginBottom: 8 }} />
            <Block style={{ width: '80%', height: 12, marginBottom: 6 }} />
            <Block style={{ width: '50%', height: 14 }} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 16, paddingTop: 56 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
});
