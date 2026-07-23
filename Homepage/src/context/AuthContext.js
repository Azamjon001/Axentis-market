import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginUser, registerUser, getUserProfile, verifyOtp, setApiMarketplaceContext } from '../api';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    restoreSession();
  }, []);

  // 🔐 Держим контекст маркетплейса в API-слое в актуальном состоянии: при входе
  // в закрытую компанию все запросы автоматически изолируются на её товары, при
  // выходе — возвращаются в публичный режим.
  useEffect(() => {
    setApiMarketplaceContext(user);
  }, [user]);

  // Применяем пользователя: сохраняем в состоянии и в хранилище. Контекст
  // закрытой компании (mode/privateCompanyId) подхватывается автоматически —
  // за это отвечает useEffect выше, реагирующий на смену user.
  const applyUser = async (userData) => {
    if (!userData) return;
    setUser(userData);
    try {
      await AsyncStorage.setItem('currentUser', JSON.stringify(userData));
    } catch {
      // хранилище недоступно — сессия останется в памяти до перезагрузки
    }
  };

  const restoreSession = async () => {
    try {
      const savedUser = await AsyncStorage.getItem('currentUser');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        await applyUser(parsed);

        // Персональные эндпоинты требуют JWT. Старые установки могли сохранить
        // сессию без токена — тихо перелогиниваем (для аккаунтов без пароля).
        try {
          const token = await AsyncStorage.getItem('userToken');
          if (!token && parsed?.phone) {
            const result = await loginUser(parsed.phone);
            if (result?.token) await AsyncStorage.setItem('userToken', result.token);
          }
        } catch {
          // аккаунт с паролем — пользователь войдёт вручную
        }

        try {
          const fresh = await getUserProfile(parsed.phone);
          await applyUser(fresh);
        } catch {
          // use cached
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  // extra: { mode: 'private', privateCode } — вход в закрытую компанию.
  const login = async (phone, password, extra = {}) => {
    const result = await loginUser(phone, password, extra);
    const userData = result.user || result;
    await applyUser(userData);
    if (result.token) await AsyncStorage.setItem('userToken', result.token);
  };

  const register = async (phone, name, surname, password, extra = {}) => {
    const result = await registerUser(phone, name, surname, password, extra);
    const userData = result.user || result;
    await applyUser(userData);
    if (result.token) await AsyncStorage.setItem('userToken', result.token);
  };

  // 📲 Вход по SMS-коду: код уже запрошен через requestOtp, здесь проверяем.
  const loginWithOtp = async (phone, code, extra = {}) => {
    const result = await verifyOtp(phone, code, extra);
    const userData = result.user || result;
    await applyUser(userData);
    if (result.token) await AsyncStorage.setItem('userToken', result.token);
  };

  const logout = async () => {
    setUser(null); // useEffect по user сбросит контекст маркетплейса в API-слое
    await AsyncStorage.multiRemove(['currentUser', 'userToken']);
  };

  const refreshUser = async () => {
    if (!user) return;
    try {
      const fresh = await getUserProfile(user.phone);
      await applyUser(fresh);
    } catch {
      // ignore
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      register,
      loginWithOtp,
      logout,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
