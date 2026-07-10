import React, { useState, useEffect } from 'react';
import CompanyDiscountsPanel from './CompanyDiscountsPanel';
import CompanyAggressiveDiscountsPanel from './CompanyAggressiveDiscountsPanel';
import CompanyPromoCodesPanel from './CompanyPromoCodesPanel';
import CompanyCampaignsPanel from './CompanyCampaignsPanel';
import { getCurrentLanguage, useTranslation, type Language } from '../utils/translations';
import api from '../utils/api';

interface CompanyDiscountsManagerProps {
  companyId: number;
  products?: any[];
}

export default function CompanyDiscountsManager({ companyId, products = [] }: CompanyDiscountsManagerProps) {
  const [activeTab, setActiveTab] = useState<'regular' | 'aggressive' | 'promo' | 'campaigns'>('regular');
  const [language, setLanguage] = useState<Language>(getCurrentLanguage());
  const t = useTranslation(language);
  // 🎟️ Промокоды доступны только закрытым (приватным) магазинам: у публичных
  // магазинов раздача кодов не имеет смысла — товары и так видны всем.
  const [companyMode, setCompanyMode] = useState<'public' | 'private' | null>(null);
  const promoAllowed = companyMode === 'private';

  useEffect(() => {
    let cancelled = false;
    api.companies.get(String(companyId))
      .then((c: any) => { if (!cancelled) setCompanyMode(c?.mode === 'private' ? 'private' : 'public'); })
      .catch(() => { if (!cancelled) setCompanyMode('public'); });
    return () => { cancelled = true; };
  }, [companyId]);

  // Если магазин стал публичным, а открыта вкладка промокодов — уводим на обычные скидки
  useEffect(() => {
    if (companyMode === 'public' && activeTab === 'promo') setActiveTab('regular');
  }, [companyMode, activeTab]);

  useEffect(() => {
    // Язык меняется через кастомное событие 'languageChange' (а не 'storage'),
    // поэтому слушаем именно его — иначе вкладки скидок не переводятся.
    const handleLanguageChange = (e: CustomEvent<Language>) => setLanguage(e.detail);
    const handleStorage = () => setLanguage(getCurrentLanguage());
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('languageChange', handleLanguageChange as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return (
    <div className="discounts-panel-container" style={{ width: '100%', height: '100%' }}>
      {/* Tabs */}
      <div className="discounts-tabs" style={{
        display: 'flex',
        gap: '10px',
        padding: '20px 20px 0 20px',
        borderBottom: '2px solid #e5e7eb',
      }}>
        <button
          className={`discounts-tab ${activeTab === 'regular' ? 'discounts-tab-active' : 'discounts-tab-inactive'}`}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: '600',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
            ...(activeTab === 'regular'
              ? { borderBottom: '3px solid #3b82f6', marginBottom: '-2px' }
              : {})
          }}
          onClick={() => setActiveTab('regular')}
        >
          🏷️ {t.regularDiscounts}
        </button>
        <button
          className={`discounts-tab ${activeTab === 'aggressive' ? 'discounts-tab-active' : 'discounts-tab-inactive'}`}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: '600',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
            ...(activeTab === 'aggressive'
              ? { borderBottom: '3px solid #3b82f6', marginBottom: '-2px' }
              : {})
          }}
          onClick={() => setActiveTab('aggressive')}
        >
          🔥 {t.aggressiveDiscounts}
        </button>
        {promoAllowed && (
          <button
            className={`discounts-tab ${activeTab === 'promo' ? 'discounts-tab-active' : 'discounts-tab-inactive'}`}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: '600',
              border: 'none',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
              ...(activeTab === 'promo'
                ? { borderBottom: '3px solid #3b82f6', marginBottom: '-2px' }
                : {})
            }}
            onClick={() => setActiveTab('promo')}
          >
            🎟️ {language === 'uz' ? 'Promokodlar' : 'Промокоды'}
          </button>
        )}
        <button
          className={`discounts-tab ${activeTab === 'campaigns' ? 'discounts-tab-active' : 'discounts-tab-inactive'}`}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: '600',
            border: 'none',
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
            ...(activeTab === 'campaigns'
              ? { borderBottom: '3px solid #3b82f6', marginBottom: '-2px' }
              : {})
          }}
          onClick={() => setActiveTab('campaigns')}
        >
          🎉 {language === 'uz' ? 'Aksiyalar' : 'Кампании'}
        </button>
      </div>

      {/* Content */}
      <div className="discounts-content" style={{ minHeight: 'calc(100vh - 120px)' }}>
        {activeTab === 'regular' && (
          <CompanyDiscountsPanel companyId={companyId} products={products} />
        )}
        {activeTab === 'aggressive' && (
          <CompanyAggressiveDiscountsPanel companyId={companyId} products={products} />
        )}
        {activeTab === 'promo' && promoAllowed && (
          <CompanyPromoCodesPanel companyId={companyId} />
        )}
        {activeTab === 'campaigns' && (
          <CompanyCampaignsPanel companyId={companyId} products={products} />
        )}
      </div>
    </div>
  );
}
