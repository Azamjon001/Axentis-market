import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingCart, TrendingUp, Clock, RotateCcw, AlertTriangle,
  MessageCircleQuestion, Package, BarChart3, ArrowRight, CheckCircle2,
  Crown, Coins, PackageX, X, Boxes, Gauge, Timer,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, PieChart, Pie, Cell,
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

interface ForecastRow { productId: number; name: string; stock: number; soldPerDay: number; daysLeft: number; outOfStock: boolean }
interface AbcRow { productId: number; name: string; revenue: number; revenueShare: number; class: string }
interface SellerRow { productId: number; name: string; units: number; revenue: number }
interface LowStockRow { productId: number; name: string; stock: number; soldPerDay: number }

interface InsightsData {
  stockForecast: ForecastRow[];
  abcAnalysis: AbcRow[];
  topSellers?: SellerRow[];
  lowStock?: LowStockRow[];
  totalRevenue90: number;
}

// Собранная карточка одного товара из всех источников аналитики
interface ProductDetail {
  productId: number;
  name: string;
  units?: number;
  revenue?: number;
  stock?: number;
  soldPerDay?: number;
  daysLeft?: number;
  outOfStock?: boolean;
  abcClass?: string;
  revenueShare?: number;
}

// Плавное появление — общий пресет пружинной анимации
const springIn = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { type: 'spring' as const, stiffness: 260, damping: 26 },
};

