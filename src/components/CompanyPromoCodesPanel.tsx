import { useState, useEffect, useCallback } from 'react';
import { Ticket, Plus, Trash2, Percent, Coins, RefreshCw, Copy } from 'lucide-react';
import { promoCodes as api } from '../utils/api';
import { useUiLang } from '../hooks/useUiLang';

// 🎟️ Промокоды магазина: продавец создаёт код (процент или фиксированная
// сумма) с минимальной суммой заказа. Идеально для Telegram-канала: код →
// рост подписчиков и заказов.
export default function CompanyPromoCodesPanel({ companyId }: { companyId: number }) {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: '', discountType: 'percent' as 'percent' | 'fixed',
    discountValue: '', minOrderAmount: '', usageLimit: '', expiresAt: '',
  });
  const lang = useUiLang();

  const L = lang === 'uz' ? {
    title: 'Promokodlar', sub: 'Telegram-kanalingiz uchun: kod → obunachi va buyurtma oʻsadi',
    code: 'Kod (masalan SUMMER20)', type: 'Turi', percent: 'Foiz %', fixed: 'Summa soʻm',
    value: 'Qiymati', minOrder: 'Minimal buyurtma (soʻm)', limit: 'Nechta marta (ixtiyoriy)',
    expires: 'Amal qiladi (ixtiyoriy)', create: 'Yaratish', empty: 'Hali promokod yoʻq',
    off: 'chegirma', from: 'dan', delConfirm: 'Oʻchirilsinmi?', used: 'ishlatilgan', copied: 'Nusxalandi',
  } : {
    title: 'Промокоды', sub: 'Для вашего Telegram-канала: код → рост подписчиков и заказов',
    code: 'Код (например SUMMER20)', type: 'Тип', percent: 'Процент %', fixed: 'Сумма сум',
    value: 'Значение', minOrder: 'Мин. сумма заказа (сум)', limit: 'Лимит использований (необязательно)',
    expires: 'Действует до (необязательно)', create: 'Создать', empty: 'Промокодов пока нет',
    off: 'скидка', from: 'от', delConfirm: 'Удалить промокод?', used: 'использован', copied: 'Скопировано',
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listByCompany(companyId).catch(() => []);
      // показываем только коды этой компании (не платформенные)
      setList((Array.isArray(data) ? data : []).filter((p: any) => p.companyId === companyId || p.company_id === companyId));
    } finally { setLoading(false); }
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    const value = parseFloat(form.discountValue);
    if (!form.code.trim() || !value || value <= 0) return;
    if (form.discountType === 'percent' && value > 90) { alert('Максимум 90%'); return; }
    setSaving(true);
    try {
      await api.createForCompany(companyId, {
        code: form.code.trim().toUpperCase(),
        discountType: form.discountType,
        discountValue: value,
        minOrderAmount: parseFloat(form.minOrderAmount) || 0,
        usageLimit: form.usageLimit ? parseInt(form.usageLimit, 10) : null,
        expiresAt: form.expiresAt || null,
      });
      setForm({ code: '', discountType: 'percent', discountValue: '', minOrderAmount: '', usageLimit: '', expiresAt: '' });
      await load();
    } catch (e: any) {
      alert(e?.message || 'Ошибка');
    } finally { setSaving(false); }
  };

  const remove = async (id: number) => {
    if (!confirm(L.delConfirm)) return;
    await api.deleteForCompany(companyId, id).catch(() => {});
    setList((l) => l.filter((p) => p.id !== id));
  };

  const copy = (code: string) => { navigator.clipboard?.writeText(code).then(() => {}); };

  const inp = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm';
  const card = 'bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700';

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-5">
      <div className="flex items-center gap-2">
        <Ticket className="w-6 h-6 text-violet-500" />
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{L.title}</h2>
          <p className="text-xs text-gray-400">{L.sub}</p>
        </div>
      </div>

      {/* Создание */}
      <div className={`${card} p-4 space-y-3`}>
        <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder={L.code} className={inp} />
        <div className="grid grid-cols-2 gap-3">
          <select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value as any })} className={inp}>
            <option value="percent">{L.percent}</option>
            <option value="fixed">{L.fixed}</option>
          </select>
          <input type="number" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} placeholder={L.value} className={inp} />
        </div>
        <input type="number" value={form.minOrderAmount} onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })} placeholder={L.minOrder} className={inp} />
        <div className="grid grid-cols-2 gap-3">
          <input type="number" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} placeholder={L.limit} className={inp} />
          <input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className={inp} title={L.expires} />
        </div>
        <button onClick={submit} disabled={saving || !form.code.trim() || !form.discountValue} className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 disabled:opacity-60">
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
          <Ticket className="w-10 h-10 text-gray-300" /> {L.empty}
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((p) => {
            const isPct = (p.discountType || p.discount_type) === 'percent';
            const val = p.discountValue ?? p.discount_value;
            const minA = p.minOrderAmount ?? p.min_order_amount ?? 0;
            const used = p.usedCount ?? p.used_count ?? 0;
            return (
              <div key={p.id} className={`${card} p-3 flex items-center gap-3`}>
                <div className="w-10 h-10 rounded-lg bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                  {isPct ? <Percent className="w-5 h-5 text-violet-500" /> : <Coins className="w-5 h-5 text-violet-500" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-gray-900 dark:text-white">{p.code}</span>
                    <button onClick={() => copy(p.code)} title={L.copied} className="text-gray-400 hover:text-violet-500"><Copy className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="text-xs text-gray-500">
                    −{isPct ? `${val}%` : `${Number(val).toLocaleString('ru-RU')} сум`} {L.off}
                    {minA > 0 ? ` · ${L.from} ${Number(minA).toLocaleString('ru-RU')} сум` : ''}
                    {` · ${used} ${L.used}`}
                  </div>
                </div>
                <button onClick={() => remove(p.id)} className="p-2 text-gray-300 hover:text-red-500 shrink-0"><Trash2 className="w-4 h-4" /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
