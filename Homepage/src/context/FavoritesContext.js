import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getFavorites, toggleFavorite } from '../api';
import { useAuth } from './AuthContext';

const FavoritesContext = createContext({});

export const FavoritesProvider = ({ children }) => {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) { setProducts([]); return; }
    setIsLoading(true);
    try {
      const data = await getFavorites(user.phone);
      setProducts(Array.isArray(data) ? data : []);
    } catch {
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const isFavorite = (productId) => products.some(p => p.id === productId);

  const toggle = async (productId, product) => {
    if (!user) return;
    const wasFav = products.some(p => p.id === productId);
    setProducts(prev =>
      wasFav
        ? prev.filter(p => p.id !== productId)
        : product ? [...prev, product] : prev
    );
    try {
      await toggleFavorite(user.phone, productId);
      if (!wasFav && !product) {
        const data = await getFavorites(user.phone);
        setProducts(Array.isArray(data) ? data : []);
      }
    } catch {
      await refresh();
    }
  };

  return (
    <FavoritesContext.Provider value={{ products, count: products.length, isLoading, isFavorite, toggle, refresh }}>
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = () => useContext(FavoritesContext);
