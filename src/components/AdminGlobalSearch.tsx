import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Package, Store, User, ShoppingBag, Loader2 } from 'lucide-react';
import { moderation } from '../utils/api';

interface Results {
  products: any[];
  companies: any[];
  users: any[];
  orders: any[];
}

const EMPTY: Results = { products: [], companies: [], users: [], orders: [] };

// 🔍 Единый поиск по платформе для админа: товары, магазины, пользователи, заказы.
// Клик по результату переводит на соответствующую вкладку админки.
export default function AdminGlobalSearch({ onNavigate, lang = 'ru' }: { onNavigate: (tab: any) => void; lang?: 'ru' | 'uz' }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Results>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  const L = lang === 'uz'
    ? { ph: 'Qidiruv: tovar, doʻkon, mijoz, buyurtma…', products: 'Tovarlar', companies: 'Doʻkonlar', users: 'Mijozlar', orders: 'Buyurtmalar', empty: 'Hech narsa topilmadi', sum: 'soʻm' }
    : { ph: 'Поиск: товар, магазин, клиент, заказ…', products: 'Товары', companies: 'Магазины', users: 'Клиенты', orders: 'Заказы', empty: 'Ничего не найдено', sum: 'сум' };

  const run = useCallback((term: string) => {
    if (term.trim().length < 2) { setResults(EMPTY); setLoading(false); return; }
    setLoading(true);
    moderation.globalSearch(term.trim())
      .then((r: any) => setResults({ products: r?.products || [], companies: r?.companies || [], users: r?.users || [], orders: r?.orders || [] }))
      .catch(() => setResults(EMPTY))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => run(q), 300);
    return () => clearTimeout(debounce.current);
  }, [q, run]);

  // Закрытие по клику вне блока
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const go = (tab: string) => { onNavigate(tab); setOpen(false); setQ(''); };

  const total = results.products.length + results.companies.length + results.users.length + results.orders.length;
  const showPanel = open && q.trim().length >= 2;

  const row = 'flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 cursor-pointer text-left w-full';
  const groupTitle = 'px-3 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide';

  return (
    <div ref={boxRef} className="relative flex-1 max-w-md">
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={L.ph}
          className="w-full pl-9 pr-9 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:bg-white focus:border-purple-400 outline-none"
        />
        {loading && <Loader2 className="w-4 h-4 text-purple-500 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />}
      </div>

      {showPanel && (
        <div className="absolute left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 max-h-[70vh] overflow-y-auto z-50 pb-2">
          {!loading && total === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-400">{L.empty}</div>
          ) : (
            <>
              {results.companies.length > 0 && (
                <div>
                  <div className={groupTitle}>{L.companies}</div>
                  {results.companies.map((c) => (
                    <button key={`c${c.id}`} className={row} onClick={() => go('companies')}>
                      <Store className="w-4 h-4 text-purple-500 shrink-0" />
                      <span className="flex-1 min-w-0 truncate text-gray-800">{c.name}</span>
                      {c.status && <span className="text-xs text-gray-400">{c.status}</span>}
                    </button>
                  ))}
                </div>
              )}

              {results.products.length > 0 && (
                <div>
                  <div className={groupTitle}>{L.products}</div>
                  {results.products.map((p) => (
                    <button key={`p${p.id}`} className={row} onClick={() => go('companies')}>
                      <Package className="w-4 h-4 text-blue-500 shrink-0" />
                      <span className="flex-1 min-w-0 truncate text-gray-800">{p.name}</span>
                      <span className="text-xs text-gray-400 truncate max-w-[40%]">{p.company}</span>
                    </button>
                  ))}
                </div>
              )}

              {results.orders.length > 0 && (
                <div>
                  <div className={groupTitle}>{L.orders}</div>
                  {results.orders.map((o) => (
                    <button key={`o${o.id}`} className={row} onClick={() => go('history')}>
                      <ShoppingBag className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="flex-1 min-w-0 truncate text-gray-800">#{o.id} · {o.customerName || o.customerPhone}</span>
                      <span className="text-xs text-gray-500">{Number(o.total).toLocaleString('ru-RU')} {L.sum}</span>
                    </button>
                  ))}
                </div>
              )}

              {results.users.length > 0 && (
                <div>
                  <div className={groupTitle}>{L.users}</div>
                  {results.users.map((u) => (
                    <button key={`u${u.phone}`} className={row} onClick={() => go('overview')}>
                      <User className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="flex-1 min-w-0 truncate text-gray-800">{u.name || u.phone}</span>
                      <span className="text-xs text-gray-400">{u.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
