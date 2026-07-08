import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Package, CheckCircle, RefreshCw, Phone, LogOut, Truck,
  Navigation, MapPin, ChevronRight, Clock, Wifi, WifiOff, User,
  Minus, Plus, RotateCcw,
} from 'lucide-react';
import { couriers, orders as ordersApi } from '../utils/api';

interface ParsedItem {
  name: string;
  quantity: number;
  unitPrice: number;
  color?: string;
  size?: string;
}

// parseOrderItems normalises the several shapes an order's items can arrive in
// (JSON string or array; name/productName; price/price_with_markup).
function parseOrderItems(raw: any): ParsedItem[] {
  let arr: any[] = [];
  try {
    arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch { return []; }
  if (!Array.isArray(arr)) return [];
  return arr.map((it: any) => {
    const quantity = Number(it.quantity) || 1;
    let unit = it.price_with_markup ?? it.priceWithMarkup;
    if (unit == null && it.total != null) unit = Number(it.total) / quantity;
    if (unit == null) unit = it.price;
    return {
      name: it.name || it.productName || it.product_name || 'Товар',
      quantity,
      unitPrice: Number(unit) || 0,
      color: it.color || undefined,
      size: it.size || undefined,
    };
  });
}

declare const L: any;

interface DeliveryOrder {
  id: number;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  delivery_coordinates: string;
  total_amount: number;
  order_code: string;
  created_at: string;
  items: string;
  comment: string;
}

interface CourierInfo {
  id: number;
  name: string;
  surname: string;
  phone: string;
  company_id: number | null;
}

interface CourierPanelProps {
  courierData: CourierInfo;
  onLogout: () => void;
}

interface CourierStats {
  todayDelivered: number;
  todayAmount: number;
  totalDelivered: number;
}

export default function CourierPanel({ courierData, onLogout }: CourierPanelProps) {
  const [orderList, setOrderList] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrder | null>(null);
  const [markingId, setMarkingId] = useState<number | null>(null);
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);
  const [locationWatchId, setLocationWatchId] = useState<number | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [stats, setStats] = useState<CourierStats | null>(null);
  // returnQty[itemIndex] = сколько единиц этой позиции покупатель вернул курьеру.
  const [returnQty, setReturnQty] = useState<Record<number, number>>({});

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await couriers.getOrders(courierData.id);
      setOrderList(Array.isArray(data) ? data : []);
    } catch {
      setOrderList([]);
    } finally {
      setLoading(false);
    }
    // Статистика смены — некритична, грузим в фоне
    couriers.getStats(courierData.id).then(setStats).catch(() => {});
  }, [courierData.id]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // 🔄 Автообновление списка заказов каждые 60 сек, пока курьер онлайн —
  // новые доставки появляются без ручного нажатия «обновить».
  useEffect(() => {
    if (!isOnline) return;
    const t = setInterval(() => {
      couriers.getOrders(courierData.id)
        .then((d) => setOrderList(Array.isArray(d) ? d : []))
        .catch(() => {});
    }, 60000);
    return () => clearInterval(t);
  }, [isOnline, courierData.id]);

  useEffect(() => {
    if (!selectedOrder || !mapRef.current) return;
    if (typeof L === 'undefined') return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
    routeLayerRef.current = null;

    const destCoords = parseCoords(selectedOrder.delivery_coordinates);
    const center = destCoords || [41.2995, 69.2401];

    const map = L.map(mapRef.current, { zoomControl: true }).setView(center, 13);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    if (destCoords) {
      const destIcon = L.divIcon({
        html: `<div style="background:#EF4444;color:#fff;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,.3)">📦</div>`,
        iconSize: [36, 36], iconAnchor: [18, 18], className: '',
      });
      L.marker(destCoords, { icon: destIcon })
        .addTo(map)
        .bindPopup(`<b>${selectedOrder.customer_name}</b><br>${selectedOrder.delivery_address}`)
        .openPopup();
    }

    if (userCoords) {
      const meIcon = L.divIcon({
        html: `<div style="background:#3B82F6;color:#fff;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,.3)">🚴</div>`,
        iconSize: [36, 36], iconAnchor: [18, 18], className: '',
      });
      L.marker(userCoords, { icon: meIcon }).addTo(map).bindPopup('Вы');
      if (destCoords) fetchOSRMRoute(userCoords, destCoords, map);
    }

    setTimeout(() => map.invalidateSize(), 200);
    return () => {
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
    };
  }, [selectedOrder, userCoords]);

  const parseCoords = (raw: string): [number, number] | null => {
    if (!raw) return null;
    const parts = raw.split(',').map((s) => parseFloat(s.trim()));
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return [parts[0], parts[1]];
    return null;
  };

  const fetchOSRMRoute = async (from: [number, number], to: [number, number], map: any) => {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.code !== 'Ok' || !data.routes?.length) return;
      const route = data.routes[0];
      if (routeLayerRef.current) routeLayerRef.current.remove();
      routeLayerRef.current = L.geoJSON(route.geometry, {
        style: { color: '#3B82F6', weight: 5, opacity: 0.8 },
      }).addTo(map);
      map.fitBounds(routeLayerRef.current.getBounds(), { padding: [40, 40] });
      setRouteInfo({
        distance: `${(route.distance / 1000).toFixed(1)} км`,
        duration: `${Math.round(route.duration / 60)} мин`,
      });
    } catch { /* OSRM unavailable */ }
  };

  const goOnline = () => {
    if (!navigator.geolocation) { alert('Геолокация не поддерживается'); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserCoords(coords);
        await couriers.setStatus(courierData.id, true);
        await couriers.updateLocation(courierData.id, coords[0], coords[1]);
        setIsOnline(true);
        const watchId = navigator.geolocation.watchPosition(
          async (p) => {
            const c: [number, number] = [p.coords.latitude, p.coords.longitude];
            setUserCoords(c);
            await couriers.updateLocation(courierData.id, c[0], c[1]);
          },
          undefined,
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
        );
        setLocationWatchId(watchId);
      },
      (err) => alert('Ошибка геолокации: ' + err.message),
      { enableHighAccuracy: true },
    );
  };

  const goOffline = async () => {
    if (locationWatchId !== null) { navigator.geolocation.clearWatch(locationWatchId); setLocationWatchId(null); }
    await couriers.setStatus(courierData.id, false);
    setIsOnline(false);
    setUserCoords(null);
  };

  const handleSelectOrder = (order: DeliveryOrder) => {
    if (!isOnline) { alert('⚠️ Перейдите в режим ОНЛАЙН перед принятием заказа'); return; }
    setSelectedOrder(order);
    setReturnQty({});
    setRouteInfo(null);
  };

  const handleMarkDelivered = async (orderId: number) => {
    // Собираем позиции, которые покупатель вернул, в формат { index, quantity }.
    const returns = Object.entries(returnQty)
      .map(([idx, q]) => ({ index: Number(idx), quantity: Number(q) }))
      .filter((r) => r.quantity > 0);

    const confirmMsg = returns.length
      ? 'Часть товаров возвращается продавцу. Подтвердить доставку?'
      : 'Подтвердить доставку этого заказа?';
    if (!window.confirm(confirmMsg)) return;

    setMarkingId(orderId);
    try {
      await ordersApi.markDelivered(orderId, returns);
      setSelectedOrder(null);
      setReturnQty({});
      setRouteInfo(null);
      await loadOrders();
    } catch { alert('Ошибка при отметке заказа'); }
    finally { setMarkingId(null); }
  };

  const setItemReturn = (index: number, qty: number, max: number) => {
    const clamped = Math.max(0, Math.min(qty, max));
    setReturnQty((prev) => ({ ...prev, [index]: clamped }));
  };

  const handleLogout = async () => { await goOffline(); onLogout(); };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  const formatAmount = (n: number) => n.toLocaleString('ru-RU') + ' сум';

  // ─── Order detail view ──────────────────────────────────────────────────────
  if (selectedOrder) {
    const detailItems = parseOrderItems(selectedOrder.items);
    const totalReturned = Object.values(returnQty).reduce((s, q) => s + (q || 0), 0);
    // Сумма к оплате = сумма оставленных покупателем товаров.
    const keptTotal = detailItems.reduce((sum, it, i) => {
      const kept = it.quantity - (returnQty[i] || 0);
      return sum + kept * it.unitPrice;
    }, 0);
    const returnedTotal = detailItems.reduce(
      (sum, it, i) => sum + (returnQty[i] || 0) * it.unitPrice, 0);

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
        <div className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
          <button onClick={() => { setSelectedOrder(null); setRouteInfo(null); }} className="p-2 rounded-xl hover:bg-gray-100">
            <ChevronRight className="w-5 h-5 rotate-180 text-gray-600" />
          </button>
          <div className="flex-1">
            <div className="font-bold text-gray-800">Заказ #{selectedOrder.order_code || selectedOrder.id}</div>
            <div className="text-xs text-gray-500">{formatTime(selectedOrder.created_at)}</div>
          </div>
          {routeInfo && (
            <div className="text-right">
              <div className="text-sm font-bold text-blue-600">{routeInfo.distance}</div>
              <div className="text-xs text-gray-500">{routeInfo.duration}</div>
            </div>
          )}
        </div>

        <div ref={mapRef} className="w-full" style={{ height: '45vh', minHeight: 240 }} />

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-gray-800">{selectedOrder.customer_name}</div>
                <a href={`tel:${selectedOrder.customer_phone}`} className="text-sm text-blue-500 flex items-center gap-1 mt-0.5">
                  <Phone className="w-3.5 h-3.5" />
                  {selectedOrder.customer_phone}
                </a>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-red-400 mt-0.5" />
              <div className="text-sm text-gray-700 leading-relaxed">{selectedOrder.delivery_address}</div>
            </div>
            {selectedOrder.comment && (
              <div className="bg-amber-50 rounded-xl px-3 py-2 text-sm text-amber-800">
                💬 {selectedOrder.comment}
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-gray-100">
              <span className="text-sm text-gray-500">Сумма</span>
              <span className="font-bold text-gray-800">{formatAmount(selectedOrder.total_amount)}</span>
            </div>
          </div>

          {/* Items + возврат: курьер отмечает, что покупатель вернул */}
          {detailItems.length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-semibold text-gray-700">Товары</div>
                <div className="text-[11px] text-gray-400">выберите возврат, если есть</div>
              </div>
              <div className="text-[11px] text-gray-400 mb-3 leading-relaxed">
                Если покупатель забрал не всё — укажите, сколько единиц возвращается продавцу.
              </div>
              <div className="space-y-3">
                {detailItems.map((item, i) => {
                  const ret = returnQty[i] || 0;
                  const kept = item.quantity - ret;
                  return (
                    <div key={i} className={`rounded-xl border p-3 transition-colors ${ret > 0 ? 'border-amber-300 bg-amber-50/60' : 'border-gray-100'}`}>
                      <div className="flex justify-between gap-2">
                        <div className="text-sm text-gray-800 font-medium flex-1">
                          {item.name}
                          {(item.color || item.size) && (
                            <span className="text-gray-400 font-normal ml-1">
                              ({[item.color, item.size].filter(Boolean).join(' / ')})
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 whitespace-nowrap">{item.quantity} шт.</div>
                      </div>
                      {item.quantity > 0 && (
                        <div className="flex items-center justify-between mt-2.5">
                          <span className="text-xs text-gray-500">
                            {ret > 0 ? (
                              <span className="text-amber-600 font-semibold">Возврат: {ret} из {item.quantity}</span>
                            ) : (
                              <span className="text-green-600 font-medium">Забрал полностью</span>
                            )}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setItemReturn(i, ret - 1, item.quantity)}
                              disabled={ret <= 0}
                              className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center disabled:opacity-40 active:bg-gray-200"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-6 text-center text-sm font-bold text-gray-800">{ret}</span>
                            <button
                              onClick={() => setItemReturn(i, ret + 1, item.quantity)}
                              disabled={ret >= item.quantity}
                              className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center disabled:opacity-40 active:bg-amber-200"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                      {kept === 0 && item.quantity > 0 && (
                        <div className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
                          <RotateCcw className="w-3 h-3" /> Полностью возвращается продавцу
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Итог: к оплате vs возврат */}
              <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                {totalReturned > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-amber-600">Возврат продавцу</span>
                    <span className="font-semibold text-amber-600">−{formatAmount(returnedTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 font-medium">К оплате покупателем</span>
                  <span className="font-bold text-green-600">{formatAmount(keptTotal)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-white border-t space-y-2.5">
          {/* 🧭 Открыть точку доставки в родном навигаторе (Яндекс/Google) */}
          {(() => {
            const dest = parseCoords(selectedOrder.delivery_coordinates);
            if (!dest) return null;
            return (
              <div className="flex gap-2.5">
                <a
                  href={`https://yandex.uz/maps/?rtext=~${dest[0]},${dest[1]}&rtt=auto`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex-1 bg-blue-50 text-blue-600 py-3 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors"
                >
                  <Navigation className="w-4 h-4" />Яндекс
                </a>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${dest[0]},${dest[1]}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex-1 bg-blue-50 text-blue-600 py-3 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors"
                >
                  <Navigation className="w-4 h-4" />Google
                </a>
                <a
                  href={`tel:${selectedOrder.customer_phone}`}
                  className="flex-1 bg-green-50 text-green-600 py-3 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-green-100 transition-colors"
                >
                  <Phone className="w-4 h-4" />Звонок
                </a>
              </div>
            );
          })()}
          <button
            onClick={() => handleMarkDelivered(selectedOrder.id)}
            disabled={markingId === selectedOrder.id}
            className={`w-full text-white py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${
              totalReturned > 0
                ? 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700'
                : 'bg-green-500 hover:bg-green-600 active:bg-green-700'
            }`}
          >
            <CheckCircle className="w-5 h-5" />
            {markingId === selectedOrder.id
              ? 'Отмечаем...'
              : totalReturned > 0
                ? `✓ Доставлено (возврат ${totalReturned} шт.)`
                : '✓ Доставлено'}
          </button>
        </div>
      </div>
    );
  }

  // ─── Orders list view ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-white border-b px-4 pt-10 pb-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <Truck className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <div className="font-bold text-gray-800">{courierData.name} {courierData.surname}</div>
              <div className="text-xs text-gray-400">{courierData.phone}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500">
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        <button
          onClick={isOnline ? goOffline : goOnline}
          className={`w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
            isOnline
              ? 'bg-green-500 text-white shadow-lg shadow-green-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {isOnline ? (
            <><Wifi className="w-4 h-4" />ОНЛАЙН — геолокация активна</>
          ) : (
            <><WifiOff className="w-4 h-4" />ОФЛАЙН — нажмите для начала работы</>
          )}
        </button>

        {/* 📊 Итоги смены: мотивация и контроль дня */}
        {stats && (
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="bg-orange-50 rounded-xl px-2 py-2 text-center">
              <div className="text-lg font-bold text-orange-600">{stats.todayDelivered}</div>
              <div className="text-[10px] text-orange-400 font-medium">сегодня</div>
            </div>
            <div className="bg-green-50 rounded-xl px-2 py-2 text-center">
              <div className="text-lg font-bold text-green-600">{(stats.todayAmount / 1000).toFixed(0)}K</div>
              <div className="text-[10px] text-green-500 font-medium">сум за день</div>
            </div>
            <div className="bg-gray-50 rounded-xl px-2 py-2 text-center">
              <div className="text-lg font-bold text-gray-700">{stats.totalDelivered}</div>
              <div className="text-[10px] text-gray-400 font-medium">всего</div>
            </div>
          </div>
        )}
      </div>

      {/* Order list */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Активные доставки ({orderList.length})
          </h2>
          <button onClick={loadOrders} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 text-gray-300 animate-spin" />
          </div>
        ) : orderList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
              <Package className="w-8 h-8 text-gray-300" />
            </div>
            <div className="text-gray-500 font-medium">Нет активных доставок</div>
            <div className="text-gray-400 text-sm">Новые заказы появятся здесь</div>
          </div>
        ) : (
          <div className="space-y-3">
            {orderList.map((order) => (
              <button
                key={order.id}
                onClick={() => handleSelectOrder(order)}
                className="w-full bg-white rounded-2xl p-4 shadow-sm text-left hover:shadow-md transition-all border border-transparent hover:border-orange-200 active:scale-[0.99]"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-orange-500" />
                    <span className="font-bold text-gray-800 text-sm">#{order.order_code || order.id}</span>
                  </div>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(order.created_at)}
                  </span>
                </div>
                <div className="text-sm font-semibold text-gray-700 mb-1">{order.customer_name}</div>
                <div className="flex items-start gap-1 mb-3">
                  <MapPin className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                  <span className="text-xs text-gray-500 leading-relaxed line-clamp-2">{order.delivery_address}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-800">{formatAmount(order.total_amount)}</span>
                  <div className="flex items-center gap-3">
                    {/* 📞 Звонок покупателю прямо из списка (span, т.к. карточка — <button>) */}
                    <span
                      role="link"
                      onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${order.customer_phone}`; }}
                      className="flex items-center gap-1 text-green-600 text-xs font-semibold bg-green-50 px-2.5 py-1.5 rounded-lg hover:bg-green-100 cursor-pointer"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      Звонок
                    </span>
                    <div className="flex items-center gap-1 text-orange-500 text-xs font-semibold">
                      <Navigation className="w-3.5 h-3.5" />
                      Маршрут
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {!isOnline && orderList.length > 0 && (
        <div className="mx-4 mb-4 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-700 text-center">
          ⚠️ Перейдите в режим ОНЛАЙН, чтобы принимать заказы
        </div>
      )}
    </div>
  );
}
