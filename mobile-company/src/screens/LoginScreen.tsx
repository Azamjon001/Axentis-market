import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import api, { CompanySession, saveSession } from '../api';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';
import { Button, Card, Input } from '../ui';

interface Props {
  onLogin: (company: CompanySession) => void;
}

// 🔐 Вход ТОЛЬКО для компаний — тот же принцип, что CompanyLogin.tsx в вебе,
// но без каскада «админ → компания → агент»: приложение вызывает
// исключительно /auth/login/company. Учётные данные администратора этим
// endpoint'ом не принимаются, поэтому попасть в приложение админом нельзя.
export default function LoginScreen({ onLogin }: Props) {
  const { theme } = useTheme();
  const { t, lang, setLang } = useI18n();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    if (!phone.trim() || !password.trim()) {
      setError(t.fillAllFields);
      return;
    }
    if (!policyAccepted) {
      setError(t.policyRequired);
      return;
    }
    setLoading(true);
    try {
      const response = await api.auth.loginCompany(phone, password, referralCode || undefined);
      const company = response.company;
      // 🛡️ Страховка: пропускаем в панель только валидный аккаунт компании.
      if (!company || !company.id || company.id <= 0) {
        throw new Error(t.invalidCredentials);
      }
      // 📜 Фиксируем принятие политики (как в вебе — не критично при ошибке)
      api.policies.accept('company', String(company.id)).catch(() => {});
      await saveSession(company);
      onLogin(company);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setError(/401|credentials|Invalid/i.test(msg) ? t.invalidCredentials : msg || t.invalidCredentials);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Переключатель языка */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 18 }}>
          {(['uz', 'ru'] as const).map((l) => (
            <Pressable
              key={l}
              onPress={() => setLang(l)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: lang === l ? theme.primary : theme.card,
                borderWidth: 1,
                borderColor: lang === l ? theme.primary : theme.border,
              }}
            >
              <Text style={{ color: lang === l ? '#fff' : theme.text2, fontSize: 13, fontWeight: '600' }}>
                {l === 'uz' ? "🇺🇿 O'zbekcha" : '🇷🇺 Русский'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Card style={{ padding: 22 }}>
          {/* Логотип */}
          <View style={{ alignItems: 'center', marginBottom: 18 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: theme.primaryPale,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <Text style={{ fontSize: 30 }}>🏢</Text>
            </View>
            <Text style={{ color: theme.text, fontSize: 22, fontWeight: '700', textAlign: 'center' }}>
              {t.companyLoginTitle}
            </Text>
            <Text style={{ color: theme.text2, fontSize: 14, marginTop: 6, textAlign: 'center' }}>
              {t.enterCompanyData}
            </Text>
          </View>

          <Input
            label={t.phoneNumber}
            value={phone}
            onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 9))}
            placeholder="901234567"
            keyboardType="phone-pad"
            maxLength={9}
          />

          <Input
            label={t.password}
            value={password}
            onChangeText={setPassword}
            placeholder={t.enterPassword}
            secureTextEntry
          />

          <Input
            label={t.referralCodeOptional}
            value={referralCode}
            onChangeText={(v) => setReferralCode(v.replace(/\D/g, '').slice(0, 7))}
            placeholder="1234567"
            keyboardType="number-pad"
            maxLength={7}
          />
          <Text style={{ color: theme.text3, fontSize: 12, marginTop: -6, marginBottom: 12 }}>
            💡 {t.referralCodeHint} ({referralCode.length}/7)
          </Text>

          {/* Согласие с политикой */}
          <Pressable
            onPress={() => setPolicyAccepted((v) => !v)}
            style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 6,
                borderWidth: 2,
                borderColor: policyAccepted ? theme.primary : theme.text3,
                backgroundColor: policyAccepted ? theme.primary : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 1,
              }}
            >
              {policyAccepted && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>}
            </View>
            <Text style={{ color: theme.text2, fontSize: 13, flex: 1, lineHeight: 18 }}>
              {t.policyAcceptPrefix}
              <Text style={{ color: theme.primary, fontWeight: '600' }}>{t.policyLink}</Text>
              {t.policyAcceptSuffix}
            </Text>
          </Pressable>

          {error ? (
            <View
              style={{
                backgroundColor: 'rgba(220,38,38,0.10)',
                borderWidth: 1,
                borderColor: 'rgba(220,38,38,0.35)',
                borderRadius: 12,
                padding: 12,
                marginBottom: 14,
              }}
            >
              <Text style={{ color: theme.danger, fontSize: 13.5 }}>{error}</Text>
            </View>
          ) : null}

          <Button
            title={loading ? t.loading : t.loginButton}
            onPress={submit}
            loading={loading}
            disabled={!policyAccepted}
          />

          {/* Явное указание: админ-панели в приложении нет */}
          <Text style={{ color: theme.text3, fontSize: 12, textAlign: 'center', marginTop: 14, lineHeight: 17 }}>
            {t.adminNotAllowed}
          </Text>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
