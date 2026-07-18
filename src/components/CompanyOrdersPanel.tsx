import { useState, useEffect, lazy, Suspense } from 'react';
import { motion } from 'motion/react';
import { Search, Check, X, Clock, Package, Phone, User, DollarSign, RefreshCw, Calendar, MapPin, Navigation, Truck, TrendingUp, Briefcase, SlidersHorizontal, Map, MessageSquare, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import api, { getImageUrl } from '../utils/api';
import { formatUzbekistanFullDateTime } from '../utils/uzbekTime';
import { toast } from 'sonner@2.0.3';
import { useResponsive, useResponsiveClasses } from '../hooks/useResponsive';
import { getCurrentLanguage, useTranslation, type Language } from '../utils/translations';
import CompactPeriodSelector from './CompactPeriodSelector';

// 🗺️ Карта маршрута открывается во всплывающем окне (overlay), не занимает место в списке
const DeliveryMap = lazy(() => import('./DeliveryMap'));


interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
  color?: string;
  size?: string;
  markupAmount?: number;
  imageUrl?: string;
}

interface Order {
  id: number;
  order_code: string;
  user_name: string;
  user_phone: string;
  total_amount: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'completed' | 'cancelled';
  payment_method?: string;
  created_at?: string;
  order_date?: string;
  confirmed_date?: string;
  items: OrderItem[];
  markup_profit?: number;
  delivery_type?: string;
  delivery_address?: string;
  delivery_coordinates?: string;
  recipient_name?: string;
  comment?: string; // 💬 Комментарий покупателя к заказу
}

interface CompanyOrdersPanelProps {
  companyId: number;
}

