import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingCart, TrendingUp, Clock, RotateCcw, AlertTriangle,
  MessageCircleQuestion, Package, ArrowRight, CheckCircle2,
  Crown, Coins, PackageX, X, Boxes, Gauge, Timer,
  Wallet, PiggyBank, Percent, Store, Globe, ChevronRight,
  Snowflake, Users,
} from 'lucide-react';
import {
  ResponsiveContainer, Tooltip, PieChart, Pie, Cell,
} from 'recharts';
import AxAreaChart from './charts/AxAreaChart';
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

interface ForecastRow { productId: number; name: string; stock: number; soldPerDay: number; daysLeft: number; outOfStock: boolean }
interface AbcRow { productId: number; name: string; revenue: number; revenueShare: number; class: string }
interface SellerRow { productId: number; name: string; units: number; revenue: number }
interface LowStockRow { productId: number; name: string; stock: number; soldPerDay: number }

interface DeadStockRow { productId: number; name: string; stock: number; frozenValue: number }

interface InsightsData {
  stockForecast: ForecastRow[];
  abcAnalysis: AbcRow[];
  topSellers?: SellerRow[];
  lowStock?: LowStockRow[];
  deadStock?: DeadStockRow[];
  deadStockTotal?: number;
  totalRevenue90: number;
}

interface SegmentClient { phone: string; name: string; orders: number; total: number; daysSince: number }
interface SegmentsData { vip: SegmentClient[]; regular: SegmentClient[]; new: SegmentClient[]; sleeping: SegmentClient[]; lost: SegmentClient[] }

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

interface ProfitBlock { revenue: number; profit: number; cogs: number; count: number; margin: number }
interface ProfitData {
  online: ProfitBlock;
  offline: ProfitBlock;
  total: ProfitBlock;
  today: { revenue: number; profit: number };
}

