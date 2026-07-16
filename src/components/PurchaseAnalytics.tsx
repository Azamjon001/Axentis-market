import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Package, TrendingDown, DollarSign, ChevronDown, ChevronUp, Clock, Download } from 'lucide-react';
import api from '../utils/api';
import { downloadCSV } from '../utils/csv';
import CompactPeriodSelector from './CompactPeriodSelector';
import { getCurrentLanguage, type Language } from '../utils/translations';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area,
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

  // 📈 Динамика закупок: фиксированная сетка точек по выбранному периоду.
  // Сегодня/вчера — 24 точки (каждый час), неделя — 14 (каждые 12 часов),
  // месяц — точка на каждый день, год — 52 (каждая неделя). Пустые интервалы
  // дают 0 — линия сплошная по всему периоду, а не одна точка.
  const chartData = React.useMemo(() => {
    if (purchases.length === 0) return [];

    const now = new Date();
    let start: Date;
    let end = new Date(now);
    let pointsCount: number;
    let labelMode: 'hour' | 'half-day' | 'day';

    switch (timePeriod) {
      case 'day': {
        start = new Date(now); start.setHours(0, 0, 0, 0);
        end = new Date(start); end.setHours(23, 59, 59, 999);
        pointsCount = 24; labelMode = 'hour';
        break;
      }
      case 'yesterday': {
        start = new Date(now); start.setDate(now.getDate() - 1); start.setHours(0, 0, 0, 0);
        end = new Date(start); end.setHours(23, 59, 59, 999);
        pointsCount = 24; labelMode = 'hour';
        break;
      }
      case 'week': {
        start = new Date(now); start.setDate(now.getDate() - 7);
        pointsCount = 14; labelMode = 'half-day';
        break;
      }
      case 'month': {
        start = new Date(now); start.setMonth(now.getMonth() - 1);
        pointsCount = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
        labelMode = 'day';
        break;
      }
      case 'year': {
        start = new Date(now); start.setFullYear(now.getFullYear() - 1);
        pointsCount = 52; labelMode = 'day';
        break;
      }
      default: { // custom / all — шаг подбирается по длине диапазона
        if (timePeriod === 'custom' && customStartDate && customEndDate) {
          start = new Date(customStartDate); start.setHours(0, 0, 0, 0);
          end = new Date(customEndDate); end.setHours(23, 59, 59, 999);
        } else {
          start = new Date(Math.min(...purchases.map(p => new Date(p.purchaseDate).getTime())));
        }
        const spanDays = Math.max((end.getTime() - start.getTime()) / 86_400_000, 0.01);
        if (spanDays <= 1.5) { pointsCount = 24; labelMode = 'hour'; }
        else if (spanDays <= 8) { pointsCount = 14; labelMode = 'half-day'; }
        else if (spanDays <= 62) { pointsCount = Math.max(2, Math.round(spanDays)); labelMode = 'day'; }
        else { pointsCount = 52; labelMode = 'day'; }
      }
    }

    const startMs = start.getTime();
    const bucketMs = Math.max(1, (end.getTime() - startMs) / pointsCount);
    const pad = (n: number) => String(n).padStart(2, '0');
    const makeLabel = (d: Date) => {
      if (labelMode === 'hour') return `${pad(d.getHours())}:00`;
      if (labelMode === 'half-day') return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${d.getHours() < 12 ? '00:00' : '12:00'}`;
      return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
    };

    const buckets = Array.from({ length: pointsCount }, (_, i) => ({
      date: makeLabel(new Date(startMs + i * bucketMs)),
      quantity: 0,
      cost: 0,
    }));

    purchases.forEach(p => {
      const t = new Date(p.purchaseDate).getTime();
      if (Number.isNaN(t) || t < startMs || t > end.getTime()) return;
      const idx = Math.min(Math.floor((t - startMs) / bucketMs), pointsCount - 1);
      buckets[idx].quantity += p.quantity;
      buckets[idx].cost += p.totalCost;
    });

    return buckets;
  }, [purchases, timePeriod, customStartDate, customEndDate]);

  // 🏆 Топ-10 товаров по закупкам — просто список с количеством, без диаграмм
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
      .slice(0, 10);
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
      {/* Header: заголовок + период + экспорт */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ax-text)', margin: 0, letterSpacing: '-0.01em' }}>
            {language === 'uz' ? 'Xaridlar' : 'Закупки'}
          </h2>
          <p style={{ color: '#8B8BAA', marginTop: 4, marginBottom: 0, fontSize: 13 }}>
            {language === 'uz' ? 'Tovar xaridlari statistikasi va tahlili' : 'Статистика и анализ закупок товаров'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: '#8B8BAA' }}>
            {language === 'uz' ? 'Davr tanlang:' : 'Период:'}
          </span>
          <CompactPeriodSelector
            value={timePeriod as any}
            onChange={setTimePeriod as any}
            language={language}
          />
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={exportCSV}
            disabled={purchases.length === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px',
              background: purchases.length > 0 ? 'linear-gradient(135deg, #7C5CF0, #5B3DD4)' : 'rgba(255,255,255,0.06)',
              border: 'none', borderRadius: 11,
              color: purchases.length > 0 ? '#FFFFFF' : '#5A5A78',
              cursor: purchases.length > 0 ? 'pointer' : 'not-allowed',
              fontSize: 13, fontWeight: 700,
              boxShadow: purchases.length > 0 ? '0 6px 16px rgba(124,92,240,0.35)' : 'none',
            }}
          >
            <Download style={{ width: 15, height: 15 }} />
            {language === 'uz' ? 'Excelga eksport' : 'Экспорт в Excel'}
          </motion.button>
        </div>
      </div>

      {/* 🎯 Произвольный период (от одного дня до нескольких лет) */}
      {timePeriod === 'custom' && (
        <div style={{ background: 'var(--ax-card)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 14, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, color: '#8B8BAA', fontWeight: 600 }}>
              {language === 'uz' ? 'Boshlanish sanasi' : 'Дата начала'}
            </label>
            <input
              type="date"
              value={customStartDate}
              max={customEndDate || undefined}
              onChange={(e) => setCustomStartDate(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 10px', color: 'var(--ax-text)', fontSize: 14, colorScheme: 'dark' }}
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
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 10px', color: 'var(--ax-text)', fontSize: 14, colorScheme: 'dark' }}
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

      {/* Statistics Cards — иконка слева, подпись и значение справа */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {[
          { icon: <Package style={{ width: 20, height: 20 }} />,      label: language === 'uz' ? 'Jami xaridlar' : 'Всего закупок',   value: `${stats.totalPurchases} ${language === 'uz' ? 'ta' : 'шт'}`, accent: '#7C5CF0', big: 22 },
          { icon: <TrendingDown style={{ width: 20, height: 20 }} />, label: language === 'uz' ? 'Jami tovarlar' : 'Всего товаров',   value: `${stats.totalQuantity} ${language === 'uz' ? 'ta' : 'шт'}`,  accent: '#22C55E', big: 22 },
          { icon: <DollarSign style={{ width: 20, height: 20 }} />,   label: language === 'uz' ? 'Sarflangan summa' : 'Потраченная сумма', value: `${stats.totalCost.toLocaleString()} ${language === 'uz' ? "so'm" : 'сум'}`, accent: '#F87171', big: 19 },
        ].map((c, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24, delay: i * 0.06 }}
            whileHover={{ y: -3 }}
            style={{
              background: `linear-gradient(160deg, ${c.accent}10, var(--ax-card) 58%)`,
              border: `1px solid ${c.accent}26`, borderRadius: 16, padding: '16px 18px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
              <div style={{ width: 42, height: 42, background: `${c.accent}1F`, color: c.accent, borderRadius: 12, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                {c.icon}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 12.5, color: '#8B8BAA', fontWeight: 500, margin: 0 }}>{c.label}</p>
                <p style={{ fontSize: c.big, fontWeight: 800, color: c.accent, margin: '2px 0 0', lineHeight: 1.15, wordBreak: 'break-word' }}>{c.value}</p>
              </div>
            </div>
          </motion.div>
        ))}
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
          {/* Таблица «Последние закупки» + график «Динамика закупок» в два столбца */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'stretch' }}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26, delay: 0.1 }}
            style={{
              flex: '1.3 1 440px',
              minWidth: 0,
              background: 'var(--ax-card)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 16,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ax-text)', margin: 0 }}>
                {language === 'uz' ? "So'nggi xaridlar" : 'Последние закупки'}
              </h4>
            </div>
            <div style={{ overflowX: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr
                    style={{
                      background: 'var(--ax-input)',
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
                      {language === 'uz' ? 'Amallar' : 'Действия'}
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
            {/* Футер таблицы: итог по записям */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.07)', color: '#8B8BAA', fontSize: 12.5 }}>
              {language === 'uz' ? `Jami: ${purchases.length} ta yozuv` : `Всего: ${purchases.length} записей`}
            </div>
          </motion.div>

          {/* 📈 Динамика закупок */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26, delay: 0.15 }}
            style={{
              flex: '1 1 340px',
              minWidth: 0,
              background: 'var(--ax-card)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 16,
              padding: 22,
            }}
          >
            <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ax-text)', margin: '0 0 4px' }}>
              {language === 'uz' ? 'Xaridlar dinamikasi' : 'Динамика закупок'}
            </h4>
            <p style={{ fontSize: 12.5, color: '#5A5A78', margin: '0 0 18px' }}>
              {language === 'uz'
                ? "Tanlangan davr boʻyicha xarajatlar oqimi"
                : 'Поток затрат за выбранный период'}
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData} margin={{ left: 0, right: 8 }}>
                <defs>
                  <linearGradient id="purchaseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C5CF0" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#7C5CF0" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#5A5A78', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={24}
                />
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
                  dot={false}
                  name={language === 'uz' ? 'Summa (so\'m)' : 'Сумма (сум)'}
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
          </div>

          {/* 🏆 Топ-10 товаров по закупкам — список, без диаграмм */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26, delay: 0.2 }}
            style={{
              background: 'var(--ax-card)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 16,
              padding: 22,
            }}
          >
            <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ax-text)', margin: '0 0 4px' }}>
              {language === 'uz' ? 'Top-10 tovarlar (xaridlar boʻyicha)' : 'Топ-10 товаров по закупкам'}
            </h4>
            <p style={{ fontSize: 13, color: '#5A5A78', margin: '0 0 16px' }}>
              {language === 'uz' ? "Eng ko'p sotib olingan tovarlar va soni" : 'Самые закупаемые товары и их количество'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {topProducts.map((p, i) => {
                const maxQty = topProducts[0]?.quantity || 1;
                return (
                  <div
                    key={p.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: i === 0 ? 'rgba(124,92,240,0.10)' : 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        fontSize: 13,
                        fontWeight: 700,
                        background: i < 3 ? 'rgba(124,92,240,0.25)' : 'rgba(255,255,255,0.06)',
                        color: i < 3 ? '#A78BFA' : '#8B8BAA',
                      }}
                    >
                      {i + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: 'var(--ax-text)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {p.name}
                      </div>
                      <div
                        style={{
                          marginTop: 6,
                          height: 5,
                          borderRadius: 3,
                          background: 'rgba(255,255,255,0.06)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.max(4, Math.round((p.quantity / maxQty) * 100))}%`,
                            height: '100%',
                            borderRadius: 3,
                            background: 'linear-gradient(90deg, #7C5CF0, #A78BFA)',
                          }}
                        />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#22C55E', lineHeight: 1.2 }}>
                        {p.quantity.toLocaleString()} {language === 'uz' ? 'dona' : 'шт'}
                      </div>
                      <div style={{ fontSize: 11, color: '#5A5A78' }}>
                        {p.cost.toLocaleString()} {language === 'uz' ? "so'm" : 'сум'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
