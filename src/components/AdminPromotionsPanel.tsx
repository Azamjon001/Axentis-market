import { useState, useEffect, useCallback } from 'react';
import { Megaphone, Check, X, Clock, Store, Package, DollarSign, RefreshCw } from 'lucide-react';
import { promotions as promoApi } from '../utils/api';

// 📢 Модерация внутренней рекламы: очередь заявок продавцов, одобрение с суммой
// оплаты и сроком, доход платформы, активные размещения.
interface Promo {
  id: number;
  companyId: number;
  companyName: string;
  scope: 'company' | 'product';
  productId?: number;
  productName?: string;
  days: number;
  amount: number;
  status: string;
  startsAt?: string;
  endsAt?: string;
  active?: boolean;
  note?: string;
  createdAt: string;
}

const fmt = (n: number) => (n || 0).toLocaleString('ru-RU');

export default function AdminPromotionsPanel() {
  const [pending, setPending] = useState<Promo[]>([]);
  const [active, setActive] = useState<Promo[]>([]);
  const [revenue, setRevenue] = useState<{ totalRevenue: number; activeRevenue: number; activeCount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [amounts, setAmounts] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, a, r] = await Promise.all([
        promoApi.listAll('pending').catch(() => []),
        promoApi.listAll('active').catch(() => []),
        promoApi.revenue().catch(() => null),
      ]);
      setPending(Array.isArray(p) ? p : []);
      setActive(Array.isArray(a) ? a : []);
      setRevenue(r);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const approve = async (promo: Promo) => {
    const amount = parseFloat((amounts[promo.id] || '0').replace(',', '.'));
    if (isNaN(amount) || amount < 0) { alert('Введите сумму оплаты'); return; }
    await promoApi.approve(promo.id, amount);
    load();
  };
  const reject = async (id: number) => { await promoApi.reject(id); load(); };
  const cancel = async (id: number) => { if (confirm('Остановить продвижение досрочно?')) { await promoApi.cancel(id); load(); } };

  const scopeLabel = (p: Promo) =>
    p.scope === 'product'
      ? <span className="inline-flex items-center gap-1"><Package className="w-3.5 h-3.5" />{p.productName || `Товар #${p.productId}`}</span>
      : <span className="inline-flex items-center gap-1"><Store className="w-3.5 h-3.5" />Весь магазин</span>;

  const card = 'bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4';

  return (
    <div className="space-y-6">
      {/* Доход */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={card}>
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1"><DollarSign className="w-4 h-4" />Всего собрано</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{fmt(revenue?.totalRevenue || 0)} сум</div>
        </div>
        <div className={card}>
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1"><Megaphone className="w-4 h-4" />Активная реклама</div>
          <div className="text-2xl font-bold text-emerald-600">{fmt(revenue?.activeRevenue || 0)} сум</div>
        </div>
        <div className={card}>
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1"><Clock className="w-4 h-4" />Активных размещений</div>
          <div className="text-2xl font-bold text-purple-600">{revenue?.activeCount || 0}</div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-500" /> Заявки на модерации ({pending.length})
        </h3>
        <button onClick={load} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {pending.length === 0 ? (
        <div className="text-center py-10 text-gray-400">Нет новых заявок</div>
      ) : (
        <div className="space-y-3">
          {pending.map((p) => (
            <div key={p.id} className={card}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">{p.companyName}</div>
                  <div className="text-sm text-gray-500 flex items-center gap-3 mt-1">
                    {scopeLabel(p)}
                    <span>· {p.days} дн.</span>
                  </div>
                  {p.note && <div className="text-xs text-gray-400 mt-1">💬 {p.note}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Сумма, сум"
                    value={amounts[p.id] || ''}
                    onChange={(e) => setAmounts({ ...amounts, [p.id]: e.target.value })}
                    className="w-32 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                  />
                  <button onClick={() => approve(p)} className="flex items-center gap-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700">
                    <Check className="w-4 h-4" /> Одобрить
                  </button>
                  <button onClick={() => reject(p.id)} className="flex items-center gap-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-100">
                    <X className="w-4 h-4" /> Отклонить
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 pt-2">
        <Megaphone className="w-5 h-5 text-emerald-500" /> Активные размещения ({active.length})
      </h3>
      {active.length === 0 ? (
        <div className="text-center py-6 text-gray-400">Нет активных размещений</div>
      ) : (
        <div className="space-y-3">
          {active.map((p) => (
            <div key={p.id} className={card}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">{p.companyName}</div>
                  <div className="text-sm text-gray-500 flex items-center gap-3 mt-1">
                    {scopeLabel(p)}
                    <span>· {fmt(p.amount)} сум</span>
                    {p.endsAt && <span>· до {new Date(p.endsAt).toLocaleDateString('ru-RU')}</span>}
                  </div>
                </div>
                <button onClick={() => cancel(p.id)} className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-100">
                  Остановить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