export default function CompanyOrdersPanel({ companyId }: CompanyOrdersPanelProps) {
  const [language, setLanguage] = useState<Language>(getCurrentLanguage());
  const t = useTranslation(language);

  useEffect(() => {
    const handleLanguageChange = (e: CustomEvent) => {
      setLanguage(e.detail);
    };
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    return () => window.removeEventListener('languageChange', handleLanguageChange as EventListener);
  }, []);

  type PeriodType = 'day' | 'week' | 'month' | 'year' | 'custom';

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'shipped' | 'completed' | 'cancelled'>('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodType>('day');
  const [periodStartDate, setPeriodStartDate] = useState<Date | null>(null);
  const [periodEndDate, setPeriodEndDate] = useState<Date | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // 🗺️ Координаты компании (точка отправления) и заказ, для которого открыта карта
  const [companyCoords, setCompanyCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [companyAddress, setCompanyAddress] = useState<string>('');
  const [mapOrder, setMapOrder] = useState<Order | null>(null);

  // 🔁 Частичная выдача: заказ, для которого открыт диалог завершения, и
  // сколько единиц КАЖДОЙ позиции покупатель вернул (index позиции → кол-во).
  // Возвращённые товары не считаются проданными и возвращаются на склад.
  const [completingOrder, setCompletingOrder] = useState<Order | null>(null);
  const [returnQty, setReturnQty] = useState<Record<number, number>>({});

  const { isMobile } = useResponsive();
  const responsive = useResponsiveClasses();

  useEffect(() => {
    loadOrders();
    loadCompanyData();

    const interval = setInterval(() => {
      loadOrders();
    }, 3000);
    return () => clearInterval(interval);
  }, [companyId]);

  const loadCompanyData = async () => {
    try {
      const data = await api.companies.get(companyId.toString());
      if (data.latitude && data.longitude) {
        setCompanyCoords({ lat: data.latitude, lng: data.longitude });
      }
      if (data.address) setCompanyAddress(data.address);
    } catch (error) {
      console.error('Error loading company data:', error);
    }
  };

  const parseDeliveryCoords = (coords?: string): { lat: number; lng: number } | null => {
    if (!coords) return null;
    try {
      const parts = coords.split(',').map(c => parseFloat(c.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return { lat: parts[0], lng: parts[1] };
      }
    } catch { /* ignore */ }
    return null;
  };

  const loadOrders = async () => {
    try {
      const data = await api.orders.list({ companyId: String(companyId) });
      const rawOrders = Array.isArray(data) ? data : (data?.orders || []);

      const mapped = rawOrders.map((order: any) => {
        let items = Array.isArray(order.items) ? order.items : [];

        if (typeof order.items === 'string' && order.items.length > 0) {
          try {
            const parsed = JSON.parse(order.items);
            items = Array.isArray(parsed) ? parsed : [];
          } catch (e) {
            console.error('⚠️ Failed to parse items for order', order.id, e);
          }
        }

        const mappedItems: OrderItem[] = items.map((item: any) => ({
          name: item.productName || item.product_name || item.name || 'Товар',
          quantity: item.quantity || 1,
          price: item.price_with_markup || item.priceWithMarkup || item.price || 0,
          total: item.total || (item.quantity || 1) * (item.price_with_markup || item.priceWithMarkup || item.price || 0),
          color: item.color && item.color !== 'Любой' && item.color !== 'любой' ? item.color : undefined,
          size: item.size && item.size !== 'Любой' && item.size !== 'любой' ? item.size
              : item.selectedSize && item.selectedSize !== 'Любой' ? item.selectedSize
              : item.selected_size && item.selected_size !== 'Любой' ? item.selected_size
              : undefined,
          markupAmount: item.markupAmount || item.markup_amount || 0,
          imageUrl: item.image_url || item.imageUrl || (Array.isArray(item.images) ? item.images[0] : undefined),
        }));

        return {
          ...order,
          order_code: order.orderCode || order.order_code || '',
          user_name: order.customerName || order.customer_name || order.user_name || '',
          user_phone: order.customerPhone || order.customer_phone || order.user_phone || '',
          order_date: order.createdAt || order.created_at || order.order_date,
          total_amount: order.totalAmount || order.total_amount || 0,
          markup_profit: order.markupProfit || order.markup_profit || 0,
          delivery_type: order.deliveryType || order.delivery_type,
          delivery_address: order.deliveryAddress || order.delivery_address,
          delivery_coordinates: order.deliveryCoordinates || order.delivery_coordinates,
          recipient_name: order.recipientName || order.recipient_name,
          comment: order.comment || '',
          items: mappedItems,
        };
      });

      const sorted = mapped.sort((a: Order, b: Order) => {
        const dateA = new Date(a.order_date || a.created_at || '').getTime();
        const dateB = new Date(b.order_date || b.created_at || '').getTime();
        return dateB - dateA;
      });
      setOrders(sorted);
    } catch (error) {
      console.error('Error loading orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  // Подтверждающий диалог показываем только при ОТМЕНЕ заказа — остальные
  // действия (принять, отправить, завершить) выполняются сразу, без вопросов.
  const handleAcceptOrder = async (orderId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setProcessingId(orderId);
    try {
      await api.orders.updateStatus(String(orderId), 'confirmed');
      toast.success(t.orderAccepted);
      loadOrders();
    } catch (error) {
      console.error('Error accepting order:', error);
      toast.error(t.acceptOrderError);
    } finally {
      setProcessingId(null);
    }
  };

  const handleMarkAsShipped = async (orderId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setProcessingId(orderId);
    try {
      await api.orders.confirmPayment(orderId);
      toast.success(t.orderShipped);
      loadOrders();
    } catch (error) {
      console.error('Error marking as shipped:', error);
      toast.error(t.markAsShippedError);
    } finally {
      setProcessingId(null);
    }
  };

  // Завершение заказа продавцом: деньги учитываются в аналитике только после
  // того, как заказ доставлен/выдан покупателю. Для самовывоза и продавцов без
  // курьера это единственный способ перевести заказ в 'completed'.
  //
  // Открываем диалог выдачи: продавец отмечает, какие позиции покупатель
  // забрал, а какие вернул (частичная выдача). По умолчанию возвращено 0 —
  // т.е. заказ выдан полностью.
  const openCompleteModal = (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();
    setReturnQty({});
    setCompletingOrder(order);
  };

  // Изменение количества возвращаемых единиц позиции (0..заказанное кол-во).
  const setReturnFor = (idx: number, qty: number, max: number) => {
    const clamped = Math.max(0, Math.min(qty, max));
    setReturnQty(prev => ({ ...prev, [idx]: clamped }));
  };

  const submitComplete = async () => {
    const order = completingOrder;
    if (!order) return;

    const returns = Object.entries(returnQty)
      .map(([idx, q]) => ({ index: Number(idx), quantity: Number(q) }))
      .filter(r => r.quantity > 0);

    // Без confirm(): продавец уже осознанно отметил возвраты в модальном окне
    // выдачи и нажал кнопку — дополнительный вопрос только раздражает.
    setProcessingId(order.id);
    try {
      await api.orders.markDelivered(order.id, returns);
      toast.success(language === 'uz' ? 'Buyurtma yakunlandi' : 'Заказ завершён');
      setCompletingOrder(null);
      setReturnQty({});
      loadOrders();
    } catch (error) {
      console.error('Error completing order:', error);
      toast.error(language === 'uz' ? 'Xatolik yuz berdi' : 'Ошибка при завершении заказа');
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancelOrder = async (orderId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t.cancelOrderConfirm)) return;

    setProcessingId(orderId);
    try {
      await api.orders.cancel(orderId);
      toast.success(t.orderCancelled);
      loadOrders();
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast.error(t.cancelError);
    } finally {
      setProcessingId(null);
    }
  };

  const toggleExpand = (order: Order) => {
    setExpandedOrderId(expandedOrderId === order.id ? null : order.id);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('uz-UZ').format(price) + ' сум';
  };

  const getPeriodRange = (period: PeriodType): { start: Date; end: Date } => {
    const now = new Date();
    const start = new Date();
    const end = new Date();
    if (period === 'day') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (period === 'week') {
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
      start.setMonth(now.getMonth() - 1);
      start.setHours(0, 0, 0, 0);
    } else if (period === 'year') {
      start.setFullYear(now.getFullYear() - 1);
      start.setHours(0, 0, 0, 0);
    } else if (period === 'custom') {
      if (periodStartDate) { start.setTime(periodStartDate.getTime()); start.setHours(0, 0, 0, 0); }
      if (periodEndDate) { end.setTime(periodEndDate.getTime()); end.setHours(23, 59, 59, 999); }
    }
    return { start, end };
  };

  const getStatusBadge = (status: string) => {
    const cfg = (() => {
      switch (status) {
        case 'confirmed':  return { icon: <Check className="w-3.5 h-3.5" />, label: t.statusConfirmed, color: '#60A5FA', bg: 'rgba(59,130,246,0.13)',  border: 'rgba(59,130,246,0.3)' };
        case 'processing': return { icon: <Clock className="w-3.5 h-3.5" />, label: t.statusConfirmed, color: '#A78BFA', bg: 'rgba(124,92,240,0.13)',  border: 'rgba(124,92,240,0.3)' };
        case 'shipped':    return { icon: <Truck className="w-3.5 h-3.5" />, label: t.statusShipped,   color: '#38BDF8', bg: 'rgba(14,165,233,0.13)',  border: 'rgba(14,165,233,0.3)' };
        case 'completed':
        case 'delivered':  return { icon: <Check className="w-3.5 h-3.5" />, label: t.completed,       color: '#22C55E', bg: 'rgba(34,197,94,0.13)',   border: 'rgba(34,197,94,0.3)' };
        case 'cancelled':  return { icon: <X className="w-3.5 h-3.5" />,     label: t.cancelled,       color: '#F87171', bg: 'rgba(248,113,113,0.13)', border: 'rgba(248,113,113,0.3)' };
        default:           return { icon: <Clock className="w-3.5 h-3.5" />, label: t.waiting,         color: '#FBBF24', bg: 'rgba(251,191,36,0.13)',  border: 'rgba(251,191,36,0.3)' };
      }
    })();
    return (
      <span className="flex items-center gap-1.5 rounded-full font-semibold" style={{ padding: '8px 16px', fontSize: 13, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, whiteSpace: 'nowrap' }}>
        {cfg.icon} {cfg.label}
      </span>
    );
  };

  const { start: periodStart, end: periodEnd } = getPeriodRange(periodFilter);

  const filteredOrders = orders.filter(order => {
    const matchesSearch =
      (order.order_code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.user_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.user_phone || '').includes(searchQuery);

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

    const dateStr = order.order_date || order.created_at || '';
    const d = dateStr ? new Date(dateStr) : null;
    const matchesPeriod = d && !isNaN(d.getTime()) ? d >= periodStart && d <= periodEnd : true;

    return matchesSearch && matchesStatus && matchesPeriod;
  });

  const periodRevenue = filteredOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  const periodProfit = filteredOrders.reduce((sum, o) => sum + (Number(o.markup_profit) || 0), 0);

  // Мини-серия для спарклайна карточки «Заказы»: количество заказов по корзинам периода
  const ordersSeries = (() => {
    const buckets = 14;
    const span = Math.max(periodEnd.getTime() - periodStart.getTime(), 1);
    const arr = new Array(buckets).fill(0);
    filteredOrders.forEach(o => {
      const ds = o.order_date || o.created_at;
      if (!ds) return;
      const time = new Date(ds).getTime();
      if (isNaN(time) || time < periodStart.getTime() || time > periodEnd.getTime()) return;
      arr[Math.min(Math.floor(((time - periodStart.getTime()) / span) * buckets), buckets - 1)]++;
    });
    return arr;
  })();

  // 📊 Экспорт отфильтрованных заказов в Excel: вся информация о заказе,
  // включая состав, доставку, оплату и комментарий покупателя.
  const statusLabel = (status: string) => {
    switch (status) {
      case 'confirmed':
      case 'processing': return t.statusConfirmed;
      case 'shipped':    return t.statusShipped;
      case 'completed':
      case 'delivered':  return t.completed;
      case 'cancelled':  return t.cancelled;
      default:           return t.waiting;
    }
  };

  const paymentLabel = (method?: string) =>
    method === 'demo_online' ? t.demoOnline :
    method === 'real_online' ? t.onlineCard : t.cashCheck;

  const exportToExcel = () => {
    if (filteredOrders.length === 0) {
      toast.error(language === 'uz' ? 'Eksport uchun buyurtmalar yoʻq' : 'Нет заказов для экспорта');
      return;
    }
    const uz = language === 'uz';
    const rows = filteredOrders.map((o) => ({
      [uz ? 'Kod' : 'Код']: o.order_code ? `#${o.order_code}` : String(o.id),
      [uz ? 'Sana' : 'Дата']: o.order_date || o.created_at
        ? formatUzbekistanFullDateTime(o.order_date || o.created_at!)
        : '',
      [uz ? 'Holat' : 'Статус']: statusLabel(o.status),
      [uz ? 'Mijoz' : 'Клиент']: o.user_name || '',
      [uz ? 'Telefon' : 'Телефон']: o.user_phone || '',
      [uz ? 'Qabul qiluvchi' : 'Получатель']: o.recipient_name || '',
      [uz ? 'Yetkazish' : 'Доставка']: o.delivery_type === 'delivery'
        ? (uz ? 'Kuryer' : 'Курьер')
        : (uz ? 'Olib ketish' : 'Самовывоз'),
      [uz ? 'Manzil' : 'Адрес']: o.delivery_address || '',
      [uz ? 'Toʻlov' : 'Оплата']: paymentLabel(o.payment_method),
      [uz ? 'Tovarlar' : 'Товары']: o.items
        .map(it => `${it.name}${it.color ? ` (${it.color})` : ''}${it.size ? ` [${it.size}]` : ''} × ${it.quantity}`)
        .join('; '),
      [uz ? 'Pozitsiyalar' : 'Позиций']: o.items.length,
      [uz ? 'Summa' : 'Сумма']: Number(o.total_amount) || 0,
      [uz ? 'Foyda (ustama)' : 'Прибыль (наценка)']: Number(o.markup_profit) || 0,
      [uz ? 'Izoh' : 'Комментарий']: o.comment || '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 10 }, { wch: 19 }, { wch: 14 }, { wch: 20 }, { wch: 15 }, { wch: 20 },
      { wch: 11 }, { wch: 32 }, { wch: 14 }, { wch: 50 }, { wch: 9 }, { wch: 13 },
      { wch: 16 }, { wch: 32 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, uz ? 'Buyurtmalar' : 'Заказы');
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${uz ? 'buyurtmalar' : 'zakazy'}_${today}.xlsx`);
    toast.success(uz ? 'Excel fayli yuklab olindi' : 'Файл Excel скачан');
  };

  // Сброс всех фильтров (кнопка-иконка рядом с поиском)
  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPeriodFilter('day');
    setPeriodStartDate(null);
    setPeriodEndDate(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12" style={{ border: '3px solid rgba(124,92,240,0.25)', borderTopColor: 'var(--ax-primary)' }}></div>
      </div>
    );
  }

  // ── ORDER LIST PANEL ──────────────────────────────────────────────────────
  const orderListPanel = (
    <div className={responsive.spacing} style={{ minWidth: 0 }}>
      {/* ── ШАПКА: заголовок + период + обновить ── */}
      <div style={{ paddingBottom: 6 }}>
        <div className="flex items-center justify-between gap-2" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
          <h2 className="font-bold truncate" style={{ color: 'var(--ax-text)', fontSize: isMobile ? 20 : 24, fontWeight: 800, letterSpacing: '-0.01em', margin: 0 }}>
            {language === 'uz' ? 'Buyurtmalar' : 'Заказы'}
          </h2>
          <div className="flex items-center gap-2 flex-shrink-0">
            <CompactPeriodSelector value={periodFilter} onChange={setPeriodFilter} />
            {/* 📊 Экспорт текущей выборки заказов в Excel */}
            <motion.button whileTap={{ scale: 0.92 }} onClick={exportToExcel}
              style={{ height: 40, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0 14px', borderRadius: 11, fontSize: 13, fontWeight: 600, color: '#22C55E', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', cursor: 'pointer' }}
              title={language === 'uz' ? 'Excel formatida yuklab olish' : 'Скачать в формате Excel'}>
              <FileSpreadsheet className="w-4 h-4" />
              {!isMobile && 'Excel'}
            </motion.button>
            <motion.button whileHover={{ rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={loadOrders}
              style={{ width: 40, height: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 11, color: 'var(--ax-text-2)', background: 'var(--ax-card)', border: '1px solid var(--ax-border)', cursor: 'pointer' }} title={t.refreshList}>
              <RefreshCw className="w-4 h-4" />
            </motion.button>
          </div>
        </div>

        {/* Стат-карты: заказы / выручка / прибыль */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 14 }}>
          {[
            { icon: <Briefcase size={19} />,  label: language === 'uz' ? 'Buyurtmalar' : 'Заказы',  value: `${filteredOrders.length}`,      accent: '#7C5CF0', spark: true },
            { icon: <DollarSign size={19} />, label: language === 'uz' ? 'Daromad' : 'Выручка',     value: formatPrice(periodRevenue),       accent: '#38BDF8' },
            { icon: <TrendingUp size={19} />, label: language === 'uz' ? 'Foyda' : 'Прибыль',       value: `+${formatPrice(periodProfit)}`,  accent: '#22C55E' },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 26, delay: i * 0.05 }}
              style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 13, padding: '16px 18px', borderRadius: 16, background: `linear-gradient(160deg, ${s.accent}10, var(--ax-card) 58%)`, border: `1px solid ${s.accent}26` }}>
              <span style={{ width: 44, height: 44, borderRadius: 13, background: `${s.accent}1F`, color: s.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.icon}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, color: 'var(--ax-text-2)', fontWeight: 500 }}>{s.label}</div>
                <div style={{ fontSize: isMobile ? 17 : 19, fontWeight: 800, color: 'var(--ax-text)', lineHeight: 1.15, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.value}</div>
              </div>
              {s.spark && ordersSeries.some(v => v > 0) && <OrdersSparkline data={ordersSeries} color={s.accent} />}
            </motion.div>
          ))}
        </div>

        {periodFilter === 'custom' && (
          <div className="flex gap-2 mb-2.5">
            {[[periodStartDate, setPeriodStartDate, language === 'uz' ? 'Boshidan' : 'С даты'], [periodEndDate, setPeriodEndDate, language === 'uz' ? 'Gacha' : 'По дату']].map(([val, setter, lbl]: any, i) => (
              <input key={i} type="date"
                value={val ? val.toISOString().split('T')[0] : ''}
                onChange={(e) => setter(e.target.value ? new Date(e.target.value) : null)}
                className="flex-1 px-3 py-2 rounded-lg text-sm focus:outline-none"
                style={{ background: 'var(--ax-input)', border: '1px solid var(--ax-border)', color: 'var(--ax-text)', colorScheme: 'dark' }} />
            ))}
          </div>
        )}

        {/* Поиск + кнопка сброса фильтров */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div className="relative" style={{ flex: 1, minWidth: 0 }}>
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--ax-text-3)' }} />
            <input type="text" placeholder={isMobile ? t.searchDots : (language === 'uz' ? "Kod, ism yoki telefon boʻyicha qidirish..." : 'Поиск по коду, имени или телефону...')} value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full focus:outline-none"
              style={{ padding: '13px 16px 13px 44px', borderRadius: 13, background: 'var(--ax-card)', border: '1px solid var(--ax-border)', color: 'var(--ax-text)', fontSize: 14 }} />
          </div>
          <motion.button whileTap={{ scale: 0.92 }} onClick={resetFilters}
            title={language === 'uz' ? 'Filtrlarni tozalash' : 'Сбросить фильтры'}
            style={{ width: 46, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 13, background: 'var(--ax-card)', border: '1px solid var(--ax-border)', color: 'var(--ax-text-2)', cursor: 'pointer' }}>
            <SlidersHorizontal className="w-4 h-4" />
          </motion.button>
        </div>

        {/* Статусы-пилюли (горизонтальная прокрутка) */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
          {([
            { key: 'all',       label: t.all,             accent: '#7C5CF0' },
            { key: 'pending',   label: t.waitingOrders,   accent: '#FBBF24' },
            { key: 'confirmed', label: t.confirmedOrders, accent: '#60A5FA' },
            { key: 'shipped',   label: t.shippedOrders,   accent: '#38BDF8' },
            { key: 'cancelled', label: t.cancelledOrders, accent: '#F87171' },
          ] as const).map((p) => {
            const on = statusFilter === p.key;
            return (
              <motion.button key={p.key} whileTap={{ scale: 0.94 }} onClick={() => setStatusFilter(p.key)}
                style={{
                  flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 11, fontSize: 13, fontWeight: on ? 700 : 500, cursor: 'pointer', whiteSpace: 'nowrap',
                  background: on ? (p.key === 'all' ? 'var(--ax-primary)' : p.accent) : 'var(--ax-card)',
                  color: on ? '#fff' : 'var(--ax-text-2)',
                  border: `1px solid ${on ? (p.key === 'all' ? 'var(--ax-primary)' : p.accent) : 'var(--ax-border)'}`,
                  boxShadow: on ? `0 4px 14px ${p.accent}55` : 'none',
                }}>
                {p.label}
                {on && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.85)', display: 'inline-block' }} />}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Orders List */}
      <div className={responsive.spacing}>
        {filteredOrders.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
            style={{ background: 'var(--ax-card)', border: '1px dashed var(--ax-border)', borderRadius: 16, padding: '48px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, minHeight: 260, justifyContent: 'center' }}>
            <span style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--ax-primary-pale)', color: 'var(--ax-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package className="w-8 h-8" />
            </span>
            <div>
              <p style={{ color: 'var(--ax-text)', fontSize: 16, fontWeight: 600, margin: 0 }}>{t.ordersNotFound}</p>
              <p style={{ color: 'var(--ax-text-3)', fontSize: 13, marginTop: 4 }}>
                {language === 'uz' ? 'Ushbu davr yoki filtr uchun buyurtma yoʻq' : 'За этот период или фильтр заказов нет'}
              </p>
            </div>
          </motion.div>
        ) : (
          filteredOrders.map((order) => {
            const isExpanded = expandedOrderId === order.id;
            const hasDelivery = order.delivery_type === 'delivery' && (!!order.delivery_coordinates || !!order.delivery_address);

            return (
              <motion.div
                key={order.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                className={`${responsive.card} overflow-hidden`}
                style={{
                  background: 'var(--ax-card)',
                  border: isExpanded ? '1px solid rgba(124,92,240,0.5)' : '1px solid rgba(255,255,255,0.07)',
                  boxShadow: isExpanded ? '0 8px 30px rgba(124,92,240,0.14)' : 'none',
                }}
              >
                <div
                  onClick={() => toggleExpand(order)}
                  style={{ padding: isMobile ? 14 : '20px 22px', cursor: 'pointer', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: isMobile ? 12 : 18 }}
                >
                  {/* Код, дата, доставка */}
                  <div style={{ minWidth: 128 }}>
                    <div style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 800, fontSize: isMobile ? 17 : 20, color: 'var(--ax-text)', letterSpacing: '0.01em' }}>
                      #{order.order_code}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, color: 'var(--ax-text-2)', fontSize: 13 }}>
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(order.order_date || order.created_at || '').toLocaleDateString('ru-RU',
                        isMobile ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'long' }
                      )}
                    </div>
                    {hasDelivery && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, color: '#38BDF8', fontSize: 13, fontWeight: 500 }}>
                        <Navigation className="w-3.5 h-3.5" />
                        {language === 'uz' ? 'Yetkazib berish' : 'Доставка'}
                      </div>
                    )}
                  </div>

                  {/* Клиент: аватар + имя + телефон */}
                  <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 13 }}>
                    <span style={{ width: 50, height: 50, borderRadius: '50%', flexShrink: 0, background: 'var(--ax-primary-pale)', border: '1.5px solid rgba(124,92,240,0.45)', color: 'var(--ax-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      <User className="w-5 h-5" />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: 'var(--ax-text)', fontSize: 15.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {order.user_name || order.user_phone || t.guest}
                      </div>
                      {order.user_phone && order.user_phone !== order.user_name && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, color: 'var(--ax-text-2)', fontSize: 13 }}>
                          <Phone className="w-3.5 h-3.5" />
                          {order.user_phone}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Сумма, прибыль, статус */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 'auto', flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: 'var(--ax-primary)', fontSize: isMobile ? 16 : 18, fontWeight: 800 }}>
                        {formatPrice(order.total_amount)}
                      </div>
                      {(order.markup_profit ?? 0) > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 2, color: '#22C55E', fontSize: 13, fontWeight: 600 }}>
                          <TrendingUp className="w-3.5 h-3.5" />
                          +{formatPrice(order.markup_profit!)}
                        </div>
                      )}
                      <div style={{ color: 'var(--ax-text-3)', fontSize: 12, marginTop: 2 }}>
                        {order.items?.length || 0} {t.products}
                      </div>
                    </div>
                    <div>{getStatusBadge(order.status)}</div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="animate-in slide-in-from-top-2" style={{ borderTop: '1px solid var(--ax-border)', padding: isMobile ? 14 : 20, display: 'flex', flexDirection: 'column', gap: 14 }}>

                    {/* Состав заказа */}
                    <div style={{ background: 'var(--ax-input)', border: '1px solid var(--ax-border)', borderRadius: 14, padding: '14px 16px' }}>
                      <h4 style={{ color: 'var(--ax-text-3)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>
                        {t.orderComposition}
                      </h4>
                      {order.items.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: idx < order.items.length - 1 ? '1px solid var(--ax-border)' : 'none', flexWrap: 'wrap' }}>
                          <div style={{ width: 54, height: 54, flexShrink: 0, borderRadius: 11, overflow: 'hidden', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {item.imageUrl ? (
                              <img src={getImageUrl(item.imageUrl) || item.imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} loading="lazy" />
                            ) : (
                              <Package className="w-6 h-6" style={{ color: '#5A5A78' }} />
                            )}
                          </div>
                          <div style={{ flex: '1 1 150px', minWidth: 0 }}>
                            <div style={{ color: 'var(--ax-text)', fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                            {(item.color || item.size) && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                                {item.color && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: 'rgba(124,92,240,0.15)', color: '#A78BFA' }}>
                                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#A78BFA', display: 'inline-block' }} />
                                    {item.color}
                                  </span>
                                )}
                                {item.size && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: 'rgba(34,197,94,0.13)', color: '#22C55E' }}>
                                    {item.size}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <div style={{ textAlign: 'right', marginLeft: 'auto' }}>
                            <div style={{ color: 'var(--ax-text-2)', fontSize: 13 }}>
                              {item.quantity} {language === 'uz' ? 'dona' : 'шт'} × {formatPrice(item.price)}
                            </div>
                            <div style={{ color: 'var(--ax-primary)', fontSize: 15, fontWeight: 700, marginTop: 3 }}>
                              {formatPrice(item.total)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Время заказа + способ оплаты */}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', border: '1px solid var(--ax-border)', borderRadius: 14, overflow: 'hidden' }}>
                      <div style={{ padding: '14px 16px', borderRight: isMobile ? 'none' : '1px solid var(--ax-border)', borderBottom: isMobile ? '1px solid var(--ax-border)' : 'none' }}>
                        <div style={{ color: 'var(--ax-text-2)', fontSize: 13 }}>{t.orderTime}:</div>
                        <div style={{ color: 'var(--ax-text)', fontSize: 15, fontWeight: 600, marginTop: 5 }}>
                          {order.order_date ? formatUzbekistanFullDateTime(order.order_date) : '-'}
                        </div>
                      </div>
                      <div style={{ padding: '14px 16px' }}>
                        <div style={{ color: 'var(--ax-text-2)', fontSize: 13 }}>{t.paymentMethod}:</div>
                        <div style={{ color: 'var(--ax-text)', fontSize: 15, fontWeight: 600, marginTop: 5 }}>
                          {order.payment_method === 'demo_online' ? t.demoOnline :
                           order.payment_method === 'real_online' ? t.onlineCard : t.cashCheck}
                        </div>
                      </div>
                    </div>

                    {/* Информация о доставке */}
                    {order.delivery_type === 'delivery' && (
                      <div style={{ background: 'rgba(56,189,248,0.07)', border: '1px solid rgba(56,189,248,0.22)', borderRadius: 14, padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                          <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#38BDF8', fontSize: 14, fontWeight: 700, margin: 0 }}>
                            <MapPin className="w-4 h-4" />
                            {language === 'uz' ? 'Yetkazib berish' : 'Доставка'}
                          </h4>
                          {order.recipient_name && (
                            <span style={{ color: 'var(--ax-text)', fontSize: 14, fontWeight: 700 }}>{order.recipient_name}</span>
                          )}
                        </div>
                        {order.recipient_name && (
                          <div style={{ marginTop: 10, color: 'var(--ax-text-2)', fontSize: 13 }}>
                            {t.deliveryRecipient}
                          </div>
                        )}
                        {order.delivery_address && (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ color: 'var(--ax-text-2)', fontSize: 13 }}>{t.deliveryAddress}</div>
                            <div style={{ color: 'var(--ax-text)', fontSize: 14, marginTop: 3 }}>{order.delivery_address}</div>
                          </div>
                        )}
                        {(order.delivery_coordinates || order.delivery_address) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setMapOrder(order); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'rgba(124,92,240,0.13)', border: '1px solid rgba(124,92,240,0.35)', color: '#A78BFA' }}
                          >
                            <Map className="w-4 h-4" />
                            {language === 'uz' ? 'Xaritada koʻrsatish' : 'Показать на карте'}
                          </button>
                        )}
                      </div>
                    )}

                    {/* 💬 Комментарий покупателя к заказу */}
                    {order.comment && (
                      <div style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 14, padding: '14px 16px' }}>
                        <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#FBBF24', fontSize: 14, fontWeight: 700, margin: 0 }}>
                          <MessageSquare className="w-4 h-4" />
                          {language === 'uz' ? 'Xaridor izohi' : 'Комментарий покупателя'}
                        </h4>
                        <div style={{ marginTop: 8, color: 'var(--ax-text)', fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{order.comment}</div>
                      </div>
                    )}

                    {/* Кнопки действий */}
                    {order.status === 'pending' && (
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1.4fr', gap: 12 }}>
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={(e) => handleCancelOrder(order.id, e)}
                          disabled={processingId === order.id}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '15px 0', borderRadius: 13, fontSize: 15, fontWeight: 700, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(248,113,113,0.4)', color: '#F87171', opacity: processingId === order.id ? 0.5 : 1 }}
                        >
                          <X className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                          {language === 'uz' ? 'Bekor qilish' : 'Отменить'}
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={(e) => handleAcceptOrder(order.id, e)}
                          disabled={processingId === order.id}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '15px 0', borderRadius: 13, fontSize: 15, fontWeight: 700, cursor: 'pointer', background: 'linear-gradient(135deg, #8B6CF5, #6D48E5)', border: 'none', color: '#FFFFFF', boxShadow: '0 8px 22px rgba(124,92,240,0.4)', opacity: processingId === order.id ? 0.5 : 1 }}
                        >
                          <Check style={{ width: 18, height: 18 }} />
                          {language === 'uz' ? 'Buyurtmani qabul qilish' : 'Принять заказ'}
                        </motion.button>
                      </div>
                    )}

                    {order.status === 'confirmed' && (
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1.4fr', gap: 12 }}>
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={(e) => handleCancelOrder(order.id, e)}
                          disabled={processingId === order.id}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '15px 0', borderRadius: 13, fontSize: 15, fontWeight: 700, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(248,113,113,0.4)', color: '#F87171', opacity: processingId === order.id ? 0.5 : 1 }}
                        >
                          <X style={{ width: 18, height: 18 }} />
                          {language === 'uz' ? 'Bekor qilish' : 'Отменить'}
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={(e) => handleMarkAsShipped(order.id, e)}
                          disabled={processingId === order.id}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '15px 0', borderRadius: 13, fontSize: 15, fontWeight: 700, cursor: 'pointer', background: 'linear-gradient(135deg, #38BDF8, #0EA5E9)', border: 'none', color: '#FFFFFF', boxShadow: '0 8px 22px rgba(14,165,233,0.35)', opacity: processingId === order.id ? 0.5 : 1 }}
                        >
                          <Truck style={{ width: 18, height: 18 }} />
                          {t.markAsShipped}
                        </motion.button>
                      </div>
                    )}

                    {order.status === 'shipped' && (
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={(e) => openCompleteModal(order, e)}
                        disabled={processingId === order.id}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '15px 0', borderRadius: 13, fontSize: 15, fontWeight: 700, cursor: 'pointer', background: 'linear-gradient(135deg, #34D399, #16A34A)', border: 'none', color: '#FFFFFF', boxShadow: '0 8px 22px rgba(34,197,94,0.35)', opacity: processingId === order.id ? 0.5 : 1 }}
                      >
                        <Check style={{ width: 18, height: 18 }} />
                        {language === 'uz' ? 'Yakunlash (topshirildi)' : 'Завершить (выдан)'}
                      </motion.button>
                    )}

                    {processingId === order.id && (
                      <div style={{ textAlign: 'center', fontSize: 13, color: '#38BDF8' }} className="animate-pulse">
                        {t.processing}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );


  // ── КАРТА ВО ВСПЛЫВАЮЩЕМ ОКНЕ ─────────────────────────────────────────────
  const mapModal = mapOrder && (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={() => setMapOrder(null)}
    >
      <div
        className="relative w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--ax-card)', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" style={{ color: '#7C5CF0' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--ax-text)' }}>
              {language === 'uz' ? 'Yo\'nalish' : 'Маршрут'} #{mapOrder.order_code}
            </span>
          </div>
          <button
            onClick={() => setMapOrder(null)}
            className="w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--ax-text-2)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div style={{ height: isMobile ? '60vh' : 460, width: '100%' }}>
          <Suspense fallback={<div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--ax-text-2)' }}>{language === 'uz' ? 'Xarita yuklanmoqda…' : 'Загрузка карты…'}</div>}>
            <DeliveryMap
              companyCoords={companyCoords}
              deliveryCoords={parseDeliveryCoords(mapOrder.delivery_coordinates)}
              companyAddress={companyAddress}
              deliveryAddress={mapOrder.delivery_address}
            />
          </Suspense>
        </div>
        {mapOrder.delivery_address && (
          <div className="px-4 py-3 text-xs" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', color: 'var(--ax-text-2)' }}>
            <span style={{ color: '#7C5CF0' }}>{t.deliveryAddress}:</span> {mapOrder.delivery_address}
          </div>
        )}
      </div>
    </div>
  );

  // ── ДИАЛОГ ВЫДАЧИ ЗАКАЗА (частичный возврат) ──────────────────────────────
  const completeModal = completingOrder && (() => {
    const order = completingOrder;
    const unitOf = (it: OrderItem) => (it.quantity > 0 ? it.total / it.quantity : it.price);
    let keptTotal = 0;
    let returnedTotal = 0;
    order.items.forEach((it, i) => {
      const ret = Math.max(0, Math.min(returnQty[i] || 0, it.quantity));
      const kept = it.quantity - ret;
      keptTotal += unitOf(it) * kept;
      returnedTotal += unitOf(it) * ret;
    });
    const hasReturns = returnedTotal > 0;

    return (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6"
        style={{ background: 'rgba(0,0,0,0.7)' }}
        onClick={() => { if (processingId !== order.id) { setCompletingOrder(null); setReturnQty({}); } }}
      >
        <div
          className="relative w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
          style={{ background: 'var(--ax-card)', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '90vh' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" style={{ color: '#22C55E' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--ax-text)' }}>
                {language === 'uz' ? 'Buyurtmani topshirish' : 'Выдача заказа'} #{order.order_code}
              </span>
            </div>
            <button
              onClick={() => { setCompletingOrder(null); setReturnQty({}); }}
              disabled={processingId === order.id}
              className="w-8 h-8 flex items-center justify-center rounded-lg disabled:opacity-50"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--ax-text-2)' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-4 py-3 overflow-y-auto" style={{ gap: 10, display: 'flex', flexDirection: 'column' }}>
            <p className="text-xs" style={{ color: 'var(--ax-text-2)' }}>
              {language === 'uz'
                ? 'Xaridor qaytargan tovarlar sonini belgilang. Qaytarilgan tovarlar sotilmagan hisoblanadi va omborga qaytariladi.'
                : 'Укажите, сколько единиц покупатель вернул. Возвращённые товары считаются непроданными и возвращаются на склад.'}
            </p>

            {order.items.map((it, i) => {
              const ret = Math.max(0, Math.min(returnQty[i] || 0, it.quantity));
              const kept = it.quantity - ret;
              return (
                <div key={i} className="rounded-lg p-3" style={{ background: 'var(--ax-bg)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: 'var(--ax-text)' }}>{it.name}</div>
                      <div className="text-xs" style={{ color: 'var(--ax-text-2)' }}>
                        {[it.color, it.size].filter(Boolean).join(' / ')}
                        {(it.color || it.size) ? ' · ' : ''}
                        {language === 'uz' ? 'Buyurtma' : 'Заказано'}: {it.quantity} {t.pcs}.
                      </div>
                    </div>
                    <div className="text-right text-xs whitespace-nowrap" style={{ color: 'var(--ax-text-2)' }}>
                      {formatPrice(unitOf(it))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2.5">
                    <span className="text-xs font-medium" style={{ color: hasReturns && ret > 0 ? '#EF4444' : 'var(--ax-text-2)' }}>
                      {language === 'uz' ? 'Qaytarildi' : 'Возврат'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setReturnFor(i, ret - 1, it.quantity)}
                        disabled={ret <= 0 || processingId === order.id}
                        className="w-8 h-8 flex items-center justify-center rounded-lg font-bold disabled:opacity-40"
                        style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--ax-text)' }}
                      >−</button>
                      <span className="w-8 text-center text-sm font-semibold" style={{ color: 'var(--ax-text)' }}>{ret}</span>
                      <button
                        onClick={() => setReturnFor(i, ret + 1, it.quantity)}
                        disabled={ret >= it.quantity || processingId === order.id}
                        className="w-8 h-8 flex items-center justify-center rounded-lg font-bold disabled:opacity-40"
                        style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--ax-text)' }}
                      >+</button>
                      <button
                        onClick={() => setReturnFor(i, it.quantity, it.quantity)}
                        disabled={ret >= it.quantity || processingId === order.id}
                        className="ml-1 px-2 h-8 flex items-center rounded-lg text-xs font-medium disabled:opacity-40"
                        style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}
                      >
                        {language === 'uz' ? 'Hammasi' : 'Все'}
                      </button>
                    </div>
                  </div>
                  {ret > 0 && (
                    <div className="text-xs mt-1.5" style={{ color: '#22C55E' }}>
                      {language === 'uz' ? 'Qabul qilindi' : 'Принято'}: {kept} {t.pcs}.
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: 'var(--ax-text-2)' }}>{language === 'uz' ? 'Sotildi (hisobotga)' : 'Продано (в аналитику)'}</span>
              <span className="font-bold" style={{ color: 'var(--ax-primary)' }}>{formatPrice(keptTotal)}</span>
            </div>
            {hasReturns && (
              <div className="flex items-center justify-between text-sm mt-1">
                <span style={{ color: 'var(--ax-text-2)' }}>{language === 'uz' ? 'Qaytarildi' : 'Возврат'}</span>
                <span className="font-medium" style={{ color: '#EF4444' }}>−{formatPrice(returnedTotal)}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                onClick={() => { setCompletingOrder(null); setReturnQty({}); }}
                disabled={processingId === order.id}
                className={`flex items-center justify-center ${responsive.gap} ${responsive.button} bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors disabled:opacity-50`}
              >
                {t.cancel}
              </button>
              <button
                onClick={submitComplete}
                disabled={processingId === order.id}
                className={`flex items-center justify-center ${responsive.gap} ${responsive.button} bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors shadow-sm disabled:opacity-50`}
              >
                <Check className={responsive.iconSmall} />
                {language === 'uz' ? 'Tasdiqlash' : 'Подтвердить'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  })();

  // ── ROOT LAYOUT ───────────────────────────────────────────────────────────
  return (
    <div className={responsive.spacing} style={{ background: 'var(--ax-bg)', color: 'var(--ax-text)' }}>
      {orderListPanel}
      {mapModal}
      {completeModal}
    </div>
  );
}

// Мини-график тренда для карточки «Заказы» (чистый SVG)
function OrdersSparkline({ data, color, width = 88, height = 30 }: { data: number[]; color: string; width?: number; height?: number }) {
  const max = Math.max(...data, 1);
  const stepX = width / Math.max(data.length - 1, 1);
  const pad = 2;
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = pad + (1 - v / max) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', flexShrink: 0 }} aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
