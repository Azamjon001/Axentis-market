import { useState, useEffect, useCallback } from 'react';
import {
  Landmark, RefreshCw, Clock, CheckCircle2, XCircle, Ban, Copy, Check,
  ArrowRightCircle, AlertTriangle,
} from 'lucide-react';
import api from '../utils/api';

interface Payout {
  id: number;
  companyId: number;
  companyName?: string;
  amount: number;
  cardNumber?: string; // полный номер — только для админа (нужен для перевода)
  maskedCard: string;
  cardHolder: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  commissionPercent: number;
  createdAt: string;
  processedAt?: string;
  failureReason?: string;
  providerRef?: string;
}

type StatusFilter = 'all' | 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending:    { label: 'Ожидает перевода', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', icon: Clock },
  processing: { label: 'В обработке', color: '#38BDF8', bg: 'rgba(56,189,248,0.12)', icon: RefreshCw },
  completed:  { label: 'Переведено', color: '#22C55E', bg: 'rgba(34,197,94,0.12)', icon: CheckCircle2 },
  failed:     { label: 'Ошибка', color: '#F87171', bg: 'rgba(248,113,113,0.12)', icon: XCircle },
  cancelled:  { label: 'Отменён компанией', color: '#8B8BAA', bg: 'rgba(139,139,170,0.12)', icon: Ban },
};

const fmt = (n: number) => (Number(n) || 0).toLocaleString('ru-RU');

/**
 * 💸 Очередь выплат (админ). Пока merchant API не подключён, переводы
 * выполняются вручную: админ переводит деньги на карту компании и
 * подтверждает здесь. «Переведено» ставится ТОЛЬКО после фактического перевода.
 */
