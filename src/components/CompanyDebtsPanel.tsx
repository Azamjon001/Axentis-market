import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Wallet, Plus, Phone, Trash2, CheckCircle2, AlertTriangle, X, Coins,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../utils/api';
import { useUiLang } from '../hooks/useUiLang';

// ============================================================================
// 🧾 «Дафтар» — журнал долгов клиентов (цифровая долговая тетрадь).
// Общий API /debts с мобильным приложением Axentis Business: кому, сколько,
// до какого числа; частичные оплаты; push-напоминание продавцу в день срока.
// ============================================================================

interface Debt {
  id: number;
  customerName: string;
  customerPhone: string;
  amount: number;
  paidAmount: number;
  note: string;
  dueDate?: string;
  status: 'open' | 'paid';
  createdAt: string;
}

const fmt = (n: number) => Math.round(n || 0).toLocaleString('ru-RU');

export default function CompanyDebtsPanel({ companyId }: { companyId: number }) {
  const lang = useUiLang();
  const isUz = lang === 'uz';

  const [list, setList] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'open' | 'paid'>('open');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ customerName: '', customerPhone: '', amount: '', dueDate: '', note: '' });
  const [payingDebt, setPayingDebt] = useState<Debt | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const L = {
    title: isUz ? 'Daftar — mijozlar qarzlari' : 'Дафтар — долги клиентов',
    hint: isUz
      ? 'Raqamli qarz daftari: kimga, qancha, qachongacha. Muddat kuni push keladi.'
      : 'Цифровая долговая тетрадь: кому, сколько, до какого числа. В день срока придёт push.',
    totalOpen: isUz ? 'Jami qarz' : 'Всего должны',
    open: isUz ? 'Ochiq' : 'Открытые',
    paid: isUz ? 'Toʻlangan' : 'Погашенные',
    add: isUz ? 'Qarz yozish' : 'Записать долг',
    customer: isUz ? 'Mijoz ismi' : 'Имя клиента',
    phone: isUz ? 'Telefon (901234567)' : 'Телефон (901234567)',
    amount: isUz ? 'Qarz summasi' : 'Сумма долга',
    due: isUz ? 'Qaytarish muddati' : 'Срок возврата',
    note: isUz ? 'Izoh (nima uchun)' : 'Заметка (за что)',
    save: isUz ? 'Saqlash' : 'Сохранить',
    cancel: isUz ? 'Bekor qilish' : 'Отмена',
    addPayment: isUz ? 'Toʻlov qabul qilish' : 'Принять оплату',
    payAmount: isUz ? 'Toʻlov summasi' : 'Сумма оплаты',
    remaining: isUz ? 'Qoldi' : 'Осталось',
    fullRemaining: isUz ? 'Qolganini toʻlash' : 'Погасить остаток',
    overdue: isUz ? 'Muddati oʻtgan' : 'Просрочен',
    dueToday: isUz ? 'Muddati bugun' : 'Срок сегодня',
    empty: isUz ? 'Qarzlar yoʻq — hisob toza 🎉' : 'Долгов нет — все расчёты чисты 🎉',
    deleteConfirm: isUz ? 'Bu yozuvni oʻchirasizmi?' : 'Удалить эту запись о долге?',
    saved: isUz ? 'Qarz yozildi' : 'Долг записан',
    paidFully: isUz ? 'Qarz toʻliq toʻlandi 🎉' : 'Долг погашен полностью 🎉',
    fillFields: isUz ? 'Ism va summani kiriting' : 'Укажите имя и сумму',
    sum: isUz ? 'soʻm' : 'сум',
  };

  const load = async () => {
    try {
      const data = await api.debts.list(companyId);
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Debts load failed:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [companyId]);

  const filtered = useMemo(() => list.filter((d) => d.status === filter), [list, filter]);
  const totalOpen = useMemo(
    () => list.filter((d) => d.status === 'open').reduce((s, d) => s + (d.amount - d.paidAmount), 0),
    [list],
  );
  const today = new Date().toISOString().slice(0, 10);

  const submitDebt = async () => {
    const amount = parseFloat(form.amount);
    if (!form.customerName.trim() || !amount || amount <= 0) {
      toast.error(L.fillFields);
      return;
    }
    setSaving(true);
    try {
      await api.debts.create({
        companyId,
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.replace(/\D/g, ''),
        amount,
        note: form.note.trim(),
        dueDate: form.dueDate || undefined,
      });
      toast.success(L.saved);
      setFormOpen(false);
      setForm({ customerName: '', customerPhone: '', amount: '', dueDate: '', note: '' });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const submitPayment = async () => {
    if (!payingDebt) return;
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) return;
    setSaving(true);
    try {
      const updated = await api.debts.update(payingDebt.id, { addPayment: amount });
      setPayingDebt(null);
      setPayAmount('');
      load();
      if (updated?.status === 'paid') toast.success(L.paidFully);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const deleteDebt = async (d: Debt) => {
    if (!confirm(L.deleteConfirm)) return;
    try {
      await api.debts.delete(d.id);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 12,
    background: 'var(--ax-input)', border: '1px solid var(--ax-border)',
    color: 'var(--ax-text)', fontSize: 14, outline: 'none',
  };

  if (loading) {
    return <div style={{ color: 'var(--ax-text-2)', padding: 40, textAlign: 'center' }}>...</div>;
  }

  return (
    <div>
      {/* Итог + действия */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'stretch', marginBottom: 16 }}>
        <div style={{ flex: '1 1 240px', background: 'var(--ax-card)', border: '1px solid var(--ax-border)', borderRadius: 16, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ax-text-2)', fontSize: 13, marginBottom: 6 }}>
            <Wallet style={{ width: 16, height: 16, color: '#FBBF24' }} /> {L.totalOpen}
          </div>
          <div style={{ color: '#FBBF24', fontSize: 26, fontWeight: 800 }}>{fmt(totalOpen)} {L.sum}</div>
          <div style={{ color: 'var(--ax-text-3)', fontSize: 12, marginTop: 4 }}>{L.hint}</div>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '0 26px', borderRadius: 16,
            background: 'linear-gradient(135deg, #7C5CF0, #5B3DD4)', color: '#fff', border: 'none',
            cursor: 'pointer', fontSize: 14.5, fontWeight: 600,
          }}
        >
          <Plus style={{ width: 18, height: 18 }} /> {L.add}
        </button>
      </div>

      {/* Фильтр */}
      <div style={{ display: 'flex', gap: 6, padding: 5, marginBottom: 16, borderRadius: 14, background: 'var(--ax-card)', border: '1px solid var(--ax-border)', width: 'fit-content' }}>
        {(['open', 'paid'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            style={{
              padding: '8px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: filter === k ? 'var(--ax-primary)' : 'transparent',
              color: filter === k ? '#fff' : 'var(--ax-text-2)', fontSize: 13.5, fontWeight: filter === k ? 600 : 500,
            }}
          >
            {k === 'open' ? L.open : L.paid} ({list.filter((d) => d.status === k).length})
          </button>
        ))}
      </div>

      {/* Список долгов */}
      {filtered.length === 0 ? (
        <div style={{ background: 'var(--ax-card)', border: '1px solid var(--ax-border)', borderRadius: 16, padding: 48, textAlign: 'center', color: 'var(--ax-text-2)' }}>
          {L.empty}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {filtered.map((d) => {
            const remaining = d.amount - d.paidAmount;
            const overdue = d.status === 'open' && d.dueDate && d.dueDate < today;
            const dueToday = d.status === 'open' && d.dueDate === today;
            const ratio = d.amount > 0 ? d.paidAmount / d.amount : 0;
            return (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ background: 'var(--ax-card)', border: `1px solid ${overdue ? 'rgba(248,113,113,0.45)' : 'var(--ax-border)'}`, borderRadius: 16, padding: 16 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: 'var(--ax-text)', fontWeight: 700, fontSize: 15 }}>{d.customerName}</div>
                    {d.note && <div style={{ color: 'var(--ax-text-3)', fontSize: 12.5, marginTop: 2 }}>{d.note}</div>}
                  </div>
                  {overdue ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, color: '#F87171', background: 'rgba(248,113,113,0.15)', padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                      <AlertTriangle style={{ width: 12, height: 12 }} /> {L.overdue}
                    </span>
                  ) : dueToday ? (
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#FBBF24', background: 'rgba(251,191,36,0.15)', padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>{L.dueToday}</span>
                  ) : d.status === 'paid' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, color: '#22C55E', background: 'rgba(34,197,94,0.15)', padding: '3px 9px', borderRadius: 999 }}>
                      <CheckCircle2 style={{ width: 12, height: 12 }} /> {L.paid}
                    </span>
                  ) : d.dueDate ? (
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: '#38BDF8', background: 'rgba(56,189,248,0.13)', padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                      {d.dueDate.split('-').reverse().join('.')}
                    </span>
                  ) : null}
                </div>

                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                    <span style={{ color: 'var(--ax-text-2)' }}>{fmt(d.paidAmount)} / {fmt(d.amount)} {L.sum}</span>
                    {d.status === 'open' && (
                      <span style={{ color: '#FBBF24', fontWeight: 700 }}>{L.remaining}: {fmt(remaining)}</span>
                    )}
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--ax-border)', overflow: 'hidden' }}>
                    <div style={{ height: 6, width: `${Math.max(2, Math.min(100, ratio * 100))}%`, background: d.status === 'paid' ? '#22C55E' : 'var(--ax-primary)', borderRadius: 3, transition: 'width 0.3s' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center' }}>
                  {d.status === 'open' && (
                    <button
                      onClick={() => { setPayingDebt(d); setPayAmount(''); }}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 0', borderRadius: 10, background: 'rgba(34,197,94,0.15)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.3)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                    >
                      <Coins style={{ width: 14, height: 14 }} /> {L.addPayment}
                    </button>
                  )}
                  {d.customerPhone && (
                    <a
                      href={`tel:+998${d.customerPhone.slice(-9)}`}
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 10, background: 'rgba(34,197,94,0.12)', color: '#22C55E' }}
                      title={`+998 ${d.customerPhone}`}
                    >
                      <Phone style={{ width: 15, height: 15 }} />
                    </a>
                  )}
                  <button
                    onClick={() => deleteDebt(d)}
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 10, background: 'rgba(220,38,38,0.10)', color: 'var(--ax-danger)', border: 'none', cursor: 'pointer' }}
                  >
                    <Trash2 style={{ width: 15, height: 15 }} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Модалка: новый долг */}
      {formOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setFormOpen(false)}>
          <div style={{ background: 'var(--ax-surface)', border: '1px solid var(--ax-border)', borderRadius: 18, padding: 22, width: '100%', maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ color: 'var(--ax-text)', fontSize: 17, fontWeight: 700 }}>{L.add}</h3>
              <button onClick={() => setFormOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--ax-text-2)', cursor: 'pointer' }}><X style={{ width: 20, height: 20 }} /></button>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <input style={inputStyle} placeholder={L.customer} value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
              <input style={inputStyle} placeholder={L.phone} value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value.replace(/\D/g, '').slice(0, 9) })} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input style={inputStyle} placeholder={`${L.amount}, ${L.sum}`} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^0-9.]/g, '') })} />
                <input style={inputStyle} type="date" title={L.due} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </div>
              <input style={inputStyle} placeholder={L.note} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              <button
                onClick={submitDebt}
                disabled={saving}
                style={{ padding: '12px 0', borderRadius: 12, background: 'linear-gradient(135deg, #7C5CF0, #5B3DD4)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14.5, opacity: saving ? 0.6 : 1 }}
              >
                {L.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка: приём оплаты */}
      {payingDebt && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setPayingDebt(null)}>
          <div style={{ background: 'var(--ax-surface)', border: '1px solid var(--ax-border)', borderRadius: 18, padding: 22, width: '100%', maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ color: 'var(--ax-text)', fontSize: 17, fontWeight: 700 }}>{L.addPayment}</h3>
              <button onClick={() => setPayingDebt(null)} style={{ background: 'none', border: 'none', color: 'var(--ax-text-2)', cursor: 'pointer' }}><X style={{ width: 20, height: 20 }} /></button>
            </div>
            <div style={{ color: 'var(--ax-text-2)', fontSize: 13.5, marginBottom: 14 }}>
              {payingDebt.customerName} · {L.remaining}: <b style={{ color: '#FBBF24' }}>{fmt(payingDebt.amount - payingDebt.paidAmount)} {L.sum}</b>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <input style={inputStyle} placeholder={`${L.payAmount}, ${L.sum}`} value={payAmount} onChange={(e) => setPayAmount(e.target.value.replace(/[^0-9.]/g, ''))} autoFocus />
              <button
                onClick={() => setPayAmount(String(payingDebt.amount - payingDebt.paidAmount))}
                style={{ padding: '9px 0', borderRadius: 10, background: 'var(--ax-primary-pale)', color: 'var(--ax-primary)', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                {L.fullRemaining} ({fmt(payingDebt.amount - payingDebt.paidAmount)})
              </button>
              <button
                onClick={submitPayment}
                disabled={saving}
                style={{ padding: '12px 0', borderRadius: 12, background: '#16A34A', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14.5, opacity: saving ? 0.6 : 1 }}
              >
                {L.addPayment}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
