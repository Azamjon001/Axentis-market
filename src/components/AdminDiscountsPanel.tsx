import React, { useState, useEffect } from 'react';
import api, { getImageUrl } from '../utils/api';

interface Discount {
  id: number;
  companyId: number;
  productId: number;
  discountPercent: number;
  title?: string;
  description?: string;
  status: string;
  adminReviewed: boolean;
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

export default function AdminDiscountsPanel() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDiscounts();
  }, []);

  const fetchDiscounts = async () => {
    setLoading(true);
    try {
      const response = await api.discounts.listApproved(); // Только одобренные
      setDiscounts(response || []);
    } catch (error) {
      console.error('Ошибка загрузки скидок:', error);
    }
    setLoading(false);
  };

  const handleDeleteDiscount = async (id: number) => {
    if (!confirm('Удалить скидку?')) return;

    try {
      await api.discounts.delete(id);
      fetchDiscounts();
    } catch (error) {
      alert('Ошибка удаления скидки');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>
          🏷️ Активные скидки ({discounts.length})
        </h2>
      </div>
      <div style={styles.discountsList}>
        {loading ? (
          <div style={styles.loading}>Загрузка...</div>
        ) : discounts.length === 0 ? (
          <div style={styles.empty}>
            <p>Нет активных скидок</p>
          </div>
        ) : (
          discounts.map(discount => {
            const images = discount.productImages ? JSON.parse(discount.productImages) : [];
            const firstImage = images[0];
            // 🔥 ИСПРАВЛЕНО: Скидка применяется только на наценку, а не на полную цену
            // productBasePrice = базовая цена (12,000,000), productPrice = цена с наценкой (14,760,000)
            const basePrice = discount.productBasePrice || 0;
            const sellingPrice = discount.productPrice || 0;
            const markupAmount = sellingPrice - basePrice;
            const discountAmount = markupAmount * (discount.discountPercent / 100);
            const discountedPrice = sellingPrice - discountAmount;

            return (
              <div key={discount.id} style={styles.discountCard}>
                <div style={styles.cardHeader}>
                  <div style={styles.discountBadge}>
                    -{discount.discountPercent}%
                  </div>
                  <button 
                    style={styles.deleteButton}
                    onClick={() => handleDeleteDiscount(discount.id)}
                    title="Удалить"
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
                    <div style={styles.companyInfo}>
                      {discount.companyLogo && (
                        <img 
                          src={getImageUrl(discount.companyLogo) || ''} 
                          alt={discount.companyName}
                          style={styles.companyLogo}
                        />
                      )}
                      <span style={styles.companyName}>{discount.companyName}</span>
                    </div>

                    <h3 style={styles.productName}>{discount.productName}</h3>
                    
                    <div style={styles.priceContainer}>
                      <span style={styles.originalPrice}>
                        {discount.productPrice.toLocaleString()} сум
                      </span>
                      <span style={styles.discountPercent}>
                        -{discount.discountPercent}%
                      </span>
                      <span style={styles.finalPrice}>
                        {discountedPrice.toLocaleString()} сум
                      </span>
                    </div>

                    {discount.title && (
                      <div style={styles.discountTitle}>
                        🎉 {discount.title}
                      </div>
                    )}

                    {discount.description && (
                      <div style={styles.description}>
                        {discount.description}
                      </div>
                    )}

                    <div style={styles.dates}>
                      Создано: {new Date(discount.createdAt).toLocaleDateString('ru-RU')}
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
    maxWidth: '1400px',
    margin: '0 auto'
  },
  header: {
    marginBottom: '20px'
  },
  title: {
    margin: 0,
    fontSize: '28px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  pendingBadge: {
    backgroundColor: '#ef4444',
    color: 'white',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '16px'
  },
  filterBar: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
    flexWrap: 'wrap' as 'wrap'
  },
  filterButton: {
    padding: '10px 20px',
    backgroundColor: '#f3f4f6',
    border: '2px solid transparent',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s'
  },
  filterButtonActive: {
    backgroundColor: '#3b82f6',
    color: 'white',
    borderColor: '#2563eb'
  },
  discountsList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '20px'
  },
  loading: {
    textAlign: 'center' as 'center',
    padding: '40px',
    color: '#6b7280',
    gridColumn: '1 / -1'
  },
  empty: {
    textAlign: 'center' as 'center',
    padding: '40px',
    color: '#6b7280',
    gridColumn: '1 / -1'
  },
  discountCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    overflow: 'hidden',
    transition: 'transform 0.2s',
    ':hover': {
      transform: 'translateY(-4px)'
    }
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 15px',
    backgroundColor: '#f9fafb'
  },
  discountBadge: {
    padding: '4px 12px',
    borderRadius: '12px',
    backgroundColor: '#ef4444',
    color: 'white',
    fontSize: '14px',
    fontWeight: '700'
  },
  deleteButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '18px',
    opacity: 0.6,
    transition: 'opacity 0.2s'
  },
  cardBody: {
    display: 'flex',
    flexDirection: 'column' as 'column'
  },
  productImage: {
    width: '100%',
    height: '220px',
    objectFit: 'cover' as 'cover'
  },
  cardContent: {
    padding: '15px'
  },
  companyInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '10px',
    padding: '6px 10px',
    backgroundColor: '#3b82f6',
    borderRadius: '6px'
  },
  companyLogo: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    objectFit: 'cover' as 'cover',
    flexShrink: 0
  },
  companyName: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#ffffff'
  },
  productName: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '10px',
    color: '#111827'
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
    color: '#10b981'
  },
  discountTitle: {
    backgroundColor: '#fef3c7',
    padding: '8px',
    borderRadius: '6px',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: '500'
  },
  description: {
    fontSize: '13px',
    color: '#6b7280',
    marginBottom: '10px',
    lineHeight: '1.4'
  },
  dates: {
    fontSize: '12px',
    color: '#9ca3af',
    marginBottom: '12px'
  },
  actions: {
    display: 'flex',
    gap: '8px'
  },
  approveButton: {
    flex: 1,
    padding: '10px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'background-color 0.2s'
  },
  rejectButton: {
    flex: 1,
    padding: '10px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'background-color 0.2s'
  },
  changeStatusButton: {
    flex: 1,
    padding: '10px',
    backgroundColor: '#6b7280',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'background-color 0.2s'
  }
};