export default function CompanyDashboardPanel({ companyId, onNavigate }: CompanyDashboardPanelProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [profit, setProfit] = useState<ProfitData | null>(null);
  const [segments, setSegments] = useState<SegmentsData | null>(null);
  const [openSegment, setOpenSegment] = useState<keyof SegmentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ProductDetail | null>(null);
  // Открытая мини-панель разбора прибыли (null = закрыта)
  const [profitOpen, setProfitOpen] = useState<null | 'revenue' | 'profit'>(null);
  // 🎯 Дневная цель продаж (companies.daily_sales_goal — общая с приложением)
  const [goal, setGoal] = useState(0);
  const [goalEditOpen, setGoalEditOpen] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  // 📇 Мини-CRM: карточка клиента (по клику в сегментах) + долги для сверки
  const [clientCard, setClientCard] = useState<SegmentClient | null>(null);
  const [debtsList, setDebtsList] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.analytics.dashboard(companyId),
      api.orders.list({ companyId }).catch(() => []),
      api.analytics.inventoryInsights(companyId).catch(() => null),
      api.analytics.profit(companyId).catch(() => null),
      api.analytics.customerSegments(companyId).catch(() => null),
      api.companies.get(String(companyId)).catch(() => null),
    ]).then(([dashData, ordersData, insightsData, profitData, segmentsData, companyData]) => {
      if (!active) return;
      setData(dashData);
      const orders = Array.isArray(ordersData) ? ordersData : (ordersData?.orders || []);
      setAllOrders(orders);
      setInsights(insightsData);
      setProfit(profitData);
      setSegments(segmentsData);
      setGoal(Number(companyData?.dailySalesGoal) || 0);
      api.debts.list(companyId).then((d: any) => setDebtsList(Array.isArray(d) ? d : [])).catch(() => {});
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
    netProfit: isUz ? 'Sof foyda (ustama)' : 'Чистая прибыль',
    soldUnits: isUz ? 'Sotilgan dona' : 'Продано единиц',
    // Короткие человеческие подсказки под карточками
    hintTodayOrders: isUz ? 'bugun tushgan' : 'поступило сегодня',
    hintTodayRevenue: isUz ? 'bugungi savdo' : 'продажи за сегодня',
    hintSoldUnits: isUz ? 'jami dona' : 'штук всего',
    hintRevenue: isUz ? 'bosing — pul qayerdan' : 'нажмите — откуда деньги',
    hintProfit: isUz ? 'bosing — qancha ishladingiz' : 'нажмите — сколько заработали',
    tapHint: isUz ? 'Bosib batafsil koʻring' : 'Нажмите, чтобы увидеть детали',
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
    leadersHint: isUz ? 'Eng koʻp sotib olishadi' : 'Покупают чаще всего',
    profitable: isUz ? 'Eng foydali tovarlar' : 'Самые прибыльные',
    profitableHint: isUz ? 'Koʻproq pul keltiradi' : 'Приносят больше всего денег',
    lowStockTitle: isUz ? 'Kam qolgan tovarlar' : 'Товары с низким остатком',
    lowStockHint: isUz ? 'Tugaydi — toʻldiring' : 'Скоро закончатся — пора докупить',
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
    // ── Мини-панель прибыли ──
    pTitle: isUz ? 'Foyda va tushum' : 'Прибыль и выручка',
    pSubtitle: isUz ? 'Pulingiz qayerdan kelgani' : 'Откуда берутся ваши деньги',
    pRevenue: isUz ? 'Umumiy tushum' : 'Общая выручка',
    pRevenueExp: isUz ? 'Xaridorlar sizga toʻlagan barcha pul' : 'Все деньги, которые вам заплатили покупатели',
    pProfit: isUz ? 'Sof foyda (ustama)' : 'Чистая прибыль (наценка)',
    pProfitExp: isUz ? 'Sotish va sotib olish narxi orasidagi farq — sizning haqiqiy daromadingiz' : 'Разница между ценой продажи и закупки — ваш реальный заработок',
    pCogs: isUz ? 'Tannarx' : 'Себестоимость',
    pCogsExp: isUz ? 'Sotilgan tovarni sotib olishga ketgan pul' : 'Сколько потратили на закупку проданного товара',
    pMargin: isUz ? 'Marja' : 'Маржа',
    pMarginExp: isUz ? 'Har 100 soʻmdan qancha foyda qoladi' : 'Сколько прибыли остаётся с каждых 100 сум',
    pOnline: isUz ? 'Onlayn (buyurtmalar)' : 'Онлайн (заказы)',
    pOnlineExp: isUz ? 'Yetkazib berish bilan buyurtmalar' : 'Заказы с доставкой',
    pOffline: isUz ? 'Oflayn (kassa)' : 'Офлайн (касса)',
    pOfflineExp: isUz ? 'Doʻkonda kassa orqali sotuvlar' : 'Продажи через кассу в магазине',
    pOps: isUz ? 'sotuv' : 'продаж',
    pNoData: isUz ? 'Hali sotuvlar yoʻq' : 'Продаж пока нет',
    pWhatIsThis: isUz ? 'Bu nima?' : 'Что это?',
    // ── Залежавшийся товар ──
    deadTitle: isUz ? 'Yotib qolgan tovarlar' : 'Залежавшийся товар',
    deadHint: isUz ? '60 kun sotilmagan — chegirma qiling' : '60 дней без продаж — пора делать скидку',
    frozen: isUz ? 'muzlatilgan' : 'заморожено',
    noDead: isUz ? 'Yotib qolgan tovar yoʻq' : 'Залежавшихся товаров нет',
    // ── RFM-сегменты клиентов ──
    segTitle: isUz ? 'Sizning mijozlaringiz' : 'Ваши клиенты',
    segHint: isUz ? 'Tizim mijozlarni oʻzi guruhlarga ajratdi' : 'Система сама разложила покупателей по группам',
    segVip: 'VIP',
    segVipHint: isUz ? '4+ buyurtma — ularni asrang' : '4+ заказа — их надо беречь',
    segRegular: isUz ? 'Doimiylar' : 'Постоянные',
    segRegularHint: isUz ? '2-3 buyurtma' : '2–3 заказа',
    segNew: isUz ? 'Yangilar' : 'Новые',
    segNewHint: isUz ? 'Birinchi buyurtma' : 'Первый заказ',
    segSleeping: isUz ? 'Uxlayotganlar' : 'Засыпающие',
    segSleepingHint: isUz ? '45-90 kun kelmagan — eslating!' : '45–90 дней не покупали — напомните о себе!',
    segLost: isUz ? 'Yoʻqotilganlar' : 'Потерянные',
    segLostHint: isUz ? '90+ kun kelmagan' : '90+ дней не покупали',
    segOrders: isUz ? 'buyurtma' : 'заказов',
    segDays: isUz ? 'kun oldin' : 'дн. назад',
    segEmpty: isUz ? 'Bu guruhda hech kim yoʻq' : 'В этой группе пока никого',
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
    const localKey = (d: Date, half: 0 | 1) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${half}`;
    const now = new Date();
    // Текущая неделя (14 полудневных корзин) + предыдущая неделя (тот же индекс).
    const cur: { date: string; revenue: number; prevRevenue: number; orders: number }[] = [];
    const curKey: Record<string, number> = {}; // ключ корзины → индекс
    const prevKey: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const p = new Date(now); p.setDate(p.getDate() - i - 7);
      const dayLabel = `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
      for (const half of [0, 1] as const) {
        curKey[localKey(d, half)] = cur.length;
        prevKey[localKey(p, half)] = cur.length;
        cur.push({ date: `${dayLabel} ${half === 0 ? '00:00' : '12:00'}`, revenue: 0, prevRevenue: 0, orders: 0 });
      }
    }
    allOrders.forEach((o: any) => {
      const dateStr = o.created_at || o.order_date || '';
      if (!dateStr || o.status === 'cancelled') return;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return;
      const k = localKey(d, d.getHours() < 12 ? 0 : 1);
      if (curKey[k] !== undefined) {
        cur[curKey[k]].revenue += parseFloat(o.total_amount) || 0;
        cur[curKey[k]].orders += 1;
      } else if (prevKey[k] !== undefined) {
        cur[prevKey[k]].prevRevenue += parseFloat(o.total_amount) || 0;
      }
    });
    return cur;
  }, [allOrders]);

  // Есть ли исторические заказы за прошлую неделю → показывать вторую линию.
  const hasPrevRevenue = useMemo(() => chartData.some((d) => d.prevRevenue > 0), [chartData]);

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

  // 📊 Сводка ABC: сколько товаров в каждом классе и какую долю выручки они
  // дают. ВАЖНО: хук обязан стоять ДО ранних return (loading / !data) —
  // иначе при переходе «загрузка → данные» меняется число хуков и React
  // падает с ошибкой #310.
  const abcSummary = useMemo(() => {
    const all = insights?.abcAnalysis || [];
    const sum = (cls: string) => ({
      count: all.filter(a => a.class === cls).length,
      share: Math.round(all.filter(a => a.class === cls).reduce((s, a) => s + (a.revenueShare || 0), 0)),
    });
    return { A: sum('A'), B: sum('B'), C: sum('C'), total: all.length };
  }, [insights]);

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

  const totalRevenueVal = profit?.total.revenue ?? data.totalRevenue;
  const netProfitVal = profit?.total.profit ?? 0;

  type Stat = {
    icon: React.ReactNode; label: string; value: string; hint: string;
    accent: string; accentBg: string; onClick: () => void; clickable?: boolean; alert?: boolean;
  };
  const stats: Stat[] = [
    { icon: <ShoppingCart size={20} />, label: L.todayOrders,  value: fmt(data.todayOrders),               hint: L.hintTodayOrders,  accent: '#7C5CF0', accentBg: 'rgba(124,92,240,0.15)', onClick: () => onNavigate?.('orders') },
    { icon: <TrendingUp size={20} />,   label: L.todayRevenue, value: `${fmt(data.todayRevenue)} ${L.sum}`, hint: L.hintTodayRevenue, accent: '#22C55E', accentBg: 'rgba(34,197,94,0.12)',  onClick: () => onNavigate?.('analytics') },
    { icon: <Package size={20} />,      label: L.soldUnits,    value: fmt(data.soldUnits),                 hint: L.hintSoldUnits,    accent: '#FBBF24', accentBg: 'rgba(251,191,36,0.12)', onClick: () => onNavigate?.('warehouse') },
    { icon: <Wallet size={20} />,       label: L.totalRevenue, value: `${fmt(totalRevenueVal)} ${L.sum}`,   hint: L.hintRevenue,      accent: '#38BDF8', accentBg: 'rgba(56,189,248,0.12)', onClick: () => setProfitOpen('revenue'), clickable: true },
    { icon: <PiggyBank size={20} />,    label: L.netProfit,    value: `${fmt(netProfitVal)} ${L.sum}`,     hint: L.hintProfit,       accent: '#34D399', accentBg: 'rgba(52,211,153,0.15)', onClick: () => setProfitOpen('profit'),  clickable: true },
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
  const deadStockList = insights?.deadStock || [];

  // 👥 Конфигурация RFM-сегментов для отрисовки
  const segmentDefs: Array<{ key: keyof SegmentsData; label: string; hint: string; color: string }> = [
    { key: 'vip',      label: L.segVip,      hint: L.segVipHint,      color: '#FBBF24' },
    { key: 'regular',  label: L.segRegular,  hint: L.segRegularHint,  color: '#22C55E' },
    { key: 'new',      label: L.segNew,      hint: L.segNewHint,      color: '#38BDF8' },
    { key: 'sleeping', label: L.segSleeping, hint: L.segSleepingHint, color: '#FB923C' },
    { key: 'lost',     label: L.segLost,     hint: L.segLostHint,     color: '#F87171' },
  ];

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

  // 🎯 Цель дня: сегодняшняя выручка против заданной цели
  const goalTodayRevenue = (profit?.today?.revenue ?? data.todayRevenue) || 0;
  const goalRatio = goal > 0 ? Math.min(1, goalTodayRevenue / goal) : 0;
  const goalReached = goal > 0 && goalTodayRevenue >= goal;
  const goalRingR = 34;
  const goalRingC = 2 * Math.PI * goalRingR;

  const saveGoal = async () => {
    const value = parseInt(goalInput, 10) || 0;
    try {
      await api.companies.update(String(companyId), { dailySalesGoal: value });
      setGoal(value);
      setGoalEditOpen(false);
    } catch (e) {
      console.error('Goal save failed:', e);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* 🎯 Цель дня */}
      <motion.div
        {...springIn}
        onClick={() => { setGoalInput(goal > 0 ? String(goal) : ''); setGoalEditOpen(true); }}
        style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '14px 18px', borderRadius: 16, background: 'var(--ax-card)', border: `1px solid ${goalReached ? 'rgba(34,197,94,0.4)' : 'var(--ax-border)'}`, cursor: 'pointer' }}
      >
        <div style={{ position: 'relative', width: 78, height: 78, flexShrink: 0 }}>
          <svg width={78} height={78}>
            <circle cx={39} cy={39} r={goalRingR} stroke="var(--ax-border)" strokeWidth={8} fill="none" />
            <circle
              cx={39} cy={39} r={goalRingR}
              stroke={goalReached ? '#22C55E' : 'var(--ax-primary)'}
              strokeWidth={8} fill="none" strokeLinecap="round"
              strokeDasharray={`${goalRingC * goalRatio} ${goalRingC}`}
              transform="rotate(-90 39 39)"
              style={{ transition: 'stroke-dasharray 0.6s ease' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, color: goalReached ? '#22C55E' : 'var(--ax-text)' }}>
            {goal > 0 ? `${Math.min(999, Math.round((goalTodayRevenue / goal) * 100))}%` : '—'}
          </div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--ax-text)' }}>
            🎯 {isUz ? 'Kun maqsadi' : 'Цель дня'}
          </div>
          {goal > 0 ? (
            <>
              <div style={{ color: 'var(--ax-text-2)', fontSize: 13.5, marginTop: 3 }}>
                {fmt(goalTodayRevenue)} / {fmt(goal)} {L.sum}
              </div>
              <div style={{ color: goalReached ? '#22C55E' : 'var(--ax-text-3)', fontSize: 12.5, marginTop: 2, fontWeight: goalReached ? 700 : 400 }}>
                {goalReached
                  ? (isUz ? 'Maqsadga erishildi! 🎉' : 'Цель достигнута! 🎉')
                  : (isUz ? 'Bosing — maqsadni oʻzgartiring' : 'Нажмите, чтобы изменить цель')}
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--ax-text-3)', fontSize: 12.5, marginTop: 3 }}>
              {isUz ? 'Kunlik maqsad qoʻying — taraqqiyotni kuzating' : 'Задайте дневную цель — и следите за прогрессом'}
            </div>
          )}
        </div>
      </motion.div>

      {/* Модалка: изменить цель */}
      {goalEditOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setGoalEditOpen(false)}>
          <div style={{ background: 'var(--ax-surface)', border: '1px solid var(--ax-border)', borderRadius: 18, padding: 22, width: '100%', maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: 'var(--ax-text)', fontSize: 16.5, fontWeight: 700, marginBottom: 14 }}>
              🎯 {isUz ? 'Kunlik maqsad, soʻm' : 'Цель на день, сум'}
            </h3>
            <input
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value.replace(/\D/g, ''))}
              placeholder="1000000"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') saveGoal(); }}
              style={{ width: '100%', padding: '11px 14px', borderRadius: 12, background: 'var(--ax-input)', border: '1px solid var(--ax-border)', color: 'var(--ax-text)', fontSize: 15, outline: 'none', marginBottom: 12 }}
            />
            <button
              onClick={saveGoal}
              style={{ width: '100%', padding: '12px 0', borderRadius: 12, background: 'linear-gradient(135deg, #7C5CF0, #5B3DD4)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14.5 }}
            >
              {isUz ? 'Saqlash' : 'Сохранить'}
            </button>
          </div>
        </div>
      )}

      {/* Top stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
        {stats.map((s, i) => (
          <motion.button
            key={i}
            onClick={s.onClick}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24, delay: i * 0.05 }}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
            style={{
              position: 'relative',
              background: s.clickable ? `linear-gradient(160deg, ${s.accent}14, var(--ax-card) 60%)` : 'var(--ax-card)',
              border: `1px solid ${s.alert ? 'rgba(251,146,60,0.35)' : s.clickable ? `${s.accent}40` : 'rgba(255,255,255,0.07)'}`,
              borderRadius: 16, padding: '18px 20px', textAlign: 'left', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            }}
          >
            {s.clickable && (
              <span style={{ position: 'absolute', top: 14, right: 14, color: s.accent, opacity: 0.75, display: 'inline-flex' }}>
                <ChevronRight size={16} />
              </span>
            )}
            <div style={{ width: 40, height: 40, borderRadius: 12, background: s.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.accent }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ax-text)', lineHeight: 1.2 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#8B8BAA', marginTop: 4 }}>{s.label}</div>
              <div style={{ fontSize: 10.5, color: s.clickable ? s.accent : '#5A5A78', marginTop: 3, fontWeight: s.clickable ? 600 : 400 }}>{s.hint}</div>
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
            {/* Единый стиль линейных диаграмм проекта — см. AxAreaChart */}
            <AxAreaChart
              data={chartData}
              xKey="date"
              height={200}
              xInterval={1}
              xTickFormatter={(v: string) => v.replace(' 00:00', '')}
              series={[
                { key: 'revenue', name: isUz ? 'Joriy hafta' : 'Текущая неделя', color: '#7C5CF0', fill: true },
                ...(hasPrevRevenue
                  ? [{ key: 'prevRevenue', name: isUz ? 'Oldingi hafta' : 'Прошлая неделя', color: '#0284C7', dashed: true }]
                  : []),
              ]}
              valueFormatter={(v) => `${fmt(v)} ${L.sum}`}
            />
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
          {/* Сводка ABC: A кормит магазин, C — балласт */}
          {abcSummary.total > 0 && (
            <div style={{ display: 'flex', gap: 6, padding: '0 16px 8px' }}>
              {(['A', 'B', 'C'] as const).map((cls) => {
                const clr = cls === 'A' ? '#22C55E' : cls === 'B' ? '#FBBF24' : '#8B8BAA';
                const s = abcSummary[cls];
                return (
                  <div key={cls} style={{ flex: 1, padding: '6px 8px', borderRadius: 9, background: `${clr}12`, border: `1px solid ${clr}30`, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: clr }}>{cls} · {s.count}</div>
                    <div style={{ fontSize: 10, color: '#8B8BAA' }}>{s.share}% {isUz ? 'tushum' : 'выручки'}</div>
                  </div>
                );
              })}
            </div>
          )}
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

        {/* ❄️ Залежавшийся товар: 60 дней без продаж, деньги заморожены */}
        <motion.div {...springIn} style={cardBase}>
          {panelHeader(<Snowflake size={17} />, L.deadTitle, L.deadHint, '#38BDF8')}
          <div style={{ padding: '2px 8px 12px' }}>
            {deadStockList.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#22C55E', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <CheckCircle2 size={15} />{L.noDead}
              </div>
            ) : (
              <>
                {(insights?.deadStockTotal || 0) > 0 && (
                  <div style={{ margin: '2px 10px 6px', padding: '7px 12px', borderRadius: 10, background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', fontSize: 12, color: '#38BDF8', fontWeight: 700 }}>
                    {fmt(insights!.deadStockTotal!)} {L.sum} {L.frozen}
                  </div>
                )}
                {deadStockList.slice(0, 8).map((d, i) => productRow(
                  d.productId, i + 1, d.name,
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#38BDF8', background: 'rgba(56,189,248,0.12)', padding: '3px 9px', borderRadius: 12, whiteSpace: 'nowrap' }}>
                    {fmt(d.frozenValue)} {L.sum}
                  </span>,
                  `${d.stock} ${L.units}`, '#38BDF8',
                ))}
              </>
            )}
          </div>
        </motion.div>
      </div>

      {/* 👥 Ваши клиенты (RFM-сегменты) */}
      {segments && (
        <motion.div {...springIn} style={cardBase}>
          {panelHeader(<Users size={17} />, L.segTitle, L.segHint, '#A78BFA')}
          <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
              {segmentDefs.map((s) => {
                const list = segments[s.key] || [];
                const open = openSegment === s.key;
                return (
                  <motion.button
                    key={s.key}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setOpenSegment(open ? null : s.key)}
                    style={{
                      padding: '10px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                      background: open ? `${s.color}1F` : `${s.color}0F`,
                      border: `1px solid ${s.color}${open ? '66' : '30'}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: s.color }}>{s.label}</span>
                      <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--ax-text)' }}>{list.length}</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: '#8B8BAA', marginTop: 2 }}>{s.hint}</div>
                  </motion.button>
                );
              })}
            </div>

            {/* Раскрытый сегмент: список клиентов, самые ценные первыми */}
            <AnimatePresence>
              {openSegment && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, maxHeight: 280, overflowY: 'auto' }}>
                    {(segments[openSegment] || []).length === 0 ? (
                      <div style={{ padding: 16, textAlign: 'center', color: '#5A5A78', fontSize: 13 }}>{L.segEmpty}</div>
                    ) : (segments[openSegment] || []).map((cl, i) => (
                      <div
                        key={cl.phone}
                        onClick={() => setClientCard(cl)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}
                        title={isUz ? 'Mijoz kartasi' : 'Карточка клиента'}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13, color: 'var(--ax-text)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cl.name || cl.phone}</div>
                          <div style={{ fontSize: 11, color: '#5A5A78' }}>{cl.phone} · {cl.orders} {L.segOrders} · {cl.daysSince} {L.segDays}</div>
                        </div>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ax-text)', whiteSpace: 'nowrap' }}>{fmt(cl.total)} {L.sum}</span>
                        <ChevronRight size={14} style={{ color: '#5A5A78', flexShrink: 0 }} />
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* 📇 Карточка клиента — мини-CRM: заказы + долги в одном месте */}
      {clientCard && (() => {
        const norm = (p: string) => (p || '').replace(/\D/g, '').slice(-9);
        const clientOrders = allOrders
          .filter((o: any) => norm(o.customerPhone || o.customer_phone || o.user_phone) === norm(clientCard.phone))
          .sort((a: any, b: any) => new Date(b.createdAt || b.created_at || '').getTime() - new Date(a.createdAt || a.created_at || '').getTime());
        const clientDebt = debtsList
          .filter((d: any) => d.status === 'open' && norm(d.customerPhone) === norm(clientCard.phone))
          .reduce((s: number, d: any) => s + (d.amount - d.paidAmount), 0);
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setClientCard(null)}>
            <div style={{ background: 'var(--ax-surface)', border: '1px solid var(--ax-border)', borderRadius: 18, padding: 22, width: '100%', maxWidth: 460, maxHeight: '84vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ color: 'var(--ax-text)', fontSize: 18, fontWeight: 800 }}>{clientCard.name || clientCard.phone}</div>
                  <div style={{ color: 'var(--ax-text-2)', fontSize: 13.5, marginTop: 2 }}>+998 {clientCard.phone}</div>
                </div>
                <button onClick={() => setClientCard(null)} style={{ background: 'none', border: 'none', color: 'var(--ax-text-2)', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                <span style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(56,189,248,0.13)', color: '#38BDF8', fontSize: 12, fontWeight: 700 }}>
                  {isUz ? 'Buyurtmalar' : 'Заказов'}: {clientCard.orders}
                </span>
                <span style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(34,197,94,0.13)', color: '#22C55E', fontSize: 12, fontWeight: 700 }}>
                  {isUz ? 'Xarid' : 'Куплено на'}: {fmt(clientCard.total)} {L.sum}
                </span>
                <span style={{ padding: '4px 10px', borderRadius: 999, background: clientDebt > 0 ? 'rgba(248,113,113,0.13)' : 'rgba(34,197,94,0.13)', color: clientDebt > 0 ? '#F87171' : '#22C55E', fontSize: 12, fontWeight: 700 }}>
                  {clientDebt > 0
                    ? `${isUz ? 'Qarz' : 'Долг'}: ${fmt(clientDebt)} ${L.sum}`
                    : (isUz ? 'Qarzlar yoʻq' : 'Долгов нет')}
                </span>
                <span style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(139,92,246,0.13)', color: '#A78BFA', fontSize: 12, fontWeight: 700 }}>
                  {isUz ? 'Oxirgi buyurtma' : 'Последний заказ'}: {clientCard.daysSince} {isUz ? 'kun oldin' : 'дн. назад'}
                </span>
              </div>
              <a
                href={`tel:+998${norm(clientCard.phone)}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 11, background: 'rgba(34,197,94,0.15)', color: '#22C55E', fontSize: 13, fontWeight: 600, marginBottom: 16, textDecoration: 'none' }}
              >
                📞 {isUz ? 'Qoʻngʻiroq' : 'Позвонить'}
              </a>
              <div style={{ color: 'var(--ax-text-3)', fontSize: 11.5, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
                {L.recent}
              </div>
              {clientOrders.length === 0 ? (
                <div style={{ color: 'var(--ax-text-3)', fontSize: 13, padding: '10px 0' }}>{L.noOrders}</div>
              ) : (
                <div style={{ display: 'grid', gap: 6 }}>
                  {clientOrders.slice(0, 6).map((o: any) => (
                    <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 10, background: 'var(--ax-card)', border: '1px solid var(--ax-border)' }}>
                      <div>
                        <div style={{ color: 'var(--ax-text)', fontSize: 13, fontWeight: 600 }}>#{o.orderCode || o.order_code || o.id}</div>
                        <div style={{ color: 'var(--ax-text-3)', fontSize: 11.5 }}>
                          {new Date(o.createdAt || o.created_at).toLocaleDateString('ru-RU')}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: 'var(--ax-text)', fontWeight: 700, fontSize: 13 }}>{fmt(o.totalAmount || o.total_amount)} {L.sum}</div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[o.status]?.text || 'var(--ax-text-3)' }}>{o.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

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

      {/* 💰 Мини-панель разбора прибыли */}
      <AnimatePresence>
        {profitOpen && (
          <ProfitModal
            focus={profitOpen}
            profit={profit}
            L={L}
            fmt={fmt}
            onClose={() => setProfitOpen(null)}
            onAnalytics={() => { setProfitOpen(null); onNavigate?.('analytics'); }}
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

// ── Мини-панель разбора прибыли (онлайн/офлайн) ─────────────────────────────
function ProfitModal({
  focus, profit, L, fmt, onClose, onAnalytics,
}: {
  focus: 'revenue' | 'profit';
  profit: ProfitData | null;
  L: Record<string, string>;
  fmt: (n: number) => string;
  onClose: () => void;
  onAnalytics: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const t = profit?.total;
  const on = profit?.online;
  const off = profit?.offline;
  const hasData = !!t && t.count > 0;

  // Доли онлайн/офлайн по выручке — для наглядной полоски
  const onShare = t && t.revenue > 0 && on ? Math.round(on.revenue / t.revenue * 100) : 0;
  const offShare = 100 - onShare;

  // Ключевые цифры «героя» — выручка и прибыль, фокусная подсвечена
  const hero = [
    { key: 'revenue', icon: <Wallet size={16} />, label: L.pRevenue, exp: L.pRevenueExp, value: fmt(t?.revenue || 0), color: '#38BDF8' },
    { key: 'profit',  icon: <PiggyBank size={16} />, label: L.pProfit,  exp: L.pProfitExp,  value: fmt(t?.profit || 0),  color: '#34D399' },
  ];

  const channel = (
    title: string, exp: string, icon: React.ReactNode, blk: ProfitBlock | undefined, accent: string,
  ) => (
    <div style={{ flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '13px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ width: 26, height: 26, borderRadius: 8, background: `${accent}1A`, color: accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ax-text)' }}>{title}</div>
          <div style={{ fontSize: 10, color: '#5A5A78' }}>{exp}</div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10 }}>
        <span style={{ fontSize: 11, color: '#8B8BAA' }}>{L.pRevenue}</span>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ax-text)' }}>{fmt(blk?.revenue || 0)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 5 }}>
        <span style={{ fontSize: 11, color: '#8B8BAA' }}>{L.pProfit.replace(' (ustama)', '').replace(' (наценка)', '')}</span>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: accent }}>{fmt(blk?.profit || 0)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 5 }}>
        <span style={{ fontSize: 11, color: '#8B8BAA' }}>{L.pOps}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#8B8BAA' }}>{fmt(blk?.count || 0)}</span>
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(6,6,16,0.72)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto', background: 'var(--ax-card)', border: '1px solid rgba(52,211,153,0.22)', borderRadius: 20, boxShadow: '0 24px 70px rgba(0,0,0,0.6)' }}
      >
        {/* Header */}
        <div style={{ padding: '18px 20px', background: 'linear-gradient(135deg, rgba(52,211,153,0.16), rgba(56,189,248,0.04))', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'flex-start', gap: 12, position: 'sticky', top: 0, backdropFilter: 'blur(8px)', zIndex: 2 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ax-text)', lineHeight: 1.3 }}>{L.pTitle}</div>
            <div style={{ fontSize: 12, color: '#8B8BAA', marginTop: 2 }}>{L.pSubtitle}</div>
          </div>
          <button onClick={onClose} style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: 'none', color: '#8B8BAA', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>

        {!hasData ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#5A5A78', fontSize: 14 }}>{L.pNoData}</div>
        ) : (
          <>
            {/* Hero: выручка + прибыль */}
            <div style={{ padding: '16px 20px 6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {hero.map((h, i) => {
                const active = h.key === focus;
                return (
                  <motion.div key={h.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i }}
                    style={{ background: active ? `${h.color}14` : 'rgba(255,255,255,0.03)', border: `1px solid ${active ? h.color + '55' : 'rgba(255,255,255,0.06)'}`, borderRadius: 14, padding: '13px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: h.color, marginBottom: 6 }}>
                      {h.icon}<span style={{ fontSize: 11.5, color: '#8B8BAA' }}>{h.label}</span>
                    </div>
                    <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--ax-text)', lineHeight: 1.15 }}>{h.value} <span style={{ fontSize: 12, color: '#5A5A78', fontWeight: 400 }}>{L.sum}</span></div>
                    <div style={{ fontSize: 10.5, color: '#5A5A78', marginTop: 6, lineHeight: 1.4 }}>{h.exp}</div>
                  </motion.div>
                );
              })}
            </div>

            {/* Маржа + Себестоимость */}
            <div style={{ padding: '6px 20px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '10px 13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#A78BFA', marginBottom: 4 }}><Percent size={14} /><span style={{ fontSize: 11, color: '#8B8BAA' }}>{L.pMargin}</span></div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ax-text)' }}>{t?.margin ?? 0}%</div>
                <div style={{ fontSize: 10, color: '#5A5A78', marginTop: 3 }}>{L.pMarginExp}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '10px 13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#FB923C', marginBottom: 4 }}><Boxes size={14} /><span style={{ fontSize: 11, color: '#8B8BAA' }}>{L.pCogs}</span></div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ax-text)' }}>{fmt(t?.cogs || 0)}</div>
                <div style={{ fontSize: 10, color: '#5A5A78', marginTop: 3 }}>{L.pCogsExp}</div>
              </div>
            </div>

            {/* Полоска онлайн/офлайн по выручке */}
            <div style={{ padding: '6px 20px 4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8B8BAA', marginBottom: 6 }}>
                <span style={{ color: '#38BDF8' }}>● {L.pOnline} {onShare}%</span>
                <span style={{ color: '#A78BFA' }}>{L.pOffline} {offShare}% ●</span>
              </div>
              <div style={{ height: 8, borderRadius: 6, overflow: 'hidden', display: 'flex', background: 'rgba(255,255,255,0.06)' }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${onShare}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} style={{ background: 'linear-gradient(90deg,#0EA5E9,#38BDF8)' }} />
                <motion.div initial={{ width: 0 }} animate={{ width: `${offShare}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.05 }} style={{ background: 'linear-gradient(90deg,#8B5CF6,#A78BFA)' }} />
              </div>
            </div>

            {/* Каналы: онлайн / офлайн */}
            <div style={{ padding: '10px 20px 18px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {channel(L.pOnline, L.pOnlineExp, <Globe size={15} />, on, '#38BDF8')}
              {channel(L.pOffline, L.pOfflineExp, <Store size={15} />, off, '#A78BFA')}
            </div>

            <div style={{ padding: '0 20px 20px' }}>
              <button onClick={onAnalytics} style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px solid rgba(124,92,240,0.3)', cursor: 'pointer', background: 'rgba(124,92,240,0.12)', color: '#A78BFA', fontSize: 13, fontWeight: 600 }}>
                {L.viewAnalytics}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
