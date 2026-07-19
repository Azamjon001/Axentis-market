import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 🎨 Дизайн-токены Axentis — 1:1 с веб-панелью (--ax-* переменные dark-theme.css).
// Не хардкодим цвета в экранах: всё берётся отсюда.
export type ThemeName = 'light' | 'dark';

export interface Theme {
  name: ThemeName;
  bg: string;
  surface: string;
  sidebar: string;
  card: string;
  input: string;
  border: string;
  text: string;
  text2: string;
  text3: string;
  primary: string;
  primaryPale: string;
  success: string;
  danger: string;
  warning: string;
  // Акценты групп разделов — как в CompanyPanel.tsx
  opsAccent: string;
  mktAccent: string;
}

export const themes: Record<ThemeName, Theme> = {
  light: {
    name: 'light',
    bg: '#E4E9EF',
    surface: '#F2F4F8',
    sidebar: '#D4DCE8',
    card: '#F2F4F8',
    input: '#EAEFF5',
    border: '#B8C5D4',
    text: '#0F172A',
    text2: '#475569',
    text3: '#94A3B8',
    primary: '#4F46E5',
    primaryPale: 'rgba(79, 70, 229, 0.12)',
    success: '#16A34A',
    danger: '#DC2626',
    warning: '#D97706',
    opsAccent: '#0EA5E9',
    mktAccent: '#8B5CF6',
  },
  dark: {
    name: 'dark',
    bg: '#0A0A18',
    surface: '#0E0E1C',
    sidebar: '#0C0C1A',
    card: '#13132A',
    input: '#1A1A35',
    border: 'rgba(255,255,255,0.07)',
    text: '#FFFFFF',
    text2: '#8B8BAA',
    text3: '#5A5A78',
    primary: '#7C5CF0',
    primaryPale: 'rgba(124, 92, 240, 0.15)',
    success: '#22C55E',
    danger: '#F87171',
    warning: '#FBBF24',
    opsAccent: '#38BDF8',
    mktAccent: '#A78BFA',
  },
};

// Цвета статусов заказов — те же, что в CompanyDashboardPanel STATUS_COLOR
export const STATUS_COLOR: Record<string, string> = {
  pending: '#FBBF24',
  confirmed: '#60A5FA',
  processing: '#A78BFA',
  shipped: '#38BDF8',
  delivered: '#4ADE80',
  completed: '#22C55E',
  cancelled: '#F87171',
};

interface ThemeCtx {
  theme: Theme;
  themeName: ThemeName;
  setThemeName: (n: ThemeName) => void;
}

const Ctx = createContext<ThemeCtx>({
  theme: themes.dark,
  themeName: 'dark',
  setThemeName: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeNameState] = useState<ThemeName>('dark');

  useEffect(() => {
    AsyncStorage.getItem('axentis_theme').then((v) => {
      if (v === 'light' || v === 'dark') setThemeNameState(v);
    });
  }, []);

  const setThemeName = (n: ThemeName) => {
    setThemeNameState(n);
    AsyncStorage.setItem('axentis_theme', n).catch(() => {});
  };

  return (
    <Ctx.Provider value={{ theme: themes[themeName], themeName, setThemeName }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);
