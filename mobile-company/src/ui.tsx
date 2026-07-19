import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { R, SP, useTheme } from './theme';

// ─── Хаптика: лёгкий отклик на каждое значимое действие ─────────────────────

export const haptic = {
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
};

// ─── Форматирование ──────────────────────────────────────────────────────────

/** 1234567 → «1 234 567» (без Intl — Hermes-совместимо) */
export function fmt(n: number | null | undefined): string {
  const v = Math.round(n || 0);
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Короткий формат больших сумм: 1.2 млн / 350 тыс */
export function fmtShort(n: number, lang: 'ru' | 'uz'): string {
  const v = n || 0;
  if (Math.abs(v) >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)} ${lang === 'uz' ? 'mlrd' : 'млрд'}`;
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} ${lang === 'uz' ? 'mln' : 'млн'}`;
  if (Math.abs(v) >= 100_000) return `${(v / 1_000).toFixed(0)} ${lang === 'uz' ? 'ming' : 'тыс'}`;
  return fmt(v);
}

export function fmtDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ─── Карточка ────────────────────────────────────────────────────────────────

export function Card({
  children,
  style,
  onPress,
  onLongPress,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const { theme } = useTheme();
  const base: ViewStyle = {
    backgroundColor: theme.card,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: theme.border,
    padding: SP.lg - 2,
  };
  if (onPress || onLongPress) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        style={({ pressed }) => [base, { opacity: pressed ? 0.88 : 1 }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

// ─── Кнопка ──────────────────────────────────────────────────────────────────

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  small,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'success' | 'danger' | 'ghost' | 'warning';
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const bg =
    variant === 'primary'
      ? theme.primary
      : variant === 'success'
      ? theme.success
      : variant === 'warning'
      ? 'rgba(217,119,6,0.14)'
      : variant === 'danger'
      ? 'rgba(220,38,38,0.12)'
      : theme.primaryPale;
  const fg =
    variant === 'danger'
      ? theme.danger
      : variant === 'warning'
      ? theme.warning
      : variant === 'ghost'
      ? theme.primary
      : '#fff';

  return (
    <Pressable
      onPress={() => {
        haptic.light();
        onPress();
      }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          opacity: disabled || loading ? 0.5 : pressed ? 0.85 : 1,
          borderRadius: R.md,
          paddingVertical: small ? 9 : 13,
          paddingHorizontal: small ? 13 : 18,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 7,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : icon ? (
        <Ionicons name={icon} size={small ? 15 : 17} color={fg} />
      ) : null}
      <Text style={{ color: fg, fontWeight: '600', fontSize: small ? 13 : 15 }}>{title}</Text>
    </Pressable>
  );
}

// ─── Поле ввода ──────────────────────────────────────────────────────────────

export function Input({ label, style, ...props }: TextInputProps & { label?: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: SP.md }}>
      {label ? (
        <Text style={{ color: theme.text2, fontSize: 13, fontWeight: '500', marginBottom: 6 }}>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={theme.text3}
        {...props}
        style={[
          {
            backgroundColor: theme.input,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: R.md,
            paddingHorizontal: 14,
            paddingVertical: 11,
            color: theme.text,
            fontSize: 15,
          },
          style,
        ]}
      />
    </View>
  );
}

// ─── Поисковая строка ────────────────────────────────────────────────────────

export function SearchBar({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: theme.input,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: R.md,
        paddingHorizontal: 12,
      }}
    >
      <Ionicons name="search" size={17} color={theme.text3} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.text3}
        style={{ flex: 1, paddingVertical: 10, color: theme.text, fontSize: 14.5 }}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText('')} hitSlop={8}>
          <Ionicons name="close-circle" size={17} color={theme.text3} />
        </Pressable>
      )}
    </View>
  );
}

// ─── Бейдж статуса ───────────────────────────────────────────────────────────

