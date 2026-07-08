import { useState, useEffect, useMemo } from 'react';
import {
  ShoppingCart, TrendingUp, TrendingDown, Clock, RotateCcw, AlertTriangle,
  MessageCircleQuestion, Package, BarChart3, ArrowRight, CheckCircle2,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';
import api from '../utils/api';
import { useUiLang } from '../hooks/useUiLang';

interface DashboardData {
  todayOrders: number;
  todayRevenue: number;
  pendingOrders: number;
  totalRevenue: number;
  pendingReturns: number;
  lowStock: number;
  unansweredQuestions: number;
  totalProducts: number;
  soldUnits: number;
  recentOrders: Array<{
    id: number;
    customerName: string;
    totalAmount: number;
    status: string;
    orderCode: string;
    createdAt: string;
  }>;
}

interface CompanyDashboardPanelProps {
  companyId: number;
  onNavigate?: (tab: string) => void;
}

const fmt = (n: number) => (n || 0).toLocaleString('ru-RU');

const STATUS_COLOR: Record<string, { bg: string; text: string; dot: string }> = {
  pending:    { bg: 'rgba(251,191,36,0.15)',  text: '#FBBF24', dot: '#FBBF24' },
  confirmed:  { bg: 'rgba(59,130,246,0.15)',  text: '#60A5FA', dot: '#60A5FA' },
  processing: { bg: 'rgba(124,92,240,0.15)',  text: '#A78BFA', dot: '#A78BFA' },
  shipped:    { bg: 'rgba(14,165,233,0.15)',  text: '#38BDF8', dot: '#38BDF8' },
  delivered:  { bg: 'rgba(34,197,94,0.15)',   text: '#4ADE80', dot: '#4ADE80' },
  completed:  { bg: 'rgba(34,197,94,0.15)',   text: '#22C55E', dot: '#22C55E' },
  cancelled:  { bg: 'rgba(248,113,113,0.15)', text: '#F87171', dot: '#F87171' },
};

const PIE_COLORS = ['#7C5CF0', '#22C55E', '#38BDF8', '#FBBF24', '#F87171', '#A78BFA', '#34D399'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: '#13132A', border: '1px solid rgba(124,92,240,0.4)',
        borderRadius: 10, padding: '10px 14px',
      }}>
        <p style={{ color: '#8B8BAA', fontSize: 12, marginBottom: 4 }}>{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color, fontSize: 13, fontWeight: 600 }}>
            {fmt(p.value)} сум
          </p>
        ))}
      </div>
    );
  }
  return null;
};

interface InsightsData {
  stockForecast: Array<{ productId: number; name: string; stock: number; soldPerDay: number; daysLeft: number; outOfStock: boolean }>;
  abcAnalysis: Array<{ productId: number; name: string; revenue: number; revenueShare: number; class: string }>;
  totalRevenue90: number;
}

