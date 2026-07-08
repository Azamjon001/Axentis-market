import React, { useState, useEffect } from 'react';
import { Package, TrendingDown, DollarSign, ChevronDown, ChevronUp, Clock, Download } from 'lucide-react';
import api from '../utils/api';
import { downloadCSV } from '../utils/csv';
import CompactPeriodSelector from './CompactPeriodSelector';
import { getCurrentLanguage, type Language } from '../utils/translations';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Cell,
} from 'recharts';

interface PurchaseAnalyticsProps {
  companyId: number;
}

interface ImportDetail {
  name: string;
  quantity: number;
  price: number;
  total: number;
}

interface Purchase {
  id: number;
  productName: string;
  quantity: number;
  totalCost: number;
  purchaseDate: string;
  notes?: string; // JSON string with import details
}

interface PurchaseStats {
  totalPurchases: number;
  totalQuantity: number;
  totalCost: number;
}

const BAR_COLORS = ['#7C5CF0', '#22C55E', '#F59E0B', '#EF4444', '#06B6D4'];

export default function PurchaseAnalytics({ companyId }: PurchaseAnalyticsProps) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [stats, setStats] = useState<PurchaseStats>({
    totalPurchases: 0,
    totalQuantity: 0,
    totalCost: 0,
  });
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<Language>(getCurrentLanguage());

  // Listen for language changes
  useEffect(() => {
    const handleLanguageChange = (e: CustomEvent) => {
      setLanguage(e.detail);
    };
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    return () => window.removeEventListener('languageChange', handleLanguageChange as EventListener);
  }, []);

  // Filter state
  type PeriodType = 'day' | 'yesterday' | 'week' | 'month' | 'year' | 'all' | 'custom';
  const [timePeriod, setTimePeriod] = useState<PeriodType>('month');
  // Произвольный период (от одного дня до нескольких лет)
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  useEffect(() => {
    // Для custom грузим только когда обе даты заданы
    if (timePeriod === 'custom' && !(customStartDate && customEndDate)) return;
    loadData();
  }, [companyId, timePeriod, customStartDate, customEndDate]);

  const loadData = async () => {
    try {
      setLoading(true);

      const params: any = { companyId };

      // Apply time period filter
      if (timePeriod === 'custom') {
        if (customStartDate) {
          const s = new Date(customStartDate); s.setHours(0, 0, 0, 0);
          params.startDate = s.toISOString();
        }
        if (customEndDate) {
          const e = new Date(customEndDate); e.setHours(23, 59, 59, 999);
          params.endDate = e.toISOString();
        }
      } else if (timePeriod !== 'all') {
        const now = new Date();
        let startDate = new Date();

        switch (timePeriod) {
          case 'day':
            startDate.setHours(0, 0, 0, 0);
            break;
          case 'yesterday':
            startDate.setDate(now.getDate() - 1);
            startDate.setHours(0, 0, 0, 0);
            break;
          case 'week':
            startDate.setDate(now.getDate() - 7);
            break;
          case 'month':
            startDate.setMonth(now.getMonth() - 1);
            break;
          case 'year':
            startDate.setFullYear(now.getFullYear() - 1);
            break;
        }

        params.startDate = startDate.toISOString();

        if (timePeriod === 'yesterday') {
          const endDate = new Date(startDate);
          endDate.setHours(23, 59, 59, 999);
          params.endDate = endDate.toISOString();
        }
      }

      // Load purchases and stats
      const [purchasesData, statsData] = await Promise.all([
        api.productPurchases.list(params),
        api.productPurchases.stats(params),
      ]);

      setPurchases(purchasesData?.purchases || []);
      const s = statsData && !Array.isArray(statsData) ? statsData : {};
      setStats({
        totalPurchases: s.totalPurchases || 0,
        totalQuantity: s.totalQuantity || 0,
        totalCost: s.totalCost || 0,
      });
    } catch (error) {
      console.error('❌ Error loading purchase analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  // Toggle row expansion
  const toggleRow = (purchaseId: number) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(purchaseId)) {
        newSet.delete(purchaseId);
      } else {
        newSet.add(purchaseId);
      }
      return newSet;
    });
  };

  // Parse import details from notes
  const getImportDetails = (purchase: Purchase): ImportDetail[] | null => {
    if (!purchase.notes) return null;
    try {
      return JSON.parse(purchase.notes);
    } catch {
      return null;
    }
  };

  // 📄 Экспорт закупок в CSV (для Excel)
  const exportCSV = () => {
    const rows: (string | number)[][] = [[
      language === 'uz' ? 'Sana' : 'Дата',
      language === 'uz' ? 'Tovar' : 'Товар',
      language === 'uz' ? 'Miqdor' : 'Количество',
      language === 'uz' ? 'Summa' : 'Сумма',
    ]];
    for (const p of purchases) {
      rows.push([
        p.purchaseDate ? new Date(p.purchaseDate).toLocaleString('ru-RU') : '',
        p.productName || '',
        p.quantity || 0,
        p.totalCost || 0,
      ]);
    }
    downloadCSV('purchases', rows);
  };

  // Format date with time
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const dateStr = date.toLocaleDateString(language === 'uz' ? 'uz-UZ' : 'ru-RU');
    const timeStr = date.toLocaleTimeString(language === 'uz' ? 'uz-UZ' : 'ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return { dateStr, timeStr };
  };

  // Prepare chart data - group by date
  const chartData = React.useMemo(() => {
    const grouped: Record<string, { date: string; quantity: number; cost: number }> = {};

    purchases.forEach(purchase => {
      const date = new Date(purchase.purchaseDate).toLocaleDateString('uz-UZ');
      if (!grouped[date]) {
        grouped[date] = { date, quantity: 0, cost: 0 };
      }
      grouped[date].quantity += purchase.quantity;
      grouped[date].cost += purchase.totalCost;
    });

    return Object.values(grouped).sort(
      (a, b) =>
        new Date(a.date.split('.').reverse().join('-')).getTime() -
        new Date(b.date.split('.').reverse().join('-')).getTime()
    );
  }, [purchases]);

  // Single-point fix: add a leading zero-point so the chart renders properly
  const enhancedChartData = React.useMemo(() => {
    if (chartData.length === 0) return [];
    if (chartData.length === 1) {
      return [{ date: '—', quantity: 0, cost: 0 }, ...chartData];
    }
    return chartData;
  }, [chartData]);

  // Top products by purchase quantity
  const topProducts = React.useMemo(() => {
    const productMap: Record<string, { name: string; quantity: number; cost: number }> = {};

    purchases.forEach(purchase => {
      if (!productMap[purchase.productName]) {
        productMap[purchase.productName] = {
          name: purchase.productName,
          quantity: 0,
          cost: 0,
        };
      }
      productMap[purchase.productName].quantity += purchase.quantity;
      productMap[purchase.productName].cost += purchase.totalCost;
    });

    return Object.values(productMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [purchases]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 256 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            border: '3px solid rgba(124,92,240,0.2)',
            borderTopColor: '#7C5CF0',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ax-text)', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <Package style={{ width: 24, height: 24, color: '#7C5CF0' }} />
            {language === 'uz' ? 'Xaridlar tahlili' : 'Аналитика закупок'}
          </h3>
          <p style={{ color: '#8B8BAA', marginTop: 4, marginBottom: 0, fontSize: 14 }}>
            {language === 'uz' ? 'Tovar xaridlari statistikasi va trendlari' : 'Статистика и тренды закупок товаров'}
          </p>
        </div>
        {purchases.length > 0 && (
          <button
            onClick={exportCSV}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.28)', borderRadius: 10, color: '#22C55E', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            <Download style={{ width: 16, height: 16 }} />
            {language === 'uz' ? 'Excelga' : 'В Excel'}
          </button>
        )}
      </div>

      {/* Period Selector */}
      <div
        style={{
          background: 'var(--ax-card)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16,
          padding: 16,
        }}
      >
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#8B8BAA', marginBottom: 12 }}>
          {language === 'uz' ? '📅 Davr tanlang:' : '📅 Выберите период:'}
        </label>
        <CompactPeriodSelector
          value={timePeriod}
          onChange={setTimePeriod}
          language={language}
        />

        {/* 🎯 Произвольный период (от одного дня до нескольких лет) */}
        {timePeriod === 'custom' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 16, marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, color: '#8B8BAA', fontWeight: 600 }}>
                {language === 'uz' ? 'Boshlanish sanasi' : 'Дата начала'}
              </label>
              <input
                type="date"
                value={customStartDate}
                max={customEndDate || undefined}
                onChange={(e) => setCustomStartDate(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 10px', color: '#FFFFFF', fontSize: 14, colorScheme: 'dark' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, color: '#8B8BAA', fontWeight: 600 }}>
                {language === 'uz' ? 'Tugash sanasi' : 'Дата конца'}
              </label>
              <input
                type="date"
                value={customEndDate}
                min={customStartDate || undefined}
                onChange={(e) => setCustomEndDate(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 10px', color: '#FFFFFF', fontSize: 14, colorScheme: 'dark' }}
              />
            </div>
            {!(customStartDate && customEndDate) && (
              <p style={{ fontSize: 12, color: '#8B8BAA', margin: 0, alignSelf: 'center' }}>
                {language === 'uz'
                  ? 'Boshlanish va tugash sanasini tanlang.'
                  : 'Выберите дату начала и конца.'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Statistics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {/* Закупок */}
        <div
          style={{
            background: 'var(--ax-card)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 16,
            padding: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                padding: 12,
                background: 'rgba(124,92,240,0.15)',
                borderRadius: 12,
                flexShrink: 0,
              }}
            >
              <Package style={{ width: 22, height: 22, color: '#7C5CF0' }} />
            </div>
            <div>
              <p style={{ fontSize: 13, color: '#8B8BAA', fontWeight: 500, margin: 0 }}>
                {language === 'uz' ? 'Xaridlar' : 'Закупок'}
              </p>
              <p style={{ fontSize: 30, fontWeight: 700, color: '#7C5CF0', margin: 0, lineHeight: 1.1 }}>
                {stats.totalPurchases}
              </p>
            </div>
          </div>
        </div>

        {/* Товаров */}
        <div
          style={{
            background: 'var(--ax-card)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 16,
            padding: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                padding: 12,
                background: 'rgba(34,197,94,0.12)',
                borderRadius: 12,
                flexShrink: 0,
              }}
            >
              <TrendingDown style={{ width: 22, height: 22, color: '#22C55E' }} />
            </div>
            <div>
              <p style={{ fontSize: 13, color: '#8B8BAA', fontWeight: 500, margin: 0 }}>
                {language === 'uz' ? 'Tovarlar' : 'Товаров'}
              </p>
              <p style={{ fontSize: 30, fontWeight: 700, color: '#22C55E', margin: 0, lineHeight: 1.1 }}>
                {stats.totalQuantity}
              </p>
            </div>
          </div>
        </div>

        {/* Потрачено */}
        <div
          style={{
            background: 'var(--ax-card)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 16,
            padding: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                padding: 12,
                background: 'rgba(239,68,68,0.12)',
                borderRadius: 12,
                flexShrink: 0,
              }}
            >
              <DollarSign style={{ width: 22, height: 22, color: '#EF4444' }} />
            </div>
            <div>
              <p style={{ fontSize: 13, color: '#8B8BAA', fontWeight: 500, margin: 0 }}>
                {language === 'uz' ? 'Sarflangan' : 'Потрачено'}
              </p>
              <p style={{ fontSize: 22, fontWeight: 700, color: '#EF4444', margin: 0, lineHeight: 1.1 }}>
                {stats.totalCost.toLocaleString()} {language === 'uz' ? "so'm" : 'сум'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {purchases.length === 0 ? (
        <div
          style={{
            background: 'var(--ax-card)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 16,
            padding: 48,
            textAlign: 'center',
          }}
        >
          <Package style={{ width: 64, height: 64, color: '#5A5A78', margin: '0 auto 16px' }} />
          <p style={{ color: '#5A5A78', fontSize: 15, margin: 0 }}>
            {language === 'uz'
              ? "Tanlangan davr uchun xarid ma'lumotlari yo'q"
              : 'Нет данных о закупках за выбранный период'}
          </p>
        </div>
      ) : (
        <>
          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
            {/* Purchases Over Time — AreaChart */}
            <div
              style={{
                background: 'var(--ax-card)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 16,
                padding: 24,
              }}
            >
              <h4 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ax-text)', margin: '0 0 4px' }}>
                {language === 'uz' ? 'Xaridlar dinamikasi' : 'Динамика закупок'}
              </h4>
              <p style={{ fontSize: 13, color: '#5A5A78', margin: '0 0 20px' }}>
                {language === 'uz'
                  ? "Xaridlar summasi o'zgarishi vaqt bo'yicha"
                  : 'Изменение суммы закупок по времени'}
              </p>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={enhancedChartData}>
                  <defs>
                    <linearGradient id="purchaseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7C5CF0" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#7C5CF0" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fill: '#5A5A78', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fill: '#5A5A78', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v =>
                      v >= 1_000_000
                        ? `${(v / 1_000_000).toFixed(1)}M`
                        : v >= 1000
                        ? `${(v / 1000).toFixed(0)}K`
                        : String(v)
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#13132A',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 10,
                      color: 'var(--ax-text)',
                    }}
                    labelStyle={{ color: '#8B8BAA' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="cost"
                    stroke="#7C5CF0"
                    strokeWidth={2}
                    fill="url(#purchaseGrad)"
                    name={language === 'uz' ? 'Summa (so\'m)' : 'Сумма (сум)'}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Top Products — BarChart */}
            <div
              style={{
                background: 'var(--ax-card)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 16,
                padding: 24,
              }}
            >
              <h4 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ax-text)', margin: '0 0 4px' }}>
                {language === 'uz' ? 'Top 5 tovarlar' : 'Топ товаров по закупкам'}
              </h4>
              <p style={{ fontSize: 13, color: '#5A5A78', margin: '0 0 20px' }}>
                {language === 'uz' ? "Eng ko'p sotib olingan tovarlar" : 'Самые покупаемые товары'}
              </p>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={topProducts}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{ fill: '#5A5A78', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#5A5A78', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#13132A',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 10,
                      color: 'var(--ax-text)',
                    }}
                    labelStyle={{ color: '#8B8BAA' }}
                  />
                  <Bar dataKey="quantity" name={language === 'uz' ? 'Miqdori' : 'Количество'} radius={[6, 6, 0, 0]}>
                    {topProducts.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Purchases Table */}
          <div
            style={{
              background: 'var(--ax-card)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 16,
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <h4 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ax-text)', margin: 0 }}>
                {language === 'uz' ? "So'nggi xaridlar" : 'Последние закупки'}
              </h4>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr
                    style={{
                      background: 'linear-gradient(135deg, rgba(124,92,240,0.3), rgba(91,61,212,0.2))',
                    }}
                  >
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#8B8BAA', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {language === 'uz' ? 'Sana va vaqt' : 'Дата и время'}
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#8B8BAA', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {language === 'uz' ? 'Tovar' : 'Товар'}
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#8B8BAA', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {language === 'uz' ? 'Miqdori' : 'Количество'}
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#8B8BAA', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {language === 'uz' ? 'Summa' : 'Сумма'}
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#8B8BAA', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {language === 'uz' ? 'Batafsil' : 'Подробнее'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((purchase) => {
                    const importDetails = getImportDetails(purchase);
                    const isExpanded = expandedRows.has(purchase.id);
                    const { dateStr, timeStr } = formatDateTime(purchase.purchaseDate);
                    const hasDetails = importDetails && importDetails.length > 0;

                    return (
                      <React.Fragment key={purchase.id}>
                        {/* Main row */}
                        <tr
                          style={{
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            background: isExpanded ? 'rgba(124,92,240,0.08)' : 'transparent',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={e => {
                            if (!isExpanded) (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.03)';
                          }}
                          onMouseLeave={e => {
                            if (!isExpanded) (e.currentTarget as HTMLTableRowElement).style.background = 'transparent';
                          }}
                        >
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Clock style={{ width: 14, height: 14, color: '#5A5A78', flexShrink: 0 }} />
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ax-text)' }}>{dateStr}</div>
                                <div style={{ fontSize: 11, color: '#5A5A78' }}>{timeStr}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500, color: 'var(--ax-text)' }}>
                            {purchase.productName}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 13, textAlign: 'right', color: 'var(--ax-text)' }}>
                            {hasDetails ? `${importDetails.length} ${language === 'uz' ? 'tur' : 'видов'}` : purchase.quantity}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 13, textAlign: 'right', fontWeight: 600, color: '#EF4444' }}>
                            -{purchase.totalCost.toLocaleString()} {language === 'uz' ? "so'm" : 'сум'}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            {hasDetails && (
                              <button
                                onClick={() => toggleRow(purchase.id)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '4px 12px',
                                  fontSize: 12,
                                  fontWeight: 500,
                                  color: '#7C5CF0',
                                  background: 'rgba(124,92,240,0.1)',
                                  border: '1px solid rgba(124,92,240,0.25)',
                                  borderRadius: 8,
                                  cursor: 'pointer',
                                  transition: 'background 0.15s',
                                }}
                                onMouseEnter={e => {
                                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(124,92,240,0.2)';
                                }}
                                onMouseLeave={e => {
                                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(124,92,240,0.1)';
                                }}
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp style={{ width: 14, height: 14 }} />
                                    {language === 'uz' ? 'Yopish' : 'Скрыть'}
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown style={{ width: 14, height: 14 }} />
                                    {language === 'uz' ? "Ko'rish" : 'Показать'}
                                  </>
                                )}
                              </button>
                            )}
                          </td>
                        </tr>

                        {/* Expanded details row */}
                        {isExpanded && hasDetails && (
                          <tr style={{ background: 'rgba(124,92,240,0.04)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td colSpan={5} style={{ padding: '16px 20px' }}>
                              <div
                                style={{
                                  background: 'rgba(255,255,255,0.03)',
                                  border: '1px solid rgba(255,255,255,0.07)',
                                  borderRadius: 12,
                                  padding: 16,
                                }}
                              >
                                <h5 style={{ fontSize: 13, fontWeight: 600, color: '#8B8BAA', margin: '0 0 12px' }}>
                                  {language === 'uz'
                                    ? `Import tafsilotlari (${importDetails.length} tovar):`
                                    : `Детали импорта (${importDetails.length} товаров):`}
                                </h5>
                                <div style={{ overflowX: 'auto' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                      <tr style={{ background: 'rgba(124,92,240,0.12)' }}>
                                        <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#8B8BAA', textTransform: 'uppercase' }}>
                                          {language === 'uz' ? 'Tovar nomi' : 'Название товара'}
                                        </th>
                                        <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#8B8BAA', textTransform: 'uppercase' }}>
                                          {language === 'uz' ? 'Miqdori' : 'Количество'}
                                        </th>
                                        <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#8B8BAA', textTransform: 'uppercase' }}>
                                          {language === 'uz' ? 'Narxi' : 'Цена'}
                                        </th>
                                        <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#8B8BAA', textTransform: 'uppercase' }}>
                                          {language === 'uz' ? 'Jami' : 'Сумма'}
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {importDetails.map((detail, idx) => (
                                        <tr
                                          key={idx}
                                          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
                                          onMouseEnter={e => {
                                            (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.03)';
                                          }}
                                          onMouseLeave={e => {
                                            (e.currentTarget as HTMLTableRowElement).style.background = 'transparent';
                                          }}
                                        >
                                          <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--ax-text)' }}>
                                            {detail.name}
                                          </td>
                                          <td style={{ padding: '8px 12px', fontSize: 13, textAlign: 'right', color: 'var(--ax-text)' }}>
                                            {detail.quantity}
                                          </td>
                                          <td style={{ padding: '8px 12px', fontSize: 13, textAlign: 'right', color: 'var(--ax-text)' }}>
                                            {detail.price.toLocaleString()} {language === 'uz' ? "so'm" : 'сум'}
                                          </td>
                                          <td style={{ padding: '8px 12px', fontSize: 13, textAlign: 'right', fontWeight: 600, color: 'var(--ax-text)' }}>
                                            {detail.total.toLocaleString()} {language === 'uz' ? "so'm" : 'сум'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
