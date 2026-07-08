import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Alert, Animated, Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

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
  const { login, register, user } = useAuth();
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

  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginPassVisible, setLoginPassVisible] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  const [regName, setRegName] = useState('');
  const [regSurname, setRegSurname] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regPassVisible, setRegPassVisible] = useState(false);
  const [regConfirmVisible, setRegConfirmVisible] = useState(false);
  const [regLoading, setRegLoading] = useState(false);

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
    regSurname.trim().length >= 2 &&
    isRegPhoneValid &&
    regPassword.length >= 6 &&
    regPassword === regConfirm;

  const handleLogin = async () => {
    if (!isLoginValid) return;
    setLoginLoading(true);
    try {
      const phone = getCleanPhone(loginPhone);
      await login(phone, loginPassword);
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
    if (!isRegValid) {
      if (regPassword !== regConfirm) {
        Alert.alert(t('error'), t('passwordMismatch'));
        return;
      }
      if (regPassword.length < 6) {
        Alert.alert(t('error'), t('passwordTooShort'));
        return;
      }
      return;
    }
    setRegLoading(true);
    try {
      const phone = getCleanPhone(regPhone);
      await register(phone, regName.trim(), regSurname.trim(), regPassword);
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

  const indicatorLeft = tabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [4, (width - 48) / 2 + 4],
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
            <View style={[styles.tabBar, { backgroundColor: colors.inputBg }]}>
              <Animated.View
                style={[styles.tabIndicator, { backgroundColor: colors.primary, left: indicatorLeft }]}
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
                  style={[styles.btn, { backgroundColor: isLoginValid ? colors.primary : colors.border }]}
                  onPress={handleLogin}
                  disabled={!isLoginValid || loginLoading}
                  activeOpacity={0.85}
                >
                  {loginLoading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.btnText}>{t('login')}</Text>
                  }
                </TouchableOpacity>

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

                <Text style={[styles.label, { color: colors.textSecondary }]}>{t('lastName')}</Text>
                <View style={[styles.inputRow, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <Ionicons name="person-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={regSurname}
                    onChangeText={setRegSurname}
                    placeholder={t('yourLastName')}
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
                    secureTextEntry={!regPassVisible}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setRegPassVisible(v => !v)}>
                    <Ionicons
                      name={regPassVisible ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={colors.textMuted}
                    />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.label, { color: colors.textSecondary }]}>{t('confirmPassword')}</Text>
                <View style={[
                  styles.inputRow,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: regConfirm.length > 0 && regConfirm !== regPassword
                      ? colors.error
                      : colors.border,
                  },
                ]}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={regConfirm}
                    onChangeText={setRegConfirm}
                    placeholder={t('repeatPassword')}
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!regConfirmVisible}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setRegConfirmVisible(v => !v)}>
                    <Ionicons
                      name={regConfirmVisible ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={
                        regConfirm.length > 0 && regConfirm !== regPassword
                          ? colors.error
                          : colors.textMuted
                      }
                    />
                  </TouchableOpacity>
                </View>

                {regConfirm.length > 0 && regConfirm !== regPassword && (
                  <Text style={[styles.errorHint, { color: colors.error }]}>{t('passwordMismatch')}</Text>
                )}

                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: isRegValid ? colors.primary : colors.border, marginTop: 8 }]}
                  onPress={handleRegister}
                  disabled={!isRegValid || regLoading}
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
            <Text style={{ color: colors.primary }}>{t('termsLink')}</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
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
  errorHint: { fontSize: 12, marginTop: -10, marginBottom: 10 },
  disclaimer: { textAlign: 'center', fontSize: 12, marginTop: 24, lineHeight: 18 },
});
