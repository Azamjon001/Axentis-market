import { useState, useEffect } from 'react';
import { Ticket, Plus, Trash2, Power } from 'lucide-react';
import api from '../utils/api';
import { useUiLang } from '../hooks/useUiLang';

interface PromoCode {
  id: number;
  code: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  maxDiscount?: number;
  usageLimit?: number;
  usedCount: number;
  perUserLimit: number;
  companyId?: number;
  isActive: boolean;
}

/**
 * Admin panel for platform-wide promo codes. Codes created here have no
 * company_id, so they apply across ALL shops. Backend: /api/promo-codes.
 */
export default function AdminPromoCodesPanel() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const lang = useUiLang();
  const L = lang === 'uz' ? {
    title: 'Promokodlar (barcha doʻkonlar uchun)', subtitle: 'Bu yerda yaratilgan promokodlar butun platformada amal qiladi.',
    create: 'Promokod yaratish', code: 'Kod', type: 'Chegirma turi', percent: 'Foiz (%)', fixed: 'Qatʼiy summa',
    value: 'Qiymati', minOrder: 'Min. buyurtma summasi', maxDisc: 'Maks. chegirma (% uchun)', noLimit2: 'cheklovsiz',
    usageLimit: 'Foydalanish limiti', noLimit: 'limitsiz', perUser: 'Har bir foydalanuvchiga', until: 'Amal qilish muddati (ixtiyoriy)',
    saving: 'Saqlanmoqda...', createBtn: 'Yaratish', all: 'Barcha promokodlar', loading: 'Yuklanmoqda...', none: 'Hozircha promokodlar yoʻq',
    active: 'faol', off: 'oʻchirilgan', platform: 'butun platforma', shop: 'doʻkon', used: 'ishlatilgan', times: 'marta', from: 'dan', sum: 'soʻm',
    enterCode: 'Promokod kodini kiriting', cantCreate: 'Promokod yaratib boʻlmadi', confirmDel: 'Promokodni oʻchirilsinmi?',
  } : {
    title: 'Промокоды (для всех магазинов)', subtitle: 'Промокоды, созданные здесь, действуют на всей платформе.',
    create: 'Создать промокод', code: 'Код', type: 'Тип скидки', percent: 'Процент (%)', fixed: 'Фикс. сумма',
    value: 'Значение', minOrder: 'Мин. сумма заказа', maxDisc: 'Макс. скидка (для %)', noLimit2: 'без ограничения',
    usageLimit: 'Лимит использований', noLimit: 'без лимита', perUser: 'На пользователя', until: 'Действует до (необязательно)',
    saving: 'Сохранение...', createBtn: 'Создать', all: 'Все промокоды', loading: 'Загрузка...', none: 'Промокодов пока нет',
    active: 'активен', off: 'выключен', platform: 'вся платформа', shop: 'магазин', used: 'использован', times: 'раз', from: 'от', sum: 'сум',
    enterCode: 'Введите код промокода', cantCreate: 'Не удалось создать промокод', confirmDel: 'Удалить промокод?',
  };
  const [form, setForm] = useState({
    code: '',
    discountType: 'percent' as 'percent' | 'fixed',
    discountValue: 10,
    minOrderAmount: 0,
    maxDiscount: '',
    usageLimit: '',
    perUserLimit: 1,
    expiresAt: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.promoCodes.listAll();
      setCodes(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Load promo codes failed:', e);
      setCodes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.code.trim()) { alert(L.enterCode); return; }
    setSaving(true);
    try {
      await api.promoCodes.create({
        companyId: null, // platform-wide: applies to all shops
        code: form.code.trim(),
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        minOrderAmount: Number(form.minOrderAmount) || 0,
        maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : null,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
        perUserLimit: Number(form.perUserLimit) || 1,
        expiresAt: form.expiresAt || null,
      });
      setForm({ ...form, code: '', maxDiscount: '', usageLimit: '' });
      await load();
    } catch (e: any) {
      alert(e?.message || L.cantCreate);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (c: PromoCode) => {
    try { await api.promoCodes.toggle(c.id, !c.isActive); await load(); } catch (e) { console.error(e); }
  };
  const handleDelete = async (id: number) => {
    if (!confirm(L.confirmDel)) return;
    try { await api.promoCodes.delete(id); await load(); } catch (e) { console.error(e); }
  };

  const input = 'w-full px-3 py-2 rounded-lg border border-gray-300 text-sm';

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Ticket className="w-6 h-6 text-purple-600" />
        <h2 className="text-lg font-bold">{L.title}</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">{L.subtitle}</p>

      <div className="bg-white rounded-2xl p-4 shadow-sm mb-6">
        <h3 className="font-semibold mb-3">{L.create}</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-gray-500">{L.code}</label>
            <input className={input} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SALE20" />
          </div>
          <div>
            <label className="text-xs text-gray-500">{L.type}</label>
            <select className={input} value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value as any })}>
              <option value="percent">{L.percent}</option>
              <option value="fixed">{L.fixed}</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">{L.value}</label>
            <input type="number" className={input} value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })} />
          </div>
          <div>
            <label className="text-xs text-gray-500">{L.minOrder}</label>
            <input type="number" className={input} value={form.minOrderAmount} onChange={(e) => setForm({ ...form, minOrderAmount: Number(e.target.value) })} />
          </div>
          <div>
            <label className="text-xs text-gray-500">{L.maxDisc}</label>
            <input type="number" className={input} value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })} placeholder={L.noLimit2} />
          </div>
          <div>
            <label className="text-xs text-gray-500">{L.usageLimit}</label>
            <input type="number" className={input} value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} placeholder={L.noLimit} />
          </div>
          <div>
            <label className="text-xs text-gray-500">{L.perUser}</label>
            <input type="number" className={input} value={form.perUserLimit} onChange={(e) => setForm({ ...form, perUserLimit: Number(e.target.value) })} />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500">{L.until}</label>
            <input type="date" className={input} value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          </div>
        </div>
        <button onClick={handleCreate} disabled={saving} className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white font-medium disabled:opacity-50 active:scale-95 transition-all">
          <Plus className="w-4 h-4" />
          {saving ? L.saving : L.createBtn}
        </button>
      </div>

      <h3 className="font-semibold mb-3">{L.all}</h3>
      {loading ? (
        <p className="text-gray-400">{L.loading}</p>
      ) : codes.length === 0 ? (
        <p className="text-gray-400">{L.none}</p>
      ) : (
        <div className="space-y-2">
          {codes.map((c) => (
            <div key={c.id} className="bg-white rounded-xl p-3 shadow-sm flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-purple-700">{c.code}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                    {c.isActive ? L.active : L.off}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.companyId ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                    {c.companyId ? `${L.shop} #${c.companyId}` : L.platform}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  {c.discountType === 'percent' ? `${c.discountValue}%` : `${c.discountValue} ${L.sum}`}
                  {c.minOrderAmount > 0 && ` · ${L.from} ${c.minOrderAmount} ${L.sum}`}
                  {` · ${L.used} ${c.usedCount}${c.usageLimit ? '/' + c.usageLimit : ''} ${L.times}`}
                </p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => handleToggle(c)} className="p-2 rounded-lg hover:bg-gray-100" title="Вкл/выкл">
                  <Power className={`w-4 h-4 ${c.isActive ? 'text-green-600' : 'text-gray-400'}`} />
                </button>
                <button onClick={() => handleDelete(c.id)} className="p-2 rounded-lg hover:bg-red-50" title="Удалить">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
