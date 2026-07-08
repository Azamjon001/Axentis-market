import { useState, useEffect } from 'react';
import { RotateCcw, Check, X, CreditCard, Download } from 'lucide-react';
import api from '../utils/api';
import { useUiLang } from '../hooks/useUiLang';
import { downloadCSV } from '../utils/csv';

interface ReturnRequest {
  id: number;
  orderId?: number;
  customerPhone: string;
  reason: string;
  refundAmount: number;
  status: 'requested' | 'approved' | 'rejected' | 'refunded';
  comment?: string;
  createdAt: string;
}

interface CompanyReturnsPanelProps {
  companyId: number;
}

const STATUS_LABEL_RU: Record<string, string> = {
  requested: 'Запрошен', approved: 'Одобрен', rejected: 'Отклонён', refunded: 'Возвращены деньги',
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
 * Seller panel for handling customer return / refund requests.
 * Backend: /api/returns.
 */
export default function CompanyReturnsPanel({ companyId }: CompanyReturnsPanelProps) {
  const [items, setItems] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const lang = useUiLang();
  const STATUS_LABEL = lang === 'uz' ? STATUS_LABEL_UZ : STATUS_LABEL_RU;
  const L = lang === 'uz' ? {
    title: 'Qaytarishlar', loading: 'Yuklanmoqda...', empty: 'Hozircha qaytarish arizalari yoʻq',
    req: 'Ariza', order: 'Buyurtma', reason: 'Sababi', toRefund: 'Qaytariladi', sum: 'soʻm',
    approve: 'Tasdiqlash', reject: 'Rad etish', refunded: 'Pul qaytarildi', export: 'Excelga',
    hReq: 'Ariza', hDate: 'Sana', hPhone: 'Telefon', hOrder: 'Buyurtma', hReason: 'Sababi', hSum: 'Summa', hStatus: 'Holati', hComment: 'Izoh',
  } : {
    title: 'Возвраты', loading: 'Загрузка...', empty: 'Заявок на возврат пока нет',
    req: 'Заявка', order: 'Заказ', reason: 'Причина', toRefund: 'К возврату', sum: 'сум',
    approve: 'Одобрить', reject: 'Отклонить', refunded: 'Деньги возвращены', export: 'В Excel',
    hReq: 'Заявка', hDate: 'Дата', hPhone: 'Телефон', hOrder: 'Заказ', hReason: 'Причина', hSum: 'Сумма', hStatus: 'Статус', hComment: 'Комментарий',
  };

  // 📄 Экспорт возвратов в CSV (для Excel)
  const exportCSV = () => {
    const rows: (string | number)[][] = [[L.hReq, L.hDate, L.hPhone, L.hOrder, L.hReason, L.hSum, L.hStatus, L.hComment]];
    for (const r of items) {
      rows.push([
        `#${r.id}`,
        r.createdAt ? new Date(r.createdAt).toLocaleString('ru-RU') : '',
        r.customerPhone || '',
        r.orderId ? `#${r.orderId}` : '',
        r.reason || '',
        Number(r.refundAmount) || 0,
        STATUS_LABEL[r.status] || r.status,
        r.comment || '',
      ]);
    }
    downloadCSV('returns', rows);
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
    const reason = window.prompt(
      lang === 'uz' ? 'Rad etish sababi (ixtiyoriy):' : 'Причина отклонения (необязательно):'
    );
    if (reason === null) return; // отменили
    setStatus(id, 'rejected', reason || undefined);
  };

  return (
    <div className="max-w-3xl mx-auto" style={{ color: 'var(--ax-text)' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <RotateCcw className="w-6 h-6" style={{ color: '#F59E0B' }} />
          <h2 className="text-lg font-bold">{L.title}</h2>
          {!loading && items.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(124,92,240,0.16)', color: '#7C5CF0' }}>
              {items.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
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

      {loading ? (
        <p style={{ color: 'var(--ax-text-2)' }}>{L.loading}</p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: 'var(--ax-text-2)' }}>
          <RotateCcw className="w-12 h-12 opacity-40" />
          <p>{L.empty}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((r) => {
            const badge = STATUS_BADGE[r.status] || { bg: 'rgba(255,255,255,0.08)', color: 'var(--ax-text-2)' };
            return (
            <div key={r.id} className="rounded-xl p-4" style={{ background: 'var(--ax-card)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">{L.req} #{r.id}</span>
                <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: badge.bg, color: badge.color }}>
                  {STATUS_LABEL[r.status] || r.status}
                </span>
              </div>
              <p className="text-sm" style={{ color: 'var(--ax-text-2)' }}>📞 {r.customerPhone}</p>
              {r.orderId && <p className="text-sm" style={{ color: 'var(--ax-text-2)' }}>{L.order} #{r.orderId}</p>}
              {r.reason && <p className="text-sm mt-1" style={{ color: 'var(--ax-text)' }}>{L.reason}: {r.reason}</p>}
              {r.comment && (
                <p className="text-sm mt-1 px-2 py-1 rounded-lg" style={{ background: 'rgba(248,113,113,0.10)', color: '#F87171' }}>
                  💬 {r.comment}
                </p>
              )}
              <p className="text-sm font-semibold mt-1" style={{ color: '#22C55E' }}>{L.toRefund}: {Number(r.refundAmount).toLocaleString('uz-UZ')} {L.sum}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--ax-text-2)', opacity: 0.7 }}>
                {r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}
              </p>

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
            );
          })}
        </div>
      )}
    </div>
  );
}
