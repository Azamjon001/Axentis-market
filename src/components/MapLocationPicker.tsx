import { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, X, Check, Crosshair } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

interface MapLocationPickerProps {
  currentLocation: string;
  currentLatitude: number;
  currentLongitude: number;
  onClose: () => void;
  onSelect: (location: string, lat: number, lng: number) => void;
}

export default function MapLocationPicker({
  currentLocation,
  currentLatitude,
  currentLongitude,
  onClose,
  onSelect
}: MapLocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [marker, setMarker] = useState<any>(null);
  const [selectedLat, setSelectedLat] = useState(currentLatitude || 41.2995);
  const [selectedLng, setSelectedLng] = useState(currentLongitude || 69.2401);
  const [address, setAddress] = useState(currentLocation || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Динамически загружаем Leaflet CSS и JS
    const loadLeaflet = async () => {
      // Добавляем CSS
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // Загружаем Leaflet JS
      if (!(window as any).L) {
        await new Promise<void>((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.onload = () => resolve();
          document.head.appendChild(script);
        });
      }

      initMap();
    };

    loadLeaflet();

    return () => {
      if (map) {
        map.remove();
      }
    };
  }, []);

  const initMap = () => {
    if (!mapRef.current || !(window as any).L) return;

    const L = (window as any).L;

    // Создаем карту
    const newMap = L.map(mapRef.current).setView([selectedLat, selectedLng], 13);

    // Добавляем слой OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(newMap);

    // Создаем иконку маркера
    const icon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    // Добавляем маркер
    const newMarker = L.marker([selectedLat, selectedLng], { 
      icon,
      draggable: true 
    }).addTo(newMap);

    newMarker.bindPopup('📍 Ваша компания здесь').openPopup();

    // Обработчик перетаскивания маркера
    newMarker.on('dragend', function(e: any) {
      const position = e.target.getLatLng();
      setSelectedLat(position.lat);
      setSelectedLng(position.lng);
      reverseGeocode(position.lat, position.lng);
    });

    // Обработчик клика по карте
    newMap.on('click', function(e: any) {
      const { lat, lng } = e.latlng;
      newMarker.setLatLng([lat, lng]);
      setSelectedLat(lat);
      setSelectedLng(lng);
      reverseGeocode(lat, lng);
    });

    setMap(newMap);
    setMarker(newMarker);

    // Получаем адрес для текущей позиции
    if (!currentLocation) {
      reverseGeocode(selectedLat, selectedLng);
    }
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ru`,
        {
          headers: {
            'User-Agent': 'FigmaMakeApp/1.0' // Nominatim требует User-Agent
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.display_name) {
        setAddress(data.display_name);
      } else if (data.error) {
        console.error('Nominatim API error:', data.error);
        setAddress(`Координаты: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        toast.error('Не удалось определить адрес. Координаты сохранены.');
      } else {
        setAddress(`Координаты: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      }
    } catch (error) {
      console.error('Ошибка геокодирования:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        lat,
        lng
      });
      // Если не удалось получить адрес, используем координаты
      setAddress(`Координаты: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      toast.error('Не удалось определить адрес. Используйте координаты.');
    } finally {
      setLoading(false);
    }
  };

  const handleGetCurrentLocation = async () => {
    setLoading(true);
    
    // Сначала пытаемся использовать IP-геолокацию (работает в iframe)
    try {
      console.log('🌍 Пытаюсь определить локацию по IP...');
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      
      if (data.latitude && data.longitude) {
        const lat = data.latitude;
        const lng = data.longitude;
        
        console.log('✅ Локация определена по IP:', lat, lng);
        
        setSelectedLat(lat);
        setSelectedLng(lng);
        
        if (map && marker) {
          map.setView([lat, lng], 13);
          marker.setLatLng([lat, lng]);
          reverseGeocode(lat, lng);
        }
        
        toast.success(`📍 Определено: ${data.city || ''}, ${data.country_name || ''}`);
        setLoading(false);
        return;
      }
    } catch (error) {
      console.warn('⚠️ IP геолокация не сработала, пробую GPS...', error);
    }
    
    // Если IP не сработал, пытаемся использовать GPS (может не работать в iframe)
    if (!navigator.geolocation) {
      toast.error('❌ Геолокация недоступна. Используйте "Быстрый переход" или кликните на карту.');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        console.log('✅ Локация определена по GPS:', lat, lng);
        
        setSelectedLat(lat);
        setSelectedLng(lng);
        
        if (map && marker) {
          map.setView([lat, lng], 15);
          marker.setLatLng([lat, lng]);
          reverseGeocode(lat, lng);
        }
        
        toast.success('📍 Текущее местоположение определено!');
        setLoading(false);
      },
      (error) => {
        console.error('❌ Ошибка геолокации:', {
          code: error.code,
          message: error.message,
          PERMISSION_DENIED: error.PERMISSION_DENIED,
          POSITION_UNAVAILABLE: error.POSITION_UNAVAILABLE,
          TIMEOUT: error.TIMEOUT
        });
        
        // Более дружелюбное сообщение
        toast.error('❌ Автоопределение недоступно. Используйте "Быстрый переход" или кликните на карту.', { duration: 4000 });
        setLoading(false);
      },
      {
        enableHighAccuracy: false, // Быстрее работает
        timeout: 5000,
        maximumAge: 60000 // Кэш на 1 минуту
      }
    );
  };

  const handleSelect = () => {
    if (address && selectedLat && selectedLng) {
      onSelect(address, selectedLat, selectedLng);
    } else {
      toast.error('Пожалуйста, выберите локацию на карте');
    }
  };

  // Популярные места в Ташкенте
  const popularPlaces = [
    { name: 'Площадь Независимости', lat: 41.3111, lng: 69.2797 },
    { name: 'Чорсу Базар', lat: 41.3267, lng: 69.2348 },
    { name: 'Magic City', lat: 41.3145, lng: 69.2494 },
    { name: 'Next', lat: 41.2856, lng: 69.2034 },
    { name: 'Samarkand Darvoza', lat: 41.3156, lng: 69.2285 }
  ];

  const goToPlace = (lat: number, lng: number) => {
    setSelectedLat(lat);
    setSelectedLng(lng);
    if (map && marker) {
      map.setView([lat, lng], 16);
      marker.setLatLng([lat, lng]);
      reverseGeocode(lat, lng);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Заголовок */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-gray-900 flex items-center gap-2">
              <MapPin className="w-6 h-6 text-purple-600" />
              Выберите локацию на карте
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Кликните на карту или перетащите маркер
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Боковая панель */}
          <div className="w-80 border-r border-gray-200 p-4 overflow-y-auto">
            {/* Кнопка текущей локации */}
            <button
              onClick={handleGetCurrentLocation}
              disabled={loading}
              className="w-full mb-4 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Navigation className="w-5 h-5" />
              {loading ? 'Определение...' : 'Моя локация'}
            </button>

            {/* Выбранный адрес */}
            <div className="mb-4 p-4 bg-purple-50 rounded-lg">
              <label className="block text-sm text-gray-700 mb-2">
                Выбранный адрес:
              </label>
              <p className="text-sm text-gray-900">
                {address || 'Выберите точку на карте'}
              </p>
              {selectedLat && selectedLng && (
                <p className="text-xs text-gray-500 mt-2">
                  📍 {selectedLat.toFixed(6)}, {selectedLng.toFixed(6)}
                </p>
              )}
            </div>

            {/* Популярные места */}
            <div className="mb-4">
              <h4 className="text-sm text-gray-700 mb-3 flex items-center gap-2">
                <Crosshair className="w-4 h-4" />
                Быстрый переход:
              </h4>
              <div className="space-y-2">
                {popularPlaces.map((place) => (
                  <button
                    key={place.name}
                    onClick={() => goToPlace(place.lat, place.lng)}
                    className="w-full px-3 py-2 text-sm text-left border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
                  >
                    {place.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Инструкции */}
            <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-900">
              <p className="mb-2">💡 <strong>Как использовать:</strong></p>
              <ul className="space-y-1 text-xs">
                <li>• Кликните на карту чтобы установить маркер</li>
                <li>• Перетащите маркер для точной настройки</li>
                <li>• Используйте колесико мыши для увеличения</li>
                <li>• Нажмите "Моя локация" для автоопределения</li>
              </ul>
            </div>

            {/* Помощь при ошибках */}
            <div className="mt-4 p-3 bg-amber-50 rounded-lg text-sm text-amber-900">
              <p className="mb-2">⚠️ <strong>Не работает геолокация?</strong></p>
              <ul className="space-y-1 text-xs">
                <li>• Разрешите доступ к местоположению в браузере</li>
                <li>• Проверьте настройки конфиденциальности</li>
                <li>• Убедитесь что GPS включен</li>
                <li>• Используйте "Быстрый переход" или кликните на карту</li>
              </ul>
            </div>
          </div>

          {/* Карта */}
          <div className="flex-1 relative">
            <div ref={mapRef} className="w-full h-full" />
            
            {/* Индикатор загрузки */}
            {loading && (
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-600 border-t-transparent"></div>
                <span className="text-sm text-gray-700">Определение адреса...</span>
              </div>
            )}
          </div>
        </div>

        {/* Кнопки действий */}
        <div className="flex gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSelect}
            disabled={!address}
            className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5" />
            Выбрать эту локацию
          </button>
        </div>
      </div>
    </div>
  );
}