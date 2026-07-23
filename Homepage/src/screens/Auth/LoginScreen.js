import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Animated, Dimensions, Modal, Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { getPolicy, acceptPolicy } from '../../api';
// ВАЖНО: Alert берём из утиля, а НЕ из 'react-native' — на вебе (react-native-web)
// нативный Alert.alert молча ничего не делает, поэтому логин/регистрация «молчали».
import { Alert } from '../../utils/alert';

const { width } = Dimensions.get('window');

function formatUzPhone(val) {
  const digits = val.replace(/\D/g, '');
  const local = digits.startsWith('998') ? digits.slice(3) : digits;
  if (local.length === 0) return '';
  if (local.length <= 2) return `+998 ${local}`;
  if (local.length <= 5) return `+998 ${local.slice(0, 2)} ${local.slice(2)}`;
  if (local.length <= 7) return `+998 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`;
  if (local.length <= 9) return `+998 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7)}`;
  return `+998 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7, 9)}`;
}

function getCleanPhone(formatted) {
  const digits = formatted.replace(/\D/g, '');
  if (digits.startsWith('998')) return digits;
  return '998' + digits;
}

export default function LoginScreen() {
  const { colors, isDark } = useTheme();
  const { login, register, loginWithOtp, user } = useAuth();
  const { t } = useLanguage();
  const navigation = useNavigation();

  // После успешного входа/регистрации закрываем экран входа и возвращаемся
  // туда, откуда пришли (товар, корзина, профиль). Если возвращаться некуда —
  // на главную.
  useEffect(() => {
    if (user) {
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const [tab, setTab] = useState('login');
  const tabAnim = useRef(new Animated.Value(0)).current;
  const [tabBarWidth, setTabBarWidth] = useState(0);

  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginPassVisible, setLoginPassVisible] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // 🔒 Закрытая компания: вход/регистрация по уникальному ID компании.
  // В этом режиме пользователь видит ТОЛЬКО товары своей компании.
  // В сборке «Axentis Private» (APP_VARIANT=private) доступен только этот режим.
  const isPrivateApp = Constants.expoConfig?.extra?.appVariant === 'private';
  const [accessMode, setAccessMode] = useState(isPrivateApp ? 'private' : 'public'); // 'public' | 'private'
  const [privateCode, setPrivateCode] = useState('');
  const [privateCompany, setPrivateCompany] = useState(null); // { companyId, name }
  const [checkingCode, setCheckingCode] = useState(false);

  // 📲 Вход по SMS-коду (без пароля)
  const [loginMethod, setLoginMethod] = useState('password'); // 'password' | 'sms'
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  // Ссылка на Telegram-бота: покупатель делится контактом и получает код.
  const [otpTelegramUrl, setOtpTelegramUrl] = useState('');

  useEffect(() => {
    if (resendTimer <= 0) return undefined;
    const id = setInterval(() => setResendTimer(s => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [resendTimer]);

  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  // 📜 Политика конфиденциальности: согласие обязательно для регистрации
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [policyVisible, setPolicyVisible] = useState(false);
  const [policyText, setPolicyText] = useState('');
  const [policyLoading, setPolicyLoading] = useState(false);
  const { language } = useLanguage();

  const openPolicy = async () => {
    setPolicyVisible(true);
    if (policyText) return;
    setPolicyLoading(true);
    try {
      const p = await getPolicy('customer');
      const text = language === 'uz' && p?.contentUz ? p.contentUz : p?.contentRu;
      setPolicyText(text || '');
    } catch {
      setPolicyText(language === 'uz' ? 'Matnni yuklab boʻlmadi' : 'Не удалось загрузить текст');
    } finally {
      setPolicyLoading(false);
    }
  };

  const switchTab = (newTab) => {
    setTab(newTab);
    Animated.spring(tabAnim, {
      toValue: newTab === 'login' ? 0 : 1,
      useNativeDriver: false,
      tension: 60,
      friction: 10,
    }).start();
  };

  const handleLoginPhoneChange = (text) => {
    if (text === '' || text === '+') { setLoginPhone(''); return; }
    const digits = text.replace(/\D/g, '');
    setLoginPhone(formatUzPhone(digits));
  };

  const handleRegPhoneChange = (text) => {
    if (text === '' || text === '+') { setRegPhone(''); return; }
    const digits = text.replace(/\D/g, '');
    setRegPhone(formatUzPhone(digits));
  };

  const loginPhoneDigits = loginPhone.replace(/\D/g, '');
  const isLoginPhoneValid = loginPhoneDigits.length >= 9;
  const isLoginValid = isLoginPhoneValid && loginPassword.length >= 4;

  const regPhoneDigits = regPhone.replace(/\D/g, '');
  const isRegPhoneValid = regPhoneDigits.length >= 9;
  const isRegValid =
    regName.trim().length >= 2 &&
    isRegPhoneValid &&
    regPassword.length >= 6 &&
    policyAccepted; // 📜 без согласия с политикой регистрация недоступна

  // Доп. параметры входа/регистрации для закрытой компании.
  const authExtra = () =>
    accessMode === 'private' && privateCode.trim()
      ? { mode: 'private', privateCode: privateCode.trim() }
      : {};

  // Проверка ID закрытой компании (показывает название до входа).
  const handleCheckPrivateCode = async () => {
    if (!privateCode.trim()) return;
    setCheckingCode(true);
    try {
      const res = await verifyPrivateCode(privateCode.trim());
      setPrivateCompany({ companyId: res.companyId, name: res.name });
    } catch {
      setPrivateCompany(null);
      Alert.alert(t('error'), t('companyNotFound'));
    } finally {
      setCheckingCode(false);
    }
  };

  // 📲 Запросить SMS-код
  const handleRequestOtp = async () => {
    if (!isLoginPhoneValid) { Alert.alert(t('error'), t('enterValidPhone')); return; }
    setOtpLoading(true);
    try {
      const phone = getCleanPhone(loginPhone);
      const res = await requestOtp(phone);
      setOtpSent(true);
      setResendTimer(60);
      setOtpTelegramUrl(res?.telegramUrl || '');
      if (res?.devCode) {
        // Провайдер не настроен (dev): код приходит в ответе, подставляем сами.
        setOtpCode(String(res.devCode));
      } else if (res?.needsTelegram && res?.telegramUrl) {
        // Код не доставлен напрямую (нет SMS / номер не привязан): открываем
        // Telegram-бота — покупатель делится контактом и тут же получает код.
        Linking.openURL(res.telegramUrl).catch(() => {});
        Alert.alert(t('getCodeViaTelegramTitle'), t('getCodeViaTelegramMsg'));
      } else {
        Alert.alert(
          res?.channel === 'telegram' ? t('smsCodeSentTelegram') : t('smsCodeSent'),
          `+${phone}`,
        );
      }
    } catch (err) {
      const serverMsg = err?.response?.data?.error;
      Alert.alert(t('error'), serverMsg || err?.message || t('loginError'));
    } finally {
      setOtpLoading(false);
    }
  };

  // 📲 Подтвердить SMS-код → вход (аккаунт создаётся автоматически)
  const handleVerifyOtp = async () => {
    if (otpCode.trim().length !== 6) { Alert.alert(t('error'), t('enterCode6')); return; }
    setOtpLoading(true);
    try {
      const phone = getCleanPhone(loginPhone);
      await loginWithOtp(phone, otpCode.trim(), authExtra());
    } catch (err) {
      const serverMsg = err?.response?.data?.error;
      Alert.alert(t('invalidCode'), serverMsg || t('loginError'));
    } finally {
      setOtpLoading(false);
    }
  };

  const handleLogin = async () => {
    // Понятная причина вместо «молчания»: раньше кнопка была disabled и клик
    // не давал никакой реакции. Теперь всегда объясняем, чего не хватает.
    if (!isLoginPhoneValid) { Alert.alert(t('error'), t('enterValidPhone')); return; }
    if (!loginPassword) { Alert.alert(t('error'), t('invalidPhoneOrPass')); return; }
    setLoginLoading(true);
    try {
      const phone = getCleanPhone(loginPhone);
      await login(phone, loginPassword, authExtra());
    } catch (err) {
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.error;

      if (!err?.response) {
        // Нет ответа от сервера — проблема сети или сервер недоступен
        Alert.alert(
          t('noServerConnection'),
          `${t('connectFailMsg')}\n\n(${err?.message || 'Network Error'})`,
        );
      } else if (status === 404) {
        Alert.alert(t('userNotFound'), t('userNotRegistered'), [
          { text: t('register'), onPress: () => switchTab('register') },
          { text: 'OK', style: 'cancel' },
        ]);
      } else if (status === 401) {
        Alert.alert(t('invalidData'), serverMsg || t('invalidPhoneOrPass'));
      } else {
        Alert.alert(
          `${t('error')}${status ? ` ${status}` : ''}`,
          serverMsg || err?.message || t('loginError'),
        );
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async () => {
    // Понятная причина вместо «молчания»: показываем, какое поле не заполнено,
    // раньше кнопка была disabled и клик не давал никакой реакции.
    if (regName.trim().length < 2) { Alert.alert(t('error'), t('enterName')); return; }
    if (!isRegPhoneValid) { Alert.alert(t('error'), t('enterValidPhone')); return; }
    if (regPassword.length < 6) { Alert.alert(t('error'), t('passwordTooShort')); return; }
    if (!policyAccepted) { Alert.alert(t('error'), t('acceptPolicyFirst')); return; }
    setRegLoading(true);
    try {
      const phone = getCleanPhone(regPhone);
      await register(phone, regName.trim(), '', regPassword);
      // 📜 Фиксируем принятие политики (документальное подтверждение согласия)
      acceptPolicy('customer', phone).catch(() => { /* не критично */ });
    } catch (err) {
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.error;
      if (!err?.response) {
        Alert.alert(t('noServerConnection'), `${t('connectFailMsg')}\n\n(${err?.message || 'Network Error'})`);
      } else {
        Alert.alert(`${t('error')}${status ? ` ${status}` : ''}`, serverMsg || t('registerError'));
      }
    } finally {
      setRegLoading(false);
    }
  };

  // Индикатор вкладок считаем от РЕАЛЬНОЙ ширины таб-бара (измеряем onLayout),
  // а не от ширины экрана — иначе синий блок вылезал за рамку карточки.
  const tabSlot = tabBarWidth > 0 ? (tabBarWidth - 8) / 2 : 0; // 8 = padding 4×2
  const indicatorLeft = tabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [4, 4 + tabSlot],
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <LinearGradient
        colors={isDark ? ['#1A0A3E', '#0A0A1E'] : ['#EDE8FF', '#F5F3FF']}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoArea}>
            <View style={[styles.logoBox, { backgroundColor: colors.primary }]}>
              <Ionicons name="storefront" size={36} color="#fff" />
            </View>
            <Text style={[styles.appName, { color: colors.text }]}>Axentis Market</Text>
            <Text style={[styles.tagline, { color: colors.textSecondary }]}>{t('tagline')}</Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View
              style={[styles.tabBar, { backgroundColor: colors.inputBg }]}
              onLayout={(e) => setTabBarWidth(e.nativeEvent.layout.width)}
            >
              <Animated.View
                style={[styles.tabIndicator, { backgroundColor: colors.primary, left: indicatorLeft, width: tabSlot || '50%' }]}
              />
              <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('login')} activeOpacity={0.8}>
                <Text style={[styles.tabText, { color: tab === 'login' ? '#fff' : colors.textSecondary }]}>
                  {t('login')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('register')} activeOpacity={0.8}>
                <Text style={[styles.tabText, { color: tab === 'register' ? '#fff' : colors.textSecondary }]}>
                  {t('register')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 🔒 Режим доступа: общий маркет или закрытая компания по ID.
                В сборке «Axentis Private» переключатель скрыт — только закрытый режим. */}
            <View style={[styles.modeRow, isPrivateApp && { display: 'none' }]}>
              <TouchableOpacity
                style={[
                  styles.modeChip,
                  {
                    backgroundColor: accessMode === 'public' ? colors.primary + '22' : colors.inputBg,
                    borderColor: accessMode === 'public' ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => { setAccessMode('public'); setPrivateCompany(null); setPrivateCode(''); }}
                activeOpacity={0.8}
              >
                <Ionicons name="globe-outline" size={15} color={accessMode === 'public' ? colors.primary : colors.textMuted} />
                <Text style={[styles.modeChipText, { color: accessMode === 'public' ? colors.primary : colors.textSecondary }]}>
                  {t('publicMarketMode')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modeChip,
                  {
                    backgroundColor: accessMode === 'private' ? colors.primary + '22' : colors.inputBg,
                    borderColor: accessMode === 'private' ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setAccessMode('private')}
                activeOpacity={0.8}
              >
                <Ionicons name="lock-closed-outline" size={15} color={accessMode === 'private' ? colors.primary : colors.textMuted} />
                <Text style={[styles.modeChipText, { color: accessMode === 'private' ? colors.primary : colors.textSecondary }]}>
                  {t('privateCompanyMode')}
                </Text>
              </TouchableOpacity>
            </View>

            {accessMode === 'private' && (
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>{t('companyIdLabel')}</Text>
                <View style={[styles.inputRow, { backgroundColor: colors.inputBg, borderColor: privateCompany ? '#22C55E' : colors.border }]}>
                  <Ionicons name="key-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={privateCode}
                    onChangeText={(v) => { setPrivateCode(v); setPrivateCompany(null); }}
                    placeholder={t('companyIdPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={handleCheckPrivateCode} disabled={checkingCode || !privateCode.trim()}>
                    {checkingCode
                      ? <ActivityIndicator size="small" color={colors.primary} />
                      : <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}>{t('checkCompanyId')}</Text>
                    }
                  </TouchableOpacity>
                </View>
                {privateCompany ? (
                  <View style={styles.companyFoundRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                    <Text style={{ color: '#22C55E', fontSize: 13, fontWeight: '600', marginLeft: 6 }}>
                      {t('companyFound')}: {privateCompany.name}
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.privateHint, { color: colors.textMuted }]}>{t('privateModeHint')}</Text>
                )}
              </View>
            )}

            {tab === 'login' ? (
              <View style={{ marginTop: 24 }}>
                <Text style={[styles.formTitle, { color: colors.text }]}>{t('loginTitle')}</Text>

                <Text style={[styles.label, { color: colors.textSecondary }]}>{t('phoneNumber')}</Text>
                <View style={[styles.inputRow, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <Ionicons name="call-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={loginPhone}
                    onChangeText={handleLoginPhoneChange}
                    placeholder="+998 XX XXX XX XX"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    maxLength={17}
                  />
                  {loginPhone.length > 0 && (
                    <TouchableOpacity onPress={() => setLoginPhone('')}>
                      <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>

                {loginMethod === 'password' ? (
                  <>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>{t('password')}</Text>
                    <View style={[styles.inputRow, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                      <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                      <TextInput
                        style={[styles.input, { color: colors.text }]}
                        value={loginPassword}
                        onChangeText={setLoginPassword}
                        placeholder={t('enterPassword')}
                        placeholderTextColor={colors.textMuted}
                        secureTextEntry={!loginPassVisible}
                        autoCapitalize="none"
                      />
                      <TouchableOpacity onPress={() => setLoginPassVisible(v => !v)}>
                        <Ionicons
                          name={loginPassVisible ? 'eye-off-outline' : 'eye-outline'}
                          size={18}
                          color={colors.textMuted}
                        />
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={[styles.btn, { backgroundColor: colors.primary }]}
                      onPress={handleLogin}
                      disabled={loginLoading}
                      activeOpacity={0.85}
                    >
                      {loginLoading
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.btnText}>{t('login')}</Text>
                      }
                    </TouchableOpacity>

                    {/* 📲 Переключение на вход по SMS-коду */}
                    <TouchableOpacity
                      onPress={() => { setLoginMethod('sms'); setOtpSent(false); setOtpCode(''); }}
                      style={styles.switchHint}
                    >
                      <Text style={[styles.switchText, { color: colors.primary, fontWeight: '600' }]}>
                        {t('smsLogin')}
                      </Text>
                      <Text style={[styles.switchText, { color: colors.textMuted, marginTop: 2 }]}>
                        {t('smsLoginHint')}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    {otpSent && (
                      <>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('smsCodeLabel')}</Text>
                        <View style={[styles.inputRow, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                          <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                          <TextInput
                            style={[styles.input, { color: colors.text, letterSpacing: 6, fontWeight: '700' }]}
                            value={otpCode}
                            onChangeText={(v) => setOtpCode(v.replace(/\D/g, '').slice(0, 6))}
                            placeholder="••••••"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="number-pad"
                            maxLength={6}
                          />
                        </View>
                      </>
                    )}

                    <TouchableOpacity
                      style={[styles.btn, { backgroundColor: colors.primary }]}
                      onPress={otpSent ? handleVerifyOtp : handleRequestOtp}
                      disabled={otpLoading}
                      activeOpacity={0.85}
                    >
                      {otpLoading
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.btnText}>{otpSent ? t('confirmCode') : t('sendCode')}</Text>
                      }
                    </TouchableOpacity>

                    {/* 📲 Открыть Telegram-бота: поделиться контактом и получить код */}
                    {otpSent && !!otpTelegramUrl && (
                      <TouchableOpacity
                        onPress={() => Linking.openURL(otpTelegramUrl).catch(() => {})}
                        style={[styles.btn, { backgroundColor: '#229ED9', marginTop: 8, flexDirection: 'row' }]}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="paper-plane" size={18} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.btnText}>{t('openTelegramBot')}</Text>
                      </TouchableOpacity>
                    )}

                    {otpSent && (
                      <TouchableOpacity
                        onPress={handleRequestOtp}
                        disabled={resendTimer > 0 || otpLoading}
                        style={styles.switchHint}
                      >
                        <Text style={[styles.switchText, { color: resendTimer > 0 ? colors.textMuted : colors.primary, fontWeight: '600' }]}>
                          {resendTimer > 0 ? `${t('resendIn')} ${resendTimer}s` : t('resendCode')}
                        </Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      onPress={() => { setLoginMethod('password'); setOtpSent(false); setOtpCode(''); }}
                      style={styles.switchHint}
                    >
                      <Text style={[styles.switchText, { color: colors.primary, fontWeight: '600' }]}>
                        {t('backToPassword')}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                <TouchableOpacity onPress={() => switchTab('register')} style={styles.switchHint}>
                  <Text style={[styles.switchText, { color: colors.textSecondary }]}>
                    {t('noAccount')}{' '}
                    <Text style={{ color: colors.primary, fontWeight: '600' }}>{t('createAccount')}</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ marginTop: 24 }}>
                <Text style={[styles.formTitle, { color: colors.text }]}>{t('registerTitle')}</Text>

                <Text style={[styles.label, { color: colors.textSecondary }]}>{t('firstName')}</Text>
                <View style={[styles.inputRow, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <Ionicons name="person-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={regName}
                    onChangeText={setRegName}
                    placeholder={t('yourFirstName')}
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="words"
                  />
                </View>

                <Text style={[styles.label, { color: colors.textSecondary }]}>{t('phoneNumber')}</Text>
                <View style={[styles.inputRow, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <Ionicons name="call-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={regPhone}
                    onChangeText={handleRegPhoneChange}
                    placeholder="+998 XX XXX XX XX"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    maxLength={17}
                  />
                  {regPhone.length > 0 && (
                    <TouchableOpacity onPress={() => setRegPhone('')}>
                      <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={[styles.label, { color: colors.textSecondary }]}>{t('password')}</Text>
                <View style={[styles.inputRow, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={regPassword}
                    onChangeText={setRegPassword}
                    placeholder={t('minChars')}
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                </View>

                {/* 📜 Согласие с политикой конфиденциальности */}
                <TouchableOpacity
                  style={styles.policyRow}
                  onPress={() => setPolicyAccepted(v => !v)}
                  activeOpacity={0.8}
                >
                  <View style={[
                    styles.policyCheckbox,
                    {
                      borderColor: policyAccepted ? colors.primary : colors.border,
                      backgroundColor: policyAccepted ? colors.primary : 'transparent',
                    },
                  ]}>
                    {policyAccepted && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <Text style={[styles.policyText, { color: colors.textSecondary }]}>
                    {language === 'uz' ? 'Men ' : 'Я принимаю '}
                    <Text
                      style={{ color: colors.primary, fontWeight: '600', textDecorationLine: 'underline' }}
                      onPress={openPolicy}
                    >
                      {language === 'uz' ? 'maxfiylik siyosati' : 'политику конфиденциальности'}
                    </Text>
                    {language === 'uz' ? 'ni qabul qilaman' : ''}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: colors.primary, marginTop: 8 }]}
                  onPress={handleRegister}
                  disabled={regLoading}
                  activeOpacity={0.85}
                >
                  {regLoading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.btnText}>{t('registerTitle')}</Text>
                  }
                </TouchableOpacity>

                <TouchableOpacity onPress={() => switchTab('login')} style={styles.switchHint}>
                  <Text style={[styles.switchText, { color: colors.textSecondary }]}>
                    {t('haveAccount')}{' '}
                    <Text style={{ color: colors.primary, fontWeight: '600' }}>{t('signIn')}</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
            {t('terms')}{' '}
            <Text style={{ color: colors.primary }} onPress={openPolicy}>{t('termsLink')}</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 📜 Модал с текстом политики конфиденциальности */}
      <Modal visible={policyVisible} animationType="slide" transparent onRequestClose={() => setPolicyVisible(false)}>
        <View style={styles.policyOverlay}>
          <View style={[styles.policySheet, { backgroundColor: colors.surface }]}>
            <View style={styles.policyHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
                <Text style={[styles.policyTitle, { color: colors.text }]}>
                  {language === 'uz' ? 'Maxfiylik siyosati' : 'Политика конфиденциальности'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setPolicyVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {policyLoading ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              // flex:1 в фиксированном по высоте sheet — иначе на вебе ScrollView
              // не получает ограничение высоты и текст «зависает» без прокрутки.
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator>
                <Text style={[styles.policyBody, { color: colors.text }]}>{policyText}</Text>
              </ScrollView>
            )}
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.primary, marginTop: 12 }]}
              onPress={() => { setPolicyAccepted(true); setPolicyVisible(false); }}
              activeOpacity={0.85}
            >
              <Text style={styles.btnText}>
                {language === 'uz' ? 'Qabul qilaman' : 'Принимаю'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 60 },
  logoArea: { alignItems: 'center', marginBottom: 32 },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#7B5CF0',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
  appName: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  tagline: { fontSize: 14, marginTop: 4 },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    position: 'relative',
    height: 46,
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    width: '50%',
    height: 38,
    borderRadius: 11,
  },
  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  tabText: { fontSize: 14, fontWeight: '600' },
  formTitle: { fontSize: 20, fontWeight: '700', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '500', marginBottom: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 50,
    marginBottom: 14,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, height: '100%', backgroundColor: 'transparent' },
  btn: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  switchHint: { alignItems: 'center', marginTop: 16 },
  switchText: { fontSize: 13 },
  // 🔒 Режим доступа (общий маркет / закрытая компания)
  modeRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  modeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
  },
  modeChipText: { fontSize: 13, fontWeight: '600' },
  companyFoundRow: { flexDirection: 'row', alignItems: 'center', marginTop: -6, marginBottom: 8 },
  privateHint: { fontSize: 12, marginTop: -6, marginBottom: 8 },
  errorHint: { fontSize: 12, marginTop: -10, marginBottom: 10 },
  disclaimer: { textAlign: 'center', fontSize: 12, marginTop: 24, lineHeight: 18 },
  // 📜 Политика конфиденциальности
  policyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 2, marginBottom: 4 },
  policyCheckbox: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  policyText: { flex: 1, fontSize: 13, lineHeight: 19 },
  policyOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  policySheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 28,
    // Фиксированная высота (не maxHeight): даёт ScrollView внутри реальную
    // границу — прокрутка текста работает и на native, и в веб-сборке.
    height: '85%',
  },
  policyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  policyTitle: { fontSize: 17, fontWeight: '700' },
  policyBody: { fontSize: 13.5, lineHeight: 21 },
});
