import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  Alert, TextInput, Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { addUserAddress } from '../../api';
import { GOOGLE_MAPS_API_KEY } from '../../config';

// Ташкент по умолчанию
const DEFAULT_CENTER = { lat: 41.311081, lng: 69.240562 };

// HTML с интерактивной картой Leaflet, использующей тайлы Google Maps.
// Пользователь может двигать карту, тапать по карте или перетаскивать маркер —
// выбранная точка отправляется обратно в React Native через postMessage.
function buildMapHtml(center) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; }
    body { background: #e9eef2; }
    .leaflet-control-attribution { font-size: 9px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var startLat = ${center.lat};
    var startLng = ${center.lng};

    function send(lat, lng) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'move', lat: lat, lng: lng }));
      }
    }

    var map = L.map('map', { zoomControl: true, attributionControl: true }).setView([startLat, startLng], 16);

    // Тайлы Google Maps (дорожная схема, на русском). Ключ для тайлов не требуется.
    L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&hl=ru&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['0', '1', '2', '3'],
      attribution: '© Google'
    }).addTo(map);

    var marker = L.marker([startLat, startLng], { draggable: true }).addTo(map);

    marker.on('dragend', function (e) {
      var p = e.target.getLatLng();
      send(p.lat, p.lng);
    });

    map.on('click', function (e) {
      marker.setLatLng(e.latlng);
      send(e.latlng.lat, e.latlng.lng);
    });

    // Сообщить стартовую точку
    send(startLat, startLng);

    // Команды из React Native (центрирование на geolocation / результат поиска)
    function handleMessage(raw) {
      try {
        var data = JSON.parse(raw);
        if (data.type === 'center' && data.lat && data.lng) {
          map.setView([data.lat, data.lng], data.zoom || 16);
          marker.setLatLng([data.lat, data.lng]);
          send(data.lat, data.lng);
        }
      } catch (err) {}
    }
    document.addEventListener('message', function (e) { handleMessage(e.data); });
    window.addEventListener('message', function (e) { handleMessage(e.data); });
  </script>
