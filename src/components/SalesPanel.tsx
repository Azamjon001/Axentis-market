import { useState, useEffect } from 'react';
import { Package, Search, Users, CheckSquare, Square, ShoppingCart, X } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import api, { getImageUrl } from '../utils/api';
import { getUzbekistanToday, toUzbekistanDate, formatUzbekistanFullDateTime } from '../utils/uzbekTime';
import { getCurrentLanguage, useTranslation, type Language } from '../utils/translations';
import { useResponsive, useResponsiveClasses } from '../hooks/useResponsive';

interface Product {
  id: number;
  name: string;
  quantity: number;
  price: number;
  markupPercent?: number;
  availableForCustomers?: boolean;
  images?: string[]; // 📸 Массив путей к изображениям товара
  description?: string;
  category?: string;
  barcode?: string;
  brand?: string;
}

interface Order {
  id: number;
  order_code: string;
  user_name: string;
  user_phone: string;
  order_date: string;
  confirmed_date?: string;
  total_amount: number;
  status: string;
  items: Array<{
    id: number;
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
}

interface SalesPanelProps {
  companyId: number;
}

export default function SalesPanel({ companyId }: SalesPanelProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedItems, setSelectedItems] = useState<{ [key: number]: number }>({});
  const [selectedForSale, setSelectedForSale] = useState<Set<number>>(new Set());
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [salesHistory, setSalesHistory] = useState<any[]>([]);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [orderSearchCode, setOrderSearchCode] = useState('');
  const [foundOrder, setFoundOrder] = useState<Order | null>(null);
  const [showOrderReceipt, setShowOrderReceipt] = useState(false);
  
  // 📱 Адаптивность
  const { isMobile, isTablet } = useResponsive();
  const responsive = useResponsiveClasses();
  
  // Новые состояния для детальной панели
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [showCompanyProfile, setShowCompanyProfile] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<any>(null);
  const [productNotes, setProductNotes] = useState<{[key: number]: string}>({});
  const [editingNotes, setEditingNotes] = useState(false);
  const [editingProductsDescription, setEditingProductsDescription] = useState(false); // 🆕 Режим редактирования описания товаров
  const [productsDescriptionDraft, setProductsDescriptionDraft] = useState(''); // 🆕 Черновик описания
  const [editingProductDescription, setEditingProductDescription] = useState(false); // 🆕 Режим редактирования описания товара
  const [productDescriptionDraft, setProductDescriptionDraft] = useState(''); // 🆕 Черновик описания товара
  
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

  useEffect(() => {
    loadData();
    
    // 🔄 Auto-refresh every 10 seconds
    console.log('🔄 [Sales Panel] Setting up auto-refresh every 10 seconds');
    const intervalId = setInterval(() => {
      console.log('🔄 [Sales Panel] Auto-refreshing data...');
      loadData();
    }, 10000); // 10 seconds
    
    // Cleanup on unmount
    return () => {
      console.log('🛑 [Sales Panel] Stopping auto-refresh');
      clearInterval(intervalId);
    };
  }, [companyId]);

