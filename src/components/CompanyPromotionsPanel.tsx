import { useState, useEffect, useCallback } from 'react';
import { Megaphone, Store, Package, Send, Clock, CheckCircle2, XCircle } from 'lucide-react';
import api, { promotions as promoApi } from '../utils/api';

// 📢 Заявка продавца на внутреннюю рекламу: продвинуть весь магазин или
// конкретный товар на N дней. Оплата — офлайн, статус подтверждает админ.
interface Props { companyId: number }

const fmt = (n: number) => (n || 0).toLocaleString('ru-RU');

const STATUS: Record<string, { label: string; cls: string; icon: any }> = {
  pending:   { label: 'На модерации', cls: 'text-amber-600 bg-amber-50', icon: Clock },
  active:    { label: 'Активна',      cls: 'text-emerald-600 bg-emerald-50', icon: CheckCircle2 },
  rejected:  { label: 'Отклонена',    cls: 'text-red-600 bg-red-50', icon: XCircle },
  expired:   { label: 'Завершена',    cls: 'text-gray-500 bg-gray-100', icon: Clock },
  cancelled: { label: 'Остановлена',  cls: 'text-gray-500 bg-gray-100', icon: XCircle },
};

export default function CompanyPromotionsPanel({ companyId }: Props) {
  const [scope, setScope] = useState<'company' | 'product'>('company');
  const [productId, setProductId] = useState<number | ''>('');
  const [days, setDays] = useState('1');
  const [note, setNote] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [list, setList] = useState<any[]>([]);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const items = await promoApi.listByCompany(companyId).catch(() => []);
      setList(Array.isArray(items) ? items : []);
    } catch { /* ignore */ }
  }, [companyId]);

  useEffect(() => {
    load();
    api.products.list({ companyId: String(companyId) }).then((p: any) => {
      const arr = Array.isArray(p) ? p : (p?.products || []);
      setProducts(arr);
    }).catch(() => {});
  }, [companyId, load]);

  const submit = async () => {
    if (scope === 'product' && !productId) { alert('Выберите товар'); return; }
    const d = parseInt(days, 10);
    if (isNaN(d) || d <= 0) { alert('Укажите число дней'); return; }
    setSending(true);
    try {
      await promoApi.request({
        companyId,
        scope,
        productId: scope === 'product' ? Number(productId) : undefined,
        days: d,
        note: note.trim() || undefined,
      });
      setNote(''); setProductId(''); setDays('1'); setScope('company');
      alert('Заявка отправлена! Администратор подтвердит оплату и запустит продвижение.');
      load();
    } catch (e: any) {
      alert('Ошибка: ' + (e.message || 'не удалось отправить'));
    } finally {
      setSending(false);
    }
  };

  const cardCls = 'bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl p-5">
        <div className="flex items-center gap-3 mb-1">
          <Megaphone className="w-7 h-7" />
          <h2 className="text-xl font-bold">Продвижение (внутренняя реклама)</h2>
        </div>
        <p className="text-purple-100 text-sm">
          Поднимите весь магазин или отдельный товар в начало витрины. Оплата
          согласовывается с администратором, продвижение запускается после подтверждения.
        </p>
      </div>

      {/* Форма заявки */}
      <div className={cardCls}>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={() => setScope('company')}
            className={`flex items-center justify-center gap-2 py-3 rounded-lg border-2 font-semibold transition-colors ${
              scope === 'company' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 dark:border-gray-600 text-gray-500'
            }`}
          >
            <Store className="w-4 h-4" /> Весь магазин
          </button>
          <button
            onClick={() => setScope('product')}
            className={`flex items-center justify-center gap-2 py-3 rounded-lg border-2 font-semibold transition-colors ${
              scope === 'product' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 dark:border-gray-600 text-gray-500'
            }`}
          >
            <Package className="w-4 h-4" /> Один товар
          </button>
        </div>

        {scope === 'product' && (
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value ? Number(e.target.value) : '')}
            className="w-full mb-3 px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <option value="">— выберите товар —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}

        <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Срок продвижения (дней)</label>
        <input
          type="number" min={1}
          value={days} onChange={(e) => setDays(e.target.value)}
          className="w-full mb-3 px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />

        <textarea
          value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Комментарий администратору (необязательно)"
          rows={2}
          className="w-full mb-4 px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
        />

        <button
          onClick={submit} disabled={sending}
          className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50"
        >
          <Send className="w-4 h-4" /> {sending ? 'Отправка...' : 'Отправить заявку'}
        </button>
      </div>

      {/* История заявок */}
      <div>
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3">Мои заявки</h3>
        {list.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">Заявок пока нет</div>
        ) : (
          <div className="space-y-2">
            {list.map((p) => {
              const st = STATUS[p.status] || STATUS.pending;
              const Icon = st.icon;
              return (
                <div key={p.id} className={`${cardCls} flex items-center justify-between`}>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                      {p.scope === 'product'
                        ? <><Package className="w-4 h-4 text-gray-400" />{p.productName || `Товар #${p.productId}`}</>
                        : <><Store className="w-4 h-4 text-gray-400" />Весь магазин</>}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {p.days} дн.{p.amount > 0 ? ` · ${fmt(p.amount)} сум` : ''}
                      {p.endsAt ? ` · до ${new Date(p.endsAt).toLocaleDateString('ru-RU')}` : ''}
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${st.cls}`}>
                    <Icon className="w-3.5 h-3.5" /> {st.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
