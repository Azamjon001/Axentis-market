import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Package, Plus, Trash2, Check, Search, Boxes } from 'lucide-react';
import api, { getImageUrl } from '../utils/api';
import { toast } from 'sonner@2.0.3';
import { getCurrentLanguage, type Language } from '../utils/translations';

// 🧩 Комплекты «вместе дешевле»: продавец выбирает 2–5 своих товаров и
// назначает скидку за покупку всего набора. Покупатель видит комплект на
// карточке любого товара из него, прошлым покупателям уходит push, а скидка
// применяется автоматически при оформлении.

interface BundleItem { id: number; name: string; price: number; image?: string }
interface Bundle { id: number; name: string; discountPercent: number; isActive: boolean; items: BundleItem[] }
interface ProductRow { id: number; name: string; sellingPrice?: number; price: number; images?: string[] }

const fmt = (n: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(n || 0)) + ' сум';

export default function CompanyBundlesPanel({ companyId }: { companyId: number }) {
  const [language, setLanguage] = useState<Language>(getCurrentLanguage());
  const uz = language === 'uz';
  useEffect(() => {
    const onLang = (e: CustomEvent) => setLanguage(e.detail);
    window.addEventListener('languageChange', onLang as EventListener);
    return () => window.removeEventListener('languageChange', onLang as EventListener);
  }, []);

  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Форма создания
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [percent, setPercent] = useState('10');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [bs, ps] = await Promise.all([
        api.companies.listBundles(companyId).catch(() => []),
        api.products.list({ companyId: String(companyId), limit: 500 }).catch(() => []),
      ]);
      setBundles(Array.isArray(bs) ? bs : []);
      const rawProducts = Array.isArray(ps) ? ps : (ps as any)?.products || [];
      setProducts(rawProducts.filter((p: any) => !String(p.name || '').startsWith('__CATEGORY_MARKER__')));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [companyId]);

  const toggleProduct = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id)
        : prev.length >= 5 ? prev
        : [...prev, id]);
  };

  const unitPrice = (p: ProductRow) => p.sellingPrice || p.price || 0;
  const selectedProducts = products.filter(p => selectedIds.includes(p.id));
  const selectedSum = selectedProducts.reduce((s, p) => s + unitPrice(p), 0);
  const pctNum = Math.max(0, Math.min(90, parseFloat(percent) || 0));

  const submit = async () => {
    if (selectedIds.length < 2) {
      toast.error(uz ? 'Kamida 2 ta mahsulot tanlang' : 'Выберите минимум 2 товара');
      return;
    }
    if (pctNum < 1) {
      toast.error(uz ? 'Chegirma foizini kiriting' : 'Укажите процент скидки');
      return;
    }
    setSaving(true);
    try {
      await api.companies.createBundle(companyId, {
        name: name.trim() || undefined,
        discountPercent: pctNum,
        productIds: selectedIds,
      });
      toast.success(uz
        ? 'Toʻplam yaratildi! Oldingi xaridorlarga xabar yuborildi'
        : 'Комплект создан! Прошлым покупателям отправлено уведомление');
      setCreating(false);
      setName(''); setPercent('10'); setSelectedIds([]); setSearch('');
      load();
    } catch (e: any) {
      toast.error(e?.message || (uz ? 'Xatolik yuz berdi' : 'Не удалось создать комплект'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (bundleId: number) => {
    if (!confirm(uz ? 'Toʻplamni oʻchirish?' : 'Удалить комплект?')) return;
    try {
      await api.companies.deleteBundle(companyId, bundleId);
      setBundles(prev => prev.filter(b => b.id !== bundleId));
    } catch {
      toast.error(uz ? 'Oʻchirib boʻlmadi' : 'Не удалось удалить');
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-10 w-10" style={{ border: '3px solid rgba(124,92,240,0.25)', borderTopColor: 'var(--ax-primary)' }} />
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ color: 'var(--ax-text)', fontSize: 20, fontWeight: 800, margin: 0 }}>
            🧩 {uz ? 'Birgalikda arzonroq' : 'Комплекты «вместе дешевле»'}
          </h2>
          <p style={{ color: 'var(--ax-text-2)', fontSize: 13, margin: '4px 0 0' }}>
            {uz
              ? 'Toʻplam yarating: xaridor barcha mahsulotlarni birga olsa — chegirma avtomatik qoʻllanadi. Oldin sotib olganlarga push yuboriladi.'
              : 'Соберите комплект: покупатель берёт все товары вместе — скидка применяется сама. Тем, кто уже покупал товар из комплекта, уйдёт push-приглашение.'}
          </p>
        </div>
        {!creating && (
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setCreating(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 16px', borderRadius: 11, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #7C5CF0, #5B3DD4)', color: '#FFF', fontSize: 13.5, fontWeight: 700 }}>
            <Plus style={{ width: 15, height: 15 }} />
            {uz ? 'Toʻplam yaratish' : 'Создать комплект'}
          </motion.button>
        )}
      </div>

      {/* ── Форма создания ── */}
      <AnimatePresence>
        {creating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ background: 'var(--ax-card)', border: '1px solid var(--ax-border)', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={uz ? 'Toʻplam nomi (ixtiyoriy)' : 'Название комплекта (необязательно)'}
                  style={{ flex: '2 1 220px', background: 'var(--ax-input)', border: '1px solid var(--ax-border)', borderRadius: 10, padding: '10px 12px', color: 'var(--ax-text)', fontSize: 13.5 }}
                />
                <div style={{ position: 'relative', flex: '0 1 140px', minWidth: 110 }}>
                  <input
                    value={percent}
                    onChange={(e) => setPercent(e.target.value.replace(/[^\d.]/g, ''))}
                    inputMode="decimal"
                    placeholder={uz ? 'Chegirma' : 'Скидка'}
                    style={{ width: '100%', background: 'var(--ax-input)', border: '1px solid var(--ax-border)', borderRadius: 10, padding: '10px 28px 10px 12px', color: 'var(--ax-text)', fontSize: 13.5 }}
                  />
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ax-text-3)', fontSize: 13 }}>%</span>
                </div>
              </div>

              {/* Выбор товаров */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--ax-text-2)', fontSize: 12.5, fontWeight: 600 }}>
                    {uz ? `Mahsulotlar (${selectedIds.length}/5, kamida 2 ta)` : `Товары (${selectedIds.length}/5, минимум 2)`}
                  </span>
                  <div style={{ position: 'relative', flex: '0 1 240px' }}>
                    <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: 'var(--ax-text-3)' }} />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={uz ? 'Qidirish…' : 'Поиск…'}
                      style={{ width: '100%', background: 'var(--ax-input)', border: '1px solid var(--ax-border)', borderRadius: 9, padding: '7px 10px 7px 30px', color: 'var(--ax-text)', fontSize: 12.5 }}
                    />
                  </div>
                </div>
                <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--ax-border)', borderRadius: 12 }}>
                  {filteredProducts.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--ax-text-3)', fontSize: 13 }}>
                      {uz ? 'Mahsulot topilmadi' : 'Товары не найдены'}
                    </div>
                  ) : filteredProducts.map((p) => {
                    const on = selectedIds.includes(p.id);
                    const img = Array.isArray(p.images) ? p.images[0] : undefined;
                    return (
                      <button
                        key={p.id}
                        onClick={() => toggleProduct(p.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 12px',
                          background: on ? 'rgba(124,92,240,0.1)' : 'transparent', border: 'none',
                          borderBottom: '1px solid var(--ax-border)', cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        <span style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, border: `1.5px solid ${on ? 'var(--ax-primary)' : 'var(--ax-border)'}`, background: on ? 'var(--ax-primary)' : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          {on && <Check style={{ width: 13, height: 13, color: '#FFF' }} />}
                        </span>
                        <span style={{ width: 34, height: 34, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: '#FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          {img ? (
                            <img src={getImageUrl(img) || img} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} loading="lazy" />
                          ) : (
                            <Package style={{ width: 16, height: 16, color: '#5A5A78' }} />
                          )}
                        </span>
                        <span style={{ flex: 1, minWidth: 0, color: 'var(--ax-text)', fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                        <span style={{ color: 'var(--ax-text-2)', fontSize: 12.5, whiteSpace: 'nowrap' }}>{fmt(unitPrice(p))}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Живой расчёт комплекта */}
              {selectedIds.length >= 2 && pctNum > 0 && (
                <div style={{ background: 'var(--ax-input)', border: '1px solid var(--ax-border)', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: 'var(--ax-text-2)' }}>
                  {uz ? 'Toʻplam narxi' : 'Цена комплекта'}:{' '}
                  <span style={{ textDecoration: 'line-through' }}>{fmt(selectedSum)}</span>{' '}
                  → <span style={{ color: 'var(--ax-primary)', fontWeight: 800 }}>{fmt(selectedSum * (1 - pctNum / 100))}</span>{' '}
                  <span style={{ color: '#22C55E' }}>({uz ? 'xaridor tejaydi' : 'покупатель экономит'} {fmt(selectedSum * pctNum / 100)})</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setCreating(false); setSelectedIds([]); setSearch(''); }}
                  disabled={saving}
                  style={{ padding: '10px 16px', borderRadius: 10, background: 'var(--ax-input)', border: '1px solid var(--ax-border)', color: 'var(--ax-text-2)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
                >
                  {uz ? 'Bekor qilish' : 'Отмена'}
                </button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={submit}
                  disabled={saving || selectedIds.length < 2 || pctNum < 1}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #7C5CF0, #5B3DD4)', color: '#FFF', fontSize: 13.5, fontWeight: 700, opacity: saving || selectedIds.length < 2 || pctNum < 1 ? 0.5 : 1 }}
                >
                  <Check style={{ width: 15, height: 15 }} />
                  {saving ? (uz ? 'Saqlanmoqda…' : 'Сохранение…') : (uz ? 'Yaratish' : 'Создать комплект')}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Список комплектов ── */}
      {bundles.length === 0 && !creating ? (
        <div style={{ background: 'var(--ax-card)', border: '1px dashed var(--ax-border)', borderRadius: 16, padding: '44px 20px', textAlign: 'center', color: 'var(--ax-text-3)' }}>
          <Boxes style={{ width: 36, height: 36, margin: '0 auto 10px', color: 'var(--ax-primary)' }} />
          <div style={{ color: 'var(--ax-text)', fontSize: 15, fontWeight: 600 }}>
            {uz ? 'Hali toʻplamlar yoʻq' : 'Комплектов пока нет'}
          </div>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            {uz
              ? 'Masalan: shampun + balzam −10%. Oʻrtacha chek oshadi.'
              : 'Например: шампунь + бальзам −10%. Это поднимает средний чек.'}
          </div>
        </div>
      ) : (
        bundles.map((b) => {
          const setSum = b.items.reduce((s, it) => s + (it.price || 0), 0);
          return (
            <div key={b.id} style={{ background: 'var(--ax-card)', border: '1px solid var(--ax-border)', borderRadius: 16, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ padding: '4px 11px', borderRadius: 9, background: 'rgba(124,92,240,0.15)', color: 'var(--ax-primary)', fontSize: 13, fontWeight: 800 }}>
                  −{Math.round(b.discountPercent)}%
                </span>
                <span style={{ flex: 1, minWidth: 0, color: 'var(--ax-text)', fontSize: 14.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {b.name || (uz ? 'Toʻplam' : 'Комплект')}
                </span>
                <span style={{ color: 'var(--ax-text-2)', fontSize: 13 }}>
                  <span style={{ textDecoration: 'line-through' }}>{fmt(setSum)}</span>{' '}
                  → <span style={{ color: 'var(--ax-primary)', fontWeight: 700 }}>{fmt(setSum * (1 - b.discountPercent / 100))}</span>
                </span>
                <button
                  onClick={() => remove(b.id)}
                  title={uz ? 'Oʻchirish' : 'Удалить'}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 9, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#F87171', cursor: 'pointer' }}
                >
                  <Trash2 style={{ width: 14, height: 14 }} />
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {b.items.map((it) => (
                  <span key={it.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 10, background: 'var(--ax-input)', border: '1px solid var(--ax-border)' }}>
                    <span style={{ width: 26, height: 26, borderRadius: 6, overflow: 'hidden', background: '#FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      {it.image ? (
                        <img src={getImageUrl(it.image) || it.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} loading="lazy" />
                      ) : (
                        <Package style={{ width: 13, height: 13, color: '#5A5A78' }} />
                      )}
                    </span>
                    <span style={{ color: 'var(--ax-text)', fontSize: 12.5, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</span>
                    <span style={{ color: 'var(--ax-text-3)', fontSize: 11.5 }}>{fmt(it.price)}</span>
                  </span>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
