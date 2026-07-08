import React, { useRef, useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

// 🚴 Карта отслеживания курьера (Leaflet во WebView, без нативных зависимостей).
// Показывает движущийся маркер курьера и точку доставки, обновляется на лету.
function buildHtml(courier, dest) {
  const cLat = courier?.lat ?? dest?.lat ?? 41.3111;
  const cLng = courier?.lng ?? dest?.lng ?? 69.2797;
  const dLat = dest?.lat ?? cLat;
  const dLng = dest?.lng ?? cLng;
  return `<!DOCTYPE html><html><head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>html,body,#map{height:100%;width:100%;margin:0;padding:0;}body{background:#e9eef2;}
  .leaflet-control-attribution{font-size:9px;}
  .pin{width:26px;height:26px;border-radius:50%;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:14px;}
  </style></head><body><div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: true, attributionControl: true }).setView([${cLat}, ${cLng}], 14);
    L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&hl=ru&x={x}&y={y}&z={z}', { maxZoom: 20, subdomains: ['0','1','2','3'], attribution: '© Google' }).addTo(map);

    var courierIcon = L.divIcon({ className: '', html: '<div class="pin" style="background:#7B5CF0">🚴</div>', iconSize: [26,26], iconAnchor: [13,13] });
    var destIcon = L.divIcon({ className: '', html: '<div class="pin" style="background:#22C55E">📍</div>', iconSize: [26,26], iconAnchor: [13,13] });

    var destMarker = L.marker([${dLat}, ${dLng}], { icon: destIcon }).addTo(map);
    var courierMarker = ${courier && courier.lat != null ? `L.marker([${cLat}, ${cLng}], { icon: courierIcon }).addTo(map)` : 'null'};
    var line = null;

    function redrawLine() {
      if (line) { map.removeLayer(line); line = null; }
      if (courierMarker) {
        line = L.polyline([courierMarker.getLatLng(), destMarker.getLatLng()], { color: '#7B5CF0', weight: 3, dashArray: '6 6' }).addTo(map);
        try { map.fitBounds(line.getBounds(), { padding: [50, 50], maxZoom: 16 }); } catch (e) {}
      }
    }
    redrawLine();

    // Обновление позиции курьера без перезагрузки карты
    function updateCourier(lat, lng) {
      if (lat == null || lng == null) return;
      if (!courierMarker) { courierMarker = L.marker([lat, lng], { icon: courierIcon }).addTo(map); }
      else { courierMarker.setLatLng([lat, lng]); }
      redrawLine();
    }
    document.addEventListener('message', function (e) { try { var d = JSON.parse(e.data); if (d.type==='courier') updateCourier(d.lat, d.lng); } catch (err) {} });
    window.addEventListener('message', function (e) { try { var d = JSON.parse(e.data); if (d.type==='courier') updateCourier(d.lat, d.lng); } catch (err) {} });
  </script></body></html>`;
}

export default function CourierTrackMap({ courier, destination, style }) {
  const webRef = useRef(null);
  // HTML строим один раз (по первой отрисовке), дальше двигаем маркер через postMessage
  const html = useMemo(() => buildHtml(courier, destination), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (courier?.lat != null && courier?.lng != null && webRef.current) {
      const msg = JSON.stringify({ type: 'courier', lat: courier.lat, lng: courier.lng });
      webRef.current.postMessage(msg);
    }
  }, [courier?.lat, courier?.lng]);

  return (
    <View style={[styles.wrap, style]}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html }}
        style={styles.web}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', height: 240, borderRadius: 16, overflow: 'hidden' },
  web: { flex: 1, backgroundColor: '#e9eef2' },
});