export default function CompanyDashboardPanel({ companyId, onNavigate }: CompanyDashboardPanelProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [inventoryCost, setInventoryCost] = useState(0);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.analytics.dashboard(companyId),
      api.orders.list({ companyId }).catch(() => []),
      api.analytics.company(companyId).catch(() => ({})),
      api.analytics.inventoryInsights(companyId).catch(() => null),
    ]).then(([dashData, ordersData, analyticsData, insightsData]) => {
      if (!active) return;
      setData(dashData);
      const orders = Array.isArray(ordersData) ? ordersData : (ordersData?.orders || []);
      setAllOrders(orders);
      setInventoryCost(analyticsData.inventoryCost || analyticsData.inventoryValue || 0);
      setInsights(insightsData);
    }).catch((e) => console.error('Dashboard load failed:', e))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [companyId]);

  const lang = useUiLang();
  const isUz = lang === 'uz';

  const L = {
    loading: isUz ? 'Yuklanmoqda...' : 'Загрузка...',
    failed: isUz ? 'Yuklab boʻlmadi' : 'Не удалось загрузить',
    todayOrders: isUz ? 'Bugungi buyurtmalar' : 'Заказы сегодня',
    todayRevenue: isUz ? 'Bugungi tushum' : 'Выручка сегодня',
    totalRevenue: isUz ? 'Jami tushum' : 'Выручка всего',
    soldUnits: isUz ? 'Sotilgan dona' : 'Продано единиц',
    attention: isUz ? 'Eʼtibor' : 'Требует внимания',
    newOrders: isUz ? 'Yangi buyurtmalar' : 'Новые заказы',
    returns: isUz ? 'Qaytarishlar' : 'Заявки на возврат',
    lowStock: isUz ? 'Tugayotgan' : 'Мало товаров',
    questions: isUz ? 'Savollar' : 'Вопросы',
    allGood: isUz ? 'Hammasi nazoratda 🎉' : 'Всё под контролем 🎉',
    recent: isUz ? 'Soʻnggi buyurtmalar' : 'Последние заказы',
    noOrders: isUz ? 'Buyurtmalar yoʻq' : 'Заказов пока нет',
    buyer: isUz ? 'Xaridor' : 'Покупатель',
    sum: isUz ? 'soʻm' : 'сум',
    salesChart: isUz ? 'Sotuv dinamikasi' : 'Динамика продаж',
    allOrders: isUz ? 'Barchasi' : 'Все заказы',
    statusDist: isUz ? 'Buyurtma holatlari' : 'Статусы заказов',
    forecastTitle: isUz ? 'Zaxira prognozi' : 'Прогноз остатков',
    forecastHint: isUz ? '30 kunlik sotuv tezligi boʻyicha' : 'по скорости продаж за 30 дней',
    daysLeft: isUz ? 'kun qoldi' : 'дн. осталось',
    outOfStock: isUz ? 'Tugadi' : 'Закончился',
    perDay: isUz ? 'dona/kun' : 'шт/день',
    stockLeft: isUz ? 'qoldiq' : 'остаток',
    abcTitle: isUz ? 'ABC-tahlil' : 'ABC-анализ ассортимента',
    abcHint: isUz ? '90 kunlik tushum boʻyicha' : 'по выручке за 90 дней',
    abcA: isUz ? 'A — asosiy daromad' : 'A — приносят 80% выручки',
    abcB: isUz ? 'B — oʻrtacha' : 'B — следующие 15%',
    abcC: isUz ? 'C — kam daromad' : 'C — хвост ассортимента',
    noSalesData: isUz ? 'Sotuvlar yetarli emas' : 'Пока мало данных о продажах',
  };

  const statusLabel: Record<string, string> = isUz ? {
    pending: 'Yangi', confirmed: 'Qabul', processing: 'Jarayon',
    shipped: 'Yoʻlda', delivered: 'Yetkazildi', completed: 'Yakunlandi', cancelled: 'Bekor',
  } : {
    pending: 'Новый', confirmed: 'Принят', processing: 'В обработке',
    shipped: 'В пути', delivered: 'Доставлен', completed: 'Завершён', cancelled: 'Отменён',
  };

  // Build 7-day chart data from all orders
  const chartData = useMemo(() => {
    const days: Record<string, { date: string; revenue: number; orders: number }> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
      days[key] = { date: label, revenue: 0, orders: 0 };
    }
    allOrders.forEach((o: any) => {
      const dateStr = (o.created_at || o.order_date || '').slice(0, 10);
      if (days[dateStr] && o.status !== 'cancelled') {
        days[dateStr].revenue += parseFloat(o.total_amount) || 0;
        days[dateStr].orders += 1;
      }
    });
    return Object.values(days);
  }, [allOrders]);

  // Build pie chart data from order statuses
  const pieData = useMemo(() => {
    const counts: Record<string, number> = {};
    allOrders.forEach((o: any) => {
      counts[o.status] = (counts[o.status] || 0) + 1;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ name: statusLabel[k] || k, value: v }));
  }, [allOrders]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#8B8BAA' }}>
          <div style={{
            width: 18, height: 18, borderRadius: '50%',
            border: '2px solid rgba(124,92,240,0.3)', borderTopColor: '#7C5CF0',
            animation: 'spin 0.8s linear infinite',
          }} />
          {L.loading}
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!data) return <div style={{ padding: 20, color: '#F87171', textAlign: 'center' }}>{L.failed}</div>;

  // 📦 Успешные (завершённые) заказы за всё время
  const completedOrdersCount = allOrders.filter((o: any) => o.status === 'completed').length;

  const stats = [
    { icon: <ShoppingCart size={20} />,  label: L.todayOrders,  value: fmt(data.todayOrders),                      accent: '#7C5CF0', accentBg: 'rgba(124,92,240,0.15)', tab: 'orders' },
    { icon: <CheckCircle2 size={20} />,  label: isUz ? 'Muvaffaqiyatli buyurtmalar' : 'Успешных заказов', value: fmt(completedOrdersCount), accent: '#22C55E', accentBg: 'rgba(34,197,94,0.14)', tab: 'orders' },
    { icon: <TrendingUp size={20} />,    label: L.todayRevenue, value: `${fmt(data.todayRevenue)} ${L.sum}`,       accent: '#22C55E', accentBg: 'rgba(34,197,94,0.12)',   tab: 'analytics' },
    { icon: <BarChart3 size={20} />,     label: L.totalRevenue, value: `${fmt(data.totalRevenue)} ${L.sum}`,       accent: '#38BDF8', accentBg: 'rgba(56,189,248,0.12)',  tab: 'analytics' },
    { icon: <Package size={20} />,       label: L.soldUnits,    value: fmt(data.soldUnits),                        accent: '#FBBF24', accentBg: 'rgba(251,191,36,0.12)',  tab: 'warehouse' },
    { icon: <TrendingDown size={20} />,  label: isUz ? 'Ombor qiymati' : 'Затраты (склад)', value: `${fmt(inventoryCost)} ${L.sum}`, accent: '#EF4444', accentBg: 'rgba(239,68,68,0.12)', tab: 'analytics' },
  ];

  const attentionItems = [
    { icon: <Clock size={16} />,               label: L.newOrders, count: data.pendingOrders,         color: '#FBBF24', bg: 'rgba(251,191,36,0.12)',  tab: 'orders' },
    { icon: <RotateCcw size={16} />,           label: L.returns,   count: data.pendingReturns,        color: '#F87171', bg: 'rgba(248,113,113,0.12)', tab: 'returns' },
    { icon: <AlertTriangle size={16} />,       label: L.lowStock,  count: data.lowStock,              color: '#FB923C', bg: 'rgba(251,146,60,0.12)',  tab: 'warehouse' },
    { icon: <MessageCircleQuestion size={16} />, label: L.questions, count: data.unansweredQuestions, color: '#60A5FA', bg: 'rgba(96,165,250,0.12)',  tab: 'questions' },
  ].filter(i => i.count > 0);

  const card = (children: React.ReactNode, extra?: React.CSSProperties) => (
    <div style={{
      background: 'var(--ax-card)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.4)', ...extra,
    }}>
      {children}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Top stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
        {stats.map((s, i) => (
          <button key={i} onClick={() => onNavigate?.(s.tab)} style={{
            background: 'var(--ax-card)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 16, padding: '18px 20px', textAlign: 'left', cursor: 'pointer',
            transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: 12,
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = s.accent + '50'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 12, background: s.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.accent }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.2 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#8B8BAA', marginTop: 4 }}>{s.label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
        {/* Area chart */}
        {card(
          <>
            <div style={{ padding: '16px 20px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#FFFFFF' }}>{L.salesChart}</span>
              <span style={{ fontSize: 12, color: '#5A5A78' }}>7 {isUz ? 'kun' : 'дней'}</span>
            </div>
            <div style={{ padding: '0 8px 16px' }}>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7C5CF0" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#7C5CF0" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fill: '#5A5A78', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#5A5A78', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="revenue" stroke="#7C5CF0" strokeWidth={2} fill="url(#revGrad)" dot={{ fill: '#7C5CF0', r: 3 }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>,
        )}

        {/* Donut chart */}
        {card(
          <>
            <div style={{ padding: '16px 20px 8px' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#FFFFFF' }}>{L.statusDist}</span>
            </div>
            <div style={{ padding: '0 8px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                        {pieData.map((_, idx) => (
                          <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => [`${v} ${isUz ? 'ta' : 'шт'}`, '']} contentStyle={{ background: '#13132A', border: '1px solid rgba(124,92,240,0.4)', borderRadius: 8, color: '#fff' }} itemStyle={{ color: '#fff' }} labelStyle={{ color: '#fff' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', padding: '0 16px' }}>
                    {pieData.slice(0, 5).map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: PIE_COLORS[idx % PIE_COLORS.length] }} />
                          <span style={{ fontSize: 11, color: '#8B8BAA' }}>{item.name}</span>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#FFFFFF' }}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ color: '#5A5A78', fontSize: 13, padding: '40px 0' }}>{L.noOrders}</div>
              )}
            </div>
          </>,
        )}
      </div>

      {/* Attention */}
      {attentionItems.length > 0 ? (
        card(
          <>
            <div style={{ padding: '14px 20px 10px', fontSize: 12, fontWeight: 600, color: '#8B8BAA', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{L.attention}</div>
            <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              {attentionItems.map((item, i) => (
                <button key={i} onClick={() => onNavigate?.(item.tab)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '11px 14px',
                  borderRadius: 12, background: item.bg, border: `1px solid ${item.color}25`, cursor: 'pointer',
                  color: item.color, transition: 'opacity 0.2s',
                }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.8'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>{item.icon}<span style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</span></div>
                  <span style={{ fontSize: 18, fontWeight: 700 }}>{item.count}</span>
                </button>
              ))}
            </div>
          </>,
        )
      ) : (
        <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, color: '#22C55E', fontSize: 14 }}>
          <CheckCircle2 size={18} />{L.allGood}
        </div>
      )}

      {/* 📦 Инсайты склада: прогноз остатков + ABC-анализ */}
      {insights && (insights.stockForecast?.length > 0 || insights.abcAnalysis?.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {card(
            <>
              <div style={{ padding: '16px 20px 8px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#FFFFFF' }}>📦 {L.forecastTitle}</span>
                <span style={{ fontSize: 11, color: '#5A5A78' }}>{L.forecastHint}</span>
              </div>
              {(!insights.stockForecast || insights.stockForecast.length === 0) ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#5A5A78', fontSize: 13 }}>{L.noSalesData}</div>
              ) : (
                <div style={{ padding: '4px 12px 14px' }}>
                  {insights.stockForecast.slice(0, 8).map((f) => {
                    const critical = f.outOfStock || (f.daysLeft >= 0 && f.daysLeft <= 7);
                    const warn = !critical && f.daysLeft >= 0 && f.daysLeft <= 14;
                    const color = critical ? '#F87171' : warn ? '#FBBF24' : '#22C55E';
                    return (
                      <div key={f.productId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 8px', borderRadius: 10 }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                          <div style={{ fontSize: 11, color: '#5A5A78' }}>{f.soldPerDay} {L.perDay} · {L.stockLeft}: {f.stock}</div>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color, whiteSpace: 'nowrap', background: `${color}1A`, padding: '4px 10px', borderRadius: 12 }}>
                          {f.outOfStock ? L.outOfStock : f.daysLeft < 0 ? '—' : `${f.daysLeft} ${L.daysLeft}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>,
          )}
          {card(
            <>
              <div style={{ padding: '16px 20px 8px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#FFFFFF' }}>🏆 {L.abcTitle}</span>
                <span style={{ fontSize: 11, color: '#5A5A78' }}>{L.abcHint}</span>
              </div>
              {(!insights.abcAnalysis || insights.abcAnalysis.length === 0) ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#5A5A78', fontSize: 13 }}>{L.noSalesData}</div>
              ) : (
                <div style={{ padding: '4px 12px 14px' }}>
                  <div style={{ display: 'flex', gap: 10, padding: '4px 8px 10px', flexWrap: 'wrap' }}>
                    {[['A', '#22C55E', L.abcA], ['B', '#FBBF24', L.abcB], ['C', '#8B8BAA', L.abcC]].map(([cls, clr, label]) => (
                      <span key={cls as string} style={{ fontSize: 10.5, color: clr as string, background: `${clr}14`, padding: '3px 8px', borderRadius: 10 }}>{label as string}</span>
                    ))}
                  </div>
                  {insights.abcAnalysis.slice(0, 8).map((a) => {
                    const clr = a.class === 'A' ? '#22C55E' : a.class === 'B' ? '#FBBF24' : '#8B8BAA';
                    return (
                      <div key={a.productId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px' }}>
                        <span style={{ width: 22, height: 22, borderRadius: 7, background: `${clr}1A`, color: clr, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{a.class}</span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#FFFFFF' }}>{fmt(a.revenue)} {L.sum}</div>
                          <div style={{ fontSize: 10.5, color: '#5A5A78' }}>{a.revenueShare}%</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>,
          )}
        </div>
      )}

      {/* Recent orders */}
      {card(
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#FFFFFF' }}>{L.recent}</span>
            <button onClick={() => onNavigate?.('orders')} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#7C5CF0', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
              {L.allOrders}<ArrowRight size={13} />
            </button>
          </div>
          {data.recentOrders.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#5A5A78', fontSize: 14 }}>{L.noOrders}</div>
          ) : (
            data.recentOrders.map((o, idx) => {
              const sc = STATUS_COLOR[o.status] || { bg: 'rgba(139,139,170,0.15)', text: '#8B8BAA', dot: '#8B8BAA' };
              return (
                <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: idx < data.recentOrders.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#FFFFFF' }}>{o.customerName || L.buyer}</div>
                    <div style={{ fontSize: 12, color: '#5A5A78', marginTop: 2 }}>№{o.orderCode}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#FFFFFF' }}>{fmt(o.totalAmount)} <span style={{ color: '#5A5A78', fontSize: 11 }}>{L.sum}</span></div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: sc.bg, fontSize: 11, fontWeight: 500, color: sc.text, whiteSpace: 'nowrap' }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: sc.dot }} />
                      {statusLabel[o.status] || o.status}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </>,
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