</body>
</html>`;
}

export default function MapLocationPickerScreen() {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  const { returnTo, initialCoords } = route.params ?? {};

  const startCenter = useMemo(() => {
    if (initialCoords?.lat && initialCoords?.lng) {
      return { lat: initialCoords.lat, lng: initialCoords.lng };
    }
    return DEFAULT_CENTER;
  }, [initialCoords]);

  const webRef = useRef(null);
  const [coords, setCoords] = useState(startCenter);
  const [locating, setLocating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);

  const mapHtml = useMemo(() => buildMapHtml(startCenter), [startCenter]);

  const onMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'move' && typeof data.lat === 'number') {
        setCoords({ lat: data.lat, lng: data.lng });
      }
    } catch {}
  }, []);

  const centerMapTo = (lat, lng, zoom = 16) => {
    webRef.current?.postMessage(JSON.stringify({ type: 'center', lat, lng, zoom }));
    setCoords({ lat, lng });
  };

  const handleUseMyLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('noAccessTitle'), t('allowGeo'));
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      centerMapTo(loc.coords.latitude, loc.coords.longitude, 17);
    } catch {
      Alert.alert(t('error'), t('geoFail'));
    } finally {
      setLocating(false);
    }
  };

  // Поиск адреса. При наличии ключа — через Google Geocoding (точнее),
  // иначе через OpenStreetMap/Nominatim с привязкой к Узбекистану.
  const searchViaGoogle = async (q) => {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}`
      + `&language=ru&region=uz&components=country:UZ&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.status === 'OK' && json.results?.length > 0) {
      const loc = json.results[0].geometry.location;
      return { lat: loc.lat, lng: loc.lng };
    }
    return null;
  };

  const searchViaNominatim = async (q) => {
    // viewbox + bounded + countrycodes=uz сильно повышают релевантность по Узбекистану
    const viewbox = '55.9,45.6,73.2,37.1'; // примерные границы Узбекистана (left,top,right,bottom)
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1`
      + `&countrycodes=uz&viewbox=${viewbox}&bounded=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'ru' } });
    const json = await res.json();
    if (Array.isArray(json) && json.length > 0) {
      return { lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon) };
    }
    return null;
  };

  const handleSearch = async () => {
    const q = search.trim();
    if (!q) return;
    setSearching(true);
    try {
      let found = null;
      if (GOOGLE_MAPS_API_KEY) {
        try { found = await searchViaGoogle(q); } catch { /* fallback ниже */ }
      }
      if (!found) found = await searchViaNominatim(q);
      if (found) {
        centerMapTo(found.lat, found.lng, 16);
      } else {
        Alert.alert(t('notFoundTitle'), t('nothingFoundQuery'));
      }
    } catch {
      Alert.alert(t('error'), t('searchFail'));
    } finally {
      setSearching(false);
    }
  };

  const reverseGeocode = async (lat, lng) => {
    let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    try {
      const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (geo.length > 0) {
        const g = geo[0];
        const parts = [g.street, g.streetNumber, g.district, g.subregion, g.city, g.region].filter(Boolean);
        if (parts.length > 0) address = parts.join(', ');
      }
    } catch {}
    return address;
  };

  const handleConfirm = async () => {
    if (!coords) return;
    setConfirming(true);
    try {
      const address = await reverseGeocode(coords.lat, coords.lng);

      if (returnTo === 'DeliveryAddresses') {
        if (user?.phone) {
          try {
            await addUserAddress(user.phone, {
              address,
              latitude: coords.lat,
              longitude: coords.lng,
              isDefault: false,
            });
          } catch {
            // silent — адрес всё равно может сохраниться
          }
        }
        navigation.navigate('DeliveryAddresses');
      } else {
        navigation.navigate('Checkout', {
          selectedCoords: { lat: coords.lat, lng: coords.lng },
          selectedAddress: address,
        });
      }
    } finally {
      setConfirming(false);
    }
  };

  const headerTitle = returnTo === 'DeliveryAddresses'
    ? t('newAddress')
    : t('selectDeliveryPlace');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Карта на весь экран */}
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html: mapHtml }}
        style={styles.web}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        renderLoading={() => (
          <View style={[styles.web, styles.loading, { backgroundColor: colors.background }]}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        )}
      />

      {/* Шапка + поиск */}
      <View style={styles.topOverlay} pointerEvents="box-none">
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.iconBtn, { backgroundColor: colors.surface }]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="search" size={18} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              value={search}
              onChangeText={setSearch}
              placeholder={t('searchAddressPh')}
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
            {searching
              ? <ActivityIndicator size="small" color={colors.primary} />
              : (search.length > 0 && (
                  <TouchableOpacity onPress={handleSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="arrow-forward-circle" size={22} color={colors.primary} />
                  </TouchableOpacity>
                ))}
          </View>
        </View>
        <Text style={[styles.headerTitle, { color: colors.text, backgroundColor: colors.surface + 'E6' }]}>
          {headerTitle}
        </Text>
      </View>

      {/* Кнопка "Моё местоположение" */}
      <TouchableOpacity
        style={[styles.myLocBtn, { backgroundColor: colors.surface }]}
        onPress={handleUseMyLocation}
        disabled={locating}
        activeOpacity={0.85}
      >
        {locating
          ? <ActivityIndicator size="small" color={colors.primary} />
          : <Ionicons name="locate" size={22} color={colors.primary} />}
      </TouchableOpacity>

      {/* Нижняя панель с координатами и подтверждением */}
      <View style={[styles.bottomCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.coordRow}>
          <Ionicons name="location" size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.coordTitle, { color: colors.text }]}>{t('selectedPoint')}</Text>
            <Text style={[styles.coordSub, { color: colors.textSecondary }]}>
              {coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : '—'}
            </Text>
          </View>
        </View>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {t('moveMapHint')}
        </Text>
        <TouchableOpacity
          style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
          onPress={handleConfirm}
          disabled={confirming || !coords}
          activeOpacity={0.85}
        >
          {confirming
            ? <ActivityIndicator color="#FFF" />
            : <Text style={styles.confirmText}>{t('selectThisPlace')}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  web: { ...StyleSheet.absoluteFillObject },
  loading: { alignItems: 'center', justifyContent: 'center' },
  topOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingTop: 50,
    paddingHorizontal: 12,
    gap: 8,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 4 },
    }),
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 4 },
    }),
  },
  searchInput: { flex: 1, fontSize: 15 },
  headerTitle: {
    alignSelf: 'flex-start',
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    overflow: 'hidden',
  },
  myLocBtn: {
    position: 'absolute',
    right: 16,
    bottom: 220,
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 5 },
    }),
  },
  bottomCard: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: 16,
    paddingBottom: 30,
    gap: 10,
  },
  coordRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  coordTitle: { fontSize: 15, fontWeight: '700' },
  coordSub: { fontSize: 13, marginTop: 2 },
  hint: { fontSize: 12, lineHeight: 16 },
  confirmBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  confirmText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