export default function AdminPayoutsPanel() {
  const [items, setItems] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  // Модал отклонения выплаты с причиной
  const [failTarget, setFailTarget] = useState<Payout | null>(null);
  const [failReason, setFailReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.payouts.listAll();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Load payouts failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (id: number, status: string, failureReason?: string) => {
    setProcessingId(id);
    try {
      await api.payouts.updateStatus(id, { status, failureReason });
      await load();
    } catch (e: any) {
      alert(e?.message || 'Не удалось обновить статус');
    } finally {
      setProcessingId(null);
    }
  };

  const copyCard = async (p: Payout) => {
    try {
      await navigator.clipboard.writeText(p.cardNumber || '');
      setCopiedId(p.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { /* ignore */ }
  };

  const filtered = filter === 'all' ? items : items.filter(p => p.status === filter);
  const counts = (s: StatusFilter) => (s === 'all' ? items.length : items.filter(p => p.status === s).length);
  const pendingSum = items.filter(p => p.status === 'pending' || p.status === 'processing')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const completedSum = items.filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  return (
    <div className="space-y-5">
      {/* Сводка */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1"><Clock className="w-4 h-4" />Ожидают перевода</div>
          <div className="text-2xl font-bold text-amber-600">{fmt(pendingSum)} сум</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1"><CheckCircle2 className="w-4 h-4" />Выплачено (всего)</div>
          <div className="text-2xl font-bold text-emerald-600">{fmt(completedSum)} сум</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1"><Landmark className="w-4 h-4" />Всего заявок</div>
          <div className="text-2xl font-bold text-gray-900">{items.length}</div>
        </div>
      </div>

      {/* Предупреждение о ручном режиме */}
      <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          Merchant API ещё не подключён — переводы выполняются вручную. Переведите сумму на карту компании и
          только после этого нажмите «Переведено». Финансовые статусы необратимы.
        </span>
      </div>

      {/* Фильтры */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {(['pending', 'processing', 'completed', 'failed', 'cancelled', 'all'] as StatusFilter[]).map((key) => {
          const active = filter === key;
          const label = key === 'all' ? 'Все' : STATUS_META[key].label;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                active ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-purple-300'
              }`}
            >
              {label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${active ? 'bg-white/25 text-white' : 'bg-purple-50 text-purple-600'}`}>
                {counts(key)}
              </span>
            </button>
          );
        })}
        <button
          onClick={load}
          className="ml-auto w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-500 shrink-0"
          aria-label="refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Список */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-14 text-gray-500 bg-white rounded-xl border border-gray-200">
          <RefreshCw className="w-4 h-4 animate-spin" /> Загрузка...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-14 text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
          <Landmark className="w-10 h-10 opacity-40" />
          <span className="text-sm">Заявок нет</span>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => {
            const meta = STATUS_META[p.status] || STATUS_META.pending;
            const Icon = meta.icon;
            const busy = processingId === p.id;
            return (
              <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: meta.bg }}>
                      <Icon className="w-5 h-5" style={{ color: meta.color }} />
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-gray-900">
                        {fmt(p.amount)} сум
                        <span className="ml-2 text-xs font-medium text-gray-400">#{p.id}</span>
                      </div>
                      <div className="text-sm text-gray-500 truncate">
                        {p.companyName || `Компания #${p.companyId}`} · комиссия {p.commissionPercent}% · {new Date(p.createdAt).toLocaleString('ru-RU')}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold shrink-0" style={{ background: meta.bg, color: meta.color }}>
                    {meta.label}
                  </span>
                </div>

                {/* Реквизиты для перевода */}
                <div className="mt-3 flex items-center gap-2 flex-wrap bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200">
                  <code className="font-mono text-sm font-bold text-gray-800 tracking-wider">
                    {(p.cardNumber || '').replace(/(\d{4})(?=\d)/g, '$1 ') || p.maskedCard}
                  </code>
                  {p.cardHolder && <span className="text-sm text-gray-600 uppercase">· {p.cardHolder}</span>}
                  {p.cardNumber && (
                    <button
                      onClick={() => copyCard(p)}
                      className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-500 text-white text-xs font-medium hover:bg-blue-600"
                    >
                      {copiedId === p.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedId === p.id ? 'Скопировано' : 'Копировать'}
                    </button>
                  )}
                </div>

                {p.failureReason && (
                  <p className="mt-2 text-sm text-red-600">Причина ошибки: {p.failureReason}</p>
                )}
                {p.providerRef && (
                  <p className="mt-2 text-xs text-gray-400">Транзакция: {p.providerRef}</p>
                )}

                {/* Действия */}
                {(p.status === 'pending' || p.status === 'processing') && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {p.status === 'pending' && (
                      <button
                        onClick={() => setStatus(p.id, 'processing')}
                        disabled={busy}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 disabled:opacity-50"
                      >
                        <ArrowRightCircle className="w-4 h-4" /> В обработку
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (confirm(`Подтвердить: ${fmt(p.amount)} сум ФАКТИЧЕСКИ переведены на карту ${p.maskedCard}? Действие необратимо.`)) {
                          setStatus(p.id, 'completed');
                        }
                      }}
                      disabled={busy}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Переведено
                    </button>
                    <button
                      onClick={() => { setFailTarget(p); setFailReason(''); }}
                      disabled={busy}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-50 text-red-600 border border-red-200 text-sm font-semibold hover:bg-red-100 disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" /> Ошибка
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ❌ Модал: пометить выплату ошибочной с причиной */}
      {failTarget && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={() => setFailTarget(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 mb-1">Пометить выплату #{failTarget.id} ошибочной</h3>
            <p className="text-sm text-gray-500 mb-3">
              Сумма {fmt(failTarget.amount)} сум вернётся в доступный баланс компании. Причина будет видна компании.
            </p>
            <textarea
              value={failReason}
              onChange={(e) => setFailReason(e.target.value)}
              rows={3}
              placeholder="Например: неверные реквизиты карты"
              className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-red-300 resize-none"
              autoFocus
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={async () => {
                  const t = failTarget;
                  setFailTarget(null);
                  await setStatus(t.id, 'failed', failReason.trim() || undefined);
                }}
                className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700"
              >
                Пометить ошибочной
              </button>
              <button
                onClick={() => setFailTarget(null)}
                className="flex-1 py-2.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-bold hover:bg-gray-200"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
