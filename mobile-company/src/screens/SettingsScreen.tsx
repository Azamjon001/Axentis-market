import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import Constants from 'expo-constants';
import api, { CompanySession } from '../api';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';
import { Badge, Button, Card, SectionTitle, Segmented } from '../ui';

interface Props {
  company: CompanySession;
  onLogout: () => void;
}

// ⚙️ Настройки: профиль компании, язык, тема, выход — принципы нижней части
// сайдбара CompanyPanel.tsx (тема ☀️/🌙, язык uz/ru, logout).
export default function SettingsScreen({ company, onLogout }: Props) {
  const { theme, themeName, setThemeName } = useTheme();
  const { t, lang, setLang } = useI18n();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    api.companies
      .get(company.id)
      .then(setProfile)
      .catch(() => {});
  }, [company.id]);

  const confirmLogout = () => {
    Alert.alert(t.logout, t.logoutConfirm, [
      { text: t.cancel, style: 'cancel' },
      { text: t.logout, style: 'destructive', onPress: onLogout },
    ]);
  };

  const mode = profile?.mode ?? company.mode;
  const status = profile?.status ?? company.status;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 30 }}>
      {/* Профиль */}
      <SectionTitle text={t.companyProfile} />
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: theme.primaryPale,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 24 }}>🏢</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontSize: 17, fontWeight: '700' }} numberOfLines={1}>
              {profile?.name || company.name}
            </Text>
            <Text style={{ color: theme.text2, fontSize: 13.5, marginTop: 2 }}>
              +998 {company.phone}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {mode ? (
            <Badge
              text={`${t.mode}: ${mode === 'private' ? t.modePrivate : t.modePublic}`}
              color={mode === 'private' ? theme.mktAccent : theme.opsAccent}
            />
          ) : null}
          {status ? <Badge text={`${t.status}: ${status}`} color={theme.success} /> : null}
        </View>
      </Card>

      {/* Язык */}
      <View style={{ marginTop: 18 }}>
        <SectionTitle text={t.language} />
        <Segmented
          options={[
            { key: 'uz', label: "🇺🇿 O'zbekcha" },
            { key: 'ru', label: '🇷🇺 Русский' },
          ]}
          value={lang}
          onChange={setLang}
        />
      </View>

      {/* Тема */}
      <View style={{ marginTop: 18 }}>
        <SectionTitle text={t.theme} />
        <Segmented
          options={[
            { key: 'light', label: `☀️ ${t.themeLight}` },
            { key: 'dark', label: `🌙 ${t.themeDark}` },
          ]}
          value={themeName}
          onChange={setThemeName}
        />
      </View>

      {/* О приложении */}
      <View style={{ marginTop: 18 }}>
        <SectionTitle text={t.aboutApp} />
        <Card>
          <Text style={{ color: theme.text2, fontSize: 13.5, lineHeight: 19 }}>{t.aboutAppText}</Text>
          <Text style={{ color: theme.text3, fontSize: 12.5, marginTop: 8 }}>
            {t.version}: {Constants.expoConfig?.version || '1.0.0'}
          </Text>
        </Card>
      </View>

      <Button title={t.logout} onPress={confirmLogout} variant="danger" style={{ marginTop: 22 }} />
    </ScrollView>
  );
}