export default function CompanyDashboardPanel({ companyId, onNavigate }: CompanyDashboardPanelProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ProductDetail | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.analytics.dashboard(companyId),
      api.orders.list({ companyId }).catch(() => []),
      api.analytics.inventoryInsights(companyId).catch(() => null),
    ]).then(([dashData, ordersData, insightsData]) => {
      if (!active) return;
      setData(dashData);
      const orders = Array.isArray(ordersData) ? ordersData : (ordersData?.orders || []);
      setAllOrders(orders);
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
    lowStockCard: isUz ? 'Kam qolgan tovarlar' : 'Мало на складе',
    attention: isUz ? 'Eʼtibor talab qiladi' : 'Требует внимания',
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
    leaders: isUz ? 'Sotuv liderlari' : 'Лидеры продаж',
    leadersHint: isUz ? '90 kun · dona boʻyicha' : '90 дней · по штукам',
    profitable: isUz ? 'Eng foydali tovarlar' : 'Самые прибыльные',
    profitableHint: isUz ? '90 kun · tushum boʻyicha' : '90 дней · по выручке',
    lowStockTitle: isUz ? 'Kam qolgan tovarlar' : 'Товары с низким остатком',
    lowStockHint: isUz ? 'Toʻldirish kerak' : 'Требуется пополнение',
    units: isUz ? 'dona' : 'шт',
    perDay: isUz ? 'dona/kun' : 'шт/день',
    stockLeft: isUz ? 'qoldiq' : 'остаток',
    daysLeft: isUz ? 'kun qoldi' : 'дн. осталось',
    outOfStock: isUz ? 'Tugadi' : 'Закончился',
    noData: isUz ? 'Maʼlumot yetarli emas' : 'Пока мало данных',
    details: isUz ? 'Batafsil' : 'Подробнее',
    detailUnits: isUz ? 'Sotilgan (90 kun)' : 'Продано (90 дней)',
    detailRevenue: isUz ? 'Tushum (90 kun)' : 'Выручка (90 дней)',
    detailStock: isUz ? 'Ombordagi qoldiq' : 'Остаток на складе',
    detailSpeed: isUz ? 'Sotuv tezligi' : 'Скорость продаж',
    detailForecast: isUz ? 'Qachon tugaydi' : 'Прогноз остатка',
    detailAbc: isUz ? 'ABC-sinf' : 'ABC-класс',
    revShare: isUz ? 'tushum ulushi' : 'доля выручки',
    replenish: isUz ? 'Omborni toʻldirish' : 'Пополнить склад',
    viewAnalytics: isUz ? 'Analitikaga oʻtish' : 'Открыть аналитику',
  };

  const statusLabel: Record<string, string> = isUz ? {
    pending: 'Yangi', confirmed: 'Qabul', processing: 'Jarayon',
    shipped: 'Yoʻlda', delivered: 'Yetkazildi', completed: 'Yakunlandi', cancelled: 'Bekor',
  } : {
    pending: 'Новый', confirmed: 'Принят', processing: 'В обработке',
    shipped: 'В пути', delivered: 'Доставлен', completed: 'Завершён', cancelled: 'Отменён',
  };

  // 📈 Динамика продаж за 7 дней: 14 точек — каждые 12 часов (00:00 и 12:00).
  const chartData = useMemo(() => {
    const buckets: Record<string, { date: string; revenue: number; orders: number }> = {};
    const localKey = (d: Date, half: 0 | 1) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${half}`;
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayLabel = `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets[localKey(d, 0)] = { date: `${dayLabel} 00:00`, revenue: 0, orders: 0 };
      buckets[localKey(d, 1)] = { date: `${dayLabel} 12:00`, revenue: 0, orders: 0 };
    }
    allOrders.forEach((o: any) => {
      const dateStr = o.created_at || o.order_date || '';
      if (!dateStr || o.status === 'cancelled') return;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return;
      const key = localKey(d, d.getHours() < 12 ? 0 : 1);
      if (buckets[key]) {
        buckets[key].revenue += parseFloat(o.total_amount) || 0;
        buckets[key].orders += 1;
      }
    });
    return Object.values(buckets);
  }, [allOrders]);

  const pieData = useMemo(() => {
    const counts: Record<string, number> = {};
    allOrders.forEach((o: any) => {
      counts[o.status] = (counts[o.status] || 0) + 1;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ name: statusLabel[k] || k, value: v }));
  }, [allOrders]);

  // 🔗 Единая карта товаров: объединяем данные из всех аналитических источников,
  // чтобы по клику показать полную мини-карточку товара.
  const detailMap = useMemo(() => {
    const map = new Map<number, ProductDetail>();
    const upsert = (id: number, name: string, patch: Partial<ProductDetail>) => {
      const prev = map.get(id) || { productId: id, name };
      map.set(id, { ...prev, name: name || prev.name, ...patch });
    };
    insights?.topSellers?.forEach((s) => upsert(s.productId, s.name, { units: s.units, revenue: s.revenue }));
    insights?.abcAnalysis?.forEach((a) => upsert(a.productId, a.name, { revenue: a.revenue, abcClass: a.class, revenueShare: a.revenueShare }));
    insights?.stockForecast?.forEach((f) => upsert(f.productId, f.name, { stock: f.stock, soldPerDay: f.soldPerDay, daysLeft: f.daysLeft, outOfStock: f.outOfStock }));
    insights?.lowStock?.forEach((l) => upsert(l.productId, l.name, { stock: l.stock, soldPerDay: l.soldPerDay }));
    return map;
  }, [insights]);

  const openProduct = (id: number, fallbackName: string) => {
    setSelected(detailMap.get(id) || { productId: id, name: fallbackName });
  };

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

  const stats = [
    { icon: <ShoppingCart size={20} />, label: L.todayOrders,  value: fmt(data.todayOrders),                accent: '#7C5CF0', accentBg: 'rgba(124,92,240,0.15)', tab: 'orders' },
    { icon: <TrendingUp size={20} />,   label: L.todayRevenue, value: `${fmt(data.todayRevenue)} ${L.sum}`,  accent: '#22C55E', accentBg: 'rgba(34,197,94,0.12)',  tab: 'analytics' },
    { icon: <Package size={20} />,      label: L.soldUnits,    value: fmt(data.soldUnits),                  accent: '#FBBF24', accentBg: 'rgba(251,191,36,0.12)', tab: 'warehouse' },
    { icon: <BarChart3 size={20} />,    label: L.totalRevenue, value: `${fmt(data.totalRevenue)} ${L.sum}`,  accent: '#38BDF8', accentBg: 'rgba(56,189,248,0.12)', tab: 'analytics' },
    { icon: <AlertTriangle size={20} />, label: L.lowStockCard, value: fmt(data.lowStock), accent: '#FB923C', accentBg: 'rgba(251,146,60,0.14)', tab: 'warehouse', alert: data.lowStock > 0 },
  ];

  const attentionItems = [
    { icon: <Clock size={16} />,                 label: L.newOrders, count: data.pendingOrders,      color: '#FBBF24', bg: 'rgba(251,191,36,0.12)',  tab: 'orders' },
    { icon: <RotateCcw size={16} />,             label: L.returns,   count: data.pendingReturns,     color: '#F87171', bg: 'rgba(248,113,113,0.12)', tab: 'returns' },
    { icon: <AlertTriangle size={16} />,         label: L.lowStock,  count: data.lowStock,           color: '#FB923C', bg: 'rgba(251,146,60,0.12)',  tab: 'warehouse' },
    { icon: <MessageCircleQuestion size={16} />, label: L.questions, count: data.unansweredQuestions, color: '#60A5FA', bg: 'rgba(96,165,250,0.12)',  tab: 'questions' },
  ].filter(i => i.count > 0);

  const topSellers = insights?.topSellers || [];
  const profitable = (insights?.abcAnalysis || []).slice(0, 8);
  const lowStockList = insights?.lowStock || [];

  const cardBase: React.CSSProperties = {
    background: 'var(--ax-card)', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
  };

  // Ряд товара внутри панели — переиспользуемый кликабельный элемент
  const productRow = (
    key: number, rank: number, name: string, right: React.ReactNode, sub: React.ReactNode, accent: string,
  ) => (
    <motion.button
      key={key}
      onClick={() => openProduct(key, name)}
      whileHover={{ x: 3 }}
      whileTap={{ scale: 0.99 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', width: '100%',
        background: 'transparent', border: 'none', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{
        width: 24, height: 24, borderRadius: 8, flexShrink: 0, fontSize: 12, fontWeight: 700,
        background: `${accent}1A`, color: accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>{rank}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, color: 'var(--ax-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        <div style={{ fontSize: 11, color: '#5A5A78' }}>{sub}</div>
      </div>
      <div style={{ flexShrink: 0, textAlign: 'right' }}>{right}</div>
    </motion.button>
  );

  const panelHeader = (icon: React.ReactNode, title: string, hint: string, accent: string) => (
    <div style={{ padding: '15px 18px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ width: 30, height: 30, borderRadius: 9, background: `${accent}1A`, color: accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ax-text)', lineHeight: 1.2 }}>{title}</div>
        <div style={{ fontSize: 11, color: '#5A5A78' }}>{hint}</div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Top stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
        {stats.map((s, i) => (
          <motion.button
            key={i}
            onClick={() => onNavigate?.(s.tab)}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24, delay: i * 0.05 }}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
            style={{
              background: 'var(--ax-card)',
              border: `1px solid ${(s as any).alert ? 'rgba(251,146,60,0.35)' : 'rgba(255,255,255,0.07)'}`,
              borderRadius: 16, padding: '18px 20px', textAlign: 'left', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 12, background: s.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.accent }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ax-text)', lineHeight: 1.2 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#8B8BAA', marginTop: 4 }}>{s.label}</div>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(240px, 300px)', gap: 16 }}>
        <motion.div {...springIn} style={cardBase}>
          <div style={{ padding: '16px 20px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ax-text)' }}>{L.salesChart}</span>
            <span style={{ fontSize: 12, color: '#5A5A78' }}>7 {isUz ? 'kun · har 12 soat' : 'дней · каждые 12 ч'}</span>
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
                <XAxis dataKey="date" interval={1} tickFormatter={(v: string) => v.replace(' 00:00', '')} tick={{ fill: '#5A5A78', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#5A5A78', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="revenue" stroke="#7C5CF0" strokeWidth={2} fill="url(#revGrad)" dot={{ fill: '#7C5CF0', r: 2.5 }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div {...springIn} style={cardBase}>
          <div style={{ padding: '16px 20px 8px' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ax-text)' }}>{L.statusDist}</span>
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
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ax-text)' }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ color: '#5A5A78', fontSize: 13, padding: '40px 0' }}>{L.noOrders}</div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Attention */}
      {attentionItems.length > 0 ? (
        <motion.div {...springIn} style={cardBase}>
          <div style={{ padding: '14px 20px 10px', fontSize: 12, fontWeight: 600, color: '#8B8BAA', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{L.attention}</div>
          <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {attentionItems.map((item, i) => (
              <motion.button key={i} onClick={() => onNavigate?.(item.tab)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '11px 14px',
                borderRadius: 12, background: item.bg, border: `1px solid ${item.color}25`, cursor: 'pointer', color: item.color,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>{item.icon}<span style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</span></div>
                <span style={{ fontSize: 18, fontWeight: 700 }}>{item.count}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      ) : (
        <motion.div {...springIn} style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, color: '#22C55E', fontSize: 14 }}>
          <CheckCircle2 size={18} />{L.allGood}
        </motion.div>
      )}

      {/* 🏆 Три панели: лидеры продаж · самые прибыльные · низкий остаток */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {/* Лидеры продаж */}
        <motion.div {...springIn} style={cardBase}>
          {panelHeader(<Crown size={17} />, L.leaders, L.leadersHint, '#7C5CF0')}
          <div style={{ padding: '2px 8px 12px' }}>
            {topSellers.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#5A5A78', fontSize: 13 }}>{L.noData}</div>
            ) : topSellers.slice(0, 8).map((s, i) => productRow(
              s.productId, i + 1, s.name,
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ax-text)' }}>{fmt(s.units)} <span style={{ color: '#5A5A78', fontSize: 11, fontWeight: 400 }}>{L.units}</span></div>
              </>,
              `${fmt(s.revenue)} ${L.sum}`, '#7C5CF0',
            ))}
          </div>
        </motion.div>

        {/* Самые прибыльные */}
        <motion.div {...springIn} style={cardBase}>
          {panelHeader(<Coins size={17} />, L.profitable, L.profitableHint, '#22C55E')}
          <div style={{ padding: '2px 8px 12px' }}>
            {profitable.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#5A5A78', fontSize: 13 }}>{L.noData}</div>
            ) : profitable.map((a, i) => productRow(
              a.productId, i + 1, a.name,
              <>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ax-text)' }}>{fmt(a.revenue)}</div>
                <div style={{ fontSize: 10.5, color: '#5A5A78' }}>{a.revenueShare}%</div>
              </>,
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ padding: '1px 6px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: (a.class === 'A' ? '#22C55E' : a.class === 'B' ? '#FBBF24' : '#8B8BAA') + '22', color: a.class === 'A' ? '#22C55E' : a.class === 'B' ? '#FBBF24' : '#8B8BAA' }}>{a.class}</span>
                {L.revShare}
              </span>,
              '#22C55E',
            ))}
          </div>
        </motion.div>

        {/* Низкий остаток */}
        <motion.div {...springIn} style={cardBase}>
          {panelHeader(<PackageX size={17} />, L.lowStockTitle, L.lowStockHint, '#FB923C')}
          <div style={{ padding: '2px 8px 12px' }}>
            {lowStockList.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#22C55E', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <CheckCircle2 size={15} />{isUz ? 'Barcha zaxiralar yetarli' : 'Все запасы в норме'}
              </div>
            ) : lowStockList.slice(0, 8).map((l) => {
              const critical = l.stock <= 0;
              const clr = critical ? '#F87171' : '#FB923C';
              return productRow(
                l.productId, l.stock, l.name,
                <span style={{ fontSize: 11.5, fontWeight: 700, color: clr, background: `${clr}1A`, padding: '3px 9px', borderRadius: 12, whiteSpace: 'nowrap' }}>
                  {critical ? L.outOfStock : `${l.stock} ${L.units}`}
                </span>,
                `${l.soldPerDay} ${L.perDay}`, clr,
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Recent orders */}
      <motion.div {...springIn} style={cardBase}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ax-text)' }}>{L.recent}</span>
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
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ax-text)' }}>{o.customerName || L.buyer}</div>
                  <div style={{ fontSize: 12, color: '#5A5A78', marginTop: 2 }}>№{o.orderCode}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ax-text)' }}>{fmt(o.totalAmount)} <span style={{ color: '#5A5A78', fontSize: 11 }}>{L.sum}</span></div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: sc.bg, fontSize: 11, fontWeight: 500, color: sc.text, whiteSpace: 'nowrap' }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: sc.dot }} />
                    {statusLabel[o.status] || o.status}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </motion.div>

      {/* 🔍 Мини-панель детали товара */}
      <AnimatePresence>
        {selected && (
          <ProductDetailModal
            key={selected.productId}
            detail={selected}
            L={L}
            fmt={fmt}
            onClose={() => setSelected(null)}
            onReplenish={() => { setSelected(null); onNavigate?.('warehouse'); }}
            onAnalytics={() => { setSelected(null); onNavigate?.('analytics'); }}
          />
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Мини-панель детали товара ────────────────────────────────────────────────
function ProductDetailModal({
  detail, L, fmt, onClose, onReplenish, onAnalytics,
}: {
  detail: ProductDetail;
  L: Record<string, string>;
  fmt: (n: number) => string;
  onClose: () => void;
  onReplenish: () => void;
  onAnalytics: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const stockColor = detail.stock == null ? '#8B8BAA'
    : detail.stock <= 0 ? '#F87171'
    : detail.stock <= 5 ? '#FB923C' : '#22C55E';

  const forecastText = detail.outOfStock ? L.outOfStock
    : detail.daysLeft == null || detail.daysLeft < 0 ? '—'
    : `${detail.daysLeft} ${L.daysLeft}`;

  const metrics = [
    detail.units != null && { icon: <Boxes size={16} />, label: L.detailUnits, value: `${fmt(detail.units)} ${L.units}`, color: '#7C5CF0' },
    detail.revenue != null && { icon: <Coins size={16} />, label: L.detailRevenue, value: `${fmt(detail.revenue)} ${L.sum}`, color: '#22C55E' },
    detail.stock != null && { icon: <Package size={16} />, label: L.detailStock, value: detail.outOfStock ? L.outOfStock : `${fmt(detail.stock)} ${L.units}`, color: stockColor },
    detail.soldPerDay != null && { icon: <Gauge size={16} />, label: L.detailSpeed, value: `${detail.soldPerDay} ${L.perDay}`, color: '#38BDF8' },
    (detail.daysLeft != null || detail.outOfStock) && { icon: <Timer size={16} />, label: L.detailForecast, value: forecastText, color: '#FBBF24' },
  ].filter(Boolean) as Array<{ icon: React.ReactNode; label: string; value: string; color: string }>;

  const showReplenish = detail.stock != null && detail.stock <= 5;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(6,6,16,0.72)',
        backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420, background: 'var(--ax-card)',
          border: '1px solid rgba(124,92,240,0.25)', borderRadius: 20,
          boxShadow: '0 24px 70px rgba(0,0,0,0.6)', overflow: 'hidden',
        }}
      >
        <div style={{ padding: '18px 20px', background: 'linear-gradient(135deg, rgba(124,92,240,0.18), rgba(124,92,240,0.02))', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: '#8B8BAA', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{L.details}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ax-text)', lineHeight: 1.3 }}>{detail.name}</div>
            {detail.abcClass && (
              <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ padding: '2px 8px', borderRadius: 7, fontSize: 11, fontWeight: 700, background: (detail.abcClass === 'A' ? '#22C55E' : detail.abcClass === 'B' ? '#FBBF24' : '#8B8BAA') + '22', color: detail.abcClass === 'A' ? '#22C55E' : detail.abcClass === 'B' ? '#FBBF24' : '#8B8BAA' }}>{L.detailAbc} {detail.abcClass}</span>
                {detail.revenueShare != null && <span style={{ fontSize: 11, color: '#5A5A78' }}>{detail.revenueShare}% {L.revShare}</span>}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: 'none', color: '#8B8BAA', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '14px 20px 4px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {metrics.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i }}
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '11px 13px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: m.color, marginBottom: 6 }}>
                {m.icon}<span style={{ fontSize: 11, color: '#8B8BAA' }}>{m.label}</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ax-text)' }}>{m.value}</div>
            </motion.div>
          ))}
        </div>

        <div style={{ padding: '12px 20px 20px', display: 'flex', gap: 10 }}>
          {showReplenish && (
            <button onClick={onReplenish} style={{ flex: 1, padding: '11px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #FB923C, #F97316)', color: '#fff', fontSize: 13, fontWeight: 600 }}>
              {L.replenish}
            </button>
          )}
          <button onClick={onAnalytics} style={{ flex: 1, padding: '11px', borderRadius: 12, border: '1px solid rgba(124,92,240,0.3)', cursor: 'pointer', background: 'rgba(124,92,240,0.12)', color: '#A78BFA', fontSize: 13, fontWeight: 600 }}>
            {L.viewAnalytics}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
