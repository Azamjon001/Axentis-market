import React, { useState, useEffect } from 'react';
import { Package, Plus, DollarSign, Hash, Trash2, Edit2, X, Save, FileText, ChevronRight } from 'lucide-react';
import api from '../utils/api';
import CompactPeriodSelector from './CompactPeriodSelector';
import { getCurrentLanguage, type Language } from '../utils/translations';

interface ProductPurchase {
  id: number;
  companyId: number;
  productId?: number;
  productName: string;
  quantity: number;
  purchasePrice: number;
  totalCost: number;
  supplier?: string;
  notes?: string;
  purchaseDate: string;
  createdAt: string;
}

interface Product {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

interface ProductPurchasesPanelProps {
  companyId: number;
}

export default function ProductPurchasesPanel({ companyId }: ProductPurchasesPanelProps) {
  const [purchases, setPurchases] = useState<ProductPurchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [language, setLanguage] = useState<Language>(getCurrentLanguage());
  
  // Модальное окно для деталей групповой закупки
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedPurchaseDetails, setSelectedPurchaseDetails] = useState<any[]>([]);

  // Listen for language changes
  useEffect(() => {
    const handleLanguageChange = (e: CustomEvent) => {
      setLanguage(e.detail);
    };
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    return () => window.removeEventListener('languageChange', handleLanguageChange as EventListener);
  }, []);

  // Form state
  const [formData, setFormData] = useState({
    productId: '',
    productName: '',
    quantity: '',
    purchasePrice: '',
    totalCost: '',
    supplier: '',
    notes: '',
    purchaseDate: new Date().toISOString().split('T')[0],
  });

  // Filter state
  type PeriodType = 'day' | 'yesterday' | 'week' | 'month' | 'year' | 'all';
  const [timePeriod, setTimePeriod] = useState<PeriodType>('all');