export function Badge({ text, color }: { text: string; color: string }) {
  return (
    <View
      style={{
        backgroundColor: `${color}26`,
        borderRadius: R.full,
        paddingHorizontal: 10,
        paddingVertical: 3,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        alignSelf: 'flex-start',
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ color, fontSize: 12, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

// ─── Чип-фильтр ──────────────────────────────────────────────────────────────

export function Chip({
  label,
  active,
  onPress,
  color,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  color?: string;
}) {
  const { theme } = useTheme();
  const accent = color || theme.primary;
  return (
    <Pressable
      onPress={() => {
        haptic.light();
        onPress();
      }}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: R.full,
        backgroundColor: active ? accent : theme.card,
        borderWidth: 1,
        borderColor: active ? accent : theme.border,
      }}
    >
      <Text style={{ color: active ? '#fff' : theme.text2, fontSize: 13, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Сегментированный переключатель (как «Склад ↔ Продажи» в вебе) ──────────

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string; icon?: keyof typeof Ionicons.glyphMap }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: theme.card,
        borderRadius: R.md,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 4,
        gap: 4,
      }}
    >
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => {
              haptic.light();
              onChange(o.key);
            }}
            style={{
              flex: 1,
              backgroundColor: on ? theme.primary : 'transparent',
              borderRadius: R.sm,
              paddingVertical: 8,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            {o.icon && <Ionicons name={o.icon} size={14} color={on ? '#fff' : theme.text2} />}
            <Text
              style={{
                color: on ? '#fff' : theme.text2,
                fontWeight: on ? '700' : '500',
                fontSize: 13,
              }}
              numberOfLines={1}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Заголовок секции ────────────────────────────────────────────────────────

export function SectionTitle({
  text,
  hint,
  accent,
}: {
  text: string;
  hint?: string;
  accent?: string;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: 10, marginTop: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <View style={{ width: 6, height: 6, borderRadius: 2, backgroundColor: accent || theme.opsAccent }} />
        <Text
          style={{
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            color: theme.text3,
          }}
        >
          {text}
        </Text>
      </View>
      {hint ? (
        <Text style={{ color: theme.text3, fontSize: 12, marginTop: 3, marginLeft: 13 }}>{hint}</Text>
      ) : null}
    </View>
  );
}

// ─── Карточка-метрика ────────────────────────────────────────────────────────

export function StatCard({
  label,
  value,
  hint,
  color,
  icon,
  delta,
  style,
}: {
  label: string;
  value: string;
  hint?: string;
  color?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  delta?: number | null;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const deltaUp = (delta || 0) >= 0;
  return (
    <Card style={[{ flex: 1, minWidth: '46%' }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 7 }}>
        {icon && (
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 8,
              backgroundColor: `${color || theme.primary}22`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={icon} size={13} color={color || theme.primary} />
          </View>
        )}
        <Text style={{ color: theme.text2, fontSize: 12.5, flex: 1 }} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={{ color: color || theme.text, fontSize: 20, fontWeight: '700' }} numberOfLines={1}>
        {value}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
        {delta != null && isFinite(delta) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Ionicons
              name={deltaUp ? 'trending-up' : 'trending-down'}
              size={12}
              color={deltaUp ? theme.success : theme.danger}
            />
            <Text style={{ color: deltaUp ? theme.success : theme.danger, fontSize: 11.5, fontWeight: '700' }}>
              {deltaUp ? '+' : ''}
              {Math.round(delta)}%
            </Text>
          </View>
        )}
        {hint ? (
          <Text style={{ color: theme.text3, fontSize: 11.5, flex: 1 }} numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

// ─── Прогресс-бар ────────────────────────────────────────────────────────────

export function ProgressBar({ ratio, color }: { ratio: number; color: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.border, overflow: 'hidden' }}>
      <View
        style={{
          height: 6,
          borderRadius: 3,
          width: `${Math.max(2, Math.min(100, ratio * 100))}%`,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

// ─── Bottom Sheet (модалка снизу с «ручкой» — нативный мобильный паттерн) ────

export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            backgroundColor: theme.surface,
            borderTopLeftRadius: R.xl,
            borderTopRightRadius: R.xl,
            maxHeight: '90%',
          }}
        >
          {/* Ручка */}
          <View style={{ alignItems: 'center', paddingTop: 10 }}>
            <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: theme.text3, opacity: 0.4 }} />
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: SP.lg,
              paddingTop: SP.md,
              paddingBottom: 4,
            }}
          >
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', flex: 1 }} numberOfLines={1}>
              {title || ''}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={theme.text2} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: SP.lg, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Степпер количества (−/+) ────────────────────────────────────────────────

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 9999,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  const { theme } = useTheme();
  const btn = (label: '−' | '+', delta: number) => (
    <Pressable
      onPress={() => {
        haptic.light();
        onChange(Math.max(min, Math.min(max, value + delta)));
      }}
      style={({ pressed }) => ({
        width: 32,
        height: 32,
        borderRadius: R.sm,
        backgroundColor: pressed ? theme.primary : theme.primaryPale,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <Text style={{ color: theme.primary, fontSize: 18, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {btn('−', -1)}
      <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700', minWidth: 28, textAlign: 'center' }}>
        {value}
      </Text>
      {btn('+', +1)}
    </View>
  );
}

// ─── Пустое состояние / загрузка ─────────────────────────────────────────────

export function EmptyState({ text, icon }: { text: string; icon?: keyof typeof Ionicons.glyphMap }) {
  const { theme } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40, gap: 10 }}>
      <Ionicons name={icon || 'file-tray-outline'} size={36} color={theme.text3} />
      <Text style={{ color: theme.text3, fontSize: 14, textAlign: 'center' }}>{text}</Text>
    </View>
  );
}

export function Loading() {
  const { theme } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
      <ActivityIndicator size="large" color={theme.primary} />
    </View>
  );
}

// ─── Строка «ключ-значение» ──────────────────────────────────────────────────

export function KV({ k, v, vColor }: { k: string; v: string; vColor?: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
      <Text style={{ color: theme.text2, fontSize: 13.5, flex: 1, marginRight: 10 }}>{k}</Text>
      <Text style={{ color: vColor || theme.text, fontSize: 13.5, fontWeight: '600' }}>{v}</Text>
    </View>
  );
}