  const loadData = async () => {
    try {
      const productsData = await api.products.list({ companyId });
      setProducts(Array.isArray(productsData) ? productsData.filter((p: Product) => p.quantity > 0) : []);
      
      // Sales and orders - handle 404 gracefully
      try {
        const salesData = await api.sales.list({ companyId });
        const sales = Array.isArray(salesData) ? salesData : (salesData?.sales || []);
        setSalesHistory(sales);
      } catch (err) {
        console.log('Sales API not ready:', err);
        setSalesHistory([]);
      }
      
      try {
        const customerOrdersData = await api.orders.list({ companyId });
        const orders = Array.isArray(customerOrdersData) ? customerOrdersData : (customerOrdersData?.orders || []);
        setCustomerOrders(orders);
      } catch (err) {
        console.log('Orders API not ready:', err);
        setCustomerOrders([]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      alert(t.dataLoadError);
    } finally {
      setLoading(false);
    }
  };

  const loadCompanyInfo = async () => {
    try {
      const data = await api.companies.get(companyId.toString());
      setCompanyInfo(data);
      setProductsDescriptionDraft(data.productsDescription || ''); // 🆕 Загружаем текущее описание
      if (selectedProduct) {
        setProductDescriptionDraft(selectedProduct.description || ''); // 🆕 Загружаем описание товара
      }
    } catch (error) {
      console.error('Error loading company info:', error);
    }
  };

  // 🆕 Сохранение описания товаров
  const saveProductsDescription = async () => {
    try {
      await api.companies.update(companyId.toString(), {
        ...companyInfo,
        productsDescription: productsDescriptionDraft
      });
      
      setCompanyInfo({ ...companyInfo, productsDescription: productsDescriptionDraft });
      setEditingProductsDescription(false);
      
      // Показываем уведомление
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-in slide-in-from-top';
      notification.textContent = '✅ Описание товаров сохранено!';
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 3000);
    } catch (error) {
      console.error('Failed to save products description:', error);
      alert(t.saveError);
    }
  };

  // 🆕 Сохранение описания товара
  const saveProductDescription = async () => {
    if (!selectedProduct) return;
    try {
      await api.products.update(selectedProduct.id.toString(), {
        ...selectedProduct,
        description: productDescriptionDraft
      });
      // Обновляем локальное состояние
      setSelectedProduct({ ...selectedProduct, description: productDescriptionDraft });
      setEditingProductDescription(false);
      // Перезагружаем список товаров
      await loadData();
      alert(t.productDescSaved);
    } catch (error) {
      console.error('Error saving product description:', error);
      alert(t.saveError);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('uz-UZ').format(price) + ' ' + t.currency;
  };

  const getPriceWithMarkup = (product: Product) => {
    const markupPercent = product.markupPercent || 0;
    return product.price * (1 + markupPercent / 100);
  };

  const getTodaysSales = () => {
    const today = getUzbekistanToday();
    
    // Calculate company sales from sales_history
    const companySales = salesHistory
      .filter(sale => toUzbekistanDate(sale.sale_date)?.toDateString() === today)
      .reduce((sum, sale) => sum + sale.total_amount, 0);
    
    // Calculate customer orders from customer_orders
    const customerSales = customerOrders
      .filter(order => toUzbekistanDate(order.order_date)?.toDateString() === today)
      .reduce((sum, order) => sum + order.total_amount, 0);
    
    // Return total of both
    return companySales + customerSales;
  };

  const filteredProducts = products.filter(product => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase().trim();
    const name = product.name.toLowerCase();
    const price = product.price.toString();
    const quantity = product.quantity.toString();
    
    return name.includes(query) || price.includes(query) || quantity.includes(query);
  });

  const handleToggleCustomerAvailability = async (productId: number) => {
    try {
      const result = await api.products.toggleAvailability(productId);
      // Update local state
      setProducts(products.map(p => 
        p.id === productId 
          ? { ...p, availableForCustomers: result.availableForCustomers }
          : p
      ));
    } catch (error) {
      console.error('Error toggling customer availability:', error);
      alert(t.statusChangeError);
    }
  };

  // Toggle product selection for sale
  const toggleProductSelection = (productId: number) => {
    const newSelected = new Set(selectedForSale);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
      // Also remove from selectedItems
      const newItems = { ...selectedItems };
      delete newItems[productId];
      setSelectedItems(newItems);
    } else {
      newSelected.add(productId);
      // Auto-select full quantity
      const product = products.find(p => p.id === productId);
      if (product) {
        setSelectedItems({ ...selectedItems, [productId]: product.quantity });
      }
    }
    setSelectedForSale(newSelected);
  };

  // Open sale modal with selected products
  const openSaleModal = () => {
    if (selectedForSale.size === 0) {
      alert(t.selectProductsForSale);
      return;
    }
    setShowSaleModal(true);
  };

  // Handle making products available for customers
  const handleConfirmMakeAvailable = async () => {
    try {
      console.log(`🚀 [Sales Panel] Making ${selectedForSale.size} products available for customers...`);
      const startTime = Date.now();
      
      // Toggle availability for all selected products
      const productIds = Array.from(selectedForSale);
      const result = await api.products.bulkToggleAvailability(productIds, true); // true = make available
      
      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      
      console.log(`✅ [Sales Panel] Completed in ${duration} seconds!`);

      // Reset
      setSelectedForSale(new Set());
      setShowSaleModal(false);
      
      // ✅ НОВАЯ СИСТЕМА: Данные обновлены в Supabase! Перезагружаем!
      console.log('🔄 [Sales Panel] Reloading data from Supabase...');
      await loadData();
      console.log('✅ [Sales Panel] Data reloaded!');

      alert(`${t.successfullyListed}\n\n${productIds.length} ${t.listedProductsAvailable}\n${t.timeSeconds} ${duration} секунд`);
    } catch (error) {
      console.error('Error making products available:', error);
      alert(t.listProductsError);
    }
  };

