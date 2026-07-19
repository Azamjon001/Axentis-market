import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from './theme';

// ─── Форматирование ──────────────────────────────────────────────────────────

/** 1234567 → «1 234 567» (без Intl — Hermes-совместимо) */
export function fmt(n: number | null | undefined): string {
  const v = Math.round(n || 0);
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
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
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.card,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.border,
          padding: 14,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ─── Кнопка ──────────────────────────────────────────────────────────────────

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  small,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'success' | 'danger' | 'ghost';
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
      : variant === 'danger'
      ? 'rgba(220,38,38,0.12)'
      : theme.primaryPale;
  const fg = variant === 'danger' ? theme.danger : variant === 'ghost' ? theme.primary : '#fff';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          opacity: disabled || loading ? 0.5 : pressed ? 0.85 : 1,
          borderRadius: 12,
          paddingVertical: small ? 8 : 13,
          paddingHorizontal: small ? 14 : 18,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
        },
        style,
      ]}
    >
      {loading && <ActivityIndicator size="small" color={fg} />}
      <Text style={{ color: fg, fontWeight: '600', fontSize: small ? 13 : 15 }}>{title}</Text>
    </Pressable>
  );
}

// ─── Поле ввода ──────────────────────────────────────────────────────────────

export function Input({
  label,
  style,
  ...props
}: TextInputProps & { label?: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: 12 }}>
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
            borderRadius: 12,
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

// ─── Бейдж статуса ───────────────────────────────────────────────────────────

export function Badge({ text, color }: { text: string; color: string }) {
  return (
    <View
      style={{
        backgroundColor: `${color}26`,
        borderRadius: 999,
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

// ─── Сегментированный переключатель (как «Склад ↔ Продажи» в вебе) ──────────

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: theme.card,
        borderRadius: 14,
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
            onPress={() => onChange(o.key)}
            style={{
              flex: 1,
              backgroundColor: on ? theme.primary : 'transparent',
              borderRadius: 10,
              paddingVertical: 8,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: on ? '#fff' : theme.text2,
                fontWeight: on ? '700' : '500',
                fontSize: 13.5,
              }}
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

export function SectionTitle({ text, accent }: { text: string; accent?: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10, marginTop: 4 }}>
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
  );
}

// ─── Карточка-метрика ────────────────────────────────────────────────────────

export function StatCard({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: string;
  hint?: string;
  color?: string;
}) {
  const { theme } = useTheme();
  return (
    <Card style={{ flex: 1, minWidth: '46%' }}>
      <Text style={{ color: theme.text2, fontSize: 12.5, marginBottom: 6 }}>{label}</Text>
      <Text style={{ color: color || theme.text, fontSize: 20, fontWeight: '700' }}>{value}</Text>
      {hint ? (
        <Text style={{ color: theme.text3, fontSize: 11.5, marginTop: 4 }}>{hint}</Text>
      ) : null}
    </Card>
  );
}

// ─── Пустое состояние / загрузка ─────────────────────────────────────────────

export function EmptyState({ text }: { text: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
      <Text style={{ color: theme.text3, fontSize: 14 }}>{text}</Text>
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
