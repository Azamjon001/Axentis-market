import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveRegion } from '../utils/region';

// Контекст геолокации покупателя.
//
// При запуске приложения спрашиваем геолокацию и определяем область покупателя,
// чтобы каталог показывал товары компаний, обслуживающих этот регион.
// Если геолокация не сработала ИЛИ определила регион неверно — покупатель может
// выбрать регион вручную (manualRegion), и он имеет приоритет над GPS.

const MANUAL_KEY = 'manualRegion';

const LocationContext = createContext({
  region: null,
  detectedRegion: null,
  manualRegion: null,
  status: 'idle', // idle | requesting | granted | denied | unavailable
  requestLocation: async () => {},
  setManualRegion: async () => {},
});

export function LocationProvider({ children }) {
  const [detectedRegion, setDetectedRegion] = useState(null);
  const [manualRegion, setManualRegionState] = useState(null);
  const [status, setStatus] = useState('idle');
  const inFlight = useRef(false);

  // Ручной выбор региона имеет приоритет над GPS.
  const region = manualRegion || detectedRegion;

  // Загружаем сохранённый ручной регион при старте.
  useEffect(() => {
    AsyncStorage.getItem(MANUAL_KEY).then((v) => { if (v) setManualRegionState(v); }).catch(() => {});
  }, []);

  const setManualRegion = useCallback(async (name) => {
    setManualRegionState(name || null);
    try {
      if (name) await AsyncStorage.setItem(MANUAL_KEY, name);
      else await AsyncStorage.removeItem(MANUAL_KEY);
    } catch { /* ignore */ }
  }, []);

  const requestLocation = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setStatus('requesting');
    try {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== 'granted') {
        setStatus('denied');
        setDetectedRegion(null);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      let resolved = null;
      try {
        const places = await Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        if (Array.isArray(places) && places.length > 0) {
          resolved = resolveRegion(places[0]);
        }
      } catch {
        // обратное геокодирование недоступно — оставляем регион пустым
      }
      setDetectedRegion(resolved);
      setStatus('granted');
    } catch {
      setStatus('unavailable');
      setDetectedRegion(null);
    } finally {
      inFlight.current = false;
    }
  }, []);

  // Запрашиваем геолокацию один раз при запуске приложения.
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  return (
    <LocationContext.Provider value={{ region, detectedRegion, manualRegion, status, requestLocation, setManualRegion }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocationRegion() {
  return useContext(LocationContext);
}
