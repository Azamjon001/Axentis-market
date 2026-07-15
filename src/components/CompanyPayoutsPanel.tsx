import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Wallet, CreditCard, ArrowDownToLine, RefreshCw, Clock, CheckCircle2,
  XCircle, AlertTriangle, ShieldCheck, Ban, Landmark, Percent,
} from 'lucide-react';
import api from '../utils/api';
import { useUiLang } from '../hooks/useUiLang';

interface PayoutBalance {
  onlineRevenue: number;
  commissionPercent: number;
  commissionAmount: number;
  earned: number;
  withdrawnTotal: number;
  inProgress: number;
  available: number;
}

interface Payout {
  id: number;
  amount: number;
  maskedCard: string;
  cardHolder: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  commissionPercent: number;
  createdAt: string;
  processedAt?: string;
  failureReason?: string;
  providerRef?: string;
}

interface CompanyPayoutsPanelProps {
  companyId: number;
}

const STATUS_META: Record<string, { color: string; bg: string; icon: typeof Clock }> = {
  pending:    { color: '#F59E0B', bg: 'rgba(245,158,11,0.14)', icon: Clock },
  processing: { color: '#38BDF8', bg: 'rgba(56,189,248,0.14)', icon: RefreshCw },
  completed:  { color: '#22C55E', bg: 'rgba(34,197,94,0.14)', icon: CheckCircle2 },
  failed:     { color: '#F87171', bg: 'rgba(248,113,113,0.14)', icon: XCircle },
  cancelled:  { color: '#8B8BAA', bg: 'rgba(139,139,170,0.14)', icon: Ban },
};

// 16 цифр карты → «8600 1234 5678 9012» по мере ввода
const formatCard = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 16);
  return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
};

/**
 * 💸 Вывод средств: онлайн-заработок компании (оплаты картой поступают на счёт
 * платформы) за вычетом комиссии. Баланс считает ТОЛЬКО сервер — здесь только
 * отображение и оформление заявки с подтверждением реквизитов.
 */
