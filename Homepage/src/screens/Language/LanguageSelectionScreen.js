import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

export default function LanguageSelectionScreen() {
  const { colors, isDark } = useTheme();
  const { setLanguage, markLanguageChosen } = useLanguage();
  const [selected, setSelected] = useState('uz');

  const handleContinue = async () => {
    await setLanguage(selected);
    await markLanguageChosen();
  };

  const langs = [
    { code: 'uz', label: "O'zbek tili", native: "O'zbek", flag: '🇺🇿' },
    { code: 'ru', label: 'Русский язык', native: 'Русский', flag: '🇷🇺' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.content}>
        <View style={styles.logoArea}>
          <View style={[styles.logoBox, { backgroundColor: colors.primary }]}>
            <Ionicons name="globe-outline" size={40} color="#fff" />
          </View>
          <Text style={[styles.appName, { color: colors.text }]}>Axentis Market</Text>
        </View>

        <Text style={[styles.title, { color: colors.text }]}>Tilni tanlang</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Выберите язык / Tilni tanlang
        </Text>

        <View style={styles.langList}>
          {langs.map((lang) => {
            const isActive = selected === lang.code;
            return (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.langCard,
                  {
                    backgroundColor: isActive ? colors.primary : colors.surface,
                    borderColor: isActive ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setSelected(lang.code)}
                activeOpacity={0.8}
              >
                <Text style={styles.flag}>{lang.flag}</Text>
                <View style={styles.langInfo}>
                  <Text style={[styles.langNative, { color: isActive ? '#fff' : colors.text }]}>
                    {lang.native}
                  </Text>
                  <Text style={[styles.langLabel, { color: isActive ? 'rgba(255,255,255,0.75)' : colors.textSecondary }]}>
                    {lang.label}
                  </Text>
                </View>
                {isActive && (
                  <Ionicons name="checkmark-circle" size={24} color="#fff" />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.continueBtn, { backgroundColor: colors.primary }]}
          onPress={handleContinue}
          activeOpacity={0.85}
        >
          <Text style={styles.continueBtnText}>
            {selected === 'uz' ? 'Davom etish' : 'Продолжить'}
          </Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
    gap: 20,
  },
  logoArea: { alignItems: 'center', gap: 14, marginBottom: 8 },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: { fontSize: 24, fontWeight: '800' },
  title: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 15, textAlign: 'center', marginTop: -10 },
  langList: { gap: 12, marginTop: 8 },
  langCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 2,
    padding: 18,
    gap: 16,
  },
  flag: { fontSize: 36 },
  langInfo: { flex: 1 },
  langNative: { fontSize: 18, fontWeight: '700' },
  langLabel: { fontSize: 13, marginTop: 2 },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 8,
  },
  continueBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
