import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calculator, Plus, Trash2, ArrowDownCircle, ArrowUpCircle, ShoppingCart, Percent, Eraser } from 'lucide-react';
import type { Language } from '../utils/translations';

// 🧮 «Калькулятор торговца» — считает повседневные задачи магазина ОДНОЙ
// цепочкой и НИЧЕГО не забывает (записи хранятся в localStorage по компании):
//   «Дал поставщику 2 000 000» → −2 000 000
//   «Купил товар за 1 500 000» → −1 500 000
//   «Продал товар за 1 500 000 с наценкой 20%» → +1 800 000 (и виден навар)
//   «Получил долг 500 000» → +500 000
// Внизу всегда живой итог: «У меня останется …».
//
// Никаких формул и Excel: продавец добавляет строки простыми словами,
// как рассказывает сам («дал… купил… продал…»).

type OpType = 'out' | 'in' | 'sold';

interface CalcRow {
  id: number;
  type: OpType;
  label: string;
  amount: number;        // сумма операции (для «продал» — цена закупки/базовая)
  markupPercent?: number; // только для «продал с наценкой»
}

interface MerchantCalculatorProps {
  companyId: number;
  language: Language;
}

const fmt = (n: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + ' сум';

export default function MerchantCalculator({ companyId, language }: MerchantCalculatorProps) {
  const uz = language === 'uz';
  const storageKey = `merchant_calc_${companyId}`;

  const [rows, setRows] = useState<CalcRow[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  });

  // Форма новой записи
  const [type, setType] = useState<OpType>('out');
  const [label, setLabel] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [markupStr, setMarkupStr] = useState('');

  // Записи переживают перезагрузку страницы — калькулятор «помнит» расчёт.
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(rows)); } catch { /* ignore */ }
  }, [rows, storageKey]);

  const parseNum = (s: string) => {
    const v = parseFloat(s.replace(/\s/g, '').replace(',', '.'));
    return isFinite(v) && v > 0 ? v : 0;
  };

  // Эффект строки на баланс: out → −сумма; in → +сумма;
  // sold → +сумма×(1+наценка/100), навар = сумма×наценка/100.
  const rowEffect = (r: CalcRow) => {
    if (r.type === 'out') return -r.amount;
    if (r.type === 'in') return r.amount;
    return r.amount * (1 + (r.markupPercent || 0) / 100);
  };
  const rowProfit = (r: CalcRow) => (r.type === 'sold' ? r.amount * ((r.markupPercent || 0) / 100) : 0);

  const { balance, totalProfit } = useMemo(() => ({
    balance: rows.reduce((s, r) => s + rowEffect(r), 0),
    totalProfit: rows.reduce((s, r) => s + rowProfit(r), 0),
  }), [rows]);

  const addRow = () => {
    const amount = parseNum(amountStr);
    if (!amount) return;
    const markup = type === 'sold' ? parseNum(markupStr) : undefined;
    setRows(prev => [...prev, {
      id: Date.now(),
      type,
      label: label.trim(),
      amount,
      markupPercent: markup,
    }]);
    setLabel('');
    setAmountStr('');
    setMarkupStr('');
  };

  const typeOptions: Array<{ key: OpType; label: string; icon: JSX.Element; accent: string }> = [
    { key: 'out',  label: uz ? 'Berdim / sarfladim' : 'Отдал / потратил', icon: <ArrowDownCircle style={{ width: 14, height: 14 }} />, accent: '#F87171' },
    { key: 'in',   label: uz ? 'Oldim / qaytdi'      : 'Получил / вернули', icon: <ArrowUpCircle style={{ width: 14, height: 14 }} />,  accent: '#22C55E' },
    { key: 'sold', label: uz ? 'Sotdim (ustama %)'   : 'Продал (с наценкой %)', icon: <ShoppingCart style={{ width: 14, height: 14 }} />, accent: '#38BDF8' },
  ];
  const typeCfg = (k: OpType) => typeOptions.find(o => o.key === k)!;

  const soldPreviewAmount = parseNum(amountStr);
  const soldPreviewMarkup = parseNum(markupStr);
  const soldPreview = type === 'sold' && soldPreviewAmount > 0
    ? soldPreviewAmount * (1 + soldPreviewMarkup / 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 26, delay: 0.14 }}
      style={{ background: 'var(--ax-card)', border: '1px solid var(--ax-border)', borderRadius: 16, padding: '18px 20px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calculator style={{ width: 16, height: 16, color: 'var(--ax-primary)' }} />
          <h3 style={{ color: 'var(--ax-text)', fontSize: 15, fontWeight: 700, margin: 0 }}>
            {uz ? 'Savdogar kalkulyatori' : 'Калькулятор торговца'}
          </h3>
        </div>
        {rows.length > 0 && (
          <button
            onClick={() => setRows([])}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--ax-input)', border: '1px solid var(--ax-border)', borderRadius: 9, color: 'var(--ax-text-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '6px 11px' }}
          >
            <Eraser style={{ width: 13, height: 13 }} />
            {uz ? 'Tozalash' : 'Очистить'}
          </button>
        )}
      </div>
      <p style={{ color: 'var(--ax-text-3)', fontSize: 12.5, margin: '4px 0 14px' }}>
        {uz
          ? 'Kunlik hisob-kitob zanjiri: berdim, oldim, sotdim — kalkulyator hech narsani unutmaydi va qoldiqni darhol koʻrsatadi.'
          : 'Цепочка дневных расчётов: дал, купил, продал с наценкой — калькулятор ничего не забывает и сразу показывает остаток.'}
      </p>

      {/* ── Форма добавления операции ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {typeOptions.map((o) => {
          const on = type === o.key;
          return (
            <button
              key={o.key}
              onClick={() => setType(o.key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 10,
                fontSize: 12.5, fontWeight: on ? 700 : 500, cursor: 'pointer', whiteSpace: 'nowrap',
                background: on ? `${o.accent}1F` : 'var(--ax-input)',
                border: `1px solid ${on ? `${o.accent}66` : 'var(--ax-border)'}`,
                color: on ? o.accent : 'var(--ax-text-2)',
              }}
            >
              {o.icon} {o.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'stretch' }}>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={uz ? 'Izoh (masalan: mol uchun Alisherga)' : 'Заметка (например: Алишеру за товар)'}
          style={{ flex: '2 1 190px', minWidth: 0, background: 'var(--ax-input)', border: '1px solid var(--ax-border)', borderRadius: 10, padding: '10px 12px', color: 'var(--ax-text)', fontSize: 13.5 }}
        />
        <input
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value.replace(/[^\d\s.,]/g, ''))}
          onKeyDown={(e) => { if (e.key === 'Enter') addRow(); }}
          inputMode="numeric"
          placeholder={type === 'sold' ? (uz ? 'Tannarx, soʻm' : 'Себестоимость, сум') : (uz ? 'Summa, soʻm' : 'Сумма, сум')}
          style={{ flex: '1 1 130px', minWidth: 0, background: 'var(--ax-input)', border: '1px solid var(--ax-border)', borderRadius: 10, padding: '10px 12px', color: 'var(--ax-text)', fontSize: 13.5 }}
        />
        {type === 'sold' && (
          <div style={{ position: 'relative', flex: '0 1 120px', minWidth: 90 }}>
            <input
              value={markupStr}
              onChange={(e) => setMarkupStr(e.target.value.replace(/[^\d.,]/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter') addRow(); }}
              inputMode="decimal"
              placeholder={uz ? 'Ustama' : 'Наценка'}
              style={{ width: '100%', background: 'var(--ax-input)', border: '1px solid var(--ax-border)', borderRadius: 10, padding: '10px 30px 10px 12px', color: 'var(--ax-text)', fontSize: 13.5 }}
            />
            <Percent style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: 'var(--ax-text-3)' }} />
          </div>
        )}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={addRow}
          disabled={!parseNum(amountStr)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 10, border: 'none',
            cursor: parseNum(amountStr) ? 'pointer' : 'not-allowed', opacity: parseNum(amountStr) ? 1 : 0.5,
            background: 'linear-gradient(135deg, #7C5CF0, #5B3DD4)', color: '#FFF', fontSize: 13.5, fontWeight: 700,
          }}
        >
          <Plus style={{ width: 15, height: 15 }} />
          {uz ? 'Qoʻshish' : 'Добавить'}
        </motion.button>
      </div>

      {/* Живой предпросмотр продажи: «1 500 000 + 20% = 1 800 000» */}
      {type === 'sold' && soldPreview > 0 && (
        <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--ax-text-2)' }}>
          {fmt(soldPreviewAmount)} + {soldPreviewMarkup || 0}% ={' '}
          <span style={{ color: '#38BDF8', fontWeight: 700 }}>{fmt(soldPreview)}</span>
          {soldPreviewMarkup > 0 && (
            <span style={{ color: '#22C55E' }}>
              {' '}(+{fmt(soldPreview - soldPreviewAmount)} {uz ? 'foyda' : 'навар'})
            </span>
          )}
        </div>
      )}

      {/* ── Список операций ── */}
      {rows.length > 0 && (
        <div style={{ marginTop: 14, border: '1px solid var(--ax-border)', borderRadius: 12, overflow: 'hidden' }}>
          <AnimatePresence initial={false}>
            {rows.map((r, i) => {
              const cfg = typeCfg(r.type);
              const effect = rowEffect(r);
              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                  style={{ borderTop: i === 0 ? 'none' : '1px solid var(--ax-border)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: `${cfg.accent}1A`, color: cfg.accent, flexShrink: 0 }}>
                      {cfg.icon}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: 'var(--ax-text)', fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.label || cfg.label}
                      </div>
                      <div style={{ color: 'var(--ax-text-3)', fontSize: 11.5 }}>
                        {r.type === 'sold'
                          ? `${fmt(r.amount)} + ${r.markupPercent || 0}%${rowProfit(r) > 0 ? ` · ${uz ? 'foyda' : 'навар'} +${fmt(rowProfit(r))}` : ''}`
                          : cfg.label}
                      </div>
                    </div>
                    <span style={{ color: effect >= 0 ? '#22C55E' : '#F87171', fontWeight: 700, fontSize: 13.5, whiteSpace: 'nowrap' }}>
                      {effect >= 0 ? '+' : '−'}{fmt(Math.abs(effect))}
                    </span>
                    <button
                      onClick={() => setRows(prev => prev.filter(x => x.id !== r.id))}
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: 'transparent', border: 'none', color: 'var(--ax-text-3)', cursor: 'pointer', flexShrink: 0 }}
                      aria-label="delete"
                    >
                      <Trash2 style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ── Итог ── */}
      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', background: 'var(--ax-input)', border: '1px solid var(--ax-border)', borderRadius: 12, padding: '12px 14px' }}>
        <div>
          <div style={{ color: 'var(--ax-text-2)', fontSize: 12.5, fontWeight: 600 }}>
            {uz ? 'Menda qoladi' : 'У меня останется'}
          </div>
          {totalProfit > 0 && (
            <div style={{ color: '#22C55E', fontSize: 12, marginTop: 2 }}>
              {uz ? 'Shundan foyda' : 'Из них навар'}: +{fmt(totalProfit)}
            </div>
          )}
        </div>
        <span style={{ fontSize: 20, fontWeight: 800, color: balance >= 0 ? 'var(--ax-primary)' : 'var(--ax-danger)' }}>
          {balance >= 0 ? '+' : '−'}{fmt(Math.abs(balance))}
        </span>
      </div>
    </motion.div>
  );
}
