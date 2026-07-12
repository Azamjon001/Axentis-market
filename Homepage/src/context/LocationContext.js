import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveRegion } from '../utils/region';
import { resolveDeliveryZones } from '../api';

// Контекст геолокации покупателя.
//
// При запуске приложения спрашиваем геолокацию и определяем регион покупателя
// ДВУМЯ способами одновременно:
//   1. coords → бэкенд сверяет точку с границами зон, нарисованными админом
//      (таблица regions) — это основной механизм фильтрации товаров;
//   2. reverse-геокодинг → название области (текстовый fallback для компаний,
//      которые указали только область, без нарисованной зоны).
// Если геолокация не сработала ИЛИ определила регион неверно — покупатель может
// выбрать регион вручную (manualRegion), и он имеет приоритет над GPS.

const MANUAL_KEY = 'manualRegion';

const LocationContext = createContext({
  region: null,          // текстовый регион для параметра ?region=
  displayRegion: null,   // что показывать пользователю (зона админа или область)
  detectedRegion: null,
  manualRegion: null,
  coords: null,          // { lat, lng } — передаётся в ?lat&lng
  detectedZones: [],     // зоны админа, внутри которых находится точка
  status: 'idle', // idle | requesting | granted | denied | unavailable
  requestLocation: async () => {},
  setManualRegion: async () => {},
});

export function LocationProvider({ children }) {
  const [detectedRegion, setDetectedRegion] = useState(null);
  const [manualRegion, setManualRegionState] = useState(null);
  const [coords, setCoords] = useState(null);
  const [detectedZones, setDetectedZones] = useState([]);
  const [status, setStatus] = useState('idle');
  const inFlight = useRef(false);

  // Ручной выбор региона имеет приоритет над GPS.
  const region = manualRegion || detectedRegion;
  // Пользователю показываем самое точное: ручной выбор → зона админа → область.
  const displayRegion = manualRegion || detectedZones[0]?.name || detectedRegion;

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
        setCoords(null);
        setDetectedZones([]);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setCoords(point);

      // 1️⃣ Зоны админа: точка внутри нарисованных границ (главный механизм).
      try {
        const zones = await resolveDeliveryZones(point.lat, point.lng);
        setDetectedZones(zones);
      } catch {
        setDetectedZones([]);
      }

      // 2️⃣ Текстовая область через reverse-геокодинг (fallback).
      let resolved = null;
      try {
        const places = await Location.reverseGeocodeAsync({
          latitude: point.lat,
          longitude: point.lng,
        });
        if (Array.isArray(places) && places.length > 0) {
          resolved = resolveRegion(places[0]);
        }
      } catch {
        // обратное геокодирование недоступно — остаются координаты и зоны
      }
      setDetectedRegion(resolved);
      setStatus('granted');
    } catch {
      setStatus('unavailable');
      setDetectedRegion(null);
      setCoords(null);
      setDetectedZones([]);
    } finally {
      inFlight.current = false;
    }
  }, []);

  // Запрашиваем геолокацию один раз при запуске приложения.
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  return (
    <LocationContext.Provider value={{ region, displayRegion, detectedRegion, manualRegion, coords, detectedZones, status, requestLocation, setManualRegion }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocationRegion() {
  return useContext(LocationContext);
}
