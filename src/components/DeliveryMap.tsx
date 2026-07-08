import { useEffect, useRef } from 'react';
import type { Map as LeafletMap, Polyline, GeoJSON, Marker } from 'leaflet';

interface DeliveryMapProps {
  companyCoords?: { lat: number; lng: number } | null;
  deliveryCoords?: { lat: number; lng: number } | null;
  companyAddress?: string;
  deliveryAddress?: string;
}

export default function DeliveryMap({ companyCoords, deliveryCoords, companyAddress, deliveryAddress }: DeliveryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const routeLayerRef = useRef<Polyline | GeoJSON | null>(null);
  const deliveryMarkerRef = useRef<Marker | null>(null);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let destroyed = false;

    import('leaflet').then((Lmod) => {
      if (destroyed || !containerRef.current) return;
      const L = Lmod.default;

      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // Default to Tashkent if no company coords
      const defaultCenter = companyCoords || { lat: 41.2995, lng: 69.2401 };
      const map = L.map(containerRef.current!, {
        zoomControl: true,
        attributionControl: true,
      }).setView([defaultCenter.lat, defaultCenter.lng], 13);

      // Тайлы Google Maps через Leaflet (для тайлов ключ не нужен) — единый
      // стиль с мобильным приложением и более привычный вид.
      L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&hl=ru&x={x}&y={y}&z={z}', {
        attribution: '© Google',
        subdomains: ['0', '1', '2', '3'],
        maxZoom: 20,
      }).addTo(map);

      // Company marker (blue dot) — only when company coords are available
      if (companyCoords) {
        const companyIcon = L.divIcon({
          html: `<div style="width:16px;height:16px;background:#2563EB;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
          className: '',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        L.marker([companyCoords.lat, companyCoords.lng], { icon: companyIcon })
          .addTo(map)
          .bindPopup(companyAddress || 'Склад / Компания');
      }

      mapRef.current = map;
    });

    return () => {
      destroyed = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Draw / update route when deliveryCoords or deliveryAddress changes
  useEffect(() => {
    if (!mapRef.current) return;

    import('leaflet').then(async (Lmod) => {
      const L = Lmod.default;
      const map = mapRef.current;
      if (!map) return;

      // Remove previous route and delivery marker
      if (routeLayerRef.current) {
        map.removeLayer(routeLayerRef.current as any);
        routeLayerRef.current = null;
      }
      if (deliveryMarkerRef.current) {
        map.removeLayer(deliveryMarkerRef.current);
        deliveryMarkerRef.current = null;
      }

      // Determine delivery location: use coords if available, else geocode address
      let coords = deliveryCoords;
      let geocodedLabel = 'Адрес доставки';

      if (!coords && deliveryAddress && deliveryAddress.trim()) {
        try {
          const query = encodeURIComponent(deliveryAddress.trim());
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=uz`,
            { headers: { 'Accept-Language': 'ru' } }
          );
          if (resp.ok) {
            const data = await resp.json();
            if (data && data[0]) {
              coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
              geocodedLabel = deliveryAddress;
            }
          }
        } catch {
          // Geocoding failed — leave coords null
        }
      }

      if (!coords) {
        const fallbackCenter = companyCoords || { lat: 41.2995, lng: 69.2401 };
        map.setView([fallbackCenter.lat, fallbackCenter.lng], 13);
        return;
      }

      // Delivery marker (red dot)
      const deliveryIcon = L.divIcon({
        html: `<div style="width:16px;height:16px;background:#DC2626;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
        className: '',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      deliveryMarkerRef.current = L.marker([coords.lat, coords.lng], { icon: deliveryIcon })
        .addTo(map)
        .bindPopup(geocodedLabel);

      // Draw route only when both company and delivery coords are available
      if (companyCoords) {
        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${companyCoords.lng},${companyCoords.lat};${coords.lng},${coords.lat}?geometries=geojson&overview=full`;
          const resp = await fetch(url);
          if (!resp.ok) throw new Error('OSRM request failed');
          const data = await resp.json();

          if (data.code === 'Ok' && data.routes?.[0]) {
            const geojson = data.routes[0].geometry;
            const layer = L.geoJSON(geojson, {
              style: { color: '#7C5CF0', weight: 5, opacity: 0.85 },
            }).addTo(map);
            routeLayerRef.current = layer as any;

            const bounds = L.latLngBounds(
              [companyCoords.lat, companyCoords.lng],
              [coords.lat, coords.lng]
            );
            map.fitBounds(bounds, { padding: [40, 40] });
          } else {
            throw new Error('No route found');
          }
        } catch {
          // Fallback: straight dashed line
          const line = L.polyline(
            [
              [companyCoords.lat, companyCoords.lng],
              [coords.lat, coords.lng],
            ],
            { color: '#7C5CF0', weight: 3, dashArray: '8,6', opacity: 0.75 }
          ).addTo(map);
          routeLayerRef.current = line;

          const bounds = L.latLngBounds(
            [companyCoords.lat, companyCoords.lng],
            [coords.lat, coords.lng]
          );
          map.fitBounds(bounds, { padding: [40, 40] });
        }
      } else {
        // No company coords — just zoom to delivery location
        map.setView([coords.lat, coords.lng], 15);
      }
    });
  }, [deliveryCoords, deliveryAddress]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 300 }} />
  );
}
