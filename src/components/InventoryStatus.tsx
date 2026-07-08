import React from 'react';
import { CheckCircle, AlertTriangle, Package, ShoppingCart, Trash2, Shield } from 'lucide-react';

interface InventoryStatusProps {
  onClose?: () => void;
}

export default function InventoryStatus({ onClose }: InventoryStatusProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Package className="w-8 h-8 text-green-600" />
          <h2 className="text-2xl">Статус системы склада</h2>
        </div>
        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm">
          ✅ Все работает
        </span>
      </div>

      {/* Main Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Feature 1 */}
        <div className="border border-green-200 rounded-lg p-4 bg-green-50">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-green-900 mb-1">Проверка при создании заказа</h3>
              <p className="text-sm text-green-700">
                Система проверяет наличие товаров ПЕРЕД созданием заказа. 
                Невозможно купить то, чего нет на складе.
              </p>
            </div>
          </div>
        </div>

        {/* Feature 2 */}
        <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
          <div className="flex items-start gap-3">
            <Trash2 className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-blue-900 mb-1">Автоудаление при quantity = 0</h3>
              <p className="text-sm text-blue-700">
                Товары с нулевым количеством автоматически удаляются 
                из базы данных Supabase.
              </p>
            </div>
          </div>
        </div>

        {/* Feature 3 */}
        <div className="border border-orange-200 rounded-lg p-4 bg-orange-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-orange-900 mb-1">Проверка при подтверждении</h3>
              <p className="text-sm text-orange-700">
                Перед списанием товаров система заново проверяет их наличие. 
                Если товара нет - заказ отменяется.
              </p>
            </div>
          </div>
        </div>

        {/* Feature 4 */}
        <div className="border border-purple-200 rounded-lg p-4 bg-purple-50">
          <div className="flex items-start gap-3">
            <Shield className="w-6 h-6 text-purple-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-purple-900 mb-1">Автоочистка заказов</h3>
              <p className="text-sm text-purple-700">
                При загрузке заказов система автоматически отменяет 
                те, для которых товара больше нет.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <h3 className="mb-3">🔄 Как работает двойная покупка:</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="bg-white w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
            <span>На складе: iPhone (количество = 1)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-white w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
            <span>Покупатель А оформляет заказ ✅</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-white w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
            <span>Покупатель Б тоже оформляет заказ ✅</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-green-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">4</span>
            <span className="text-green-700">Компания подтверждает заказ А → iPhone удален из базы</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-orange-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">5</span>
            <span className="text-orange-700">Компания открывает заказы → Заказ Б автоматически отменен</span>
          </div>
        </div>
      </div>

      {/* Technical Details */}
      <div className="border-t pt-4">
        <h3 className="text-sm mb-2">💻 Технические детали:</h3>
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
          <div>✓ Проверки на сервере</div>
          <div>✓ Работает в Supabase</div>
          <div>✓ Race conditions обработаны</div>
          <div>✓ Подробные логи</div>
          <div>✓ Автоматическое удаление</div>
          <div>✓ Автоматическая отмена</div>
        </div>
      </div>

      {/* Close Button */}
      {onClose && (
        <button
          onClick={onClose}
          className="mt-4 w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          Понятно, спасибо! ✅
        </button>
      )}
    </div>
  );
}