  // Handle removing products from sale
  const handleRemoveFromSale = async () => {
    if (selectedForSale.size === 0) {
      alert(t.selectProductsForSale);
      return;
    }
    try {
      const productIds = Array.from(selectedForSale);
      await api.products.bulkToggleAvailability(productIds, false);
      setSelectedForSale(new Set());
      await loadData();
    } catch (error) {
      console.error('Error removing products from sale:', error);
      alert(t.statusChangeError);
    }
  };

  // Handle confirming customer payment
  const handleConfirmPayment = async (orderId: number) => {
    if (!confirm(t.confirmPayment)) return;

    try {
      await api.orders.confirmPayment(orderId);
      await loadData();
      alert(t.paymentConfirmed);
    } catch (error) {
      console.error('Error confirming payment:', error);
      alert(t.paymentConfirmError);
    }
  };

  // Handle selecting all products
  const handleSelectAll = () => {
    if (products.length === 0) {
      return;
    }

    // Check if all products are already selected
    const allSelected = selectedForSale.size === products.length;

    if (allSelected) {
      // Deselect all
      setSelectedForSale(new Set());
      setSelectedItems({});
    } else {
      // Select all products
      const allProductIds = new Set(products.map(p => p.id));
      setSelectedForSale(allProductIds);

      // Auto-set full quantity for all products
      const allItems: { [key: number]: number } = {};
      products.forEach(product => {
        allItems[product.id] = product.quantity;
      });
      setSelectedItems(allItems);
    }
  };

  // Get pending customer orders
  const getPendingOrders = () => {
    return customerOrders.filter(order => order.status === 'pending');
  };

  // Search order by code
  const handleSearchOrder = async () => {
    if (!orderSearchCode.trim()) {
      setFoundOrder(null);
      return;
    }

    try {
      const order = await api.orders.searchByCode(orderSearchCode);
      setFoundOrder(order);
    } catch (error) {
      console.error('Error searching order:', error);
      alert(t.orderSearchError);
    }
  };

