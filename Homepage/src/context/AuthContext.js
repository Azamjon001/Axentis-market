import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginUser, registerUser, getUserProfile } from '../api';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    try {
      const savedUser = await AsyncStorage.getItem('currentUser');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);

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
          setUser(fresh);
          await AsyncStorage.setItem('currentUser', JSON.stringify(fresh));
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

  const login = async (phone, password) => {
    const result = await loginUser(phone, password);
    const userData = result.user || result;
    setUser(userData);
    await AsyncStorage.setItem('currentUser', JSON.stringify(userData));
    if (result.token) await AsyncStorage.setItem('userToken', result.token);
  };

  const register = async (phone, name, surname, password) => {
    const result = await registerUser(phone, name, surname, password);
    const userData = result.user || result;
    setUser(userData);
    await AsyncStorage.setItem('currentUser', JSON.stringify(userData));
    if (result.token) await AsyncStorage.setItem('userToken', result.token);
  };

  const logout = async () => {
    setUser(null);
    await AsyncStorage.multiRemove(['currentUser', 'userToken']);
  };

  const refreshUser = async () => {
    if (!user) return;
    try {
      const fresh = await getUserProfile(user.phone);
      setUser(fresh);
      await AsyncStorage.setItem('currentUser', JSON.stringify(fresh));
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
      logout,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
