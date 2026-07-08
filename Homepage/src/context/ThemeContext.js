import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkColors, LightColors } from '../constants/Colors';

const ThemeContext = createContext({});

export const ThemeProvider = ({ children }) => {
  const systemScheme = useColorScheme();
  const [theme, setThemeState] = useState('dark');

  useEffect(() => {
    AsyncStorage.getItem('appTheme').then((saved) => {
      if (saved === 'dark' || saved === 'light' || saved === 'system') {
        setThemeState(saved);
      }
    });
  }, []);

  const setTheme = async (newTheme) => {
    setThemeState(newTheme);
    await AsyncStorage.setItem('appTheme', newTheme);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const isDark = theme === 'system' ? systemScheme === 'dark' : theme === 'dark';
  const colors = isDark ? DarkColors : LightColors;

  return (
    <ThemeContext.Provider value={{ theme, isDark, colors, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
