// ============================================================================
// UI KIT 2026 — единый визуальный язык (Luxury Dark Minimalism)
// Все компоненты используют токены из constants/theme и цвета из ThemeContext.
// ============================================================================
import React, { useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Animated,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { Radius, Spacing, Typography } from '../../constants/theme';
import CategoryIcon from '../common/CategoryIcon';

// ── Button ──────────────────────────────────────────────────────────────────
// variant: 'primary' | 'secondary' | 'ghost' | 'danger'
// size:    'lg' | 'md' | 'sm'
export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  iconRight,
  disabled,
  loading,
  fullWidth = true,
  style,
}) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const press = (to) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 50, bounciness: 0 }).start();

  const heights = { lg: 52, md: 44, sm: 36 };
  const fontSizes = { lg: 16, md: 15, sm: 13 };

  const palette = {
    primary: { bg: colors.primary, fg: '#FFFFFF', border: 'transparent' },
    secondary: { bg: colors.card, fg: colors.text, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.text, border: colors.border },
    danger: { bg: colors.error, fg: '#FFFFFF', border: 'transparent' },
  }[variant];

  return (
    <Animated.View style={[{ transform: [{ scale }] }, fullWidth && { alignSelf: 'stretch' }, style]}>
      <Pressable
        onPress={disabled || loading ? undefined : onPress}
        onPressIn={() => press(0.97)}
        onPressOut={() => press(1)}
        style={{
          height: heights[size],
          borderRadius: Radius.button,
          backgroundColor: palette.bg,
          borderWidth: variant === 'primary' || variant === 'danger' ? 0 : 1,
          borderColor: palette.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingHorizontal: Spacing.xl,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {loading ? (
          <ActivityIndicator color={palette.fg} />
        ) : (
          <>
            {icon ? <Ionicons name={icon} size={fontSizes[size] + 3} color={palette.fg} /> : null}
            <Text style={{ color: palette.fg, fontSize: fontSizes[size], fontWeight: '600', letterSpacing: -0.2 }}>
              {title}
            </Text>
            {iconRight ? <Ionicons name={iconRight} size={fontSizes[size] + 3} color={palette.fg} /> : null}
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ── Card ────────────────────────────────────────────────────────────────────
export function Card({ children, style, padded = true, onPress }) {
  const { colors } = useTheme();
  const Comp = onPress ? Pressable : View;
  return (
    <Comp
      onPress={onPress}
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: Radius.card,
          borderWidth: 1,
          borderColor: colors.border,
        },
        padded && { padding: Spacing.lg },
        style,
      ]}
    >
      {children}
    </Comp>
  );
}

// ── Badge ───────────────────────────────────────────────────────────────────
// tone: 'accent' | 'success' | 'warning' | 'danger' | 'neutral'
export function Badge({ label, tone = 'neutral', style }) {
  const { colors } = useTheme();
  const map = {
    accent: colors.primary,
    success: colors.success,
    warning: colors.warning,
    danger: colors.error,
    neutral: colors.textSecondary,
  };
  const c = map[tone];
  return (
    <View
      style={[
        {
          alignSelf: 'flex-start',
          backgroundColor: c + '1F',
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: Radius.button,
        },
        style,
      ]}
    >
      <Text style={{ color: c, fontSize: 11, fontWeight: '700', letterSpacing: 0.2 }}>{label}</Text>
    </View>
  );
}

// ── SectionHeader ─────────────────────────────────────────────────────────────
export function SectionHeader({ title, actionLabel, onAction, style }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
        style,
      ]}
    >
      <Text style={{ ...Typography.h3, color: colors.text }}>{title}</Text>
      {actionLabel ? (
        <Pressable onPress={onAction} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={15} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

// ── Chip (filter / category pill) ─────────────────────────────────────────────
// Фон по умолчанию полностью прозрачный. В выбранном состоянии — лёгкая заливка
// и белая рамка 2px (как просили в дизайне), без сплошного цветного блока.
export function Chip({ label, active, onPress, icon, category }) {
  const { colors, isDark } = useTheme();
  const activeBorder = isDark ? '#FFFFFF' : colors.primary;
  const contentColor = active ? colors.text : colors.textSecondary;
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        height: 38,
        borderRadius: Radius.pill,
        backgroundColor: active ? (isDark ? 'rgba(255,255,255,0.08)' : colors.primary + '14') : 'transparent',
        // Постоянная толщина рамки: активный/неактивный чип занимают одинаковый
        // размер, поэтому строка категорий не «прыгает» при переключении.
        borderWidth: 1.5,
        borderColor: active ? activeBorder : colors.border,
      }}
    >
      {category ? (
        <CategoryIcon category={category} size={17} color={contentColor} />
      ) : icon ? (
        <Ionicons name={icon} size={15} color={contentColor} />
      ) : null}
      <Text style={{ color: contentColor, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── Selector option (Apple-Store-style color/storage) ─────────────────────────
export function SelectOption({ label, sublabel, active, onPress, swatch }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        minWidth: 76,
        borderRadius: Radius.input,
        borderWidth: 1.5,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? colors.primary + '12' : colors.card,
      }}
    >
      {swatch ? (
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: swatch, borderWidth: 1, borderColor: colors.border }} />
      ) : null}
      <View>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{label}</Text>
        {sublabel ? <Text style={{ color: colors.textMuted, fontSize: 12 }}>{sublabel}</Text> : null}
      </View>
    </Pressable>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────
export function Divider({ style }) {
  const { colors } = useTheme();
  return <View style={[{ height: 1, backgroundColor: colors.divider }, style]} />;
}

// ── IconButton ────────────────────────────────────────────────────────────────
export function IconButton({ icon, onPress, size = 44, color, style }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          width: size,
          height: size,
          borderRadius: Radius.input,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={size * 0.46} color={color || colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({});
