import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCart, addToCart, setCartItem, removeCartItem, clearCart, getProductDetail } from '../api';
import { useAuth } from './AuthContext';

const CartContext = createContext({});

// 🛒 Ключ гостевой корзины в локальном хранилище (localStorage на вебе,
// AsyncStorage в приложении). Позволяет наполнять корзину без входа.
const GUEST_CART_KEY = 'guest_cart_v1';

async function loadGuestCart() {
  try {
    const raw = await AsyncStorage.getItem(GUEST_CART_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function saveGuestCart(items) {
  try {
    await AsyncStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
  } catch { /* ignore */ }
}

const sameVariant = (a, color, size) =>
  (a.selected_color || '') === (color || '') && (a.selected_size || '') === (size || '');

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const mergingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!user) {
      // Гость: корзина из локального хранилища
      setItems(await loadGuestCart());
      return;
    }
    setIsLoading(true);
    try {
      const data = await getCart(user.phone);
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // При входе переносим гостевую корзину на сервер, затем очищаем локальную.
  useEffect(() => {
    (async () => {
      if (user && !mergingRef.current) {
        const guest = await loadGuestCart();
        if (guest.length > 0) {
          mergingRef.current = true;
          for (const g of guest) {
            try {
              await addToCart({
                user_phone: user.phone,
                product_id: g.product_id ?? g.productId,
                quantity: g.quantity || 1,
                selected_color: g.selected_color || '',
                selected_size: g.selected_size || '',
              });
            } catch { /* товар мог закончиться — пропускаем */ }
          }
          await saveGuestCart([]);
          mergingRef.current = false;
        }
      }
      refresh();
    })();
  }, [refresh, user]);

  const addItem = async (productId, quantity = 1, color, size) => {
    if (!user) {
      // Гостевая корзина: складываем локально, подтягивая данные товара для показа
      const guest = await loadGuestCart();
      const existing = guest.find(g => (g.product_id ?? g.productId) === productId && sameVariant(g, color, size));
      if (existing) {
        existing.quantity = (existing.quantity || 1) + quantity;
      } else {
        let product = null;
        try { product = await getProductDetail(productId); } catch { /* offline */ }
        guest.push({
          id: `guest-${productId}-${color || ''}-${size || ''}`,
          product_id: productId,
          productId,
          quantity,
          selected_color: color || '',
          selected_size: size || '',
          product,
        });
      }
      await saveGuestCart(guest);
      setItems(guest);
      return;
    }
    await addToCart({
      user_phone: user.phone,
      product_id: productId,
      quantity,
      selected_color: color || '',
      selected_size: size || '',
    });
    await refresh();
  };

  const updateItem = async (productId, quantity, color, size) => {
    if (!user) {
      const guest = await loadGuestCart();
      const next = guest.map(g =>
        (g.product_id ?? g.productId) === productId && sameVariant(g, color, size)
          ? { ...g, quantity }
          : g,
      );
      await saveGuestCart(next);
      setItems(next);
      return;
    }
    setItems(prev => prev.map(item =>
      item.productId === productId &&
      (item.selected_color || '') === (color || '') &&
      (item.selected_size || '') === (size || '')
        ? { ...item, quantity }
        : item
    ));
    try {
      await setCartItem({
        user_phone: user.phone,
        product_id: productId,
        quantity,
        selected_color: color || '',
        selected_size: size || '',
      });
    } catch {
      await refresh();
    }
  };

  const removeItem = async (itemId) => {
    if (!user) {
      const guest = (await loadGuestCart()).filter(g => g.id !== itemId);
      await saveGuestCart(guest);
      setItems(guest);
      return;
    }
    setItems(prev => prev.filter(i => i.id !== itemId));
    try {
      await removeCartItem(itemId);
    } catch {
      await refresh();
    }
  };

  const clearAllItems = async () => {
    if (!user) {
      await saveGuestCart([]);
      setItems([]);
      return;
    }
    await clearCart(user.phone);
    setItems([]);
  };

  const count = items.length;
  const total = items.reduce((sum, item) => {
    // sellingPrice = цена продажи с наценкой; fallback на price (себестоимость)
    const price = item.product?.discountedPrice || item.product?.sellingPrice || item.product?.price || 0;
    return sum + price * item.quantity;
  }, 0);

  return (
    <CartContext.Provider value={{ items, count, total, isLoading, addItem, updateItem, removeItem, clearAllItems, refresh }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
