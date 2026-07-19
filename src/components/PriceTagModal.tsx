import { QRCodeSVG } from 'qrcode.react';
import { X, Printer } from 'lucide-react';
import { useUiLang } from '../hooks/useUiLang';

// ============================================================================
// 🏷 Генератор ценника — тот же макет, что в мобильном приложении:
// название, крупная цена продажи, штрих-код цифрами и QR на страницу товара
// (axentis.uz/product/:id). Кнопка печати открывает системный диалог —
// ценник печатается на любом принтере или сохраняется в PDF.
// ============================================================================

interface Props {
  product: {
    id: number;
    name: string;
    price: number;
    markupPercent?: number;
    barcode?: string;
    brand?: string;
  };
  onClose: () => void;
}

export default function PriceTagModal({ product, onClose }: Props) {
  const lang = useUiLang();
  const isUz = lang === 'uz';

  const sellPrice = Math.round((product.price || 0) * (1 + (product.markupPercent || 0) / 100));
  const fmt = (n: number) => Math.round(n || 0).toLocaleString('ru-RU');

  const print = () => {
    const node = document.getElementById('ax-price-tag');
    if (!node) return;
    const win = window.open('', '_blank', 'width=480,height=520');
    if (!win) return;
    win.document.write(`
      <html><head><title>${product.name}</title>
      <style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui,-apple-system,sans-serif;}</style>
      </head><body>${node.outerHTML}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--ax-surface)', border: '1px solid var(--ax-border)', borderRadius: 18, padding: 20, width: '100%', maxWidth: 420 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ color: 'var(--ax-text)', fontSize: 16.5, fontWeight: 700 }}>
            🏷 {isUz ? 'Narx yorligʻi' : 'Ценник'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ax-text-2)', cursor: 'pointer' }}>
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Сам ценник — белый, как для печати */}
        <div id="ax-price-tag" style={{ background: '#FFFFFF', borderRadius: 14, padding: 22, border: '1px solid #E2E8F0' }}>
          <div style={{ color: '#0F172A', fontSize: 17, fontWeight: 700, lineHeight: 1.25 }}>{product.name}</div>
          {product.brand && <div style={{ color: '#64748B', fontSize: 12.5, marginTop: 2 }}>{product.brand}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#0F172A', fontSize: 34, fontWeight: 900, lineHeight: 1 }}>{fmt(sellPrice)}</div>
              <div style={{ color: '#64748B', fontSize: 13, fontWeight: 600, marginTop: 4 }}>{isUz ? 'soʻm' : 'сум'}</div>
              {product.barcode && (
                <div style={{ color: '#94A3B8', fontSize: 12.5, marginTop: 12, letterSpacing: 2, fontVariantNumeric: 'tabular-nums' }}>
                  {product.barcode}
                </div>
              )}
            </div>
            <QRCodeSVG value={`https://axentis.uz/product/${product.id}`} size={96} bgColor="#FFFFFF" fgColor="#0F172A" />
          </div>
          <div style={{ color: '#94A3B8', fontSize: 10.5, marginTop: 14 }}>axentis.uz · Axentis Market</div>
        </div>

        <div style={{ color: 'var(--ax-text-3)', fontSize: 12, margin: '12px 0' }}>
          💡 {isUz ? 'QR-ni skanerlang — tovar sahifasi ochiladi' : 'Отсканируйте QR — откроется страница товара'}
        </div>

        <button
          onClick={print}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0', borderRadius: 12, background: 'linear-gradient(135deg, #7C5CF0, #5B3DD4)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14.5 }}
        >
          <Printer style={{ width: 16, height: 16 }} />
          {isUz ? 'Chop etish / PDF' : 'Печать / PDF'}
        </button>
      </div>
    </div>
  );
}
