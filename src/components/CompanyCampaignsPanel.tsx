import { useState, useEffect, useCallback } from 'react';
import { Sparkles, Plus, Trash2, RefreshCw, Clock } from 'lucide-react';
import apiDefault, { companies as api } from '../utils/api';
import { useUiLang } from '../hooks/useUiLang';

// 🎉 Именованные скидочные кампании: «Летняя распродажа −20%» на весь магазин,
// категорию или бренд на период. Порождает реальные скидки на подходящие товары
// и показывается отдельным рядом на главной.
export default function CompanyCampaignsPanel({ companyId, products = [] }: { companyId: number; products?: any[] }) {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', emoji: '🎉', discountPercent: '',
    scope: 'shop' as 'shop' | 'category' | 'brand', scopeValue: '', endsAt: '',
  });
  const lang = useUiLang();

  // Товары нужны для списков категорий/брендов охвата. Если проп пуст — грузим сами.
  const [prods, setProds] = useState<any[]>(products);
  useEffect(() => {
    if (products.length > 0) { setProds(products); return; }
    apiDefault.products.list({ companyId: String(companyId) })
      .then((r: any) => setProds(Array.isArray(r) ? r : (r?.products || [])))
      .catch(() => {});
  }, [companyId, products]);
  const categories = Array.from(new Set(prods.map((p) => p.category).filter(Boolean)));
  const brands = Array.from(new Set(prods.map((p) => p.brand).filter(Boolean)));

  const L = lang === 'uz' ? {
    title: 'Aksiyalar', sub: 'Nomlangan chegirmalar: «Yozgi savdo −20%» butun doʻkon/kategoriya/brendga',
    name: 'Aksiya nomi (masalan Yozgi savdo)', emoji: 'Belgi', pct: 'Chegirma %', scope: 'Qamrov',
    shop: 'Butun doʻkon', category: 'Kategoriya', brand: 'Brend', until: 'Tugash sanasi',
    create: 'Yaratish', empty: 'Aksiyalar yoʻq', active: 'Faol', ended: 'Tugagan', del: 'Oʻchirilsinmi?',
  } : {
    title: 'Кампании', sub: 'Именованные скидки: «Летняя распродажа −20%» на весь магазин/категорию/бренд',
    name: 'Название акции (например Летняя распродажа)', emoji: 'Значок', pct: 'Скидка %', scope: 'Охват',
    shop: 'Весь магазин', category: 'Категория', brand: 'Бренд', until: 'Действует до',
    create: 'Создать', empty: 'Кампаний пока нет', active: 'Активна', ended: 'Завершена', del: 'Удалить кампанию?',
  };

  const load = useCallback(async () => {
    setLoading(true);
    try { setList(await api.listCampaigns(companyId).catch(() => [])); }
    finally { setLoading(false); }
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    const pct = parseFloat(form.discountPercent);
    if (!form.name.trim() || !pct || pct <= 0 || pct > 90 || !form.endsAt) return;
    if (form.scope !== 'shop' && !form.scopeValue) { alert(lang === 'uz' ? 'Kategoriya/brend tanlang' : 'Выберите категорию/бренд'); return; }
    setSaving(true);
    try {
      const r = await api.createCampaign(companyId, {
        name: form.name.trim(), emoji: form.emoji || '🎉', discountPercent: pct,
        scope: form.scope, scopeValue: form.scope === 'shop' ? '' : form.scopeValue,
        endsAt: new Date(form.endsAt).toISOString(),
      });
      setForm({ name: '', emoji: '🎉', discountPercent: '', scope: 'shop', scopeValue: '', endsAt: '' });
      await load();
      alert(lang === 'uz'
        ? `Aksiya yaratildi. ${r?.productsDiscounted ?? 0} tovarga chegirma qoʻyildi.`
        : `Кампания создана. Скидка проставлена на ${r?.productsDiscounted ?? 0} товаров.`);
    } catch (e: any) {
      alert(e?.message || 'Ошибка');
    } finally { setSaving(false); }
  };

  const remove = async (id: number) => {
    if (!confirm(L.del)) return;
    await api.deleteCampaign(companyId, id).catch(() => {});
    setList((l) => l.filter((c) => c.id !== id));
  };

  const inp = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm';
  const card = 'bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700';
  const EMOJIS = ['🎉', '🌞', '❄️', '🔥', '🎁', '⚡', '🌸', '🏷️'];

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-5">
      <div className="flex items-center gap-2">
        <Sparkles className="w-6 h-6 text-pink-500" />
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{L.title}</h2>
          <p className="text-xs text-gray-400">{L.sub}</p>
        </div>
      </div>

      {/* Создание */}
      <div className={`${card} p-4 space-y-3`}>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={L.name} className={inp} />
        <div className="flex flex-wrap gap-1.5">
          {EMOJIS.map((e) => (
            <button key={e} onClick={() => setForm({ ...form, emoji: e })}
              className={`w-9 h-9 rounded-lg text-lg ${form.emoji === e ? 'bg-pink-100 dark:bg-pink-900/40 ring-2 ring-pink-400' : 'bg-gray-100 dark:bg-gray-700'}`}>
              {e}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input type="number" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} placeholder={L.pct} className={inp} />
          <input type="date" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} title={L.until} className={inp} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value as any, scopeValue: '' })} className={inp}>
            <option value="shop">{L.shop}</option>
            <option value="category">{L.category}</option>
            <option value="brand">{L.brand}</option>
          </select>
          {form.scope !== 'shop' && (
            <select value={form.scopeValue} onChange={(e) => setForm({ ...form, scopeValue: e.target.value })} className={inp}>
              <option value="">—</option>
              {(form.scope === 'category' ? categories : brands).map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
        </div>
        <button onClick={submit} disabled={saving || !form.name.trim() || !form.discountPercent || !form.endsAt}
          className="flex items-center gap-1.5 px-4 py-2 bg-pink-600 text-white rounded-lg text-sm font-semibold hover:bg-pink-700 disabled:opacity-60">
          <Plus className="w-4 h-4" /> {L.create}
        </button>
      </div>

      {/* Список */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-500">{list.length}</span>
        <button onClick={load} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>
      {list.length === 0 ? (
        <div className="text-center py-10 text-gray-400 flex flex-col items-center gap-2">
          <Sparkles className="w-10 h-10 text-gray-300" /> {L.empty}
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((c) => (
            <div key={c.id} className={`${card} p-3 flex items-center gap-3`}>
              <div className="text-2xl">{c.emoji || '🎉'}</div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-gray-900 dark:text-white truncate">{c.name} · −{c.discountPercent}%</div>
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {c.active ? L.active : L.ended}
                  {c.scope !== 'shop' && c.scopeValue ? ` · ${c.scopeValue}` : ` · ${L.shop}`}
                </div>
              </div>
              <button onClick={() => remove(c.id)} className="p-2 text-gray-300 hover:text-red-500 shrink-0"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
