import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  Alert, TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { addUserAddress } from '../../api';

// 🌐 Веб-версия выбора адреса: та же Leaflet-карта, но в <iframe> (WebView
// на вебе нет) и с браузерной геолокацией вместо expo-location.
const DEFAULT_CENTER = { lat: 41.311081, lng: 69.240562 };

function buildMapHtml(center) {
  return `<!DOCTYPE html><html><head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>html,body,#map{height:100%;width:100%;margin:0;padding:0;}body{background:#e9eef2;}.leaflet-control-attribution{font-size:9px;}</style>
  </head><body><div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var startLat = ${center.lat}, startLng = ${center.lng};
    function send(lat, lng){ parent.postMessage(JSON.stringify({type:'move',lat:lat,lng:lng}), '*'); }
    var map = L.map('map', { zoomControl: true }).setView([startLat, startLng], 16);
    L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&hl=ru&x={x}&y={y}&z={z}', { maxZoom: 20, subdomains: ['0','1','2','3'], attribution: '© Google' }).addTo(map);
    var marker = L.marker([startLat, startLng], { draggable: true }).addTo(map);
    marker.on('dragend', function(e){ var p = e.target.getLatLng(); send(p.lat, p.lng); });
    map.on('click', function(e){ marker.setLatLng(e.latlng); send(e.latlng.lat, e.latlng.lng); });
    send(startLat, startLng);
    window.addEventListener('message', function(e){ try { var d = JSON.parse(e.data); if (d.type==='center' && d.lat && d.lng){ map.setView([d.lat,d.lng], d.zoom||16); marker.setLatLng([d.lat,d.lng]); send(d.lat,d.lng);} } catch(err){} });
  </script></body></html>`;
}

export default function MapLocationPickerScreen() {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  const { returnTo, initialCoords } = route.params ?? {};

  const startCenter = useMemo(() => {
    if (initialCoords?.lat && initialCoords?.lng) return { lat: initialCoords.lat, lng: initialCoords.lng };
    return DEFAULT_CENTER;
  }, [initialCoords]);

  const iframeRef = useRef(null);
  const [coords, setCoords] = useState(startCenter);
  const [locating, setLocating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);

  const mapHtml = useMemo(() => buildMapHtml(startCenter), [startCenter]);

  // Точки, выбранные на карте, прилетают через window.postMessage из iframe
  useEffect(() => {
    const onMsg = (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.type === 'move' && typeof d.lat === 'number') setCoords({ lat: d.lat, lng: d.lng });
      } catch { /* not our message */ }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const centerMapTo = (lat, lng, zoom = 16) => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ type: 'center', lat, lng, zoom }), '*');
    setCoords({ lat, lng });
  };

  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) { Alert.alert(t('error'), t('geoFail')); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { centerMapTo(pos.coords.latitude, pos.coords.longitude, 17); setLocating(false); },
      () => { Alert.alert(t('noAccessTitle'), t('allowGeo')); setLocating(false); },
      { enableHighAccuracy: true },
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = async () => {
    const q = search.trim();
    if (!q) return;
    setSearching(true);
    try {
      const viewbox = '55.9,45.6,73.2,37.1';
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1&countrycodes=uz&viewbox=${viewbox}&bounded=1&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'ru' } });
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0) {
        centerMapTo(parseFloat(json[0].lat), parseFloat(json[0].lon), 16);
      } else {
        Alert.alert(t('notFoundTitle'), t('nothingFoundQuery'));
      }
    } catch {
      Alert.alert(t('error'), t('searchFail'));
    } finally {
      setSearching(false);
    }
  };

  const handleConfirm = async () => {
    if (!coords) return;
    setConfirming(true);
    try {
      const address = `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
      if (returnTo === 'DeliveryAddresses') {
        if (user?.phone) {
          try { await addUserAddress(user.phone, { address, latitude: coords.lat, longitude: coords.lng, isDefault: false }); } catch { /* silent */ }
        }
        navigation.navigate('DeliveryAddresses');
      } else {
        navigation.navigate('Checkout', { selectedCoords: { lat: coords.lat, lng: coords.lng }, selectedAddress: address });
      }
    } finally {
      setConfirming(false);
    }
  };

  const headerTitle = returnTo === 'DeliveryAddresses' ? t('newAddress') : t('selectDeliveryPlace');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <iframe ref={iframeRef} srcDoc={mapHtml} title="map-picker" style={{ ...StyleSheet.absoluteFillObject, border: 'none' }} />

      <View style={styles.topOverlay} pointerEvents="box-none">
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.iconBtn, { backgroundColor: colors.surface }]}>
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
                  <TouchableOpacity onPress={handleSearch}>
                    <Ionicons name="arrow-forward-circle" size={22} color={colors.primary} />
                  </TouchableOpacity>
                ))}
          </View>
        </View>
        <Text style={[styles.headerTitle, { color: colors.text, backgroundColor: colors.surface + 'E6' }]}>{headerTitle}</Text>
      </View>

      <TouchableOpacity style={[styles.myLocBtn, { backgroundColor: colors.surface }]} onPress={handleUseMyLocation} disabled={locating} activeOpacity={0.85}>
        {locating ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="locate" size={22} color={colors.primary} />}
      </TouchableOpacity>

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
        <Text style={[styles.hint, { color: colors.textMuted }]}>{t('moveMapHint')}</Text>
        <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: colors.primary }]} onPress={handleConfirm} disabled={confirming || !coords} activeOpacity={0.85}>
          {confirming ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmText}>{t('selectThisPlace')}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 16, paddingHorizontal: 12, gap: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 15 },
  headerTitle: { alignSelf: 'flex-start', fontSize: 13, fontWeight: '600', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, overflow: 'hidden' },
  myLocBtn: { position: 'absolute', right: 16, bottom: 220, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  bottomCard: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 16, paddingBottom: 30, gap: 10 },
  coordRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  coordTitle: { fontSize: 15, fontWeight: '700' },
  coordSub: { fontSize: 13, marginTop: 2 },
  hint: { fontSize: 12, lineHeight: 16 },
  confirmBtn: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  confirmText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
