import { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Plus, Trash2, Check, X, Undo2, Eye } from 'lucide-react';
import api from '../utils/api';
import { getCurrentLanguage, type Language } from '../utils/translations';

interface Region {
  id: number;
  name: string;
  nameUz?: string;
  parentId?: number;
  geojson?: any;
}

// Админ рисует границы регионов кликами по карте (raw Leaflet, без доп. зависимостей).
export default function AdminRegionsPanel() {
  const [language, setLanguage] = useState<Language>(getCurrentLanguage());
  const [regions, setRegions] = useState<Region[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [name, setName] = useState('');
  const [nameUz, setNameUz] = useState('');
  const [vertices, setVertices] = useState(0);
  const [saving, setSaving] = useState(false);
  const uz = language === 'uz';

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const pointsRef = useRef<[number, number][]>([]);
  const drawingRef = useRef(false);
  const drawLayerRef = useRef<any>(null);
  const viewLayerRef = useRef<any>(null);

  useEffect(() => {
    const h = (e: Event) => setLanguage((e as CustomEvent).detail);
    window.addEventListener('languageChange', h as EventListener);
    return () => window.removeEventListener('languageChange', h as EventListener);
  }, []);

  const loadRegions = useCallback(async () => {
    try { setRegions(await api.regions.list()); } catch { /* ignore */ }
  }, []);

  const redraw = useCallback(() => {
    const L = LRef.current, map = mapRef.current;
    if (!L || !map) return;
    if (drawLayerRef.current) { map.removeLayer(drawLayerRef.current); drawLayerRef.current = null; }
    const pts = pointsRef.current;
    if (pts.length === 0) return;
    drawLayerRef.current = pts.length >= 3
      ? L.polygon(pts, { color: '#6D5DFB', weight: 2, fillOpacity: 0.2 }).addTo(map)
      : L.polyline(pts, { color: '#6D5DFB', weight: 2 }).addTo(map);
    pts.forEach((p) => L.circleMarker(p, { radius: 4, color: '#fff', fillColor: '#6D5DFB', fillOpacity: 1, weight: 2 }).addTo(drawLayerRef.current));
  }, []);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let destroyed = false;
    import('leaflet').then((Lmod) => {
      if (destroyed || !containerRef.current) return;
      const L = Lmod.default;
      LRef.current = L;
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      const map = L.map(containerRef.current!, { zoomControl: true }).setView([41.0, 71.6], 9);
      L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&hl=ru&x={x}&y={y}&z={z}', {
        attribution: '© Google', subdomains: ['0', '1', '2', '3'], maxZoom: 20,
      }).addTo(map);
      map.on('click', (e: any) => {
        if (!drawingRef.current) return;
        pointsRef.current.push([e.latlng.lat, e.latlng.lng]);
        setVertices(pointsRef.current.length);
        redraw();
      });
      mapRef.current = map;
      setTimeout(() => map.invalidateSize(), 100);
      loadRegions();
    });
    return () => { destroyed = true; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, [loadRegions, redraw]);

  const startDraw = () => { drawingRef.current = true; setDrawing(true); pointsRef.current = []; setVertices(0); redraw(); };
  const undo = () => { pointsRef.current.pop(); setVertices(pointsRef.current.length); redraw(); };
  const cancelDraw = () => {
    drawingRef.current = false; setDrawing(false); pointsRef.current = []; setVertices(0);
    setName(''); setNameUz('');
    if (drawLayerRef.current && mapRef.current) { mapRef.current.removeLayer(drawLayerRef.current); drawLayerRef.current = null; }
  };

  const save = async () => {
    if (pointsRef.current.length < 3 || !name.trim()) return;
    setSaving(true);
    // GeoJSON Polygon: [lng,lat], замыкаем кольцо первой точкой.
    const ring = pointsRef.current.map(([lat, lng]) => [lng, lat]);
    ring.push(ring[0]);
    const geojson = { type: 'Polygon', coordinates: [ring] };
    try {
      await api.regions.create({ name: name.trim(), nameUz: nameUz.trim(), geojson });
      cancelDraw();
      await loadRegions();
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  const viewRegion = (r: Region) => {
    const L = LRef.current, map = mapRef.current;
    if (!L || !map || !r.geojson) return;
    if (viewLayerRef.current) { map.removeLayer(viewLayerRef.current); viewLayerRef.current = null; }
    try {
      viewLayerRef.current = L.geoJSON(r.geojson, { style: { color: '#22C55E', weight: 2, fillOpacity: 0.15 } }).addTo(map);
      map.fitBounds(viewLayerRef.current.getBounds(), { padding: [30, 30] });
    } catch { /* ignore */ }
  };

  const del = async (id: number) => {
    if (!confirm(uz ? 'Regionni o‘chirasizmi?' : 'Удалить регион?')) return;
    try { await api.regions.remove(id); await loadRegions(); } catch { /* ignore */ }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4" style={{ color: 'var(--ax-text)' }}>
      {/* Left: controls + list */}
      <div className="lg:w-80 flex-shrink-0 space-y-3">
        <div className="rounded-xl p-4" style={{ background: 'var(--ax-card)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {!drawing ? (
            <button onClick={startDraw} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium" style={{ background: 'linear-gradient(135deg,#6D5DFB,#5546E0)', color: '#fff' }}>
              <Plus className="w-4 h-4" /> {uz ? 'Yangi region chizish' : 'Нарисовать регион'}
            </button>
          ) : (
            <div className="space-y-2">
              <div className="text-xs" style={{ color: 'var(--ax-text-2)' }}>
                {uz ? 'Xaritada nuqtalarni bosing (kamida 3 ta).' : 'Кликайте точки на карте (минимум 3).'} — {vertices}
              </div>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={uz ? 'Nomi (rus)' : 'Название'} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--ax-bg)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--ax-text)' }} />
              <input value={nameUz} onChange={(e) => setNameUz(e.target.value)} placeholder={uz ? 'Nomi (uz)' : 'Название (uz)'} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--ax-bg)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--ax-text)' }} />
              <div className="flex gap-2">
                <button onClick={undo} disabled={vertices === 0} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-sm disabled:opacity-40" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--ax-text)' }}><Undo2 className="w-4 h-4" /> {uz ? 'Orqaga' : 'Отмена точки'}</button>
                <button onClick={cancelDraw} className="flex items-center justify-center gap-1 py-2 px-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}><X className="w-4 h-4" /></button>
              </div>
              <button onClick={save} disabled={vertices < 3 || !name.trim() || saving} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium disabled:opacity-40" style={{ background: '#22C55E', color: '#fff' }}>
                <Check className="w-4 h-4" /> {uz ? 'Saqlash' : 'Сохранить'}
              </button>
            </div>
          )}
        </div>

        <div className="rounded-xl p-2" style={{ background: 'var(--ax-card)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="px-2 py-1 text-xs font-semibold" style={{ color: 'var(--ax-text-2)' }}>
            {uz ? 'Regionlar' : 'Регионы'} ({regions.length})
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {regions.length === 0 && <div className="px-3 py-4 text-sm text-center" style={{ color: 'var(--ax-text-2)' }}>{uz ? 'Hali regionlar yo‘q' : 'Регионов пока нет'}</div>}
            {regions.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-white/5">
                <button onClick={() => viewRegion(r)} className="flex items-center gap-2 flex-1 text-left text-sm">
                  <MapPin className="w-4 h-4" style={{ color: '#6D5DFB' }} />
                  <span>{uz && r.nameUz ? r.nameUz : r.name}</span>
                </button>
                <button onClick={() => viewRegion(r)} className="p-1.5 rounded" style={{ color: 'var(--ax-text-2)' }} title={uz ? 'Ko‘rish' : 'Показать'}><Eye className="w-4 h-4" /></button>
                <button onClick={() => del(r.id)} className="p-1.5 rounded" style={{ color: '#EF4444' }}><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: map */}
      <div className="flex-1 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)', minHeight: 520 }}>
        <div ref={containerRef} style={{ width: '100%', height: 560 }} />
      </div>
    </div>
  );
}
