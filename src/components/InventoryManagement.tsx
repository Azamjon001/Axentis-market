import React, { useState, useEffect } from 'react';
import { Package, AlertTriangle, TrendingDown, History, Search, Filter } from 'lucide-react';

interface InventoryManagementProps {
  companyId: number;
}

interface Product {
  id: number;
  name: string;
  quantity: number;
  price: number;
  purchase_price?: number;
  category?: string;
  low_stock_threshold?: number;
}

interface PriceHistory {
  id: string;
  product_id: string;
  old_price: number;
  new_price: number;
  old_markup_percent?: number;
  new_markup_percent?: number;
  changed_at: string;
  change_reason?: string;
}

export default function InventoryManagement({ companyId }: InventoryManagementProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'low_stock' | 'out_of_stock'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
  }, [companyId, filterType]);

  useEffect(() => {
    if (selectedProduct) {
      loadPriceHistory(selectedProduct.id);
    }
  }, [selectedProduct]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(
        `/api/products?company_id=${companyId}`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const allProducts = data.products || [];
        setProducts(allProducts);

        // Определяем товары с низким остатком
        const lowStock = allProducts.filter((p: Product) => {
          const threshold = p.low_stock_threshold || 10;
          return p.quantity > 0 && p.quantity <= threshold;
        });
        setLowStockProducts(lowStock);

        // Создаём уведомления для товаров с низким остатком
        if (lowStock.length > 0) {
          createLowStockNotifications(lowStock);
        }
      }
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const createLowStockNotifications = async (products: Product[]) => {
    for (const product of products) {
      try {
        await fetch(
          `/api/notifications`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              recipient_type: 'company',
              recipient_id: companyId.toString(),
              type: 'low_stock',
              title: `⚠️ Низкий остаток: ${product.name}`,
              message: `Осталось только ${product.quantity} шт. Рекомендуем пополнить запасы.`,
              priority: product.quantity <= 3 ? 'urgent' : 'high',
              data: { product_id: product.id, quantity: product.quantity }
            })
          }
        );
      } catch (error) {
        console.error('Error creating notification:', error);
      }
    }
  };

  const loadPriceHistory = async (productId: number) => {
    try {
      const response = await fetch(
        `/api/products/${productId}/price-history`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPriceHistory(data.history || []);
      }
    } catch (error) {
      console.error('Error loading price history:', error);
    }
  };

  const updateLowStockThreshold = async (productId: number, threshold: number) => {
    try {
      const response = await fetch(
        `/api/products/${productId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            low_stock_threshold: threshold
          })
        }
      );

      if (response.ok) {
        loadProducts(); // Перезагружаем список
        alert('✅ Порог обновлён');
      }
    } catch (error) {
      console.error('Error updating threshold:', error);
      alert('❌ Ошибка обновления');
    }
  };

  const filteredProducts = products
    .filter(p => {
      // Фильтр по типу
      if (filterType === 'low_stock') {
        const threshold = p.low_stock_threshold || 10;
        return p.quantity > 0 && p.quantity <= threshold;
      }
      if (filterType === 'out_of_stock') {
        return p.quantity === 0;
      }
      return true;
    })
    .filter(p => {
      // Фильтр по поиску
      if (!searchQuery) return true;
      return p.name.toLowerCase().includes(searchQuery.toLowerCase());
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Заголовок и статистика */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="w-6 h-6 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Всего товаров</h3>
          </div>
          <p className="text-3xl font-bold text-blue-600">{products.length}</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-6 h-6 text-orange-600" />
            <h3 className="font-semibold text-gray-900">Низкий остаток</h3>
          </div>
          <p className="text-3xl font-bold text-orange-600">{lowStockProducts.length}</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingDown className="w-6 h-6 text-red-600" />
            <h3 className="font-semibold text-gray-900">Нет на складе</h3>
          </div>
          <p className="text-3xl font-bold text-red-600">
            {products.filter(p => p.quantity === 0).length}
          </p>
        </div>
      </div>

      {/* Поиск и фильтры */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск товаров..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filterType === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Все
            </button>
            <button
              onClick={() => setFilterType('low_stock')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filterType === 'low_stock'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Мало
            </button>
            <button
              onClick={() => setFilterType('out_of_stock')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filterType === 'out_of_stock'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Нет
            </button>
          </div>
        </div>
      </div>

      {/* Список товаров */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Товар
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Остаток
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Порог
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Цена
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Статус
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.map(product => {
                const threshold = product.low_stock_threshold || 10;
                const isLowStock = product.quantity > 0 && product.quantity <= threshold;
                const isOutOfStock = product.quantity === 0;

                return (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{product.name}</div>
                      {product.category && (
                        <div className="text-sm text-gray-500">{product.category}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-lg font-semibold ${
                        isOutOfStock ? 'text-red-600' : isLowStock ? 'text-orange-600' : 'text-green-600'
                      }`}>
                        {product.quantity} шт
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="number"
                        value={threshold}
                        onChange={(e) => updateLowStockThreshold(product.id, parseInt(e.target.value) || 10)}
                        className="w-20 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-gray-900">{product.price.toLocaleString()} ₸</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {isOutOfStock ? (
                        <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          Нет на складе
                        </span>
                      ) : isLowStock ? (
                        <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800">
                          Заканчивается
                        </span>
                      ) : (
                        <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          В наличии
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => setSelectedProduct(product)}
                        className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                      >
                        <History className="w-4 h-4" />
                        История
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* История изменения цен */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">
                  История цен: {selectedProduct.name}
                </h3>
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {priceHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <History className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p>История изменений пока пуста</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {priceHistory.map(record => (
                    <div key={record.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm text-gray-500">
                            {new Date(record.changed_at).toLocaleString('ru-RU')}
                          </p>
                          {record.change_reason && (
                            <p className="text-sm text-gray-600 mt-1">
                              Причина: {record.change_reason}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-sm text-gray-500">Старая цена</p>
                          <p className="text-lg font-semibold text-red-600">
                            {record.old_price.toLocaleString()} ₸
                          </p>
                        </div>
                        <div className="text-gray-400">→</div>
                        <div>
                          <p className="text-sm text-gray-500">Новая цена</p>
                          <p className="text-lg font-semibold text-green-600">
                            {record.new_price.toLocaleString()} ₸
                          </p>
                        </div>
                      </div>
                      {record.old_markup_percent !== undefined && (
                        <div className="flex items-center gap-4 mt-2">
                          <div>
                            <p className="text-xs text-gray-500">Старая наценка</p>
                            <p className="text-sm font-medium">{record.old_markup_percent}%</p>
                          </div>
                          <div className="text-gray-400">→</div>
                          <div>
                            <p className="text-xs text-gray-500">Новая наценка</p>
                            <p className="text-sm font-medium">{record.new_markup_percent}%</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


