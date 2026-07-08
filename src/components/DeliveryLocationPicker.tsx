import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, Marker } from 'leaflet';

interface DeliveryLocationPickerProps {
  onLocationSelect: (coords: { lat: number; lng: number }, address?: string) => void;
  selectedCoords?: { lat: number; lng: number } | null;
  isNight?: boolean;
}

// Default center: Tashkent, Uzbekistan
const DEFAULT_CENTER = { lat: 41.2995, lng: 69.2401 };

export default function DeliveryLocationPicker({ onLocationSelect, selectedCoords }: DeliveryLocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!isExpanded) return;
    if (!containerRef.current) return;

    let destroyed = false;

    import('leaflet').then((Lmod) => {
      if (destroyed || !containerRef.current) return;
      if (mapRef.current) return;
      const L = Lmod.default;

      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      const center = selectedCoords || DEFAULT_CENTER;
      const map = L.map(containerRef.current!, { zoomControl: true, attributionControl: false })
        .setView([center.lat, center.lng], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

      // Delivery marker icon
      const deliveryIcon = L.divIcon({
        html: `<div style="width:22px;height:22px;background:#7C5CF0;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">
          <div style="width:6px;height:6px;background:white;border-radius:50%"></div>
        </div>`,
        className: '',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      if (selectedCoords) {
        markerRef.current = L.marker([selectedCoords.lat, selectedCoords.lng], { icon: deliveryIcon }).addTo(map);
      }

      // Tap/click to set location
      map.on('click', async (e: any) => {
        const { lat, lng } = e.latlng;

        if (markerRef.current) {
          map.removeLayer(markerRef.current);
        }
        markerRef.current = L.marker([lat, lng], { icon: deliveryIcon })
          .addTo(map)
          .bindPopup('Адрес доставки')
          .openPopup();

        // Reverse geocode to get address
        setGeocoding(true);
        try {
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { 'Accept-Language': 'ru' } }
          );
          if (resp.ok) {
            const data = await resp.json();
            const addr = data.display_name || '';
            onLocationSelect({ lat, lng }, addr);
          } else {
            onLocationSelect({ lat, lng });
          }
        } catch {
          onLocationSelect({ lat, lng });
        } finally {
          setGeocoding(false);
        }
      });

      mapRef.current = map;

      // Fix map size after expand animation
      setTimeout(() => map.invalidateSize(), 50);
    });

    return () => {
      destroyed = true;
    };
  }, [isExpanded]);

  // Update marker when selectedCoords changes externally (e.g. reset)
  useEffect(() => {
    if (!mapRef.current) return;
    import('leaflet').then((Lmod) => {
      const L = Lmod.default;
      const map = mapRef.current;
      if (!map) return;
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }
      if (selectedCoords) {
        const deliveryIcon = L.divIcon({
          html: `<div style="width:22px;height:22px;background:#7C5CF0;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">
            <div style="width:6px;height:6px;background:white;border-radius:50%"></div>
          </div>`,
          className: '',
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        markerRef.current = L.marker([selectedCoords.lat, selectedCoords.lng], { icon: deliveryIcon }).addTo(map);
        map.setView([selectedCoords.lat, selectedCoords.lng], 15);
      }
    });
  }, [selectedCoords?.lat, selectedCoords?.lng]);

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const detectGPS = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        // Move map to detected position
        if (mapRef.current) {
          mapRef.current.setView([lat, lng], 16);
        }

        // Place marker and reverse-geocode
        import('leaflet').then(async (Lmod) => {
          const L = Lmod.default;
          const map = mapRef.current;
          if (!map) return;

          const deliveryIcon = L.divIcon({
            html: `<div style="width:22px;height:22px;background:#7C5CF0;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">
              <div style="width:6px;height:6px;background:white;border-radius:50%"></div>
            </div>`,
            className: '',
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          });

          if (markerRef.current) map.removeLayer(markerRef.current);
          markerRef.current = L.marker([lat, lng], { icon: deliveryIcon }).addTo(map).bindPopup('Моя геопозиция').openPopup();

          setGeocoding(true);
          try {
            const resp = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
              { headers: { 'Accept-Language': 'ru' } }
            );
            if (resp.ok) {
              const data = await resp.json();
              onLocationSelect({ lat, lng }, data.display_name || '');
            } else {
              onLocationSelect({ lat, lng });
            }
          } catch {
            onLocationSelect({ lat, lng });
          } finally {
            setGeocoding(false);
          }
        });

        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsExpanded(v => !v)}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-all"
        style={{
          background: isExpanded ? 'rgba(124,92,240,0.15)' : 'rgba(124,92,240,0.08)',
          color: '#A78BFA',
          border: '1px solid rgba(124,92,240,0.25)',
        }}
      >
        <span>📍</span>
        {isExpanded
          ? 'Свернуть карту'
          : selectedCoords
            ? 'Изменить на карте'
            : 'Выбрать на карте'}
        {geocoding && <span className="animate-spin ml-1">⏳</span>}
      </button>

      {isExpanded && (
        <div
          style={{
            marginTop: 8,
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid rgba(124,92,240,0.3)',
          }}
        >
          <div
            style={{
              padding: '6px 12px',
              background: 'rgba(124,92,240,0.1)',
              fontSize: 11,
              color: '#A78BFA',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Нажмите на карту, чтобы указать адрес доставки</span>
            {navigator.geolocation && (
              <button
                type="button"
                onClick={detectGPS}
                disabled={locating}
                style={{
                  marginLeft: 8,
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: 'rgba(124,92,240,0.25)',
                  color: '#C4B5FD',
                  border: '1px solid rgba(124,92,240,0.4)',
                  fontSize: 11,
                  cursor: locating ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  whiteSpace: 'nowrap',
                }}
              >
                {locating ? '...' : '📍 Моя геопозиция'}
              </button>
            )}
          </div>
          <div ref={containerRef} style={{ width: '100%', height: 260 }} />
        </div>
      )}
    </div>
  );
}