  useEffect(() => {
    loadData();
  }, [companyId, timePeriod]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load products
      const productsData = await api.products.list({ companyId: companyId.toString() });
      setProducts(Array.isArray(productsData) ? productsData : productsData?.products || []);

      // Load purchases with filter
      const params: any = { companyId };
      
      // Apply time period filter
      if (timePeriod !== 'all') {
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

      const purchasesData = await api.productPurchases.list(params);
      setPurchases(purchasesData?.purchases || []);

      // Убрано: больше не показываем товары со склада как отдельные записи
      // Теперь все закупки (включая импорт) записываются в productPurchases
      
    } catch (error) {
      console.error('❌ Error loading purchases:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProductSelect = (productId: string) => {
    const product = products.find(p => p.id === parseInt(productId));
    if (product) {
      setFormData(prev => ({
        ...prev,
        productId,
        productName: product.name,
        purchasePrice: product.price.toString(),
      }));
    }
  };

  const calculateTotalCost = () => {
    const quantity = parseFloat(formData.quantity) || 0;
    const price = parseFloat(formData.purchasePrice) || 0;
    return (quantity * price).toFixed(2);
  };

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      totalCost: calculateTotalCost(),
    }));
  }, [formData.quantity, formData.purchasePrice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.productName || !formData.quantity || !formData.purchasePrice) {
      alert('Majburiy maydonlarni to\'ldiring');
      return;
    }

    try {
      const data = {
        companyId,
        productId: formData.productId ? parseInt(formData.productId) : undefined,
        productName: formData.productName,
        quantity: parseInt(formData.quantity),
        purchasePrice: parseFloat(formData.purchasePrice),
        totalCost: parseFloat(formData.totalCost),
        supplier: formData.supplier || undefined,
        notes: formData.notes || undefined,
        purchaseDate: new Date(formData.purchaseDate).toISOString(),
      };

      if (editingId) {
        await api.productPurchases.update(editingId, data);
        alert('✅ Xarid yangilandi');
      } else {
        await api.productPurchases.create(data);
        alert('✅ Xarid qo\'shildi');
      }

      // Reset form
      setFormData({
        productId: '',
        productName: '',
        quantity: '',
        purchasePrice: '',
        totalCost: '',
        supplier: '',
        notes: '',
        purchaseDate: new Date().toISOString().split('T')[0],
      });
      setShowAddForm(false);
      setEditingId(null);
      loadData();
    } catch (error: any) {
      console.error('❌ Error saving purchase:', error);
      alert(`Xato: ${error.message}`);
    }
  };

  const handleEdit = (purchase: ProductPurchase) => {
    setFormData({
      productId: purchase.productId?.toString() || '',
      productName: purchase.productName,
      quantity: purchase.quantity.toString(),
      purchasePrice: purchase.purchasePrice.toString(),
      totalCost: purchase.totalCost.toString(),
      supplier: purchase.supplier || '',
      notes: purchase.notes || '',
      purchaseDate: purchase.purchaseDate.split('T')[0],
    });
    setEditingId(purchase.id);
    setShowAddForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bu xaridni o\'chirmoqchimisiz?')) return;

    try {
      await api.productPurchases.delete(id);
      alert('✅ Xarid o\'chirildi');
      loadData();
    } catch (error: any) {
      console.error('❌ Error deleting purchase:', error);
      alert(`Xato: ${error.message}`);
    }
  };
  
  // Показать детали групповой закупки
  const showPurchaseDetails = (purchase: ProductPurchase) => {
    try {
      if (purchase.notes) {
        const details = JSON.parse(purchase.notes);
        if (Array.isArray(details)) {
          setSelectedPurchaseDetails(details);
          setShowDetailsModal(true);
        }
      }
    } catch (error) {
      console.error('Ошибка парсинга деталей закупки:', error);
    }
  };

  const totalPurchases = purchases.length;
  const totalQuantity = purchases.reduce((sum, p) => sum + p.quantity, 0);
  const totalCost = purchases.reduce((sum, p) => sum + p.totalCost, 0);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Package className="w-7 h-7 text-blue-600" />
            {language === 'uz' ? 'Tovar xaridlari tarixi' : 'История закупок товаров'}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {language === 'uz' ? 'Barcha xaridlar va tovar to\'ldirishlarni kuzating' : 'Отслеживайте все закупки и пополнения склада'}
          </p>
        </div>
        <button
          onClick={() => {
            setShowAddForm(!showAddForm);
            if (showAddForm) {
              setEditingId(null);
              setFormData({
                productId: '',
                productName: '',
                quantity: '',
                purchasePrice: '',
                totalCost: '',
                supplier: '',
                notes: '',
                purchaseDate: new Date().toISOString().split('T')[0],
              });
            }
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showAddForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          {showAddForm
            ? (language === 'uz' ? 'Bekor qilish' : 'Отмена')
            : (language === 'uz' ? 'Xarid qo\'shish' : 'Добавить закупку')}
        </button>
      </div>

      {/* Period Filter */}
      <CompactPeriodSelector
        value={timePeriod}
        onChange={setTimePeriod}
        language={language}
      />

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{language === 'uz' ? 'Jami xaridlar' : 'Всего закупок'}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalPurchases}</p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/40 rounded-lg">
              <Hash className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{language === 'uz' ? 'Jami tovarlar' : 'Всего единиц'}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalQuantity}</p>
            </div>
          </div>
        </div>

        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/40 rounded-lg">
              <DollarSign className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{language === 'uz' ? 'Umumiy summa' : 'Общая сумма'}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {totalCost.toLocaleString()} {language === 'uz' ? 'so\'m' : 'сум'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Form - Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => {
          setShowAddForm(false);
          setEditingId(null);
        }}>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            {editingId
              ? (language === 'uz' ? 'Xaridni tahrirlash' : 'Редактировать закупку')
              : (language === 'uz' ? 'Xarid qo\'shish' : 'Добавить закупку')}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Product Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tovar (ixtiyoriy)
                </label>
                <select
                  value={formData.productId}
                  onChange={(e) => handleProductSelect(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Tovarni tanlang yoki qo'lda kiriting</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Product Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tovar nomi *
                </label>
                <input
                  type="text"
                  value={formData.productName}
                  onChange={(e) => setFormData(prev => ({ ...prev, productName: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Nomni kiriting"
                />
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Miqdori *
                </label>
                <input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                  required
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Miqdorni kiriting"
                />
              </div>

              {/* Purchase Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Xarid narxi (dona) *
                </label>
                <input
                  type="number"
                  value={formData.purchasePrice}
                  onChange={(e) => setFormData(prev => ({ ...prev, purchasePrice: e.target.value }))}
                  required
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Narxni kiriting"
                />
              </div>

              {/* Total Cost (auto-calculated) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Umumiy summa
                </label>
                <input
                  type="text"
                  value={`${formData.totalCost} so'm`}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white cursor-not-allowed"
                />
              </div>

              {/* Purchase Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Xarid sanasi *
                </label>
                <input
                  type="date"
                  value={formData.purchaseDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, purchaseDate: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Supplier */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ta'minotchi (ixtiyoriy)
                </label>
                <input
                  type="text"
                  value={formData.supplier}
                  onChange={(e) => setFormData(prev => ({ ...prev, supplier: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Ta'minotchi nomi"
                />
              </div>

              {/* Notes */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Izoh (ixtiyoriy)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Xarid haqida qo'shimcha ma'lumot"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-3 sticky bottom-0 bg-white dark:bg-gray-800 pt-4 pb-2 -mb-2 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingId(null);
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Save className="w-5 h-5" />
                {editingId ? 'Saqlash' : 'Qo\'shish'}
              </button>
            </div>
          </form>
        </div>
        </div>
        </div>
      )}

      {/* Purchases List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        {purchases.length === 0 && warehouseProducts.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="-4" />
            <p className="text-gray-600 dark:text-gray-400">
              {language === 'uz' ? 'Tanlangan davr uchun xarid ma\'lumotlari yo\'q' : 'Нет данных о закупках за выбранный период'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {language === 'uz' ? 'Sana' : 'Дата'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {language === 'uz' ? 'Tovar' : 'Товар'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {language === 'uz' ? 'Miqdori' : 'Кол-во'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {language === 'uz' ? 'Dona narxi' : 'Цена за ед.'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {language === 'uz' ? 'Summa' : 'Сумма'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {language === 'uz' ? 'Ta\'minotchi' : 'Поставщик'}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {language === 'uz' ? 'Amallar' : 'Действия'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {/* Manual purchase records */}
                {purchases.map((purchase) => {
                  // Проверяем, является ли это групповой закупкой (импортом)
                  const isGroupPurchase = purchase.notes && purchase.notes.startsWith('[');
                  let purchaseDetails: any[] = [];
                  if (isGroupPurchase) {
                    try {
                      purchaseDetails = JSON.parse(purchase.notes);
                    } catch (e) {
                      // Игнорируем ошибки парсинга
                    }
                  }
                  
                  return (
                  <tr key={`purchase-${purchase.id}`} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      <div>
                        {new Date(purchase.purchaseDate).toLocaleDateString(language === 'uz' ? 'uz-UZ' : 'ru-RU', { 
                          day: '2-digit', 
                          month: 'long', 
                          year: 'numeric' 
                        })}
                      </div>
                      <div className="text-xs font-medium text-blue-600 dark:text-blue-400">
                        {new Date(purchase.purchaseDate).toLocaleTimeString(language === 'uz' ? 'uz-UZ' : 'ru-RU', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        {isGroupPurchase && <FileText className="w-4 h-4 text-green-600" />}
                        {purchase.productName}
                      </div>
                      {isGroupPurchase && purchaseDetails.length > 0 && (
                        <button
                          onClick={() => showPurchaseDetails(purchase)}
                          className="text-xs text-blue-600 hover:text-blue-800 mt-1 flex items-center gap-1"
                        >
                          <ChevronRight className="w-3 h-3" />
                          {language === 'uz' ? 'Batafsil' : 'Подробнее'} ({purchaseDetails.length} {language === 'uz' ? 'tovar' : 'товаров'})
                        </button>
                      )}
                      {!isGroupPurchase && purchase.notes && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {purchase.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {purchase.quantity}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {purchase.purchasePrice.toLocaleString()} {language === 'uz' ? 'so\'m' : 'сум'}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                      {purchase.totalCost.toLocaleString()} {language === 'uz' ? 'so\'m' : 'сум'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {purchase.supplier || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(purchase)}
                          className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                          title={language === 'uz' ? 'Tahrirlash' : 'Редактировать'}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(purchase.id)}
                          className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          title={language === 'uz' ? 'O\'chirish' : 'Удалить'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Модальное окно с деталями групповой закупки */}
      {showDetailsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full p-6 max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="w-6 h-6 text-green-600" />
                {language === 'uz' ? 'Import tafsilotlari' : 'Детали импорта'}
              </h3>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedPurchaseDetails([]);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      №
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      {language === 'uz' ? 'Tovar nomi' : 'Название товара'}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      {language === 'uz' ? 'Miqdor' : 'Количество'}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      {language === 'uz' ? 'Narx' : 'Цена'}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      {language === 'uz' ? 'Jami' : 'Сумма'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {selectedPurchaseDetails.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                        {item.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right">
                        {item.price?.toLocaleString()} {language === 'uz' ? 'so\'m' : 'сўм'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white text-right">
                        {item.total?.toLocaleString()} {language === 'uz' ? 'so\'m' : 'сўм'}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-blue-50 dark:bg-blue-900/20 font-bold">
                    <td colSpan={2} className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {language === 'uz' ? 'Jami:' : 'Итого:'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right">
                      {selectedPurchaseDetails.reduce((sum, item) => sum + (item.quantity || 0), 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right">
                      —
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right">
                      {selectedPurchaseDetails.reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString()} {language === 'uz' ? 'so\'m' : 'сўм'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedPurchaseDetails([]);
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                {language === 'uz' ? 'Yopish' : 'Закрыть'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
