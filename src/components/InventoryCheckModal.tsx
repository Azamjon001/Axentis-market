import { useState, useEffect, useMemo, useRef } from 'react';
import { X, ScanLine, Minus, Plus, CheckCircle2, Download } from 'lucide-react';
import { toast } from 'sonner';
import api from '../utils/api';
import { useUiLang } from '../hooks/useUiLang';

// ============================================================================
// 📦 Инвентаризация склада — сверка фактических остатков с базой.
// Тот же алгоритм, что InventoryScreen мобильного приложения: сканируем
// (USB-сканер печатает код + Enter) или ищем по названию, каждый скан
// увеличивает «факт»; в конце — расхождения, акт (CSV) и применение остатков.
// ============================================================================

interface Product {
  id: number;
  name: string;
  quantity: number;
  price: number;
  barcode?: string;
  barid?: string;
}

export default function InventoryCheckModal({
  companyId,
  onClose,
}: {
  companyId: number;
  onClose: () => void;
}) {
  const lang = useUiLang();
  const isUz = lang === 'uz';

  const [products, setProducts] = useState<Product[]>([]);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [code, setCode] = useState('');
  const [applying, setApplying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // 📊 История прошлых ревизий
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const L = {
    title: isUz ? 'Inventarizatsiya' : 'Инвентаризация',
    hint: isUz
      ? 'Shtrix-kodni skanerlang yoki nom boʻyicha qidiring — baza bilan solishtiramiz'
      : 'Сканируйте штрих-код (USB-сканер) или ищите по названию — сверим с базой',
    placeholder: isUz ? 'Shtrix-kod yoki tovar nomi + Enter' : 'Штрих-код или название товара + Enter',
    scanned: isUz ? 'Skanerlangan' : 'Отсканировано',
    match: isUz ? 'Toʻgʻri' : 'Сходится',
    shortage: isUz ? 'Kamomad' : 'Недостача',
    surplus: isUz ? 'Ortiqcha' : 'Излишек',
    expected: isUz ? 'Bazada' : 'В базе',
    actual: isUz ? 'Fakt' : 'Факт',
    diff: isUz ? 'Farq' : 'Разница',
    notFound: isUz ? 'Tovar topilmadi' : 'Товар не найден',
    empty: isUz ? 'Hali hech narsa skanerlanmagan' : 'Пока ничего не отсканировано',
    apply: isUz ? 'Qoldiqlarni qoʻllash' : 'Применить остатки',
    applyConfirm: isUz
      ? 'Bazadagi qoldiqlarni fakt boʻyicha yangilaysizmi?'
      : 'Обновить остатки в базе по фактическим данным?',
    applied: isUz ? 'Qoldiqlar yangilandi' : 'Остатки обновлены',
    act: isUz ? 'Dalolatnoma (CSV)' : 'Акт (CSV)',
    sum: isUz ? 'soʻm' : 'сум',
  };

  useEffect(() => {
    api.products
      .list({ companyId: String(companyId), limit: 2000 })
      .then((data: any) => {
        const list: Product[] = (Array.isArray(data) ? data : data?.products || []).filter(
          (p: any) => !p.name?.startsWith('__CATEGORY_MARKER__'),
        );
        setProducts(list);
      })
      .catch(() => setProducts([]));
    inputRef.current?.focus();
  }, [companyId]);

  const bump = (p: Product) => {
    setCounts((prev) => ({ ...prev, [p.id]: (prev[p.id] || 0) + 1 }));
  };

  const findAndBump = () => {
    const q = code.trim().toLowerCase();
    setCode('');
    inputRef.current?.focus();
    if (!q) return;
    const byCode = products.find(
      (p) => p.barcode?.toLowerCase() === q || p.barid?.toLowerCase() === q,
    );
    if (byCode) {
      bump(byCode);
      return;
    }
    const byName = products.find((p) => p.name?.toLowerCase().includes(q));
    if (byName) {
      bump(byName);
      return;
    }
    toast.error(`${L.notFound}: ${q}`);
  };

  const rows = useMemo(
    () =>
      Object.entries(counts)
        .map(([id, actual]) => {
          const p = products.find((x) => x.id === Number(id));
          if (!p) return null;
          return { product: p, actual, expected: p.quantity || 0, diff: actual - (p.quantity || 0) };
        })
        .filter(Boolean) as { product: Product; actual: number; expected: number; diff: number }[],
    [counts, products],
  );

  const summary = useMemo(
    () => ({
      match: rows.filter((r) => r.diff === 0).length,
      shortage: rows.filter((r) => r.diff < 0).length,
      surplus: rows.filter((r) => r.diff > 0).length,
      shortageValue: rows
        .filter((r) => r.diff < 0)
        .reduce((s, r) => s + Math.abs(r.diff) * (r.product.price || 0), 0),
    }),
    [rows],
  );

  const downloadAct = () => {
    const table: string[][] = [
      ['Товар', L.expected, L.actual, L.diff],
      ...rows.map((r) => [r.product.name, String(r.expected), String(r.actual), String(r.diff)]),
    ];
    const csv = '﻿' + table.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `inventory_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const applyCorrections = async () => {
    const changed = rows.filter((r) => r.diff !== 0);
    if (changed.length === 0) return;
    if (!confirm(L.applyConfirm)) return;
    setApplying(true);
    try {
      await Promise.all(changed.map((r) => api.products.update(String(r.product.id), { quantity: r.actual })));
      // 📊 Акт уходит в историю ревизий (динамика недостач по месяцам)
      api.inventoryChecks
        .create({
          companyId,
          scannedCount: rows.length,
          matchCount: summary.match,
          shortageCount: summary.shortage,
          surplusCount: summary.surplus,
          shortageValue: Math.round(summary.shortageValue),
          items: rows.map((r) => ({ name: r.product.name, expected: r.expected, actual: r.actual })),
        })
        .catch(() => {});
      toast.success(L.applied);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setApplying(false);
    }
  };

  const openHistory = async () => {
    setShowHistory((v) => !v);
    if (history.length === 0) {
      try {
        const data = await api.inventoryChecks.list(companyId);
        setHistory(Array.isArray(data) ? data : []);
      } catch {
        setHistory([]);
      }
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--ax-surface)', border: '1px solid var(--ax-border)', borderRadius: 18, width: '100%', maxWidth: 640, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--ax-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(135deg, #0EA5E9, #2563EB)' }}>
            <ScanLine style={{ width: 18, height: 18, color: '#fff' }} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'var(--ax-text)', fontWeight: 700, fontSize: 16 }}>{L.title}</div>
            <div style={{ color: 'var(--ax-text-3)', fontSize: 12 }}>{L.hint}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ax-text-2)', cursor: 'pointer' }}>
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Ввод + сводка */}
        <div style={{ padding: '14px 20px', display: 'grid', gap: 10 }}>
          <input
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') findAndBump(); }}
            placeholder={L.placeholder}
            style={{ width: '100%', padding: '11px 14px', borderRadius: 12, background: 'var(--ax-input)', border: '1px solid var(--ax-border)', color: 'var(--ax-text)', fontSize: 14, outline: 'none' }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, fontWeight: 600 }}>
            <span style={{ padding: '3px 10px', borderRadius: 999, background: 'rgba(56,189,248,0.15)', color: '#38BDF8' }}>{L.scanned}: {rows.length}</span>
            <span style={{ padding: '3px 10px', borderRadius: 999, background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}>✓ {summary.match}</span>
            <span style={{ padding: '3px 10px', borderRadius: 999, background: 'rgba(248,113,113,0.15)', color: '#F87171' }}>{L.shortage}: {summary.shortage}</span>
            <span style={{ padding: '3px 10px', borderRadius: 999, background: 'rgba(251,191,36,0.15)', color: '#FBBF24' }}>{L.surplus}: {summary.surplus}</span>
            {summary.shortageValue > 0 && (
              <span style={{ padding: '3px 10px', borderRadius: 999, background: 'rgba(248,113,113,0.15)', color: '#F87171' }}>
                −{Math.round(summary.shortageValue).toLocaleString('ru-RU')} {L.sum}
              </span>
            )}
            <button
              onClick={openHistory}
              style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: 999, background: 'var(--ax-primary-pale)', color: 'var(--ax-primary)', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
            >
              📊 {isUz ? 'Reviziyalar tarixi' : 'История ревизий'}
            </button>
          </div>

          {/* 📊 История прошлых ревизий — динамика недостач */}
          {showHistory && (
            <div style={{ display: 'grid', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
              {history.length === 0 ? (
                <div style={{ color: 'var(--ax-text-3)', fontSize: 12.5, padding: '6px 0' }}>
                  {isUz ? 'Reviziyalar hali boʻlmagan' : 'Ревизий ещё не было'}
                </div>
              ) : (
                history.map((h: any) => (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 10, background: 'var(--ax-card)', border: '1px solid var(--ax-border)', fontSize: 12.5 }}>
                    <span style={{ color: 'var(--ax-text-2)', flex: 1 }}>
                      {new Date(h.createdAt).toLocaleDateString('ru-RU')} {new Date(h.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span style={{ color: '#22C55E', fontWeight: 600 }}>✓ {h.matchCount}</span>
                    <span style={{ color: '#F87171', fontWeight: 600 }}>−{h.shortageCount}</span>
                    <span style={{ color: '#FBBF24', fontWeight: 600 }}>+{h.surplusCount}</span>
                    {h.shortageValue > 0 && (
                      <span style={{ color: '#F87171', fontWeight: 700 }}>
                        −{Math.round(h.shortageValue).toLocaleString('ru-RU')} {L.sum}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Таблица */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 14px' }}>
          {rows.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--ax-text-3)', padding: 32, fontSize: 13.5 }}>{L.empty}</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {rows.map((r) => (
                <div
                  key={r.product.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12,
                    background: 'var(--ax-card)',
                    border: `1px solid ${r.diff === 0 ? 'var(--ax-border)' : r.diff < 0 ? 'rgba(248,113,113,0.4)' : 'rgba(251,191,36,0.4)'}`,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'var(--ax-text)', fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.product.name}
                    </div>
                    <div style={{ color: 'var(--ax-text-3)', fontSize: 12 }}>
                      {L.expected}: {r.expected} · {L.actual}: {r.actual}
                      {r.diff !== 0 && (
                        <b style={{ color: r.diff < 0 ? '#F87171' : '#FBBF24' }}> ({r.diff > 0 ? '+' : ''}{r.diff})</b>
                      )}
                      {r.diff === 0 && <CheckCircle2 style={{ width: 13, height: 13, color: '#22C55E', display: 'inline', marginLeft: 5, verticalAlign: '-2px' }} />}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={() => setCounts((p) => ({ ...p, [r.product.id]: Math.max(0, r.actual - 1) }))}
                      style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--ax-primary-pale)', color: 'var(--ax-primary)', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Minus style={{ width: 14, height: 14 }} />
                    </button>
                    <span style={{ color: 'var(--ax-text)', fontWeight: 700, minWidth: 26, textAlign: 'center' }}>{r.actual}</span>
                    <button
                      onClick={() => setCounts((p) => ({ ...p, [r.product.id]: r.actual + 1 }))}
                      style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--ax-primary-pale)', color: 'var(--ax-primary)', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Plus style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Действия */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--ax-border)', display: 'flex', gap: 10 }}>
          <button
            onClick={downloadAct}
            disabled={rows.length === 0}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px 0', borderRadius: 12, background: 'var(--ax-primary-pale)', color: 'var(--ax-primary)', border: 'none', cursor: rows.length ? 'pointer' : 'not-allowed', fontSize: 13.5, fontWeight: 600, opacity: rows.length ? 1 : 0.5 }}
          >
            <Download style={{ width: 15, height: 15 }} /> {L.act}
          </button>
          <button
            onClick={applyCorrections}
            disabled={applying || rows.every((r) => r.diff === 0)}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px 0', borderRadius: 12, background: '#16A34A', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, opacity: applying || rows.every((r) => r.diff === 0) ? 0.5 : 1 }}
          >
            <CheckCircle2 style={{ width: 15, height: 15 }} /> {L.apply}
          </button>
        </div>
      </div>
    </div>
  );
}
