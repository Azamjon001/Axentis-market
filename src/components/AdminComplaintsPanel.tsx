import { useState, useEffect, useCallback } from 'react';
import { Flag, Check, X, Package, Store, RefreshCw, Phone } from 'lucide-react';
import { complaints as api } from '../utils/api';

// 🚩 Очередь жалоб покупателей: разобрать (решено / отклонено) с заметкой.
export default function AdminComplaintsPanel() {
  const [tab, setTab] = useState<'open' | 'resolved' | 'dismissed'>('open');
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try { setList(await api.list(tab).catch(() => [])); } finally { setLoading(false); }
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  const resolve = async (id: number, status: 'resolved' | 'dismissed') => {
    await api.resolve(id, status, notes[id]);
    load();
  };

  const card = 'bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['open', 'resolved', 'dismissed'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === t ? 'bg-[#7C5CF0] text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
              {t === 'open' ? 'Открытые' : t === 'resolved' ? 'Решённые' : 'Отклонённые'}
            </button>
          ))}
        </div>
        <button onClick={load} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-12 text-gray-400 flex flex-col items-center gap-2">
          <Flag className="w-10 h-10 text-gray-300" />
          {tab === 'open' ? 'Нет открытых жалоб 🎉' : 'Пусто'}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((c) => (
            <div key={c.id} className={card}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                    {c.targetType === 'product'
                      ? <><Package className="w-4 h-4 text-gray-400" />{c.productName || `Товар #${c.targetId}`}</>
                      : <><Store className="w-4 h-4 text-gray-400" />{c.companyName || `Магазин #${c.targetId}`}</>}
                  </div>
                  <div className="mt-1 inline-block px-2 py-0.5 rounded bg-red-50 text-red-600 text-xs font-medium">{c.reason}</div>
                  {c.message && <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">{c.message}</p>}
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    {c.customerPhone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.customerPhone}</span>}
                    <span>{new Date(c.createdAt).toLocaleString('ru-RU')}</span>
                    {c.companyName && <span>· {c.companyName}</span>}
                  </div>
                  {c.adminNote && <div className="text-xs text-gray-500 mt-1">📝 {c.adminNote}</div>}
                </div>
              </div>

              {tab === 'open' && (
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <input
                    value={notes[c.id] || ''}
                    onChange={(e) => setNotes({ ...notes, [c.id]: e.target.value })}
                    placeholder="Заметка (необязательно)"
                    className="flex-1 min-w-[160px] px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                  />
                  <button onClick={() => resolve(c.id, 'resolved')} className="flex items-center gap-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700">
                    <Check className="w-4 h-4" /> Решено
                  </button>
                  <button onClick={() => resolve(c.id, 'dismissed')} className="flex items-center gap-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm font-semibold">
                    <X className="w-4 h-4" /> Отклонить
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
