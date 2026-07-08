import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';

// 📲 Глобальный ref навигации — по нему NotificationsManager открывает нужный
// экран при нажатии на push (например, заказ с картой курьера).
export const navigationRef = createNavigationContainerRef();

// 🔗 Глубокие ссылки и чистые URL сайта. Полная карта экранов, чтобы:
//   • в браузере адреса были красивыми (axentis.uz/product/123), а не
//     служебными (/Main/Home, /ProductDetail?productId=123);
//   • ссылка «Поделиться» и адрес в строке браузера совпадали;
//   • axentis://product/123 и https://axentis.uz/product/123 открывали товар.
const deepLinking = {
  prefixes: ['axentis://', 'https://axentis.uz', 'http://axentis.uz'],
  config: {
    // 🔑 Любая внешняя ссылка (напр. /product/123) открывается ПОВЕРХ главной:
    // React Navigation кладёт Main в низ стека, поэтому есть таб-бар и кнопка
    // «назад». Без этого товар по ссылке становился тупиком (одиночный экран).
    initialRouteName: 'Main',
    screens: {
      LanguageSelection: 'language',
      Login: 'login',
      Main: {
        path: '',
        screens: {
          Home: '',
          Cart: 'cart',
          Favorites: 'favorites',
          Profile: 'profile',
        },
      },
      ProductDetail: 'product/:productId',
      CompanyStore: 'company/:companyId',
      CategoryProducts: 'category/:categoryId',
      Checkout: 'checkout',
      OrderConfirmed: 'order-confirmed',
      AllOrders: 'orders',
      OrderDetail: 'order/:orderId',
      Notifications: 'notifications',
      Search: 'search',
      PaymentCards: 'payment-cards',
      MapLocationPicker: 'map',
      DeliveryAddresses: 'addresses',
    },
  },
};
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';
import { useLanguage } from '../context/LanguageContext';

import LoginScreen from '../screens/Auth/LoginScreen';
import HomeScreen from '../screens/Home/HomeScreen';
import CategoryProductsScreen from '../screens/Catalog/CategoryProductsScreen';
import CartScreen from '../screens/Cart/CartScreen';
import FavoritesScreen from '../screens/Favorites/FavoritesScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import ProductDetailScreen from '../screens/Product/ProductDetailScreen';
import CheckoutScreen from '../screens/Checkout/CheckoutScreen';
import OrderConfirmedScreen from '../screens/Checkout/OrderConfirmedScreen';
import OrdersScreen from '../screens/Orders/OrdersScreen';
import OrderDetailScreen from '../screens/Orders/OrderDetailScreen';
import NotificationsScreen from '../screens/Notifications/NotificationsScreen';
import SearchScreen from '../screens/Search/SearchScreen';
import CompanyStoreScreen from '../screens/Company/CompanyStoreScreen';
import PaymentCardsScreen from '../screens/Profile/PaymentCardsScreen';
import LanguageSelectionScreen from '../screens/Language/LanguageSelectionScreen';
import MapLocationPickerScreen from '../screens/Checkout/MapLocationPickerScreen';
import DeliveryAddressesScreen from '../screens/Profile/DeliveryAddressesScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function CartTabIcon({ color, focused }) {
  const { count } = useCart();
  return (
    <View>
      <Ionicons name={focused ? 'cart' : 'cart-outline'} size={24} color={color} />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </View>
  );
}

function FavoritesTabIcon({ color, focused }) {
  const { count } = useFavorites();
  return (
    <View>
      <Ionicons name={focused ? 'heart' : 'heart-outline'} size={24} color={color} />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </View>
  );
}

function MainTabs() {
  const { colors } = useTheme();
  const { t } = useLanguage();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 1,
          paddingBottom: 10,
          paddingTop: 10,
          height: 68,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.2,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: t('home'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{
          tabBarLabel: t('cart'),
          tabBarIcon: ({ color, focused }) => <CartTabIcon color={color} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={{
          tabBarLabel: t('favorites'),
          tabBarIcon: ({ color, focused }) => <FavoritesTabIcon color={color} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: t('profile'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function Navigation() {
  const { colors, isDark } = useTheme();
  const { isAuthenticated, isLoading } = useAuth();
  const { hasChosenLanguage, isLanguageLoading } = useLanguage();

  if (isLoading || isLanguageLoading) return null;

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={deepLinking}
      theme={{
        dark: isDark,
        colors: {
          primary: colors.primary,
          background: colors.background,
          card: colors.surface,
          text: colors.text,
          border: colors.border,
          notification: colors.badge,
        },
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!hasChosenLanguage ? (
          <Stack.Screen name="LanguageSelection" component={LanguageSelectionScreen} />
        ) : (
          // 🌐 Витрину можно смотреть без входа (как у Uzum/WB). Login —
          // обычный экран: на него ведут только действия покупателя
          // (корзина, оформление, профиль), а не просмотр товаров.
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
            <Stack.Screen name="CategoryProducts" component={CategoryProductsScreen} />
            <Stack.Screen name="Checkout" component={CheckoutScreen} />
            <Stack.Screen name="OrderConfirmed" component={OrderConfirmedScreen} />
            <Stack.Screen name="AllOrders" component={OrdersScreen} />
            <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="Search" component={SearchScreen} />
            <Stack.Screen name="CompanyStore" component={CompanyStoreScreen} />
            <Stack.Screen name="PaymentCards" component={PaymentCardsScreen} />
            <Stack.Screen name="MapLocationPicker" component={MapLocationPickerScreen} />
            <Stack.Screen name="DeliveryAddresses" component={DeliveryAddressesScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});