  // 📄 Экспорт истории продаж в CSV (открывается в Excel — BOM для кириллицы).
  const exportSalesCSV = () => {
    const rows: string[][] = [['Дата', 'Товары', 'Кол-во позиций', 'Сумма', 'Прибыль', 'Оплата']];
    for (const s of salesHistory) {
      let items: any[] = [];
      try { items = typeof s.items === 'string' ? JSON.parse(s.items) : (s.items || []); } catch { /* ignore */ }
      const names = items.map((i: any) => `${i.productName || i.product_name || i.name || 'Товар'} x${i.quantity || 1}`).join('; ');
      rows.push([
        new Date(s.created_at || s.createdAt).toLocaleString('ru-RU'),
        names,
        String(items.reduce((n: number, i: any) => n + (i.quantity || 1), 0)),
        String(s.total_amount ?? s.totalAmount ?? 0),
        String(s.markup_profit ?? s.markupProfit ?? 0),
        (s.payment_method === 'card' ? `Карта ${s.card_subtype || ''}`.trim() : 'Наличные'),
      ]);
    }
    const csv = '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sales_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div>
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div style={{ background: 'var(--ax-card)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16 }} className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="w-5 h-5" style={{ color: '#7C5CF0' }} />
            <div style={{ color: '#8B8BAA' }}>{t.productsAvailable}</div>
          </div>
          <div className="text-3xl" style={{ color: '#7C5CF0' }}>{products.length}</div>
        </div>
        <div style={{ background: 'var(--ax-card)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16 }} className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5" style={{ color: '#22C55E' }} />
            <div style={{ color: '#8B8BAA' }}>{t.availableForCustomers}</div>
          </div>
          <div className="text-3xl" style={{ color: '#22C55E' }}>
            {products.filter(p => p.availableForCustomers).length}
          </div>
        </div>
        <div style={{ background: 'var(--ax-card)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16 }} className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <ShoppingCart className="w-5 h-5" style={{ color: '#7C5CF0' }} />
            <div style={{ color: '#8B8BAA' }}>{t.productsSelected}</div>
          </div>
          <div className="text-3xl" style={{ color: '#7C5CF0' }}>{selectedForSale.size}</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        {/* 📄 Экспорт продаж для бухгалтерии */}
        <button
          onClick={exportSalesCSV}
          disabled={salesHistory.length === 0}
          title="Скачать историю продаж (CSV для Excel)"
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px',
            background: salesHistory.length > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
            color: salesHistory.length > 0 ? '#22C55E' : '#8B8BAA',
            border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10,
            cursor: salesHistory.length > 0 ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600,
          }}
        >
          ⬇️ Excel (CSV)
        </button>
        <button
          onClick={openSaleModal}
          disabled={selectedForSale.size === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px',
            background: selectedForSale.size > 0 ? 'linear-gradient(135deg, #7C5CF0, #5B3DD4)' : 'rgba(255,255,255,0.05)',
            color: '#FFFFFF', border: 'none', borderRadius: 10,
            cursor: selectedForSale.size > 0 ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600,
          }}
        >
          <Users style={{ width: 15, height: 15 }} />
          {t.putOnSale} ({selectedForSale.size})
        </button>
        <button
          onClick={handleRemoveFromSale}
          disabled={selectedForSale.size === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px',
            background: selectedForSale.size > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
            color: selectedForSale.size > 0 ? '#EF4444' : '#5A5A78',
            border: selectedForSale.size > 0 ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10, cursor: selectedForSale.size > 0 ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600,
          }}
        >
          <X style={{ width: 15, height: 15 }} />
          Убрать с продажи ({selectedForSale.size})
        </button>
        <button
          onClick={handleSelectAll}
          disabled={products.length === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px',
            background: 'rgba(255,255,255,0.07)', color: '#8B8BAA',
            border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, cursor: 'pointer', fontSize: 13,
          }}
        >
          {selectedForSale.size === products.length && products.length > 0 ? (
            <><CheckSquare style={{ width: 15, height: 15 }} /> {t.deselectAll}</>
          ) : (
            <><Square style={{ width: 15, height: 15 }} /> {t.selectAll}</>
          )}
        </button>
      </div>

      {/* Search */}
      <div style={{ background: 'var(--ax-card)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Search style={{ width: 18, height: 18, color: '#8B8BAA', flexShrink: 0 }} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t.searchByName}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--ax-text)', fontSize: 14 }}
        />
        {searchQuery && (
          <span style={{ color: '#8B8BAA', fontSize: 12, whiteSpace: 'nowrap' }}>
            {filteredProducts.length} найдено
          </span>
        )}
      </div>

      {/* Product Grid */}
      {filteredProducts.length === 0 ? (
        <div style={{ background: 'var(--ax-card)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 48, textAlign: 'center' }}>
          <Package style={{ width: 48, height: 48, color: '#5A5A78', margin: '0 auto 12px' }} />
          <p style={{ color: '#8B8BAA' }}>{t.noProductsInStock}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
          {filteredProducts.map((product) => {
            const isSelected = selectedForSale.has(product.id);
            const images = Array.isArray(product.images) ? product.images : [];
            const imageUrl = images[0] ? (getImageUrl(images[0]) || images[0]) : null;
            return (
              <div
                key={product.id}
                onClick={() => toggleProductSelection(product.id)}
                style={{
                  background: 'var(--ax-card)',
                  border: isSelected ? '2px solid #7C5CF0' : '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 14, overflow: 'hidden', cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: isSelected ? '0 0 0 3px rgba(124,92,240,0.15)' : 'none',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; }}
              >
                <div style={{ height: 130, background: 'rgba(255,255,255,0.04)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {imageUrl ? (
                    <img src={imageUrl} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <Package style={{ width: 40, height: 40, color: '#5A5A78' }} />
                  )}
                  <div style={{ position: 'absolute', top: 8, right: 8 }}>
                    {isSelected
                      ? <CheckSquare style={{ width: 20, height: 20, color: '#7C5CF0' }} />
                      : <Square style={{ width: 20, height: 20, color: 'rgba(255,255,255,0.35)' }} />
                    }
                  </div>
                </div>
                <div style={{ padding: '10px 12px' }}>
                  <div style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 600, marginBottom: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                    {product.name}
                  </div>
                  <div style={{ color: '#7C5CF0', fontWeight: 700, fontSize: 14 }}>
                    {formatPrice(getPriceWithMarkup(product))}
                  </div>
                  <div style={{ color: '#8B8BAA', fontSize: 11, marginTop: 2 }}>
                    {t.inStock}: {product.quantity} {t.pcs}
                  </div>
                  <div style={{ marginTop: 6, display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11, background: product.availableForCustomers ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.07)', color: product.availableForCustomers ? '#22C55E' : '#5A5A78' }}>
                    {product.availableForCustomers ? (language === 'uz' ? 'Sotuvda' : 'В продаже') : (language === 'uz' ? "Sotuvda yo'q" : 'Не в продаже')}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sale Confirmation Modal — keep as-is */}
      {showSaleModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col" style={{ background: 'var(--ax-card)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16 }}>
            <div className="p-6 text-white" style={{ background: 'linear-gradient(135deg, #7C5CF0, #5B3DD4)' }}>
              <h2 className="text-2xl" style={{ color: '#FFFFFF' }}>{t.listForCustomers}</h2>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.75)' }}>{t.listForCustomersDesc}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {Array.from(selectedForSale).map(productId => {
                  const product = products.find(p => p.id === productId);
                  if (!product) return null;
                  return (
                    <div key={productId} className="flex items-center gap-4 p-4" style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="flex-1">
                        <h3 className="mb-1" style={{ color: '#FFFFFF' }}>{product.name}</h3>
                        <div className="text-sm" style={{ color: '#8B8BAA' }}>
                          {t.price}: {formatPrice(getPriceWithMarkup(product))} | {t.inStock}: {product.quantity} {t.pcs}
                        </div>
                      </div>
                      <div style={{ padding: '4px 10px', borderRadius: 8, fontSize: 12, background: product.availableForCustomers ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.07)', color: product.availableForCustomers ? '#22C55E' : '#8B8BAA' }}>
                        {product.availableForCustomers ? t.alreadyOnSale : t.willBeListed}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="p-6 flex gap-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <button onClick={() => setShowSaleModal(false)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.07)', color: '#8B8BAA', cursor: 'pointer' }}>
                Отмена
              </button>
              <button onClick={handleConfirmMakeAvailable} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #7C5CF0, #5B3DD4)', color: '#FFFFFF', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Users style={{ width: 18, height: 18 }} />
                Выставить для покупателей
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Details Modal — keep as-is */}
      {selectedProduct && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setSelectedProduct(null)}>
          <div className="max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" style={{ background: 'var(--ax-card)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16 }} onClick={(e) => e.stopPropagation()}>
            <div className="p-6 flex justify-between items-start" style={{ background: 'linear-gradient(135deg, #7C5CF0, #5B3DD4)' }}>
              <div>
                <h2 className="text-2xl font-bold" style={{ color: '#FFFFFF' }}>{selectedProduct.name}</h2>
                <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.75)' }}>{t.productDetailsDesc}</p>
              </div>
              <button onClick={() => setSelectedProduct(null)} style={{ color: '#FFFFFF', background: 'none', border: 'none', cursor: 'pointer' }}>
                <X style={{ width: 24, height: 24 }} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="rounded-lg p-4 mb-6" style={{ background: 'rgba(124,92,240,0.1)', border: '1px solid rgba(124,92,240,0.2)' }}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm mb-1" style={{ color: '#8B8BAA' }}>{t.sellingPrice}</div>
                    <div className="text-2xl font-bold" style={{ color: '#7C5CF0' }}>{formatPrice(getPriceWithMarkup(selectedProduct))}</div>
                  </div>
                  <div>
                    <div className="text-sm mb-1" style={{ color: '#8B8BAA' }}>{t.inStock}</div>
                    <div className="text-2xl font-bold" style={{ color: '#22C55E' }}>{selectedProduct.quantity} {t.pcs}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 flex gap-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <button
                onClick={() => { toggleProductSelection(selectedProduct.id); setSelectedProduct(null); }}
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', background: selectedForSale.has(selectedProduct.id) ? 'rgba(255,255,255,0.07)' : 'linear-gradient(135deg, #7C5CF0, #5B3DD4)', color: '#FFFFFF', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {selectedForSale.has(selectedProduct.id)
                  ? <><Square style={{ width: 18, height: 18 }} /> Снять выбор</>
                  : <><CheckSquare style={{ width: 18, height: 18 }} /> Выбрать для витрины</>
                }
              </button>
              <button onClick={() => setSelectedProduct(null)} style={{ padding: '12px 20px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.07)', color: '#8B8BAA', cursor: 'pointer' }}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}