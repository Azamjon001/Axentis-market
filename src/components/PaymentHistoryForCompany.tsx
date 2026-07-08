import React, { useState, useEffect } from 'react';
import { Search, Filter, CheckCircle, AlertCircle, X, Receipt, TrendingUp, Banknote } from 'lucide-react';
import api from '../utils/api';
import { getCurrentLanguage, useTranslation, type Language } from '../utils/translations';

interface PaymentHistoryItem {
  orderId: string;
  userId: string;
  userName?: string;
  userPhone?: string;
  cardLastFour: string; // Всегда будет "••••" для компании
  cardType: string;
  amount: number;
  markupProfit?: number; // ✅ НОВОЕ: Прибыль от наценки
  status: string;
  method: string;
  cardSubtype?: string | null;
  items: Array<{
    id: number;
    name: string;
    price: number;
    sellingPrice?: number; // ✅ НОВОЕ: Цена с наценкой
    quantity: number;
    color?: string;
  }>;
  createdAt: string;
}

interface PaymentHistoryForCompanyProps {
  companyId: number;
}

export default function PaymentHistoryForCompany({ companyId }: PaymentHistoryForCompanyProps) {
  // 🌍 Переводы
  const [language, setLanguage] = useState<Language>(getCurrentLanguage());
  const t = useTranslation(language);
  
  // 🔄 Слушаем изменения языка
  useEffect(() => {
    const handleLanguageChange = (e: CustomEvent) => {
      setLanguage(e.detail);
    };
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    return () => window.removeEventListener('languageChange', handleLanguageChange as EventListener);
  }, []);
  
  const [payments, setPayments] = useState<PaymentHistoryItem[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<PaymentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'pending' | 'error'>('all');
  const [filterMethod, setFilterMethod] = useState<'all' | 'card' | 'cash'>('all');
  const [selectedPayment, setSelectedPayment] = useState<PaymentHistoryItem | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');

  useEffect(() => {
    loadPayments();
  }, []);

  useEffect(() => {
    filterPayments();
  }, [payments, searchQuery, filterStatus, filterMethod, selectedDate]);

  const processAndSetPayments = (allSales: any[]) => {
    console.log('🔄 [COMPANY] Обработка sales данных, количество:', allSales.length);
    
    // Преобразуем sales в формат PaymentHistoryItem
    const paymentsData = allSales.map((sale: any, index: number) => {
      console.log(`\n📦 [COMPANY] Обработка sale #${index + 1}:`, sale);
      
      // Парсим items - поддержка разных форматов
      let items = [];
      try {
        if (Array.isArray(sale.items)) {
          items = sale.items;
          console.log(`  ✅ Items уже массив (${items.length} товаров):`, items);
        } else if (typeof sale.items === 'string' && sale.items.length > 0) {
          const parsed = JSON.parse(sale.items);
          items = Array.isArray(parsed) ? parsed : [];
          console.log(`  ✅ Items распарсены из строки (${items.length} товаров):`, items);
        } else if (sale.items && typeof sale.items === 'object') {
          items = [sale.items];
          console.log(`  ✅ Items преобразованы из объекта:`, items);
        }
      } catch (err) {
        console.error(`  ❌ Ошибка парсинга items:`, err, 'raw items:', sale.items);
        items = [];
      }
      
      // ✅ ИСПРАВЛЕНО: Сначала пробуем взять markupProfit из API ответа
      let markupProfit = sale.markupProfit || sale.markup_profit || 0;
      let totalAmount = sale.totalAmount || sale.total_amount || 0;
      
      // Если markupProfit не пришёл из API, вычисляем из items
      if (markupProfit === 0) {
        items.forEach((item: any) => {
          const markupAmount = item.markupAmount || item.markup_amount || 0;
          const quantity = item.quantity || 1;
          markupProfit += markupAmount * quantity;
        });
      }
      
      // Если totalAmount = 0, вычисляем из items
      if (totalAmount === 0) {
        items.forEach((item: any) => {
          const priceWithMarkup = item.priceWithMarkup || item.price_with_markup || item.sellingPrice || item.price || 0;
          const quantity = item.quantity || 1;
          totalAmount += priceWithMarkup * quantity;
        });
      }
      
      console.log(`  💰 Items: ${items.length}, Прибыль: ${markupProfit}, Сумма: ${totalAmount}`);
      
      // Извлекаем телефон и имя клиента
      const firstItem = items[0] || {};
      const customerPhone = firstItem.customerPhone || firstItem.customer_phone || sale.customerPhone || '';
      const customerName = firstItem.customerName || firstItem.customer_name || sale.customerName || customerPhone || 'Клиент';
      
      const payment = {
        orderId: `#${sale.id}`,
        userId: customerPhone,
        userName: customerName,
        userPhone: customerPhone,
        cardLastFour: '••••',
        cardType: sale.paymentMethod || 'cash',
        amount: totalAmount,
        markupProfit: markupProfit,
        status: 'paid',
        method: sale.paymentMethod || 'cash',
        cardSubtype: sale.cardSubtype || sale.card_subtype || null,
        items: items.map((item: any) => ({
          id: item.productId || item.product_id || item.id || 0,
          name: item.productName || item.product_name || item.name || (item.productId ? `Товар #${item.productId}` : 'Товар'),
          price: item.price || item.purchasePrice || item.purchase_price || 0,
          sellingPrice: item.priceWithMarkup || item.price_with_markup || item.sellingPrice || item.selling_price || item.price || 0,
          quantity: item.quantity || 1,
          color: item.color || undefined,
        })),
        createdAt: sale.createdAt || sale.created_at
      };
      
      console.log(`  ✅ Создан payment:`, payment);
      return payment;
    });
    
    console.log('\n📊 [COMPANY] ============================================');
    console.log('📊 [COMPANY] ИТОГО загружено платежей:', paymentsData.length);
    console.log('📊 [COMPANY] Все платежи:', paymentsData);
    console.log('📊 [COMPANY] ============================================\n');
    
    setPayments(paymentsData);
  };

  const loadPayments = async () => {
    console.log('🚀 [PAYMENT HISTORY] Компонент загружается!');
    console.log('🏢 [PAYMENT HISTORY] Company ID from props:', companyId);
    
    if (!companyId) {
      console.error('❌ [COMPANY] companyId не передан в props!');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      
      console.log('📊 [COMPANY] Загружаем продажи для companyId:', companyId);
      
      // Используем api.sales.list вместо прямого fetch
      const salesData = await api.sales.list({ companyId: String(companyId) });
      const allSales = Array.isArray(salesData) ? salesData : [];
      
      console.log('📊 [COMPANY] Загружено продаж:', allSales.length);
      console.log('📊 [COMPANY] Сырые данные sales:', allSales);
      
      processAndSetPayments(allSales);
    } catch (error) {
      console.error('❌ [COMPANY] Ошибка при загрузке продаж:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterPayments = () => {
    console.log('\n🔍 [COMPANY] Начинаем фильтрацию платежей...');
    console.log('🔍 [COMPANY] Исходное количество payments:', payments.length);
    console.log('🔍 [COMPANY] payments:', payments);
    
    let filtered = [...payments];
    console.log('🔍 [COMPANY] После копирования:', filtered.length);

    // Поиск
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      console.log('🔍 [COMPANY] Применяем поиск:', query);
      filtered = filtered.filter(p => 
        p.orderId.toLowerCase().includes(query) ||
        p.userName?.toLowerCase().includes(query) ||
        p.userPhone?.includes(query) ||
        p.items.some(item => item.name.toLowerCase().includes(query))
      );
      console.log('🔍 [COMPANY] После поиска:', filtered.length);
    }

    // Фильтр по статусу
    if (filterStatus !== 'all') {
      console.log('🔍 [COMPANY] Применяем фильтр статуса:', filterStatus);
      filtered = filtered.filter(p => p.status === filterStatus);
      console.log('🔍 [COMPANY] После фильтра статуса:', filtered.length);
    }

    // Фильтр по методу оплаты
    if (filterMethod !== 'all') {
      console.log('🔍 [COMPANY] Применяем фильтр метода:', filterMethod);
      filtered = filtered.filter(p => p.method === filterMethod);
      console.log('🔍 [COMPANY] После фильтра метода:', filtered.length);
    }

    // 📅 Фильтр по конкретной дате
    if (selectedDate) {
      const filterDate = new Date(selectedDate);
      filtered = filtered.filter(p => {
        const paymentDate = new Date(p.createdAt);
        return (
          paymentDate.getFullYear() === filterDate.getFullYear() &&
          paymentDate.getMonth() === filterDate.getMonth() &&
          paymentDate.getDate() === filterDate.getDate()
        );
      });
      console.log('🔍 [COMPANY] После фильтра по дате:', filtered.length);
    }

    console.log('🔍 [COMPANY] ============================================');
    console.log('🔍 [COMPANY] ИТОГО после всех фильтров:', filtered.length);
    console.log('🔍 [COMPANY] Отфильтрованные платежи:', filtered);
    console.log('🔍 [COMPANY] ============================================\n');
    
    setFilteredPayments(filtered);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ru-RU').format(price);
  };

  const getStatusBadge = (status: string) => {
    const base: React.CSSProperties = {
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
    };
    switch (status) {
      case 'paid':
        return (
          <span style={{ ...base, background: 'rgba(34,197,94,0.12)', color: 'var(--ax-success)' }}>
            <CheckCircle className="w-3.5 h-3.5" />
            {t.paid}
          </span>
        );
      case 'pending':
        return (
          <span style={{ ...base, background: 'rgba(251,191,36,0.12)', color: 'var(--ax-warning)' }}>
            <AlertCircle className="w-3.5 h-3.5" />
            {t.pending}
          </span>
        );
      case 'failed':
        return (
          <span style={{ ...base, background: 'rgba(248,113,113,0.12)', color: 'var(--ax-danger)' }}>
            <X className="w-3.5 h-3.5" />
            {t.failed}
          </span>
        );
      default:
        return <span style={{ ...base, background: 'var(--ax-input)', color: 'var(--ax-text-2)' }}>{status}</span>;
    }
  };

  const getMethodName = (method: string) => {
    switch (method) {
      case 'card': return 'card';
      case 'cash': return 'cash';
      case 'payme': return 'Payme';
      case 'click': return 'Click';
      case 'uzum': return 'Uzum';
      default: return method;
    }
  };

  const getCardSubtypeName = (subtype: string | null | undefined) => {
    if (!subtype) return '';
    switch (subtype) {
      case 'humo': return '🟢 Humo';
      case 'uzcard': return '🔵 Uzcard';
      case 'visa': return '🟡 Visa';
      case 'other': return '⚪ Другие';
      default: return subtype;
    }
  };

  const totalAmount = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalProfit = filteredPayments.reduce((sum, p) => sum + (p.markupProfit || 0), 0); // ✅ НОВОЕ: Общий прибыль

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div
            className="inline-block animate-spin rounded-full h-8 w-8 border-b-2"
            style={{ borderColor: 'var(--ax-primary)' }}
          ></div>
          <p className="mt-2" style={{ color: 'var(--ax-text-2)' }}>{t.loading}</p>
        </div>
      </div>
    );
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--ax-card)',
    border: '1px solid var(--ax-border)',
    borderRadius: 14,
  };
  const inputStyle: React.CSSProperties = {
    background: 'var(--ax-input)',
    border: '1px solid var(--ax-border)',
    borderRadius: 10,
    color: 'var(--ax-text)',
    fontSize: 14,
    colorScheme: 'dark',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: 'var(--ax-text-2)',
    textTransform: 'uppercase', letterSpacing: '0.05em',
  };

  return (
    <div className="space-y-4">
      {/* ── Сводка по офлайн-продажам ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <div style={{ ...cardStyle, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, background: 'var(--ax-primary-pale)' }}>
              <Receipt className="w-4 h-4" style={{ color: 'var(--ax-primary)' }} />
            </span>
            <span style={labelStyle}>{language === 'uz' ? 'Sotuvlar' : 'Продажи'}</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--ax-text)' }}>{filteredPayments.length}</div>
        </div>

        <div style={{ ...cardStyle, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, background: 'rgba(34,197,94,0.12)' }}>
              <Banknote className="w-4 h-4" style={{ color: 'var(--ax-success)' }} />
            </span>
            <span style={labelStyle}>{language === 'uz' ? 'Savdo summasi' : 'Сумма продаж'}</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--ax-text)' }}>{formatPrice(totalAmount)} {language === 'uz' ? "so'm" : 'сум'}</div>
        </div>

        <div style={{ ...cardStyle, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, background: 'rgba(251,191,36,0.12)' }}>
              <TrendingUp className="w-4 h-4" style={{ color: 'var(--ax-warning)' }} />
            </span>
            <span style={labelStyle}>{language === 'uz' ? 'Foyda (ustama)' : 'Прибыль (наценка)'}</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--ax-success)' }}>+{formatPrice(totalProfit)} {language === 'uz' ? "so'm" : 'сум'}</div>
        </div>
      </div>

      {/* ── Поиск и фильтры ── */}
      <div style={{ ...cardStyle, padding: 16 }} className="space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: 'var(--ax-text-3)' }} />
            <input
              type="text"
              placeholder={t.searchPayments}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 focus:outline-none"
              style={inputStyle}
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition"
            style={{
              background: showFilters ? 'var(--ax-primary-pale)' : 'var(--ax-input)',
              border: '1px solid var(--ax-border)',
              color: showFilters ? 'var(--ax-primary)' : 'var(--ax-text-2)',
              cursor: 'pointer', fontSize: 14, fontWeight: 600,
            }}
          >
            <Filter className="w-4 h-4" />
            {t.filters}
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4" style={{ borderTop: '1px solid var(--ax-border)' }}>
            <div>
              <label className="block mb-2" style={labelStyle}>{t.status}</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full px-3 py-2 focus:outline-none"
                style={inputStyle}
              >
                <option value="all">{t.all}</option>
                <option value="paid">{t.paidStatus}</option>
                <option value="pending">{t.pendingStatus}</option>
                <option value="error">{t.errorStatus}</option>
              </select>
            </div>

            <div>
              <label className="block mb-2" style={labelStyle}>{t.paymentMethod}</label>
              <select
                value={filterMethod}
                onChange={(e) => setFilterMethod(e.target.value as any)}
                className="w-full px-3 py-2 focus:outline-none"
                style={inputStyle}
              >
                <option value="all">{t.allMethods}</option>
                <option value="card">{t.plasticCards}</option>
                <option value="cash">{t.cashPayment}</option>
              </select>
            </div>

            <div>
              <label className="block mb-2" style={labelStyle}>{t.selectSpecificDay}</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="flex-1 px-3 py-2 focus:outline-none"
                  style={inputStyle}
                />
                {selectedDate && (
                  <button
                    onClick={() => setSelectedDate('')}
                    className="px-3 py-2 rounded-lg text-sm font-medium transition"
                    style={{ background: 'var(--ax-input)', border: '1px solid var(--ax-border)', color: 'var(--ax-text-2)', cursor: 'pointer' }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Список продаж ── */}
      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        {filteredPayments.length === 0 ? (
          <div className="text-center py-12">
            <Receipt className="w-14 h-14 mx-auto mb-4" style={{ color: 'var(--ax-text-3)', opacity: 0.5 }} />
            <p style={{ color: 'var(--ax-text-2)' }}>{t.noPaymentsFound}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--ax-border)' }}>
                  <th className="px-4 py-3 text-left" style={labelStyle}>{t.orderDate}</th>
                  <th className="px-4 py-3 text-left" style={labelStyle}>{t.customer}</th>
                  <th className="px-4 py-3 text-left" style={labelStyle}>{t.products}</th>
                  <th className="px-4 py-3 text-right" style={labelStyle}>{t.orderTotal}</th>
                  <th className="px-4 py-3 text-right" style={labelStyle}>{t.profit}</th>
                  <th className="px-4 py-3 text-left" style={labelStyle}>{t.methodHeader}</th>
                  <th className="px-4 py-3 text-left" style={labelStyle}>{t.status}</th>
                  <th className="px-4 py-3 text-left" style={labelStyle}>{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((payment) => (
                  <tr key={payment.orderId} style={{ borderBottom: '1px solid var(--ax-border)' }}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm" style={{ color: 'var(--ax-text-2)' }}>
                      {formatDate(payment.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        <div style={{ color: 'var(--ax-text)' }}>{payment.userName || t.guest}</div>
                        {payment.userPhone && <div style={{ color: 'var(--ax-text-3)' }}>+998 {payment.userPhone}</div>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm max-w-xs">
                        {payment.items.length > 0 ? (
                          <div className="space-y-1">
                            {payment.items.slice(0, 2).map((item, idx) => (
                              <div key={idx} style={{ color: 'var(--ax-text)' }}>
                                {item.name} <span style={{ color: 'var(--ax-text-3)' }}>×{item.quantity}</span>
                              </div>
                            ))}
                            {payment.items.length > 2 && (
                              <div className="text-xs" style={{ color: 'var(--ax-text-3)' }}>
                                + {payment.items.length - 2} {t.products}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--ax-text-3)' }}>—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <span className="font-semibold text-sm" style={{ color: 'var(--ax-text)' }}>{formatPrice(payment.amount)} {language === 'uz' ? "so'm" : 'сум'}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <span className="font-semibold text-sm" style={{ color: 'var(--ax-success)' }}>+{formatPrice(payment.markupProfit || 0)}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm" style={{ color: 'var(--ax-text-2)' }}>
                      {payment.method === 'cash' ? (language === 'uz' ? 'Naqd' : 'Наличные') : getMethodName(payment.method)}
                      {payment.cardSubtype && <span className="ml-1 text-xs font-medium" style={{ color: 'var(--ax-primary)' }}> ({getCardSubtypeName(payment.cardSubtype)})</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getStatusBadge(payment.status)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={() => setSelectedPayment(payment)}
                        className="text-sm font-medium"
                        style={{ color: 'var(--ax-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        {t.detailsBtn}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Модальное окно с деталями продажи ── */}
      {selectedPayment && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto" style={{ ...cardStyle, boxShadow: 'var(--ax-shadow)' }}>
            <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--ax-border)' }}>
              <h3 className="text-lg font-bold" style={{ color: 'var(--ax-text)' }}>
                {language === 'uz' ? 'Sotuv tafsilotlari' : 'Детали продажи'} {selectedPayment.orderId}
              </h3>
              <button
                onClick={() => setSelectedPayment(null)}
                className="p-2 rounded-full transition"
                style={{ background: 'var(--ax-input)', border: 'none', color: 'var(--ax-text-2)', cursor: 'pointer' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p style={labelStyle}>{t.orderDate}</p>
                  <p style={{ color: 'var(--ax-text)', marginTop: 4 }}>{formatDate(selectedPayment.createdAt)}</p>
                </div>
                <div>
                  <p style={labelStyle}>{t.customer}</p>
                  <p style={{ color: 'var(--ax-text)', marginTop: 4 }}>{selectedPayment.userName || t.guest}</p>
                  {selectedPayment.userPhone && <p className="text-sm" style={{ color: 'var(--ax-text-3)' }}>+998 {selectedPayment.userPhone}</p>}
                </div>
                <div>
                  <p style={labelStyle}>{t.paymentMethod}</p>
                  <p style={{ color: 'var(--ax-text)', marginTop: 4 }}>
                    {selectedPayment.method === 'cash' ? (language === 'uz' ? 'Naqd' : 'Наличные') : getMethodName(selectedPayment.method)}
                    {selectedPayment.cardSubtype && ` (${getCardSubtypeName(selectedPayment.cardSubtype)})`}
                  </p>
                </div>
                <div>
                  <p style={labelStyle}>{t.status}</p>
                  <div className="mt-1">{getStatusBadge(selectedPayment.status)}</div>
                </div>
              </div>

              <div>
                <p className="mb-2" style={labelStyle}>{t.products}</p>
                <div className="space-y-2">
                  {selectedPayment.items.map((item, index) => {
                    const itemPrice = item.sellingPrice || item.price;
                    return (
                      <div key={index} className="flex justify-between items-start p-3 rounded-lg" style={{ background: 'var(--ax-input)' }}>
                        <div className="flex-1">
                          <p style={{ color: 'var(--ax-text)' }}>{item.name}</p>
                          {item.color && (
                            <p className="text-sm" style={{ color: 'var(--ax-text-3)' }}>{language === 'uz' ? 'Rang' : 'Цвет'}: {item.color}</p>
                          )}
                          <p className="text-sm" style={{ color: 'var(--ax-text-3)' }}>{formatPrice(itemPrice)} × {item.quantity}</p>
                        </div>
                        <p className="font-semibold" style={{ color: 'var(--ax-text)' }}>{formatPrice(itemPrice * item.quantity)} {language === 'uz' ? "so'm" : 'сум'}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 space-y-2" style={{ borderTop: '1px solid var(--ax-border)' }}>
                <div className="flex justify-between items-center text-lg">
                  <span style={{ color: 'var(--ax-text-2)' }}>{language === 'uz' ? 'Jami' : 'Итого'}:</span>
                  <span className="font-bold" style={{ color: 'var(--ax-text)' }}>{formatPrice(selectedPayment.amount)} {language === 'uz' ? "so'm" : 'сум'}</span>
                </div>
                <div className="flex justify-between items-center text-lg">
                  <span style={{ color: 'var(--ax-text-2)' }}>{language === 'uz' ? 'Foyda' : 'Прибыль'}:</span>
                  <span className="font-bold" style={{ color: 'var(--ax-success)' }}>+{formatPrice(selectedPayment.markupProfit || 0)} {language === 'uz' ? "so'm" : 'сум'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

