import React, { useState, useEffect } from 'react';
import { ArrowLeft, CreditCard, CheckCircle, XCircle, Loader } from 'lucide-react';


interface PaymentPageProps {
  cart: CartItem[];
  totalPrice: number;
  userPhone?: string;
  userName?: string;
  userId?: string;
  onBack: () => void;
  onSuccess: () => void;
}

interface CartItem {
  id: number;
  name: string;
  price: number; // ⚡ ЭТО УЖЕ SELLING_PRICE (цена с наценкой)!
  quantity: number;
  selectedColor?: string;
  image?: string;
  markupPercent?: number; // 💰 НОВОЕ: Процент наценки
  markupAmount?: number; // 💰 НОВОЕ: Сумма наценки в деньгах
  base_price?: number; // 💰 НОВОЕ: Базовая цена без наценки
}

type PaymentMethod = 'payme' | 'click' | 'uzum' | null;
type CardSubtype = 'uzcard' | 'humo' | 'visa' | 'other' | null;
type PaymentStatus = 'selecting' | 'selecting_card_type' | 'processing' | 'checking' | 'success' | 'failed';

export default function PaymentPage({
  cart,
  totalPrice,
  userPhone,
  userName,
  userId,
  onBack,
  onSuccess
}: PaymentPageProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(null);
  const [selectedCardSubtype, setSelectedCardSubtype] = useState<CardSubtype>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('selecting');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isDemoMode, setIsDemoMode] = useState(false);

  const paymentMethods = [
    {
      id: 'payme' as const,
      name: 'Payme',
      icon: '💰',
      description: 'UzCard, Humo, Visa, MasterCard',
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: 'click' as const,
      name: 'Click',
      icon: '🔵',
      description: 'UzCard, Humo, все карты',
      color: 'from-cyan-500 to-cyan-600'
    },
    {
      id: 'uzum' as const,
      name: 'Uzum',
      icon: '🟠',
      description: 'Uzum карты и кошелёк',
      color: 'from-orange-500 to-orange-600'
    }
  ];

  // Создание заказа
  const createOrder = async () => {
    try {
      const response = await fetch(
        `/api/create-order`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: userId || 'guest',
            userName,
            userPhone,
            items: cart.map(item => ({
              id: item.id.toString(),
              name: item.name,
              price: item.base_price || item.price, // 💰 Базовая цена без наценки
              price_with_markup: item.price, // 💰 Цена продажи (с наценкой)
              markupPercent: item.markupPercent || 0, // 💰 Процент наценки
              markupAmount: item.markupAmount || 0, // 💰 Сумма наценки за 1 штуку
              quantity: item.quantity,
              color: item.selectedColor,
              image: item.image
            })),
            totalAmount: totalPrice
          })
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create order');
      }

      return data.order.id;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  };

  // Создание платежа
  const createPayment = async (method: PaymentMethod) => {
    if (!method) return;

    setPaymentStatus('processing');
    setErrorMessage('');

    try {
      // Создаём заказ
      const newOrderId = await createOrder();
      setOrderId(newOrderId);

      // Создаём платёж
      const response = await fetch(
        `/api/create-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            orderId: newOrderId,
            method,
            cardSubtype: selectedCardSubtype // 💳 ДОБАВЛЕНО: Подтип карты
          })
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create payment');
      }

      setIsDemoMode(data.payment.demo || false);

      if (data.payment.demo) {
        // Демо режим - имитируем успешную оплату
        setPaymentStatus('checking');
        setTimeout(() => {
          checkPaymentStatus(newOrderId);
        }, 2000);
      } else {
        // Реальный платёж - редирект
        if (data.payment.checkoutUrl) {
          window.location.href = data.payment.checkoutUrl;
        } else {
          throw new Error('No checkout URL provided');
        }
      }
    } catch (error) {
      console.error('Error creating payment:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Ошибка при создании платежа');
      setPaymentStatus('failed');
    }
  };

  // Проверка статуса платежа
  const checkPaymentStatus = async (checkOrderId: string) => {
    try {
      const response = await fetch(
        `/api/check-payment/${checkOrderId}`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to check payment');
      }

      if (data.order.status === 'paid') {
        setTransactionId(data.order.transactionId);
        setPaymentStatus('success');
        
        // Через 3 секунды вызываем onSuccess
        setTimeout(() => {
          onSuccess();
        }, 3000);
      } else if (data.order.status === 'failed') {
        setPaymentStatus('failed');
        setErrorMessage('Платёж отклонён');
      } else {
        // Всё ещё pending - проверяем снова через 2 секунды
        setTimeout(() => {
          checkPaymentStatus(checkOrderId);
        }, 2000);
      }
    } catch (error) {
      console.error('Error checking payment:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Ошибка при проверке статуса');
      setPaymentStatus('failed');
    }
  };

  // Обработка нажатия на способ оплаты
  const handleMethodSelect = (method: PaymentMethod) => {
    setSelectedMethod(method);
    // Переходим к выбору типа карты
    setPaymentStatus('selecting_card_type');
  };

  // Обработка выбора подтипа карты
  const handleCardSubtypeSelect = (subtype: CardSubtype) => {
    setSelectedCardSubtype(subtype);
  };

  // Обработка подтверждения оплаты
  const handleConfirmPayment = () => {
    if (selectedMethod && selectedCardSubtype) {
      createPayment(selectedMethod);
    }
  };
  
  // Вернуться к выбору способа оплаты
  const handleBackToMethodSelection = () => {
    setPaymentStatus('selecting');
    setSelectedCardSubtype(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            {(paymentStatus === 'selecting' || paymentStatus === 'selecting_card_type') && (
              <button 
                onClick={paymentStatus === 'selecting_card_type' ? handleBackToMethodSelection : onBack} 
                className="p-2 hover:bg-gray-100 rounded-full transition"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            )}
            <h1>Оплата заказа</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Сумма заказа */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="text-center">
            <div className="text-gray-500 mb-2">Сумма к оплате</div>
            <div className="text-4xl font-bold text-blue-600 mb-2">
              {totalPrice.toLocaleString()} сум
            </div>
            <div className="text-sm text-gray-500">
              Товаров: {cart.reduce((sum, item) => sum + item.quantity, 0)} шт.
            </div>
          </div>
        </div>

        {/* Статусы */}
        {paymentStatus === 'selecting' && (
          <>
            {/* Выбор способа оплаты */}
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
              <h2 className="text-xl mb-4">Выберите способ оплаты</h2>
              
              <div className="space-y-3">
                {paymentMethods.map(method => (
                  <button
                    key={method.id}
                    onClick={() => handleMethodSelect(method.id)}
                    className={`w-full p-4 rounded-xl border-2 transition-all ${
                      selectedMethod === method.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`text-4xl bg-gradient-to-br ${method.color} w-16 h-16 rounded-xl flex items-center justify-center shadow-lg`}>
                        <span className="text-2xl">{method.icon}</span>
                      </div>
                      <div className="flex-1 text-left">
                        <div className="text-lg font-medium">{method.name}</div>
                        <div className="text-sm text-gray-500">{method.description}</div>
                      </div>
                      {selectedMethod === method.id && (
                        <CheckCircle className="w-6 h-6 text-blue-600" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Информация о безопасности */}
            <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-2xl p-6 mb-6">
              <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Безопасная оплата
              </h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Шифрование данных карты</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Защита покупателя</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Возврат средств при необходимости</span>
                </li>
              </ul>
            </div>

            {/* Поддерживаемые карты */}
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
              <h3 className="text-sm text-gray-500 mb-3">Поддерживаемые карты:</h3>
              <div className="flex flex-wrap gap-3">
                <div className="px-4 py-2 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg text-sm font-medium">
                  💳 UzCard
                </div>
                <div className="px-4 py-2 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg text-sm font-medium">
                  💳 Humo
                </div>
                <div className="px-4 py-2 bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-lg text-sm font-medium">
                  💳 Visa
                </div>
                <div className="px-4 py-2 bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg text-sm font-medium">
                  💳 MasterCard
                </div>
              </div>
            </div>

            {/* Кнопка оплаты */}
            <button
              onClick={handleMethodSelect.bind(null, selectedMethod)}
              disabled={!selectedMethod}
              className={`w-full py-4 rounded-xl font-medium text-white transition-all ${
                selectedMethod
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:shadow-lg'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              {selectedMethod ? 'Далее: выбрать тип карты' : 'Выберите способ оплаты'}
            </button>
          </>
        )}

        {/* Выбор типа карты */}
        {paymentStatus === 'selecting_card_type' && (
          <>
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
              <h2 className="text-xl mb-2">Выбран способ: {selectedMethod === 'payme' ? 'Payme' : selectedMethod === 'click' ? 'Click' : 'Uzum'}</h2>
              <p className="text-gray-500 mb-4">Выберите тип карты для оплаты</p>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleCardSubtypeSelect('uzcard')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedCardSubtype === 'uzcard'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-3xl mb-2">💳</div>
                    <div className="font-medium">UzCard</div>
                    {selectedCardSubtype === 'uzcard' && (
                      <CheckCircle className="w-5 h-5 text-blue-600 mx-auto mt-2" />
                    )}
                  </div>
                </button>

                <button
                  onClick={() => handleCardSubtypeSelect('humo')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedCardSubtype === 'humo'
                      ? 'border-green-600 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-3xl mb-2">💚</div>
                    <div className="font-medium">Humo</div>
                    {selectedCardSubtype === 'humo' && (
                      <CheckCircle className="w-5 h-5 text-green-600 mx-auto mt-2" />
                    )}
                  </div>
                </button>

                <button
                  onClick={() => handleCardSubtypeSelect('visa')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedCardSubtype === 'visa'
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-3xl mb-2">💎</div>
                    <div className="font-medium">Visa</div>
                    {selectedCardSubtype === 'visa' && (
                      <CheckCircle className="w-5 h-5 text-indigo-600 mx-auto mt-2" />
                    )}
                  </div>
                </button>

                <button
                  onClick={() => handleCardSubtypeSelect('other')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedCardSubtype === 'other'
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-3xl mb-2">💼</div>
                    <div className="font-medium">Другая</div>
                    {selectedCardSubtype === 'other' && (
                      <CheckCircle className="w-5 h-5 text-purple-600 mx-auto mt-2" />
                    )}
                  </div>
                </button>
              </div>
            </div>

            {/* Кнопка подтверждения */}
            <button
              onClick={handleConfirmPayment}
              disabled={!selectedCardSubtype}
              className={`w-full py-4 rounded-xl font-medium text-white transition-all ${
                selectedCardSubtype
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:shadow-lg'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              {selectedCardSubtype ? `Оплатить ${totalPrice.toLocaleString()} сум` : 'Выберите тип карты'}
            </button>
          </>
        )}

        {/* Processing */}
        {paymentStatus === 'processing' && (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <Loader className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
            <h2 className="text-2xl font-medium mb-2">Создание платежа...</h2>
            <p className="text-gray-500">Пожалуйста, подождите</p>
          </div>
        )}

        {/* Checking */}
        {paymentStatus === 'checking' && (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <Loader className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
            <h2 className="text-2xl font-medium mb-2">Проверка оплаты...</h2>
            <p className="text-gray-500">Ожидаем подтверждение</p>
            {isDemoMode && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  🎬 Демо режим - имитация успешной оплаты
                </p>
              </div>
            )}
          </div>
        )}

        {/* Success */}
        {paymentStatus === 'success' && (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-medium mb-2">Оплата успешна!</h2>
            <p className="text-gray-500 mb-4">Спасибо за покупку!</p>
            
            {orderId && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="text-sm text-gray-500 mb-1">Номер заказа</div>
                <div className="font-mono text-lg">{orderId.slice(-12)}</div>
              </div>
            )}
            
            {transactionId && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="text-sm text-gray-500 mb-1">ID транзакции</div>
                <div className="font-mono text-sm">{transactionId}</div>
              </div>
            )}

            {isDemoMode && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  🎬 Демо режим - реальные платежи пока не настроены
                </p>
              </div>
            )}
            
            <p className="text-sm text-gray-500 mt-4">
              Перенаправление на главную страницу...
            </p>
          </div>
        )}

        {/* Failed */}
        {paymentStatus === 'failed' && (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-12 h-12 text-red-600" />
            </div>
            <h2 className="text-2xl font-medium mb-2">Ошибка оплаты</h2>
            <p className="text-gray-500 mb-6">{errorMessage || 'Произошла ошибка при обработке платежа'}</p>
            
            <button
              onClick={() => {
                setPaymentStatus('selecting');
                setSelectedMethod(null);
                setErrorMessage('');
              }}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"
            >
              Попробовать снова
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


