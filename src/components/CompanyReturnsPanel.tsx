import { useState, useEffect, useMemo } from 'react';
import { RotateCcw, Check, X, CreditCard, Download, Search, Package, Clock, Phone, Receipt, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../utils/api';
import { useUiLang } from '../hooks/useUiLang';
import { downloadCSV } from '../utils/csv';

interface ReturnItem {
  name?: string;
  quantity?: number;
  price?: number;
  total?: number;
  color?: string;
  size?: string;
}

interface ReturnRequest {
  id: number;
  orderId?: number;
  customerPhone: string;
  reason: string;
  items?: ReturnItem[];
  refundAmount: number;
  status: 'requested' | 'approved' | 'rejected' | 'refunded';
  comment?: string;
  createdAt: string;
  resolvedAt?: string;
}

interface CompanyReturnsPanelProps {
  companyId: number;
}

type StatusFilter = 'all' | 'requested' | 'approved' | 'rejected' | 'refunded';

const STATUS_LABEL_RU: Record<string, string> = {
  requested: 'Запрошен', approved: 'Одобрен', rejected: 'Отклонён', refunded: 'Деньги возвращены',
};
const STATUS_LABEL_UZ: Record<string, string> = {
  requested: 'Soʻralgan', approved: 'Tasdiqlangan', rejected: 'Rad etilgan', refunded: 'Pul qaytarilgan',
};

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  requested: { bg: 'rgba(245,158,11,0.16)', color: '#F59E0B' },
  approved:  { bg: 'rgba(56,189,248,0.16)', color: '#38BDF8' },
  rejected:  { bg: 'rgba(248,113,113,0.16)', color: '#F87171' },
  refunded:  { bg: 'rgba(34,197,94,0.16)',  color: '#22C55E' },
};

/**
 * Панель возвратов продавца: заявки покупателей на полный/частичный возврат.
 * Показывает состав возврата (позиции), фильтры по статусу, поиск, сводку
 * и жизненный цикл заявки: запрошен → одобрен → деньги возвращены / отклонён.
 * Backend: /api/returns.
 */
