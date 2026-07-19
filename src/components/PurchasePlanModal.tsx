import { useState, useEffect, useMemo } from 'react';
import { X, Sparkles, Send, Plus, Trash2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import api from '../utils/api';
import { useUiLang } from '../hooks/useUiLang';

// ============================================================================
// 🤖 «Что докупить?» + 🚚 автозаказ поставщику (алгоритм 1:1 с приложением).
//
// Прогноз остатков считает бэкенд (/inventory-insights, 90 дней продаж);
// рекомендация = запас на 14 дней вперёд. План группируется по поставщикам
// (products.supplier_id через /suppliers), каждому поставщику заказ уходит
// одной кнопкой в Telegram или копируется в буфер.
// ============================================================================

interface Supplier {
  id: number;
  name: string;
  phone: string;
  telegram: string;
}

interface PlanRow {
  productId: number;
  name: string;
  stock: number;
  soldPerDay: number;
  recommend: number;
  cost: number;
}

const fmt = (n: number) => Math.round(n || 0).toLocaleString('ru-RU');

export default function PurchasePlanModal({
  companyId,
  onClose,
}: {
  companyId: number;
  onClose: () => void;
}) {
  const lang = useUiLang();
  const isUz = lang === 'uz';

  const [rows, setRows] = useState<PlanRow[]>([]);
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
  const [supplierOf, setSupplierOf] = useState<Map<number, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [newSupplier, setNewSupplier] = useState({ name: '', telegram: '' });

  const L = {
    title: isUz ? 'Aqlli xarid rejasi' : 'Умный план закупки',
    hint: isUz ? 'Hisob: 90 kunlik sotuv, 14 kunlik zaxira' : 'Расчёт: продажи за 90 дней, запас на 14 дней вперёд',
    empty: isUz ? 'Zaxira yetarli — xarid shart emas 🎉' : 'Запасов хватает — докупать нечего 🎉',
    budget: isUz ? 'Xarid byudjeti' : 'Бюджет закупки',
    left: isUz ? 'qoldiq' : 'остаток',
    perDay: isUz ? 'dona/kun' : 'шт/день',
    buy: isUz ? 'sotib olish' : 'докупить',
    pcs: isUz ? 'dona' : 'шт',
    sum: isUz ? 'soʻm' : 'сум',
    noSupplier: isUz ? 'Taʼminotchisiz' : 'Без поставщика',
    send: isUz ? 'Buyurtma yuborish' : 'Отправить заказ',
    copy: isUz ? 'Nusxalash' : 'Копировать',
    copied: isUz ? 'Nusxalandi' : 'Скопировано',
    orderTitle: isUz ? 'Taʼminotchiga buyurtma' : 'Заказ поставщику',
    total: isUz ? 'Jami' : 'Итого',
    suppliers: isUz ? 'Taʼminotchilar' : 'Поставщики',
    supplierName: isUz ? 'Nomi' : 'Название',
    add: isUz ? 'Qoʻshish' : 'Добавить',
    deleteConfirm: isUz ? 'Taʼminotchini oʻchirasizmi?' : 'Удалить поставщика?',
    assignHint: isUz ? 'Tovar taʼminotchisini tanlang' : 'Выберите поставщика товара',
  };

  const load = async () => {
    try {
      const [insights, productsData, supList, assignments] = await Promise.all([
        api.analytics.inventoryInsights(companyId).catch(() => null),
        api.products.list({ companyId: String(companyId), limit: 2000 }).catch(() => []),
        api.suppliers.list(companyId).catch(() => []),
        api.suppliers.assignments(companyId).catch(() => []),
      ]);
      const products = Array.isArray(productsData) ? productsData : (productsData?.products || []);
      const priceOf = new Map<number, number>(products.map((p: any) => [p.id, p.price || 0]));
      const planRows: PlanRow[] = ((insights?.stockForecast || []) as any[])
        .map((r) => {
          const recommend = Math.max(0, Math.ceil((r.soldPerDay || 0) * 14 - (r.stock || 0)));
          return {
            productId: r.productId,
            name: r.name,
            stock: r.stock || 0,
            soldPerDay: r.soldPerDay || 0,
            recommend,
            cost: recommend * (priceOf.get(r.productId) || 0),
          };
        })
        .filter((r) => r.recommend > 0)
        .sort((a, b) => b.cost - a.cost);
      setRows(planRows);
      setSuppliersList(Array.isArray(supList) ? supList : []);
      setSupplierOf(new Map(((assignments || []) as any[]).map((a) => [a.productId, a.supplierId])));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [companyId]);

  const groups = useMemo(() => {
    const map = new Map<number, PlanRow[]>();
    for (const r of rows) {
      const sid = supplierOf.get(r.productId) || 0;
      if (!map.has(sid)) map.set(sid, []);
      map.get(sid)!.push(r);
    }
    return Array.from(map.entries())
      .map(([sid, list]) => ({
        supplier: sid === 0 ? null : suppliersList.find((s) => s.id === sid) || null,
        rows: list,
        total: list.reduce((s, r) => s + r.cost, 0),
      }))
      .sort((a, b) => (a.supplier ? 0 : 1) - (b.supplier ? 0 : 1) || b.total - a.total);
  }, [rows, supplierOf, suppliersList]);

  const budget = rows.reduce((s, r) => s + r.cost, 0);

  const orderText = (group: (typeof groups)[number]) =>
    [
      `📦 ${L.orderTitle}${group.supplier ? ` — ${group.supplier.name}` : ''}`,
      '────────────────',
      ...group.rows.map((r) => `• ${r.name} — ${fmt(r.recommend)} ${L.pcs}`),
      '────────────────',
      `${L.total}: ~${fmt(group.total)} ${L.sum}`,
    ].join('\n');

  const sendOrder = (group: (typeof groups)[number]) => {
    const text = orderText(group);
    if (group.supplier?.telegram) {
      window.open(`https://t.me/${group.supplier.telegram}?text=${encodeURIComponent(text)}`, '_blank');
    } else {
      window.open(`https://t.me/share/url?url=&text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  const copyOrder = async (group: (typeof groups)[number]) => {
    try {
      await navigator.clipboard.writeText(orderText(group));
      toast.success(L.copied);
    } catch {
      /* ignore */
    }
  };

  const assign = async (productId: number, supplierId: number | null) => {
    try {
      await api.suppliers.assign(companyId, productId, supplierId);
      setSupplierOf((prev) => {
        const next = new Map(prev);
        if (supplierId === null) next.delete(productId);
        else next.set(productId, supplierId);
        return next;
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const addSupplier = async () => {
    if (!newSupplier.name.trim()) return;
    try {
      await api.suppliers.create({
        companyId,
        name: newSupplier.name.trim(),
        telegram: newSupplier.telegram.trim(),
      });
      setNewSupplier({ name: '', telegram: '' });
      const list = await api.suppliers.list(companyId);
      setSuppliersList(Array.isArray(list) ? list : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const deleteSupplier = async (id: number) => {
    if (!confirm(L.deleteConfirm)) return;
    try {
      await api.suppliers.delete(id);
      setSuppliersList((prev) => prev.filter((s) => s.id !== id));
      setSupplierOf((prev) => {
        const next = new Map(prev);
        for (const [pid, sid] of next) if (sid === id) next.delete(pid);
        return next;
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const selectStyle: React.CSSProperties = {
    padding: '5px 8px', borderRadius: 8, background: 'var(--ax-input)',
    border: '1px solid var(--ax-border)', color: 'var(--ax-text-2)', fontSize: 12, outline: 'none',
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--ax-surface)', border: '1px solid var(--ax-border)', borderRadius: 18, width: '100%', maxWidth: 660, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--ax-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)' }}>
            <Sparkles style={{ width: 18, height: 18, color: '#fff' }} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'var(--ax-text)', fontWeight: 700, fontSize: 16 }}>🤖 {L.title}</div>
            <div style={{ color: 'var(--ax-text-3)', fontSize: 12 }}>{L.hint}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ax-text-2)', cursor: 'pointer' }}>
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--ax-text-2)', padding: 32 }}>...</div>
          ) : rows.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#22C55E', padding: 32, fontWeight: 600 }}>{L.empty}</div>
          ) : (
            <>
              <div style={{ background: 'var(--ax-card)', border: '1px solid var(--ax-border)', borderRadius: 14, padding: 14, marginBottom: 16 }}>
                <div style={{ color: 'var(--ax-text-2)', fontSize: 12.5 }}>{L.budget}</div>
                <div style={{ color: '#FBBF24', fontSize: 22, fontWeight: 800 }}>{fmt(budget)} {L.sum}</div>
              </div>

              {/* Группы по поставщикам */}
              {groups.map((group, gi) => (
                <div key={group.supplier?.id ?? `none-${gi}`} style={{ marginBottom: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 14 }}>{group.supplier ? '🚚' : '❓'}</span>
                    <span style={{ color: 'var(--ax-text)', fontWeight: 700, fontSize: 14, flex: 1 }}>
                      {group.supplier ? group.supplier.name : L.noSupplier}
                    </span>
                    <span style={{ color: 'var(--ax-text-3)', fontSize: 12.5 }}>~{fmt(group.total)} {L.sum}</span>
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {group.rows.map((r) => (
                      <div key={r.productId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, background: 'var(--ax-card)', border: '1px solid var(--ax-border)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: 'var(--ax-text)', fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                          <div style={{ color: 'var(--ax-text-3)', fontSize: 12 }}>
                            {L.left}: {fmt(r.stock)} · {r.soldPerDay.toFixed(1)} {L.perDay}
                          </div>
                        </div>
                        <select
                          value={supplierOf.get(r.productId) || ''}
                          onChange={(e) => assign(r.productId, e.target.value ? Number(e.target.value) : null)}
                          title={L.assignHint}
                          style={selectStyle}
                        >
                          <option value="">{L.noSupplier}</option>
                          {suppliersList.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: 'var(--ax-primary)', fontWeight: 800, fontSize: 14.5 }}>+{fmt(r.recommend)} {L.pcs}</div>
                          {r.cost > 0 && <div style={{ color: 'var(--ax-text-3)', fontSize: 11.5 }}>~{fmt(r.cost)}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      onClick={() => sendOrder(group)}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 0', borderRadius: 10, background: 'rgba(34,197,94,0.15)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.3)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                    >
                      <Send style={{ width: 14, height: 14 }} />
                      {L.send}{group.supplier?.telegram ? ' · Telegram' : ''}
                    </button>
                    <button
                      onClick={() => copyOrder(group)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, background: 'var(--ax-primary-pale)', color: 'var(--ax-primary)', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                    >
                      <Copy style={{ width: 14, height: 14 }} /> {L.copy}
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Справочник поставщиков */}
          <div style={{ borderTop: '1px solid var(--ax-border)', paddingTop: 14, marginTop: 4 }}>
            <div style={{ color: 'var(--ax-text)', fontWeight: 700, fontSize: 13.5, marginBottom: 10 }}>🚚 {L.suppliers}</div>
            {suppliersList.map((s) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 13, color: 'var(--ax-text-2)' }}>
                <span style={{ flex: 1 }}>
                  {s.name}{s.telegram ? ` · @${s.telegram}` : ''}{s.phone ? ` · +998 ${s.phone}` : ''}
                </span>
                <button onClick={() => deleteSupplier(s.id)} style={{ background: 'none', border: 'none', color: 'var(--ax-text-3)', cursor: 'pointer' }}>
                  <Trash2 style={{ width: 14, height: 14 }} />
                </button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input
                value={newSupplier.name}
                onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                placeholder={L.supplierName}
                style={{ flex: 2, padding: '8px 12px', borderRadius: 10, background: 'var(--ax-input)', border: '1px solid var(--ax-border)', color: 'var(--ax-text)', fontSize: 13, outline: 'none' }}
              />
              <input
                value={newSupplier.telegram}
                onChange={(e) => setNewSupplier({ ...newSupplier, telegram: e.target.value.replace(/@/g, '') })}
                placeholder="Telegram"
                style={{ flex: 1.4, padding: '8px 12px', borderRadius: 10, background: 'var(--ax-input)', border: '1px solid var(--ax-border)', color: 'var(--ax-text)', fontSize: 13, outline: 'none' }}
              />
              <button
                onClick={addSupplier}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 10, background: 'var(--ax-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                <Plus style={{ width: 14, height: 14 }} /> {L.add}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
