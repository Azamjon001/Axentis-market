import { useState, useEffect, lazy, Suspense } from 'react';
import { motion } from 'motion/react';
import { Search, Check, X, Clock, Package, Phone, User, Receipt, DollarSign, RefreshCw, Calendar, MapPin, Navigation, Truck, TrendingUp } from 'lucide-react';
import api from '../utils/api';
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

  const handleAcceptOrder = async (orderId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t.acceptOrderConfirm)) return;

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
    if (!confirm(t.markAsShippedConfirm)) return;

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

    const confirmMsg = returns.length > 0
      ? (language === 'uz'
          ? 'Belgilangan tovarlar qaytariladi (sotilmagan) va omborga qaytadi. Davom etasizmi?'
          : 'Отмеченные товары будут возвращены (не проданы) и вернутся на склад. Продолжить?')
      : (language === 'uz'
          ? 'Buyurtma to\'liq topshirildimi? Summa hisobotga qo\'shiladi.'
          : 'Заказ выдан полностью? Сумма попадёт в аналитику.');
    if (!confirm(confirmMsg)) return;

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
    switch (status) {
      case 'confirmed':
        return (
          <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(59,130,246,0.15)', color: '#60A5FA' }}>
            <Check className="w-3 h-3" /> {t.statusConfirmed}
          </span>
        );
      case 'processing':
        return (
          <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(124,92,240,0.15)', color: '#A78BFA' }}>
            <Clock className="w-3 h-3" /> {t.statusConfirmed}
          </span>
        );
      case 'shipped':
        return (
          <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(14,165,233,0.15)', color: '#38BDF8' }}>
            <Truck className="w-3 h-3" /> {t.statusShipped}
          </span>
        );
      case 'completed':
      case 'delivered':
        return (
          <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}>
            <Check className="w-3 h-3" /> {t.completed}
          </span>
        );
      case 'cancelled':
        return (
          <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(248,113,113,0.15)', color: '#F87171' }}>
            <X className="w-3 h-3" /> {t.cancelled}
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(251,191,36,0.15)', color: '#FBBF24' }}>
            <Clock className="w-3 h-3" /> {t.waiting}
          </span>
        );
    }
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
      {/* ── НОВЫЙ КАРКАС: компактная шапка + строка-сводка + пилюли-статусы ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--ax-bg)', paddingBottom: 10, marginBottom: 4 }}>
        {/* Row 1: заголовок + период + обновить */}
        <div className="flex items-center justify-between gap-2" style={{ marginBottom: 12 }}>
          <div className="flex items-center gap-2 min-w-0">
            <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--ax-primary-pale)', color: 'var(--ax-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Receipt className="w-4 h-4" />
            </span>
            <h2 className="font-bold truncate" style={{ color: 'var(--ax-text)', fontSize: isMobile ? 17 : 20 }}>
              {isMobile ? t.orders : t.customerOrders}
            </h2>
            <span className="py-0.5 px-2 rounded-full font-semibold" style={{ background: 'var(--ax-primary-pale)', color: 'var(--ax-primary)', fontSize: 12, flexShrink: 0 }}>
              {filteredOrders.length}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <CompactPeriodSelector value={periodFilter} onChange={setPeriodFilter} />
            <motion.button whileHover={{ rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={loadOrders}
              className="rounded-lg" style={{ padding: 8, color: 'var(--ax-text-2)', background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer' }} title={t.refreshList}>
              <RefreshCw className="w-4 h-4" />
            </motion.button>
          </div>
        </div>

        {/* Row 2: тонкая строка-сводка (компактные чипы вместо крупных карточек) */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {[
            { icon: <Receipt size={15} />,    label: language === 'uz' ? 'Buyurtma' : 'Заказов',  value: `${filteredOrders.length}`,     accent: '#7C5CF0' },
            { icon: <DollarSign size={15} />, label: language === 'uz' ? 'Daromad' : 'Выручка',    value: formatPrice(periodRevenue),      accent: '#38BDF8' },
            { icon: <TrendingUp size={15} />, label: language === 'uz' ? 'Foyda' : 'Прибыль',      value: `+${formatPrice(periodProfit)}`, accent: '#22C55E' },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              style={{ flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', borderRadius: 12, background: 'var(--ax-card)', border: `1px solid ${s.accent}2A` }}>
              <span style={{ width: 28, height: 28, borderRadius: 8, background: `${s.accent}1F`, color: s.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.icon}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: isMobile ? 13.5 : 15, fontWeight: 700, color: 'var(--ax-text)', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.value}</div>
                <div style={{ fontSize: 10.5, color: 'var(--ax-text-3)' }}>{s.label}</div>
              </div>
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

        {/* Row 3: поиск */}
        <div className="relative" style={{ marginBottom: 10 }}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--ax-text-3)' }} />
          <input type="text" placeholder={isMobile ? t.searchDots : t.searchByCodeNamePhone} value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl focus:outline-none"
            style={{ background: 'var(--ax-input)', border: '1px solid var(--ax-border)', color: 'var(--ax-text)', fontSize: 14 }} />
        </div>

        {/* Row 4: статусы-пилюли (горизонтальная прокрутка) */}
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
                  flexShrink: 0, padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: on ? 700 : 500, cursor: 'pointer', whiteSpace: 'nowrap',
                  background: on ? p.accent : 'var(--ax-card)',
                  color: on ? '#fff' : 'var(--ax-text-2)',
                  border: `1px solid ${on ? p.accent : 'var(--ax-border)'}`,
                  boxShadow: on ? `0 4px 14px ${p.accent}55` : 'none',
                }}>
                {p.label}
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
                  className={`${isMobile ? 'p-3' : 'p-5'} cursor-pointer flex flex-col ${!isMobile && 'md:flex-row md:items-center'} ${responsive.gap}`}
                >
                  {/* Code & Date */}
                  <div className={isMobile ? 'min-w-full' : 'min-w-[120px]'}>
                    <div className={`font-mono font-bold ${isMobile ? 'text-base' : 'text-lg'}`} style={{ color: 'var(--ax-text)' }}>
                      #{order.order_code}
                    </div>
                    <div className={`${responsive.small} flex items-center ${responsive.gap} mt-1`} style={{ color: 'var(--ax-text-2)' }}>
                      <Calendar className={responsive.iconSmall} />
                      {new Date(order.order_date || order.created_at || '').toLocaleDateString('ru-RU',
                        isMobile ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'long' }
                      )}
                    </div>
                    {hasDelivery && (
                      <div className={`${responsive.small} flex items-center gap-1 mt-1`} style={{ color: '#38BDF8' }}>
                        <Navigation className="w-3 h-3" />
                        {language === 'uz' ? 'Yetkazib berish' : 'Доставка'}
                      </div>
                    )}
                  </div>

                  {/* Customer Info */}
                  <div className="flex-1">
                    <div className={`flex items-center ${responsive.gap} font-medium`} style={{ color: 'var(--ax-text)' }}>
                      <User className={responsive.iconSmall} />
                      {order.user_name || order.user_phone || t.guest}
                    </div>
                    {order.user_phone && order.user_phone !== order.user_name && (
                      <div className={`flex items-center ${responsive.gap} ${responsive.small} mt-1`} style={{ color: 'var(--ax-text-2)' }}>
                        <Phone className={responsive.iconSmall} />
                        {order.user_phone}
                      </div>
                    )}
                  </div>

                  {/* Amount & Status */}
                  <div className={`flex items-center justify-between ${!isMobile && 'md:justify-end'} gap-4 ${isMobile ? 'min-w-full' : 'min-w-[300px]'}`}>
                    <div className="text-right">
                      <div className={`font-bold ${isMobile ? 'text-base' : 'text-lg'}`} style={{ color: 'var(--ax-primary)' }}>
                        {formatPrice(order.total_amount)}
                      </div>
                      {(order.markup_profit ?? 0) > 0 && (
                        <div className={`${responsive.small} font-medium`} style={{ color: '#22C55E' }}>
                          <DollarSign className="inline w-3 h-3 mr-1" />
                          +{formatPrice(order.markup_profit!)}
                        </div>
                      )}
                      <div className={`${responsive.small}`} style={{ color: 'var(--ax-text-2)' }}>
                        {order.items?.length || 0} {t.products}
                      </div>
                    </div>
                    <div>{getStatusBadge(order.status)}</div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className={`${isMobile ? 'p-3' : 'p-5'} animate-in slide-in-from-top-2`} style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}>
                    <div className={`flex flex-col lg:flex-row ${responsive.gapLarge}`}>
                      {/* Items List */}
                      <div className={`flex-1 ${responsive.spacing}`}>
                        <h4 className={`${responsive.small} font-medium uppercase tracking-wider mb-2`} style={{ color: 'var(--ax-text-2)' }}>{t.orderComposition}</h4>
                        {order.items.map((item, idx) => (
                          <div key={idx} className={`flex items-center justify-between ${responsive.cardCompact}`} style={{ background: 'var(--ax-card)', border: '1px solid rgba(255,255,255,0.07)' }}>
                            <div className={`flex items-center ${responsive.gap}`}>
                              <div className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'} rounded-md flex items-center justify-center`} style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--ax-text-2)' }}>
                                <Package className={responsive.iconSmall} />
                              </div>
                              <div>
                                <div className={`font-medium ${responsive.body}`} style={{ color: 'var(--ax-text)' }}>{item.name}</div>
                                {/* Variant info: color and/or size */}
                                {(item.color || item.size) && (
                                  <div className={`${responsive.small} flex flex-wrap gap-1 mt-0.5`}>
                                    {item.color && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium" style={{ background: 'rgba(124,92,240,0.15)', color: '#A78BFA' }}>
                                        🎨 {item.color}
                                      </span>
                                    )}
                                    {item.size && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium" style={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E' }}>
                                        📏 {item.size}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`font-medium ${responsive.small}`} style={{ color: 'var(--ax-text)' }}>
                                {item.quantity} {t.pcs}. × {formatPrice(item.price)}
                              </div>
                              <div className={`font-bold ${responsive.body}`} style={{ color: 'var(--ax-primary)' }}>
                                {formatPrice(item.total)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Actions & Info */}
                      <div className={`lg:w-80 ${responsive.spacing}`}>
                        <div className={`${responsive.cardCompact}`} style={{ background: 'var(--ax-card)', border: '1px solid rgba(255,255,255,0.07)' }}>
                          <h4 className={`${responsive.small} font-medium mb-3`} style={{ color: 'var(--ax-text-2)' }}>{t.orderDetails}</h4>
                          <div className={`${responsive.spacing} ${responsive.small}`}>
                            <div className="flex justify-between">
                              <span style={{ color: 'var(--ax-text-2)' }}>{t.orderTime}:</span>
                              <span className="font-medium" style={{ color: 'var(--ax-text)' }}>
                                {order.order_date ? formatUzbekistanFullDateTime(order.order_date) : '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span style={{ color: 'var(--ax-text-2)' }}>{t.paymentMethod}:</span>
                              <span className="font-medium" style={{ color: 'var(--ax-text)' }}>
                                {order.payment_method === 'demo_online' ? t.demoOnline :
                                 order.payment_method === 'real_online' ? t.onlineCard : t.cashCheck}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Delivery info */}
                        {order.delivery_type === 'delivery' && (
                          <div className={`${responsive.cardCompact}`} style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.25)' }}>
                            <h4 className={`${responsive.small} font-medium mb-3 flex items-center gap-2`} style={{ color: '#38BDF8' }}>
                              <MapPin className={responsive.iconSmall} />
                              {language === 'uz' ? 'Yetkazib berish' : 'Информация о доставке'}
                            </h4>
                            <div className={`${responsive.spacing} ${responsive.small}`}>
                              {order.recipient_name && (
                                <div className="flex justify-between">
                                  <span style={{ color: 'var(--ax-text-2)' }}>{t.deliveryRecipient}:</span>
                                  <span className="font-medium" style={{ color: 'var(--ax-text)' }}>{order.recipient_name}</span>
                                </div>
                              )}
                              {order.delivery_address && (
                                <div className="flex flex-col gap-0.5">
                                  <span style={{ color: 'var(--ax-text-2)' }}>{t.deliveryAddress}:</span>
                                  <span className="font-medium text-xs" style={{ color: 'var(--ax-text)' }}>{order.delivery_address}</span>
                                </div>
                              )}
                              {(order.delivery_coordinates || order.delivery_address) && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setMapOrder(order); }}
                                  className="flex items-center gap-1.5 text-xs mt-2 px-3 py-2 rounded-lg font-medium transition-colors"
                                  style={{ background: 'rgba(124,92,240,0.15)', border: '1px solid rgba(124,92,240,0.35)', color: '#7C5CF0' }}
                                >
                                  <Navigation className="w-3.5 h-3.5" />
                                  {language === 'uz' ? 'Xaritada ko\'rsatish' : 'Показать на карте'}
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Action buttons */}
                        {order.status === 'pending' && (
                          <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} ${responsive.gap}`}>
                            <button
                              onClick={(e) => handleCancelOrder(order.id, e)}
                              disabled={processingId === order.id}
                              className={`flex items-center justify-center ${responsive.gap} ${responsive.button} rounded-lg font-medium transition-colors disabled:opacity-50 border border-red-500/30 text-red-400 hover:bg-red-500/10`}
                            >
                              <X className={responsive.iconSmall} />
                              {t.cancel}
                            </button>
                            <button
                              onClick={(e) => handleAcceptOrder(order.id, e)}
                              disabled={processingId === order.id}
                              className={`flex items-center justify-center ${responsive.gap} ${responsive.button} bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors shadow-sm disabled:opacity-50`}
                            >
                              <Check className={responsive.iconSmall} />
                              {t.acceptOrder}
                            </button>
                          </div>
                        )}

                        {order.status === 'confirmed' && (
                          <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} ${responsive.gap}`}>
                            <button
                              onClick={(e) => handleCancelOrder(order.id, e)}
                              disabled={processingId === order.id}
                              className={`flex items-center justify-center ${responsive.gap} ${responsive.button} rounded-lg font-medium transition-colors disabled:opacity-50 border border-red-500/30 text-red-400 hover:bg-red-500/10`}
                            >
                              <X className={responsive.iconSmall} />
                              {t.cancel}
                            </button>
                            <button
                              onClick={(e) => handleMarkAsShipped(order.id, e)}
                              disabled={processingId === order.id}
                              className={`flex items-center justify-center ${responsive.gap} ${responsive.button} bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm disabled:opacity-50`}
                            >
                              <Truck className={responsive.iconSmall} />
                              {t.markAsShipped}
                            </button>
                          </div>
                        )}

                        {order.status === 'shipped' && (
                          <button
                            onClick={(e) => openCompleteModal(order, e)}
                            disabled={processingId === order.id}
                            className={`w-full flex items-center justify-center ${responsive.gap} ${responsive.button} bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors shadow-sm disabled:opacity-50`}
                          >
                            <Check className={responsive.iconSmall} />
                            {language === 'uz' ? 'Yakunlash (topshirildi)' : 'Завершить (выдан)'}
                          </button>
                        )}

                        {processingId === order.id && (
                          <div className={`text-center ${responsive.small} text-blue-600 animate-pulse`}>
                            {t.processing}
                          </div>
                        )}
                      </div>
                    </div>
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
