import { useState, useEffect, useMemo } from 'react';
import {
  RotateCcw, Check, X, CreditCard, Download, Search, Package, Clock, Phone,
  Receipt, ChevronDown, ChevronUp, MessageSquareText, RefreshCw, Inbox,
} from 'lucide-react';
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
  orderCode?: string; // человекочитаемый номер заказа — как в панели заказов
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

const STATUS_BADGE: Record<string, { bg: string; color: string; border: string }> = {
  requested: { bg: 'rgba(245,158,11,0.14)', color: '#F59E0B', border: 'rgba(245,158,11,0.30)' },
  approved:  { bg: 'rgba(56,189,248,0.14)', color: '#38BDF8', border: 'rgba(56,189,248,0.30)' },
  rejected:  { bg: 'rgba(248,113,113,0.14)', color: '#F87171', border: 'rgba(248,113,113,0.30)' },
  refunded:  { bg: 'rgba(34,197,94,0.14)',  color: '#22C55E', border: 'rgba(34,197,94,0.30)' },
};

// Порядок жизненного цикла для шкалы прогресса заявки
const LIFECYCLE_STEPS: Array<'requested' | 'approved' | 'refunded'> = ['requested', 'approved', 'refunded'];

/**
 * Панель возвратов продавца: заявки покупателей на полный/частичный возврат.
 * Показывает номер исходного заказа (order_code — тот же, что в панели заказов),
 * шкалу жизненного цикла, состав возврата, фильтры, поиск и экспорт.
 * Backend: /api/returns.
 */
