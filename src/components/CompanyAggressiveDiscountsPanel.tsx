import React, { useState, useEffect } from 'react';
import api, { API_BASE, getImageUrl } from '../utils/api';
import { getCurrentLanguage, useTranslation, type Language } from '../utils/translations';

interface AggressiveDiscount {
  id: number;
  companyId: number;
  productId: number;
  discountPercent: number;
  title?: string;
  description?: string;
  status: string;
  adminReviewed: boolean;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
  productName: string;
  productImages: string;
  productPrice: number;
  productBasePrice: number;
  markupPercent: number;
  companyName: string;
  companyLogo?: string;
}

interface CompanyAggressiveDiscountsPanelProps {
  companyId: number;
  products?: any[];
}

export default function CompanyAggressiveDiscountsPanel({ companyId, products: initialProducts = [] }: CompanyAggressiveDiscountsPanelProps) {
  const [discounts, setDiscounts] = useState<AggressiveDiscount[]>([]);
  const [regularDiscounts, setRegularDiscounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [products, setProducts] = useState<any[]>(initialProducts);
  const [variants, setVariants] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    productId: '',
    variantId: '', // '' = весь товар, иначе конкретный SKU
    discountPercent: '',
    title: '',
    description: '',
    startDate: '',
    endDate: ''
  });

  // 🌍 Переводы
  const [language, setLanguage] = useState<Language>(getCurrentLanguage());
  const t = useTranslation(language);

  // 🔄 Слушаем изменения языка
  useEffect(() => {
    const handleLanguageChange = (e: CustomEvent) => {
      setLanguage(e.detail);
    };
    
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    
    return () => {
      window.removeEventListener('languageChange', handleLanguageChange as EventListener);
    };
  }, []);

  useEffect(() => {
    fetchDiscounts();
    fetchRegularDiscounts();
    if (initialProducts.length === 0) {
      fetchProducts();
    }
  }, [companyId]);

  const fetchProducts = async () => {
    try {
      const response = await api.products.list({ companyId: String(companyId) });
      setProducts(response || []);
    } catch (error) {
      console.error('Ошибка загрузки товаров:', error);
    }
  };

  const fetchVariants = async (productId: string) => {
    if (!productId) { setVariants([]); return; }
    try {
      const list = await api.products.getVariants(productId);
      setVariants(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Ошибка загрузки вариантов:', error);
      setVariants([]);
    }
  };

  const fetchDiscounts = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/aggressive-discounts/company/${companyId}`);
      if (response.ok) {
        const data = await response.json();
        setDiscounts(data || []);
      }
    } catch (error) {
      console.error('Ошибка загрузки агрессивных скидок:', error);
    }
    setLoading(false);
  };

  const fetchRegularDiscounts = async () => {
    try {
      const response = await api.discounts.listByCompany(companyId);
      setRegularDiscounts(response || []);
    } catch (error) {
      console.error('Ошибка загрузки обычных скидок:', error);
    }
  };

  // Get IDs of products already in either discount type
  const getUsedProductIds = () => {
    const regularIds = regularDiscounts.map(d => d.productId);
    const aggressiveIds = discounts.map(d => d.productId);
    return [...regularIds, ...aggressiveIds];
  };

  // Filter products not already in discounts
  const getAvailableProducts = () => {
    const usedIds = getUsedProductIds();
    return products.filter(p => !usedIds.includes(p.id));
  };

  const handleCreateDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.productId || !formData.discountPercent) {
      alert(t.selectProductError);
      return;
    }

    // Validate dates if provided
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      const hoursDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff < 1) {
        alert(t.minDurationOneHour);
        return;
      }
    }

    try {
      // Используем авторизованный API-вызов (эндпоинт требует токен компании,
      // раньше сырой fetch без токена возвращал 401 и скидка не создавалась).
      await api.aggressiveDiscounts.create({
        companyId,
        productId: parseInt(formData.productId),
        variantId: formData.variantId ? parseInt(formData.variantId) : null,
        discountPercent: parseFloat(formData.discountPercent),
        title: formData.title || undefined,
        description: formData.description || undefined,
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : undefined,
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
      });

      alert(t.discountCreated);
      setFormData({
        productId: '',
        variantId: '',
        discountPercent: '',
        title: '',
        description: '',
        startDate: '',
        endDate: ''
      });
      setVariants([]);
      setShowForm(false);
      fetchDiscounts();
    } catch (error: any) {
      alert(error.message || t.discountCreationError);
    }
  };

  const handleDeleteDiscount = async (id: number) => {
    if (!confirm(t.deleteDiscountConfirm)) return;

    try {
      await api.aggressiveDiscounts.delete(id);
      fetchDiscounts();
    } catch (error) {
      alert(t.errorDeletingDiscount);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#10b981';
      case 'rejected': return '#ef4444';
      default: return '#f59e0b';
    }
  };

  const isDiscountActive = (discount: AggressiveDiscount) => {
    if (!discount.startDate && !discount.endDate) return true;
    
    const now = new Date();
    if (discount.startDate && new Date(discount.startDate) > now) return false;
    if (discount.endDate && new Date(discount.endDate) < now) return false;
    
    return true;
  };

  const getStatusText = (discount: AggressiveDiscount) => {
    if (!isDiscountActive(discount)) return t.inactiveStatus;
    return t.activeStatus;
  };

  const availableProducts = getAvailableProducts();

  return (
    <div className="discounts-panel-container" style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>🔥 {t.aggressiveDiscounts}</h2>
          <p className="discount-subtitle" style={styles.subtitle}>{t.discountOnFullAmount}</p>
        </div>
        <button 
          style={styles.createButton} 
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? `✖ ${t.closeBtn}` : `➕ ${t.createAggressiveDiscount}`}
        </button>
      </div>

      {showForm && (
        <form className="discount-form" style={styles.form} onSubmit={handleCreateDiscount}>
          <div style={styles.formGroup}>
            <label style={styles.label}>{t.product} *</label>
            <select
              style={styles.select}
              value={formData.productId}
              onChange={(e) => {
                setFormData({ ...formData, productId: e.target.value, variantId: '' });
                fetchVariants(e.target.value);
              }}
              required
            >
              <option value="">{t.selectProduct}</option>
              {availableProducts.map(product => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.sellingPrice.toLocaleString()} {t.currency})
                </option>
              ))}
            </select>
            {availableProducts.length === 0 && (
              <p style={styles.warning}>
                ⚠️ {t.allProductsOnDiscount}
              </p>
            )}
          </div>

          {/* Применить ко всему товару или к конкретному SKU-варианту */}
          {formData.productId && variants.length > 0 && (
            <div style={styles.formGroup}>
              <label style={styles.label}>{t.applyToVariant}</label>
              <select
                style={styles.select}
                value={formData.variantId}
                onChange={(e) => setFormData({ ...formData, variantId: e.target.value })}
              >
                <option value="">{t.wholeProductAnyVariant}</option>
                {variants.map((v: any) => (
                  <option key={v.id} value={v.id}>
                    {[v.color, v.size, v.sku].filter(Boolean).join(' / ') || `#${v.id}`}
                    {typeof v.sellingPrice === 'number' ? ` — ${v.sellingPrice.toLocaleString()} ${t.currency}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={styles.formGroup}>
            <label style={styles.label}>{t.discountPercentLabel}</label>
            <input
              type="number"
              style={styles.input}
              value={formData.discountPercent}
              onChange={(e) => setFormData({ ...formData, discountPercent: e.target.value })}
              min="0"
              max="100"
              step="0.01"
              required
            />
            <p style={styles.hint}>
              ⚡ {t.aggressiveDiscountHint}
            </p>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>{t.promoTitleLabel}</label>
            <input
              type="text"
              style={styles.input}
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder={t.promoTitlePlaceholder}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>{t.descriptionLabel}</label>
            <textarea
              style={styles.textarea}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t.descriptionPlaceholder}
              rows={3}
            />
          </div>

          <div style={styles.dateRow}>
            <div style={styles.formGroup}>
              <label style={styles.label}>{t.startDateLabel}</label>
              <input
                type="datetime-local"
                style={styles.input}
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>{t.endDateLabel}</label>
              <input
                type="datetime-local"
                style={styles.input}
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </div>
          </div>
          <p style={styles.hint}>
            ⏱️ {t.durationHint}
          </p>

          <button type="submit" style={styles.submitButton}>
            {t.createAggressiveDiscount}
          </button>
        </form>
      )}

      <div style={styles.discountsList}>
        {loading ? (
          <div style={styles.loading}>{t.loadingText}</div>
        ) : discounts.length === 0 ? (
          <div style={styles.empty}>
            <p>{t.noActiveDiscounts}</p>
            <p style={styles.emptyHint}>{t.useAggressiveForLiquidation}</p>
          </div>
        ) : (
          discounts.map(discount => {
            const images = discount.productImages ? JSON.parse(discount.productImages) : [];
            const firstImage = images[0];
            
            // Calculate aggressive discount on FULL price (base + markup)
            const basePrice = discount.productBasePrice || 0;
            const sellingPrice = discount.productPrice || 0;
            const discountAmount = sellingPrice * (discount.discountPercent / 100);
            const finalPrice = sellingPrice - discountAmount;
            const isLoss = finalPrice < basePrice;
            const active = isDiscountActive(discount);

            return (
              <div key={discount.id} className="discount-card" style={{
                ...styles.discountCard,
                opacity: active ? 1 : 0.6
              }}>
                <div className="discount-card-header" style={styles.cardHeader}>
                  <div style={{
                    ...styles.statusBadge, 
                    backgroundColor: active ? '#ef4444' : '#9ca3af'
                  }}>
                    🔥 {getStatusText(discount)}
                  </div>
                  <button 
                    style={styles.deleteButton}
                    onClick={() => handleDeleteDiscount(discount.id)}
                  >
                    🗑️
                  </button>
                </div>

                <div style={styles.cardBody}>
                  {firstImage && (
                    <img 
                      src={getImageUrl(firstImage) || ''} 
                      alt={discount.productName}
                      style={styles.productImage}
                    />
                  )}
                  
                  <div style={styles.cardContent}>
                    <h3 className="discount-product-name" style={styles.productName}>{discount.productName}</h3>
                    
                    <div style={styles.priceContainer}>
                      <span style={styles.originalPrice}>
                        {sellingPrice.toLocaleString()} {t.currency}
                      </span>
                      <span style={styles.discountPercent}>
                        -{discount.discountPercent}%
                      </span>
                      <span style={styles.finalPrice}>
                        {Math.round(finalPrice).toLocaleString()} {t.currency}
                      </span>
                    </div>

                    {isLoss && (
                      <div className="discount-warning-badge" style={styles.warningBadge}>
                        ⚠️ {t.priceBelowCost} ({basePrice.toLocaleString()} {t.currency})
                      </div>
                    )}

                    {discount.title && (
                      <div className="discount-title-badge" style={styles.discountTitle}>
                        🔥 {discount.title}
                      </div>
                    )}

                    {discount.description && (
                      <div className="discount-description" style={styles.description}>
                        {discount.description}
                      </div>
                    )}

                    {(discount.startDate || discount.endDate) && (
                      <div className="discount-date-range" style={styles.dateRange}>
                        {discount.startDate && (
                          <div>📅 {t.startLabel}: {new Date(discount.startDate).toLocaleString('uz-UZ')}</div>
                        )}
                        {discount.endDate && (
                          <div>📅 {t.endLabel}: {new Date(discount.endDate).toLocaleString('uz-UZ')}</div>
                        )}
                      </div>
                    )}

                    <div className="discount-dates" style={styles.dates}>
                      {t.createdDate}: {new Date(discount.createdAt).toLocaleDateString('uz-UZ')}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    padding: '20px',
    maxWidth: '1200px',
    margin: '0 auto'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    gap: '20px'
  },
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 'bold'
  },
  subtitle: {
    margin: '5px 0 0 0',
    fontSize: '14px',
    color: '#6b7280'
  },
  createButton: {
    padding: '10px 20px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    whiteSpace: 'nowrap'
  },
  form: {
    padding: '20px',
    borderRadius: '12px',
    marginBottom: '20px'
  },
  formGroup: {
    marginBottom: '15px'
  },
  label: {
    display: 'block',
    marginBottom: '5px',
    fontWeight: '500',
    fontSize: '14px'
  },
  select: {
    width: '100%',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '14px'
  },
  input: {
    width: '100%',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '14px',
    boxSizing: 'border-box'
  },
  textarea: {
    width: '100%',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '14px',
    resize: 'vertical' as 'vertical',
    boxSizing: 'border-box'
  },
  hint: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '5px'
  },
  warning: {
    fontSize: '12px',
    color: '#ef4444',
    marginTop: '5px'
  },
  dateRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '15px'
  },
  submitButton: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '600'
  },
  discountsList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '20px'
  },
  loading: {
    textAlign: 'center' as 'center',
    padding: '40px',
    color: '#6b7280'
  },
  empty: {
    textAlign: 'center' as 'center',
    padding: '40px',
    color: '#6b7280',
    gridColumn: '1 / -1'
  },
  emptyHint: {
    fontSize: '14px',
    marginTop: '10px'
  },
  discountCard: {
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    overflow: 'hidden',
    border: '2px solid #fecaca'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 15px',
  },
  statusBadge: {
    padding: '4px 12px',
    borderRadius: '12px',
    color: 'white',
    fontSize: '12px',
    fontWeight: '600'
  },
  deleteButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '18px'
  },
  cardBody: {
    display: 'flex',
    flexDirection: 'column' as 'column'
  },
  productImage: {
    width: '100%',
    height: '200px',
    objectFit: 'cover' as 'cover'
  },
  cardContent: {
    padding: '15px'
  },
  productName: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '10px'
  },
  priceContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '10px',
    flexWrap: 'wrap' as 'wrap'
  },
  originalPrice: {
    textDecoration: 'line-through',
    color: '#9ca3af',
    fontSize: '14px'
  },
  discountPercent: {
    backgroundColor: '#ef4444',
    color: 'white',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: '600'
  },
  finalPrice: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#ef4444'
  },
  warningBadge: {
    padding: '8px',
    borderRadius: '6px',
    marginBottom: '8px',
    fontSize: '12px',
    fontWeight: '500'
  },
  discountTitle: {
    padding: '8px',
    borderRadius: '6px',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: '500'
  },
  description: {
    fontSize: '13px',
    color: '#6b7280',
    marginBottom: '8px'
  },
  dateRange: {
    padding: '8px',
    borderRadius: '6px',
    marginBottom: '8px',
    fontSize: '12px'
  },
  dates: {
    fontSize: '12px',
    color: '#9ca3af'
  }
};