export default function CompanyPayoutsPanel({ companyId }: CompanyPayoutsPanelProps) {
  const [balance, setBalance] = useState<PayoutBalance | null>(null);
  const [history, setHistory] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);

  // Форма заявки
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [amount, setAmount] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ verified: boolean; cardHolder?: string; message?: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const lang = useUiLang();
  const uz = lang === 'uz';
  const L = uz ? {
    title: 'Pul yechish', subtitle: 'Onlayn daromadni kartaga chiqarish',
    available: 'Yechish mumkin', onlineRevenue: 'Onlayn tushum', commission: 'Platforma komissiyasi',
    inProgress: 'Jarayonda', withdrawn: 'Yechilgan (jami)', earned: 'Komissiyadan keyin',
    cardLabel: 'Karta raqami', holderLabel: 'Karta egasi (ism familiya)', amountLabel: 'Summa (soʻm)',
    max: 'Maks', verify: 'Kartani tekshirish', request: 'Yechishga soʻrov',
    confirmTitle: 'Yechishni tasdiqlang', confirmText: 'Rekvizitlarni diqqat bilan tekshiring — pul koʻrsatilgan kartaga oʻtkaziladi.',
    confirm: 'Tasdiqlayman', cancel: 'Bekor qilish', history: 'Yechishlar tarixi', noHistory: 'Hali yechishlar yoʻq',
    sum: 'soʻm', statusPending: 'Kutilmoqda', statusProcessing: 'Jarayonda', statusCompleted: 'Oʻtkazildi',
    statusFailed: 'Xato', statusCancelled: 'Bekor qilingan', cancelReq: 'Bekor qilish',
    fillCard: 'Karta raqami 16 ta raqamdan iborat boʻlishi kerak', fillHolder: 'Karta egasini kiriting',
    fillAmount: 'Summani kiriting', tooMuch: 'Summa mavjud qoldiqdan oshmasligi kerak',
    minAmount: 'Minimal summa — 10 000 soʻm',
    sent: 'Soʻrov yaratildi! Pul oʻtkazilgach holat yangilanadi.',
    holderVerified: 'Karta egasi', securityNote: 'Toʻlov faqat haqiqiy oʻtkazma tasdiqlangandan soʻng «Oʻtkazildi» boʻladi.',
  } : {
    title: 'Вывод средств', subtitle: 'Вывод онлайн-заработка на банковскую карту',
    available: 'Доступно к выводу', onlineRevenue: 'Онлайн-выручка', commission: 'Комиссия платформы',
    inProgress: 'В обработке', withdrawn: 'Выведено (всего)', earned: 'После комиссии',
    cardLabel: 'Номер карты', holderLabel: 'Владелец карты (имя и фамилия)', amountLabel: 'Сумма (сум)',
    max: 'Макс', verify: 'Проверить карту', request: 'Запросить вывод',
    confirmTitle: 'Подтвердите вывод', confirmText: 'Внимательно проверьте реквизиты — деньги будут переведены на указанную карту.',
    confirm: 'Подтверждаю', cancel: 'Отмена', history: 'История выводов', noHistory: 'Выводов пока нет',
    sum: 'сум', statusPending: 'Ожидает', statusProcessing: 'В обработке', statusCompleted: 'Переведено',
    statusFailed: 'Ошибка', statusCancelled: 'Отменён', cancelReq: 'Отменить',
    fillCard: 'Номер карты должен содержать 16 цифр', fillHolder: 'Укажите владельца карты',
    fillAmount: 'Введите сумму', tooMuch: 'Сумма не должна превышать доступный остаток',
    minAmount: 'Минимальная сумма — 10 000 сум',
    sent: 'Заявка создана! Статус обновится после фактического перевода.',
    holderVerified: 'Владелец карты', securityNote: 'Выплата помечается «Переведено» только после фактического подтверждения перевода.',
  };
  const STATUS_LABEL: Record<string, string> = {
    pending: L.statusPending, processing: L.statusProcessing, completed: L.statusCompleted,
    failed: L.statusFailed, cancelled: L.statusCancelled,
  };

  const fmt = (n: number) => (Number(n) || 0).toLocaleString('uz-UZ');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, h] = await Promise.all([
        api.payouts.balance(companyId),
        api.payouts.list(companyId).catch(() => []),
      ]);
      setBalance(b);
      setHistory(Array.isArray(h) ? h : []);
    } catch (e) {
      console.error('Load payouts failed:', e);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);
  // Баланс живёт в реальном времени: заказы продолжают приходить
  useEffect(() => {
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [load]);

  const cardDigits = cardNumber.replace(/\D/g, '');
  const amountNum = parseInt(amount.replace(/\D/g, ''), 10) || 0;

  const validate = (): string => {
    if (cardDigits.length !== 16) return L.fillCard;
    if (!cardHolder.trim() && !verifyResult?.cardHolder) return L.fillHolder;
    if (amountNum <= 0) return L.fillAmount;
    if (amountNum < 10000) return L.minAmount;
    if (balance && amountNum > balance.available) return L.tooMuch;
    return '';
  };

  const handleVerify = async () => {
    setFormError('');
    setVerifyResult(null);
    if (cardDigits.length !== 16) { setFormError(L.fillCard); return; }
    setVerifying(true);
    try {
      const res = await api.payouts.verifyCard(cardDigits);
      setVerifyResult(res);
      if (res.verified && res.cardHolder) setCardHolder(res.cardHolder);
    } catch (e: any) {
      setFormError(e?.message || 'Ошибка проверки карты');
    } finally {
      setVerifying(false);
    }
  };

  const handleRequest = () => {
    setFormError('');
    setSuccessMsg('');
    const err = validate();
    if (err) { setFormError(err); return; }
    setConfirmOpen(true);
  };

  const submit = async () => {
    setSubmitting(true);
    setFormError('');
    try {
      await api.payouts.create(companyId, {
        cardNumber: cardDigits,
        cardHolder: cardHolder.trim(),
        amount: amountNum,
      });
      setConfirmOpen(false);
      setAmount('');
      setSuccessMsg(L.sent);
      await load();
    } catch (e: any) {
      setConfirmOpen(false);
      setFormError(e?.message || 'Не удалось создать заявку');
      await load(); // баланс мог измениться — показываем актуальный
    } finally {
      setSubmitting(false);
    }
  };

  const cancelPayout = async (id: number) => {
    try {
      await api.payouts.cancel(id);
      await load();
    } catch (e: any) {
      alert(e?.message || 'Не удалось отменить');
    }
  };

  const maskedForConfirm = useMemo(
    () => formatCard(cardDigits).replace(/^(\d{4} \d{2})\d{2} \d{4}/, '$1•• ••••'),
    [cardDigits],
  );

  if (loading && !balance) {
    return (
      <div className="flex items-center justify-center gap-2 py-16" style={{ color: 'var(--ax-text-2)' }}>
        <RefreshCw className="w-4 h-4 animate-spin" /> ...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto" style={{ color: 'var(--ax-text)' }}>
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.14)' }}>
            <Landmark className="w-5 h-5" style={{ color: '#22C55E' }} />
          </span>
          <div>
            <h2 className="text-lg font-bold leading-tight">{L.title}</h2>
            <p className="text-xs" style={{ color: 'var(--ax-text-2)' }}>{L.subtitle}</p>
          </div>
        </div>
        <button
          onClick={load}
          className="w-9 h-9 flex items-center justify-center rounded-lg active:scale-95"
          style={{ background: 'var(--ax-input)', border: '1px solid var(--ax-border)', color: 'var(--ax-text-2)' }}
          aria-label="refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {balance && (
        <>
          {/* 💰 Главная карта: доступно к выводу */}
          <div className="rounded-2xl p-6 mb-4 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.16), rgba(124,92,240,0.12))', border: '1px solid rgba(34,197,94,0.30)' }}>
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4" style={{ color: '#22C55E' }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--ax-text-2)' }}>{L.available}</span>
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold" style={{ color: '#22C55E' }}>
              {fmt(balance.available)} <span className="text-lg font-bold">{L.sum}</span>
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--ax-text-2)' }}>
              {L.onlineRevenue}: {fmt(balance.onlineRevenue)} − {L.commission} ({balance.commissionPercent}%): {fmt(balance.commissionAmount)}
              {balance.inProgress > 0 && <> − {L.inProgress}: {fmt(balance.inProgress)}</>}
              {balance.withdrawnTotal > 0 && <> − {L.withdrawn}: {fmt(balance.withdrawnTotal)}</>}
            </p>
          </div>

          {/* Разбивка */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[
              { label: L.onlineRevenue, value: fmt(balance.onlineRevenue), color: '#38BDF8', icon: CreditCard },
              { label: `${L.commission} (${balance.commissionPercent}%)`, value: `−${fmt(balance.commissionAmount)}`, color: '#F59E0B', icon: Percent },
              { label: L.inProgress, value: fmt(balance.inProgress), color: '#7C5CF0', icon: Clock },
              { label: L.withdrawn, value: fmt(balance.withdrawnTotal), color: '#22C55E', icon: CheckCircle2 },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="rounded-xl p-3.5" style={{ background: 'var(--ax-card)', border: '1px solid var(--ax-border)' }}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                  <span className="text-[11px] font-semibold truncate" style={{ color: 'var(--ax-text-2)' }}>{label}</span>
                </div>
                <div className="text-sm font-bold truncate" style={{ color }}>{value} {L.sum}</div>
              </div>
            ))}
          </div>

          {/* 📤 Форма заявки на вывод */}
          <div className="rounded-xl p-5 mb-6" style={{ background: 'var(--ax-card)', border: '1px solid var(--ax-border)' }}>
            <div className="flex items-center gap-2 mb-4">
              <ArrowDownToLine className="w-4 h-4" style={{ color: 'var(--ax-primary)' }} />
              <h3 className="text-sm font-bold">{L.request}</h3>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--ax-text-2)' }}>{L.cardLabel}</label>
                <div className="flex gap-2">
                  <input
                    value={cardNumber}
                    onChange={(e) => { setCardNumber(formatCard(e.target.value)); setVerifyResult(null); }}
                    placeholder="8600 0000 0000 0000"
                    inputMode="numeric"
                    className="flex-1 h-10 px-3 rounded-lg text-sm font-mono tracking-wider outline-none"
                    style={{ background: 'var(--ax-input)', border: '1px solid var(--ax-border)', color: 'var(--ax-text)' }}
                  />
                  <button
                    onClick={handleVerify}
                    disabled={verifying || cardDigits.length !== 16}
                    className="flex items-center gap-1.5 px-3 h-10 rounded-lg text-xs font-bold active:scale-95 disabled:opacity-40 whitespace-nowrap"
                    style={{ background: 'var(--ax-primary-pale)', border: '1px solid var(--ax-border)', color: 'var(--ax-primary)' }}
                  >
                    {verifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    {L.verify}
                  </button>
                </div>
                {verifyResult && (
                  <p className="flex items-center gap-1.5 text-xs mt-1.5" style={{ color: verifyResult.verified ? '#22C55E' : '#F59E0B' }}>
                    {verifyResult.verified
                      ? <><CheckCircle2 className="w-3.5 h-3.5" /> {L.holderVerified}: <b>{verifyResult.cardHolder}</b></>
                      : <><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {verifyResult.message}</>}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--ax-text-2)' }}>{L.holderLabel}</label>
                <input
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value)}
                  placeholder="AZIZBEK KARIMOV"
                  className="w-full h-10 px-3 rounded-lg text-sm uppercase outline-none"
                  style={{ background: 'var(--ax-input)', border: '1px solid var(--ax-border)', color: 'var(--ax-text)' }}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--ax-text-2)' }}>{L.amountLabel}</label>
                <div className="flex gap-2">
                  <input
                    value={amount ? fmt(amountNum) : ''}
                    onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                    placeholder="0"
                    inputMode="numeric"
                    className="flex-1 h-10 px-3 rounded-lg text-sm font-bold outline-none"
                    style={{ background: 'var(--ax-input)', border: '1px solid var(--ax-border)', color: 'var(--ax-text)' }}
                  />
                  <button
                    onClick={() => setAmount(String(Math.floor(balance.available)))}
                    className="px-3 h-10 rounded-lg text-xs font-bold active:scale-95"
                    style={{ background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.28)', color: '#22C55E' }}
                  >
                    {L.max}
                  </button>
                </div>
              </div>
              <button
                onClick={handleRequest}
                disabled={submitting || balance.available < 10000}
                className="flex items-center gap-2 h-10 px-5 rounded-lg text-white text-sm font-bold active:scale-95 disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #22C55E, #16A34A)' }}
              >
                <ArrowDownToLine className="w-4 h-4" /> {L.request}
              </button>
            </div>

            {formError && (
              <p className="flex items-center gap-1.5 text-sm mt-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(248,113,113,0.10)', color: '#F87171', border: '1px solid rgba(248,113,113,0.22)' }}>
                <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {formError}
              </p>
            )}
            {successMsg && (
              <p className="flex items-center gap-1.5 text-sm mt-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(34,197,94,0.10)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.22)' }}>
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {successMsg}
              </p>
            )}
            <p className="text-[11px] mt-3" style={{ color: 'var(--ax-text-3)' }}>🔒 {L.securityNote}</p>
          </div>
        </>
      )}

      {/* 📜 История выводов */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--ax-card)', border: '1px solid var(--ax-border)' }}>
        <div className="px-5 py-3.5 text-sm font-bold" style={{ borderBottom: '1px solid var(--ax-border)' }}>{L.history}</div>
        {history.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10" style={{ color: 'var(--ax-text-3)' }}>
            <Wallet className="w-10 h-10 opacity-30" />
            <span className="text-sm">{L.noHistory}</span>
          </div>
        ) : (
          <div>
            {history.map((p, idx) => {
              const meta = STATUS_META[p.status] || STATUS_META.pending;
              const Icon = meta.icon;
              return (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3.5 flex-wrap" style={{ borderBottom: idx < history.length - 1 ? '1px solid var(--ax-border)' : 'none' }}>
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: meta.bg }}>
                    <Icon className="w-4 h-4" style={{ color: meta.color }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold">{fmt(p.amount)} {L.sum}</div>
                    <div className="text-xs" style={{ color: 'var(--ax-text-2)' }}>
                      {p.maskedCard}{p.cardHolder ? ` · ${p.cardHolder}` : ''} · {new Date(p.createdAt).toLocaleString(uz ? 'uz-UZ' : 'ru-RU')}
                    </div>
                    {p.failureReason && <div className="text-xs mt-0.5" style={{ color: '#F87171' }}>{p.failureReason}</div>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: meta.bg, color: meta.color }}>
                      {STATUS_LABEL[p.status] || p.status}
                    </span>
                    {p.status === 'pending' && (
                      <button
                        onClick={() => cancelPayout(p.id)}
                        className="text-xs px-2.5 py-1 rounded-full font-semibold active:scale-95"
                        style={{ background: 'rgba(248,113,113,0.12)', color: '#F87171', border: '1px solid rgba(248,113,113,0.25)' }}
                      >
                        {L.cancelReq}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ✅ Подтверждение вывода */}
      {confirmOpen && balance && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => !submitting && setConfirmOpen(false)}>
          <div
            className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{ background: 'var(--ax-card)', border: '1px solid var(--ax-border)', boxShadow: '0 24px 60px rgba(0,0,0,0.45)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--ax-border)' }}>
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.14)' }}>
                  <ShieldCheck className="w-4 h-4" style={{ color: '#22C55E' }} />
                </span>
                <p className="font-bold">{L.confirmTitle}</p>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs" style={{ color: 'var(--ax-text-2)' }}>{L.confirmText}</p>
              <div className="rounded-xl p-4 space-y-2" style={{ background: 'var(--ax-input)', border: '1px solid var(--ax-border)' }}>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--ax-text-2)' }}>{L.cardLabel}</span>
                  <span className="font-mono font-bold">{maskedForConfirm}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--ax-text-2)' }}>{L.holderLabel.split(' (')[0]}</span>
                  <span className="font-bold uppercase">{cardHolder || verifyResult?.cardHolder || '—'}</span>
                </div>
                <div className="flex justify-between text-base pt-1" style={{ borderTop: '1px dashed var(--ax-border)' }}>
                  <span style={{ color: 'var(--ax-text-2)' }}>{L.amountLabel.split(' (')[0]}</span>
                  <span className="font-extrabold" style={{ color: '#22C55E' }}>{fmt(amountNum)} {L.sum}</span>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={submit}
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-white text-sm font-bold active:scale-95 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #22C55E, #16A34A)' }}
                >
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {L.confirm}
                </button>
                <button
                  onClick={() => setConfirmOpen(false)}
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-lg text-sm font-bold active:scale-95"
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