export default function CompanyReturnsPanel({ companyId }: CompanyReturnsPanelProps) {
  const [items, setItems] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const lang = useUiLang();
  const STATUS_LABEL = lang === 'uz' ? STATUS_LABEL_UZ : STATUS_LABEL_RU;
  const L = lang === 'uz' ? {
    title: 'Qaytarishlar', loading: 'Yuklanmoqda...', empty: 'Qaytarish arizalari yoʻq',
    emptyFiltered: 'Filtr boʻyicha arizalar topilmadi',
    req: 'Ariza', order: 'Buyurtma', reason: 'Sababi', toRefund: 'Qaytariladi', sum: 'soʻm',
    approve: 'Tasdiqlash', reject: 'Rad etish', refunded: 'Pul qaytarildi', export: 'Excelga',
    all: 'Hammasi', searchPh: 'Telefon yoki buyurtma raqami...',
    itemsTitle: 'Qaytariladigan tovarlar', pcs: 'dona', showItems: 'Tovarlarni koʻrish', hideItems: 'Yashirish',
    statNew: 'Yangi arizalar', statWait: 'Pul qaytarish kutilmoqda', statSum: 'Qaytarilgan summa', statTotal: 'Jami arizalar',
    hReq: 'Ariza', hDate: 'Sana', hPhone: 'Telefon', hOrder: 'Buyurtma', hReason: 'Sababi', hItems: 'Tovarlar', hSum: 'Summa', hStatus: 'Holati', hComment: 'Izoh',
    rejectPrompt: 'Rad etish sababi (ixtiyoriy):',
  } : {
    title: 'Возвраты', loading: 'Загрузка...', empty: 'Заявок на возврат пока нет',
    emptyFiltered: 'По фильтру заявок не найдено',
    req: 'Заявка', order: 'Заказ', reason: 'Причина', toRefund: 'К возврату', sum: 'сум',
    approve: 'Одобрить', reject: 'Отклонить', refunded: 'Деньги возвращены', export: 'В Excel',
    all: 'Все', searchPh: 'Телефон или № заказа...',
    itemsTitle: 'Товары к возврату', pcs: 'шт', showItems: 'Показать товары', hideItems: 'Скрыть',
    statNew: 'Новые заявки', statWait: 'Ждут возврата денег', statSum: 'Возвращено денег', statTotal: 'Всего заявок',
    hReq: 'Заявка', hDate: 'Дата', hPhone: 'Телефон', hOrder: 'Заказ', hReason: 'Причина', hItems: 'Товары', hSum: 'Сумма', hStatus: 'Статус', hComment: 'Комментарий',
    rejectPrompt: 'Причина отклонения (необязательно):',
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.returns.listByCompany(companyId);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Load returns failed:', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const setStatus = async (id: number, status: string, comment?: string) => {
    try {
      await api.returns.updateStatus(id, status, comment);
      await load();
    } catch (e) {
      console.error('Update return status failed:', e);
    }
  };

  // При отклонении спрашиваем причину — она сохраняется как comment и видна покупателю
  const handleReject = (id: number) => {
    const reason = window.prompt(L.rejectPrompt);
    if (reason === null) return; // отменили
    setStatus(id, 'rejected', reason || undefined);
  };

  const toggleExpanded = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // 📊 Сводка по всем заявкам (не зависит от фильтров)
  const stats = useMemo(() => ({
    requested: items.filter(r => r.status === 'requested').length,
    approved: items.filter(r => r.status === 'approved').length,
    refundedSum: items.filter(r => r.status === 'refunded').reduce((s, r) => s + (Number(r.refundAmount) || 0), 0),
    total: items.length,
  }), [items]);

  const filtered = useMemo(() => {
    let list = items;
    if (statusFilter !== 'all') list = list.filter(r => r.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(r =>
        (r.customerPhone || '').toLowerCase().includes(q) ||
        String(r.orderId || '').includes(q) ||
        String(r.id).includes(q)
      );
    }
    return list;
  }, [items, statusFilter, search]);

  // 📄 Экспорт возвратов в CSV (для Excel) — по текущему фильтру
  const exportCSV = () => {
    const rows: (string | number)[][] = [[L.hReq, L.hDate, L.hPhone, L.hOrder, L.hReason, L.hItems, L.hSum, L.hStatus, L.hComment]];
    for (const r of filtered) {
      rows.push([
        `#${r.id}`,
        r.createdAt ? new Date(r.createdAt).toLocaleString('ru-RU') : '',
        r.customerPhone || '',
        r.orderId ? `#${r.orderId}` : '',
        r.reason || '',
        (r.items || []).map(it => `${it.quantity || 1}x ${it.name || ''}`).join('; '),
        Number(r.refundAmount) || 0,
        STATUS_LABEL[r.status] || r.status,
        r.comment || '',
      ]);
    }
    downloadCSV('returns', rows);
  };

  const filterTabs: Array<{ key: StatusFilter; label: string; count: number }> = [
    { key: 'all', label: L.all, count: items.length },
    { key: 'requested', label: STATUS_LABEL.requested, count: stats.requested },
    { key: 'approved', label: STATUS_LABEL.approved, count: stats.approved },
    { key: 'refunded', label: STATUS_LABEL.refunded, count: items.filter(r => r.status === 'refunded').length },
    { key: 'rejected', label: STATUS_LABEL.rejected, count: items.filter(r => r.status === 'rejected').length },
  ];

  const statCards = [
    { label: L.statNew, value: String(stats.requested), color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', icon: Clock },
    { label: L.statWait, value: String(stats.approved), color: '#38BDF8', bg: 'rgba(56,189,248,0.12)', icon: CreditCard },
    { label: L.statSum, value: `${stats.refundedSum.toLocaleString('uz-UZ')} ${L.sum}`, color: '#22C55E', bg: 'rgba(34,197,94,0.12)', icon: Check },
    { label: L.statTotal, value: String(stats.total), color: '#7C5CF0', bg: 'rgba(124,92,240,0.12)', icon: RotateCcw },
  ];

  return (
    <div className="max-w-4xl mx-auto" style={{ color: 'var(--ax-text)' }}>
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <RotateCcw className="w-6 h-6" style={{ color: '#F59E0B' }} />
          <h2 className="text-lg font-bold">{L.title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {filtered.length > 0 && (
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium active:scale-95"
              style={{ background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.28)', color: '#22C55E' }}
            >
              <Download className="w-4 h-4" /> {L.export}
            </button>
          )}
          <button
            onClick={load}
            className="w-9 h-9 flex items-center justify-center rounded-lg active:scale-95"
            style={{ background: 'var(--ax-input)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--ax-text-2)' }}
            aria-label="refresh"
          >
            <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 📊 Сводка */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {statCards.map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} className="rounded-xl p-3.5 flex items-center gap-3" style={{ background: 'var(--ax-card)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs truncate" style={{ color: 'var(--ax-text-2)' }}>{label}</p>
              <p className="text-base font-bold truncate" style={{ color }}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 🔍 Фильтры и поиск */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="flex gap-1.5 overflow-x-auto pb-1 flex-1">
          {filterTabs.map(({ key, label, count }) => {
            const active = statusFilter === key;
            return (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-medium whitespace-nowrap active:scale-95"
                style={active
                  ? { background: 'linear-gradient(135deg, #7C5CF0, #5B3DD4)', color: '#fff', border: '1px solid transparent' }
                  : { background: 'var(--ax-input)', color: 'var(--ax-text-2)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                {label}
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                  style={active ? { background: 'rgba(255,255,255,0.22)', color: '#fff' } : { background: 'rgba(124,92,240,0.16)', color: '#7C5CF0' }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="relative sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ax-text-2)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={L.searchPh}
            className="w-full h-9 pl-9 pr-3 rounded-lg text-sm"
            style={{ background: 'var(--ax-input)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--ax-text)' }}
          />
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--ax-text-2)' }}>{L.loading}</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: 'var(--ax-text-2)' }}>
          <RotateCcw className="w-12 h-12 opacity-40" />
          <p>{items.length === 0 ? L.empty : L.emptyFiltered}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const badge = STATUS_BADGE[r.status] || { bg: 'rgba(255,255,255,0.08)', color: 'var(--ax-text-2)' };
            const returnItems = Array.isArray(r.items) ? r.items : [];
            const isOpen = expanded.has(r.id);
            return (
              <div key={r.id} className="rounded-xl overflow-hidden" style={{ background: 'var(--ax-card)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="p-4">
                  {/* Шапка заявки */}
                  <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{L.req} #{r.id}</span>
                      {r.orderId && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(124,92,240,0.14)', color: '#7C5CF0' }}>
                          <Receipt className="w-3 h-3" /> {L.order} #{r.orderId}
                        </span>
                      )}
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: badge.bg, color: badge.color }}>
                      {STATUS_LABEL[r.status] || r.status}
                    </span>
                  </div>

                  {/* Клиент и дата */}
                  <div className="flex items-center gap-4 text-sm flex-wrap" style={{ color: 'var(--ax-text-2)' }}>
                    <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {r.customerPhone}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {r.createdAt ? new Date(r.createdAt).toLocaleString(lang === 'uz' ? 'uz-UZ' : 'ru-RU') : ''}</span>
                  </div>

                  {r.reason && <p className="text-sm mt-2" style={{ color: 'var(--ax-text)' }}>{L.reason}: {r.reason}</p>}
                  {r.comment && (
                    <p className="text-sm mt-1.5 px-2.5 py-1.5 rounded-lg inline-block" style={{ background: 'rgba(248,113,113,0.10)', color: '#F87171' }}>
                      💬 {r.comment}
                    </p>
                  )}

                  {/* 📦 Состав возврата */}
                  {returnItems.length > 0 && (
                    <div className="mt-3">
                      <button
                        onClick={() => toggleExpanded(r.id)}
                        className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg active:scale-95"
                        style={{ background: 'rgba(124,92,240,0.10)', border: '1px solid rgba(124,92,240,0.25)', color: '#7C5CF0' }}
                      >
                        <Package className="w-3.5 h-3.5" />
                        {isOpen ? L.hideItems : `${L.showItems} (${returnItems.length})`}
                        {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                      {isOpen && (
                        <div className="mt-2 rounded-lg p-3 space-y-1.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--ax-text-2)' }}>{L.itemsTitle}:</p>
                          {returnItems.map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm gap-2">
                              <span className="flex-1 min-w-0 truncate" style={{ color: 'var(--ax-text)' }}>
                                {it.quantity || 1}x {it.name || '—'}
                                {[it.color && it.color !== 'Любой' ? it.color : '', it.size || ''].filter(Boolean).length > 0
                                  ? ` (${[it.color && it.color !== 'Любой' ? it.color : '', it.size || ''].filter(Boolean).join(', ')})`
                                  : ''}
                              </span>
                              <span className="font-medium flex-shrink-0" style={{ color: 'var(--ax-text-2)' }}>
                                {Number(it.total ?? ((it.price || 0) * (it.quantity || 1))).toLocaleString('uz-UZ')} {L.sum}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-sm font-semibold mt-2.5" style={{ color: '#22C55E' }}>
                    {L.toRefund}: {Number(r.refundAmount).toLocaleString('uz-UZ')} {L.sum}
                  </p>

                  {/* Действия по жизненному циклу */}
                  {r.status === 'requested' && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => setStatus(r.id, 'approved')}
                        className="flex items-center gap-1 px-3 py-2 rounded-lg text-white text-sm font-medium active:scale-95"
                        style={{ background: 'linear-gradient(135deg, #38BDF8, #0284C7)' }}
                      >
                        <Check className="w-4 h-4" /> {L.approve}
                      </button>
                      <button
                        onClick={() => handleReject(r.id)}
                        className="flex items-center gap-1 px-3 py-2 rounded-lg text-white text-sm font-medium active:scale-95"
                        style={{ background: 'linear-gradient(135deg, #F87171, #DC2626)' }}
                      >
                        <X className="w-4 h-4" /> {L.reject}
                      </button>
                    </div>
                  )}
                  {r.status === 'approved' && (
                    <button
                      onClick={() => setStatus(r.id, 'refunded')}
                      className="flex items-center gap-1 px-3 py-2 mt-3 rounded-lg text-white text-sm font-medium active:scale-95"
                      style={{ background: 'linear-gradient(135deg, #22C55E, #16A34A)' }}
                    >
                      <CreditCard className="w-4 h-4" /> {L.refunded}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
