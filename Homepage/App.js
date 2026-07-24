import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { ThemeProvider } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { FavoritesProvider } from './src/context/FavoritesContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { LocationProvider } from './src/context/LocationContext';
import NotificationsManager from './src/context/NotificationsManager';
import Navigation from './src/navigation';

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function requestStartupPermissions() {
  await Notifications.requestPermissionsAsync();
  await Location.requestForegroundPermissionsAsync();
}

// 🌐 На вебе (axentis.uz / Telegram Mini App) браузерный WebView — особенно
// MIUI/Android — рисует оранжевую рамку фокуса и подсветку тапа на полях и
// кнопках. Глобально убираем их, чтобы «жёлтый прямоугольник» не выскакивал.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.setAttribute('data-axentis', 'focus-reset');
  style.innerHTML = `
    * { -webkit-tap-highlight-color: transparent; }
    input, textarea, select, button, a, [role="button"], [contenteditable="true"] {
      outline: none !important;
      -webkit-tap-highlight-color: transparent;
    }
    input:focus, input:focus-visible,
    textarea:focus, textarea:focus-visible,
    select:focus, select:focus-visible,
    button:focus, button:focus-visible,
    [tabindex]:focus, [tabindex]:focus-visible {
      outline: none !important;
      box-shadow: none;
    }
    input:-webkit-autofill,
    input:-webkit-autofill:hover,
    input:-webkit-autofill:focus {
      transition: background-color 9999s ease-in-out 0s !important;
    }
  `;
  document.head.appendChild(style);
}

export default function App() {
  useEffect(() => {
    requestStartupPermissions();
    const timer = setTimeout(() => {
      SplashScreen.hideAsync();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <CartProvider>
              <FavoritesProvider>
                <LocationProvider>
                  <NotificationsManager />
                  <Navigation />
                </LocationProvider>
              </FavoritesProvider>
            </CartProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