export default function CompanyReturnsPanel({ companyId }: CompanyReturnsPanelProps) {
  const [items, setItems] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [processingId, setProcessingId] = useState<number | null>(null);
  // Модал отклонения (вместо window.prompt): заявка + причина
  const [rejectTarget, setRejectTarget] = useState<ReturnRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const lang = useUiLang();
  const STATUS_LABEL = lang === 'uz' ? STATUS_LABEL_UZ : STATUS_LABEL_RU;
  const L = lang === 'uz' ? {
    title: 'Qaytarishlar', subtitle: 'Xaridorlarning qaytarish arizalari',
    loading: 'Yuklanmoqda...', empty: 'Qaytarish arizalari yoʻq',
    emptyHint: 'Xaridor buyurtmani qaytarishni soʻraganda ariza shu yerda paydo boʻladi',
    emptyFiltered: 'Filtr boʻyicha arizalar topilmadi',
    req: 'Ariza', order: 'Buyurtma', reason: 'Sababi', toRefund: 'Qaytariladi', sum: 'soʻm',
    approve: 'Tasdiqlash', reject: 'Rad etish', refunded: 'Pul qaytarildi', export: 'Excelga',
    all: 'Hammasi', searchPh: 'Telefon yoki buyurtma raqami...',
    itemsTitle: 'Qaytariladigan tovarlar', pcs: 'dona', showItems: 'Tovarlar', hideItems: 'Yashirish',
    statNew: 'Yangi arizalar', statWait: 'Pul qaytarish kutilmoqda', statSum: 'Qaytarilgan summa', statTotal: 'Jami arizalar',
    hReq: 'Ariza', hDate: 'Sana', hPhone: 'Telefon', hOrder: 'Buyurtma', hReason: 'Sababi', hItems: 'Tovarlar', hSum: 'Summa', hStatus: 'Holati', hComment: 'Izoh',
    rejectTitle: 'Arizani rad etish', rejectHint: 'Sabab xaridorga koʻrsatiladi (ixtiyoriy)',
    rejectPh: 'Rad etish sababi...', rejectConfirm: 'Rad etish', cancel: 'Bekor qilish',
    sellerComment: 'Sotuvchi izohi',
    stepRequested: 'Soʻraldi', stepApproved: 'Tasdiqlandi', stepRefunded: 'Pul qaytarildi',
  } : {
    title: 'Возвраты', subtitle: 'Заявки покупателей на возврат',
    loading: 'Загрузка...', empty: 'Заявок на возврат пока нет',
    emptyHint: 'Когда покупатель запросит возврат заказа, заявка появится здесь',
    emptyFiltered: 'По фильтру заявок не найдено',
    req: 'Заявка', order: 'Заказ', reason: 'Причина', toRefund: 'К возврату', sum: 'сум',
    approve: 'Одобрить', reject: 'Отклонить', refunded: 'Деньги возвращены', export: 'В Excel',
    all: 'Все', searchPh: 'Телефон или № заказа...',
    itemsTitle: 'Товары к возврату', pcs: 'шт', showItems: 'Товары', hideItems: 'Скрыть',
    statNew: 'Новые заявки', statWait: 'Ждут возврата денег', statSum: 'Возвращено денег', statTotal: 'Всего заявок',
    hReq: 'Заявка', hDate: 'Дата', hPhone: 'Телефон', hOrder: 'Заказ', hReason: 'Причина', hItems: 'Товары', hSum: 'Сумма', hStatus: 'Статус', hComment: 'Комментарий',
    rejectTitle: 'Отклонить заявку', rejectHint: 'Причина будет видна покупателю (необязательно)',
    rejectPh: 'Причина отклонения...', rejectConfirm: 'Отклонить', cancel: 'Отмена',
    sellerComment: 'Комментарий продавца',
    stepRequested: 'Запрошен', stepApproved: 'Одобрен', stepRefunded: 'Деньги возвращены',
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
    setProcessingId(id);
    try {
      await api.returns.updateStatus(id, status, comment);
      await load();
    } catch (e) {
      console.error('Update return status failed:', e);
    } finally {
      setProcessingId(null);
    }
  };

  const submitReject = async () => {
    if (!rejectTarget) return;
    const target = rejectTarget;
    setRejectTarget(null);
    await setStatus(target.id, 'rejected', rejectReason.trim() || undefined);
    setRejectReason('');
  };

  const toggleExpanded = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Номер заказа для отображения: человекочитаемый order_code (как в заказах),
  // fallback — внутренний id, если код по какой-то причине отсутствует.
  const orderLabel = (r: ReturnRequest): string | null => {
    if (r.orderCode) return `#${r.orderCode}`;
    if (r.orderId) return `#${r.orderId}`;
    return null;
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
        (r.orderCode || '').toLowerCase().includes(q) ||
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
        orderLabel(r) || '',
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

  // Шкала жизненного цикла заявки: запрошен → одобрен → деньги возвращены.
  // Для отклонённых показываем бейдж вместо шкалы.
  const renderLifecycle = (r: ReturnRequest) => {
    if (r.status === 'rejected') return null;
    const currentIdx = LIFECYCLE_STEPS.indexOf(r.status as typeof LIFECYCLE_STEPS[number]);
    const stepLabels = [L.stepRequested, L.stepApproved, L.stepRefunded];
    return (
      <div className="flex items-center gap-0 mt-3" aria-label="lifecycle">
        {LIFECYCLE_STEPS.map((step, i) => {
          const reached = i <= currentIdx;
          const color = reached ? (STATUS_BADGE[step]?.color || 'var(--ax-primary)') : 'var(--ax-text-3)';
          return (
            <div key={step} className="flex items-center" style={{ flex: i < LIFECYCLE_STEPS.length - 1 ? 1 : 'none' }}>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: reached ? (STATUS_BADGE[step]?.bg || 'var(--ax-primary-pale)') : 'var(--ax-input)',
                    border: `1.5px solid ${reached ? color : 'var(--ax-border)'}`,
                  }}
                >
                  {reached
                    ? <Check className="w-3 h-3" style={{ color }} />
                    : <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--ax-text-3)' }} />}
                </span>
                <span className="text-[11px] font-medium whitespace-nowrap" style={{ color: reached ? 'var(--ax-text)' : 'var(--ax-text-3)' }}>
                  {stepLabels[i]}
                </span>
              </div>
              {i < LIFECYCLE_STEPS.length - 1 && (
                <div
                  className="h-px mx-2 flex-1 min-w-[16px]"
                  style={{ background: i < currentIdx ? color : 'var(--ax-border)' }}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto" style={{ color: 'var(--ax-text)' }}>
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,158,11,0.14)' }}>
            <RotateCcw className="w-5 h-5" style={{ color: '#F59E0B' }} />
          </span>
          <div>
            <h2 className="text-lg font-bold leading-tight">{L.title}</h2>
            <p className="text-xs" style={{ color: 'var(--ax-text-2)' }}>{L.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {filtered.length > 0 && (
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium active:scale-95 transition-transform"
              style={{ background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.28)', color: '#22C55E' }}
            >
              <Download className="w-4 h-4" /> {L.export}
            </button>
          )}
          <button
            onClick={load}
            className="w-9 h-9 flex items-center justify-center rounded-lg active:scale-95 transition-transform"
            style={{ background: 'var(--ax-input)', border: '1px solid var(--ax-border)', color: 'var(--ax-text-2)' }}
            aria-label="refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 📊 Сводка */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {statCards.map(({ label, value, color, bg, icon: Icon }) => (
          <div
            key={label}
            className="relative rounded-xl p-3.5 flex items-center gap-3 overflow-hidden"
            style={{ background: 'var(--ax-card)', border: '1px solid var(--ax-border)' }}
          >
            <span className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: color }} />
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
                className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-medium whitespace-nowrap active:scale-95 transition-transform"
                style={active
                  ? { background: 'linear-gradient(135deg, #7C5CF0, #5B3DD4)', color: '#fff', border: '1px solid transparent' }
                  : { background: 'var(--ax-input)', color: 'var(--ax-text-2)', border: '1px solid var(--ax-border)' }}
              >
                {label}
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                  style={active ? { background: 'rgba(255,255,255,0.22)', color: '#fff' } : { background: 'var(--ax-primary-pale)', color: 'var(--ax-primary)' }}
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
            className="w-full h-9 pl-9 pr-3 rounded-lg text-sm outline-none"
            style={{ background: 'var(--ax-input)', border: '1px solid var(--ax-border)', color: 'var(--ax-text)' }}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16" style={{ color: 'var(--ax-text-2)' }}>
          <RefreshCw className="w-4 h-4 animate-spin" /> {L.loading}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl" style={{ color: 'var(--ax-text-2)', background: 'var(--ax-card)', border: '1px dashed var(--ax-border)' }}>
          <Inbox className="w-12 h-12 opacity-40" />
          <p className="font-medium">{items.length === 0 ? L.empty : L.emptyFiltered}</p>
          {items.length === 0 && <p className="text-xs" style={{ color: 'var(--ax-text-3)' }}>{L.emptyHint}</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const badge = STATUS_BADGE[r.status] || { bg: 'rgba(255,255,255,0.08)', color: 'var(--ax-text-2)', border: 'var(--ax-border)' };
            const returnItems = Array.isArray(r.items) ? r.items : [];
            const isOpen = expanded.has(r.id);
            const busy = processingId === r.id;
            const order = orderLabel(r);
            return (
              <div key={r.id} className="rounded-xl overflow-hidden" style={{ background: 'var(--ax-card)', border: '1px solid var(--ax-border)' }}>
                <div className="p-4">
                  {/* Шапка заявки: номер, исходный заказ, статус */}
                  <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{L.req} #{r.id}</span>
                      {order && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'var(--ax-primary-pale)', color: 'var(--ax-primary)', border: '1px solid var(--ax-border)' }}>
                          <Receipt className="w-3 h-3" /> {L.order} {order}
                        </span>
                      )}
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                      {STATUS_LABEL[r.status] || r.status}
                    </span>
                  </div>

                  {/* Клиент и дата */}
                  <div className="flex items-center gap-4 text-sm flex-wrap" style={{ color: 'var(--ax-text-2)' }}>
                    <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {r.customerPhone}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {r.createdAt ? new Date(r.createdAt).toLocaleString(lang === 'uz' ? 'uz-UZ' : 'ru-RU') : ''}</span>
                  </div>

                  {/* Жизненный цикл */}
                  {renderLifecycle(r)}

                  {/* Причина возврата от покупателя */}
                  {r.reason && (
                    <div className="mt-3 px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--ax-input)', border: '1px solid var(--ax-border)' }}>
                      <span className="font-medium" style={{ color: 'var(--ax-text-2)' }}>{L.reason}: </span>
                      {r.reason}
                    </div>
                  )}

                  {/* Комментарий продавца (например, причина отклонения) */}
                  {r.comment && (
                    <p className="flex items-center gap-1.5 text-sm mt-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(248,113,113,0.10)', color: '#F87171', border: '1px solid rgba(248,113,113,0.22)' }}>
                      <MessageSquareText className="w-3.5 h-3.5 flex-shrink-0" />
                      <span><span className="font-semibold">{L.sellerComment}:</span> {r.comment}</span>
                    </p>
                  )}

                  {/* 📦 Состав возврата */}
                  {returnItems.length > 0 && (
                    <div className="mt-3">
                      <button
                        onClick={() => toggleExpanded(r.id)}
                        className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg active:scale-95 transition-transform"
                        style={{ background: 'var(--ax-primary-pale)', border: '1px solid var(--ax-border)', color: 'var(--ax-primary)' }}
                      >
                        <Package className="w-3.5 h-3.5" />
                        {isOpen ? L.hideItems : `${L.showItems} · ${returnItems.length}`}
                        {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                      {isOpen && (
                        <div className="mt-2 rounded-lg p-3 space-y-1.5" style={{ background: 'var(--ax-input)', border: '1px solid var(--ax-border)' }}>
                          <p className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--ax-text-3)' }}>{L.itemsTitle}</p>
                          {returnItems.map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm gap-2">
                              <span className="flex-1 min-w-0 truncate" style={{ color: 'var(--ax-text)' }}>
                                {it.quantity || 1}× {it.name || '—'}
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

                  {/* Сумма + действия по жизненному циклу */}
                  <div className="flex items-center justify-between gap-3 mt-3.5 flex-wrap">
                    <p className="text-sm font-bold" style={{ color: '#22C55E' }}>
                      {L.toRefund}: {Number(r.refundAmount).toLocaleString('uz-UZ')} {L.sum}
                    </p>
                    {r.status === 'requested' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setStatus(r.id, 'approved')}
                          disabled={busy}
                          className="flex items-center gap-1 px-3.5 py-2 rounded-lg text-white text-sm font-semibold active:scale-95 transition-transform disabled:opacity-50"
                          style={{ background: 'linear-gradient(135deg, #38BDF8, #0284C7)' }}
                        >
                          <Check className="w-4 h-4" /> {L.approve}
                        </button>
                        <button
                          onClick={() => { setRejectTarget(r); setRejectReason(''); }}
                          disabled={busy}
                          className="flex items-center gap-1 px-3.5 py-2 rounded-lg text-sm font-semibold active:scale-95 transition-transform disabled:opacity-50"
                          style={{ background: 'rgba(248,113,113,0.12)', color: '#F87171', border: '1px solid rgba(248,113,113,0.30)' }}
                        >
                          <X className="w-4 h-4" /> {L.reject}
                        </button>
                      </div>
                    )}
                    {r.status === 'approved' && (
                      <button
                        onClick={() => setStatus(r.id, 'refunded')}
                        disabled={busy}
                        className="flex items-center gap-1 px-3.5 py-2 rounded-lg text-white text-sm font-semibold active:scale-95 transition-transform disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg, #22C55E, #16A34A)' }}
                      >
                        <CreditCard className="w-4 h-4" /> {L.refunded}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ❌ Модал отклонения заявки */}
      {rejectTarget && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={() => setRejectTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{ background: 'var(--ax-card)', border: '1px solid var(--ax-border)', boxShadow: '0 24px 60px rgba(0,0,0,0.45)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderBottom: '1px solid var(--ax-border)' }}>
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(248,113,113,0.12)' }}>
                  <X className="w-4 h-4" style={{ color: '#F87171' }} />
                </span>
                <div>
                  <p className="font-bold text-sm">{L.rejectTitle}</p>
                  <p className="text-xs" style={{ color: 'var(--ax-text-3)' }}>
                    {L.req} #{rejectTarget.id}{orderLabel(rejectTarget) ? ` · ${L.order} ${orderLabel(rejectTarget)}` : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRejectTarget(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg"
                style={{ background: 'var(--ax-input)', border: '1px solid var(--ax-border)', color: 'var(--ax-text-2)' }}
                aria-label="close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-xs mb-2" style={{ color: 'var(--ax-text-2)' }}>{L.rejectHint}</p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={L.rejectPh}
                rows={3}
                autoFocus
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
                style={{ background: 'var(--ax-input)', border: '1px solid var(--ax-border)', color: 'var(--ax-text)' }}
              />
              <div className="flex gap-2 mt-4">
                <button
                  onClick={submitReject}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-white text-sm font-semibold active:scale-95 transition-transform"
                  style={{ background: 'linear-gradient(135deg, #F87171, #DC2626)' }}
                >
                  <X className="w-4 h-4" /> {L.rejectConfirm}
                </button>
                <button
                  onClick={() => setRejectTarget(null)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold active:scale-95 transition-transform"
                  style={{ background: 'var(--ax-input)', border: '1px solid var(--ax-border)', color: 'var(--ax-text)' }}
                >
                  {L.cancel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
