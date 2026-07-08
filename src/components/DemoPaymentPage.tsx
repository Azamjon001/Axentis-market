import React, { useState, useEffect } from 'react';
import { ArrowLeft, CreditCard, CheckCircle, Sparkles, Wallet } from 'lucide-react';


interface DemoPaymentPageProps {
  cart: CartItem[];
  totalPrice: number;
  userPhone?: string;
  userName?: string;
  onBack: () => void;
  onSuccess: () => void;
}

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  selectedColor?: string;
  image?: string;
}

type PaymentStep = 'method' | 'card' | 'processing' | 'success';

export default function DemoPaymentPage({
  cart,
  totalPrice,
  userPhone,
  userName,
  onBack,
  onSuccess
}: DemoPaymentPageProps) {
  const [step, setStep] = useState<PaymentStep>('method');
  const [selectedMethod, setSelectedMethod] = useState<'payme' | 'click' | 'uzum' | null>(null);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCVC, setCardCVC] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [virtualBalance] = useState(999999999); // Бесконечный баланс!
  const [saveCard, setSaveCard] = useState(true); // Сохранять карту по умолчанию

  const paymentMethods = [
    {
      id: 'payme' as const,
      name: 'Payme',
      icon: '💰',
      description: 'UzCard, Humo, Visa, MasterCard',
      color: 'from-blue-500 to-blue-600',
      logo: '💳'
    },
    {
      id: 'click' as const,
      name: 'Click',
      icon: '🔵',
      description: 'UzCard, Humo, все карты',
      color: 'from-cyan-500 to-cyan-600',
      logo: '💳'
    },
    {
      id: 'uzum' as const,
      name: 'Uzum',
      icon: '🟠',
      description: 'Uzum карты и кошелёк',
      color: 'from-orange-500 to-orange-600',
      logo: '🛍️'
    }
  ];

  const handleMethodSelect = (method: typeof selectedMethod) => {
    setSelectedMethod(method);
    setStep('card');
  };

  const formatCardNumber = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 16);
    const groups = numbers.match(/.{1,4}/g) || [];
    return groups.join(' ');
  };

  const formatExpiry = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 4);
    if (numbers.length >= 3) {
      return numbers.slice(0, 2) + '/' + numbers.slice(2);
    }
    return numbers;
  };

  const handlePay = async () => {
    setStep('processing');
    
    const userId = userPhone || 'guest';
    const lastFour = cardNumber.replace(/\s/g, '').slice(-4);
    const [expiryMonth, expiryYear] = cardExpiry.split('/');
    
    // Определяем тип карты
    const number = cardNumber.replace(/\s/g, '');
    let cardType = 'uzcard';
    if (number.startsWith('8600')) cardType = 'uzcard';
    else if (number.startsWith('9860')) cardType = 'humo';
    else if (number.startsWith('4')) cardType = 'visa';
    else if (number.startsWith('5')) cardType = 'mastercard';
    
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      console.log('🚀 [DEMO PAY] Начинаем обработку платежа...');
      console.log('💰 [DEMO PAY] Сумма:', totalPrice);
      console.log('📦 [DEMO PAY] Товаров в корзине:', cart.length);
      
      // 1️⃣ ⚡ ПРОВЕРЯЕМ наличие товаров ПЕРЕД покупкой!
      console.log('📦 [DEMO PAY] Проверка наличия товаров...');
      const insufficientItems = [];
      const productsData = [];
      
      // Сначала проверяем все товары
      for (const item of cart) {
        const response = await fetch(
          `/api/products/${item.id}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (response.ok) {
          const { product } = await response.json();
          productsData.push({ item, product });
          
          // Проверяем достаточно ли товара
          if (product.quantity < item.quantity) {
            insufficientItems.push({
              name: item.name,
              requested: item.quantity,
              available: product.quantity
            });
          }
        } else {
          console.error(`❌ [DEMO PAY] Не удалось получить товар ${item.id}`);
          insufficientItems.push({
            name: item.name,
            requested: item.quantity,
            available: 0
          });
        }
      }
      
      // Если товаров недостаточно - НЕ ДАЁМ КУПИТЬ!
      if (insufficientItems.length > 0) {
        console.error('❌ [DEMO PAY] Недостаточно товара на складе:', insufficientItems);
        alert(`❌ Ошибка! Недостаточно товара на складе:\n\n${
          insufficientItems.map(i => `${i.name}: запрошено ${i.requested}, доступно ${i.available}`).join('\n')
        }`);
        setStep('method');
        return;
      }
      
      // 2️⃣ Списываем товары со склада
      console.log('📦 [DEMO PAY] Списание товаров со склада...');
      const salesItems = [];
      
      for (const { item, product } of productsData) {
        const newQuantity = Math.max(0, product.quantity - item.quantity);
        
        // Списываем товар
        const updateResponse = await fetch(
            `/api/products/${item.id}`,
            {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
     
              },
              body: JSON.stringify({
                quantity: newQuantity
              })
            }
          );
          
          if (updateResponse.ok) {
            console.log(`✅ [DEMO PAY] Товар "${item.name}" списан: ${product.quantity} → ${newQuantity}`);
          } else {
            console.error(`❌ [DEMO PAY] Ошибка списания товара "${item.name}"`);
          }
          
          // Рассчитываем закупочную цену и наценку на основе процента
          const markupPercent = product.markupPercent || 30; // По умолчанию 30%
          const purchasePrice = Math.round(product.price / (1 + markupPercent / 100));
          const markupAmount = product.price - purchasePrice; // 🔥 Наценка за одну единицу
          
          console.log(`💵 [DEMO PAY] Товар "${item.name}": цена=${product.price}, наценка=${markupPercent}% (${markupAmount} сум), закупка=${purchasePrice}`);
          
          // Добавляем в список для sales_history
          salesItems.push({
            product_id: item.id,
            name: item.name,
            price: product.price,
            quantity: item.quantity,
            color: item.selectedColor,
            purchase_price: purchasePrice,
            markupPercent: markupPercent,
            markupAmount: markupAmount // 🔥 ДОБАВЛЕНО: Наценка за единицу товара!
          });
      }
      
      // 3️⃣ Сохраняем карту если пользователь выбрал
      if (saveCard && userPhone) {
        console.log('💳 [DEMO PAY] Сохранение карты...');
        const saveCardResponse = await fetch(
          `/api/save-card`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
         
            },
            body: JSON.stringify({
              userId: userPhone,
              cardNumber: cardNumber.replace(/\s/g, ''),
              expiryMonth,
              expiryYear,
              holderName: cardHolder
            })
          }
        );
        
        if (saveCardResponse.ok) {
          console.log('✅ [DEMO PAY] Карта сохранена: •••• ' + lastFour);
        } else {
          console.error('❌ [DEMO PAY] Ошибка сохранения карты');
        }
      }
      
      // 4️⃣ Сохраняем историю платежа
      console.log('📊 [DEMO PAY] Сохранение истории платежа...');
      const historyResponse = await fetch(
        `/api/save-payment-history`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
     
          },
          body: JSON.stringify({
            orderId,
            userId,
            userName,
            userPhone,
            cardLastFour: lastFour,
            cardType,
            amount: totalPrice,
            status: 'paid',
            method: selectedMethod,
            items: cart.map(item => ({
              id: item.id,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              color: item.selectedColor
            }))
          })
        }
      );
      
      if (historyResponse.ok) {
        console.log('✅ [DEMO PAY] История платежа сохранена');
      } else {
        console.error('❌ [DEMO PAY] Ошибка сохранения истории платежа');
      }
      
      // 4️⃣ Добавляем в историю продаж для аналитики компании
      console.log('📈 [DEMO PAY] Добавление в историю продаж...');
      const companyId = 1; // ID главной компании
      
      if (salesItems.length > 0) {
        // 💰 Рассчитываем общую прибыль от наценок
        const totalMarkupEarnings = salesItems.reduce((sum, item) => {
          const markupPerItem = item.markupAmount || 0;
          const quantity = item.quantity || 0;
          const itemProfit = markupPerItem * quantity;
          console.log(`   💵 ${item.name}: наценка ${markupPerItem} сум × ${quantity} шт = ${itemProfit} сум прибыли`);
          return sum + itemProfit;
        }, 0);
        
        console.log('📈 [DEMO PAY] 💰 ОБЩАЯ ПРИБЫЛЬ ОТ НАЦЕНОК:', totalMarkupEarnings, 'сум');
        console.log('📈 [DEMO PAY] Отправка данных продажи:', {
          company_id: companyId,
          items: salesItems,
          total_amount: totalPrice,
          total_markup_earnings: totalMarkupEarnings
        });
        
        const salesResponse = await fetch(
          `/api/sales-history`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              company_id: companyId,
              items: salesItems,
              total_amount: totalPrice,
              total_markup_earnings: totalMarkupEarnings
            })
          }
        );
        
        if (salesResponse.ok) {
          const salesData = await salesResponse.json();
          console.log('✅ [DEMO PAY] Продажа добавлена в аналитику компании:', salesData);
        } else {
          const errorText = await salesResponse.text();
          console.error('❌ [DEMO PAY] Ошибка добавления продажи:', errorText);
        }
      } else {
        console.warn('⚠️ [DEMO PAY] Нет товаров для добавления в sales_history');
      }
      
      console.log('🎉 [DEMO PAY] Все операции завершены!');
      
    } catch (error) {
      console.error('❌ [DEMO PAY] Критическая ошибка:', error);
    }
    
    // Имитация обработки платежа (всегда успешно!)
    setTimeout(() => {
      setStep('success');
      
      // Через 3 секунды возвращаемся
      setTimeout(() => {
        onSuccess();
      }, 3000);
    }, 2000);
  };

  const isCardValid = cardNumber.replace(/\s/g, '').length === 16 && 
                       cardExpiry.length === 5 && 
                       cardCVC.length === 3 &&
                       cardHolder.trim().length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 pb-20">
      {/* Demo Badge */}
      <div className="fixed top-4 right-4 z-50">
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-pulse">
          <Sparkles className="w-4 h-4" />
          <span className="text-sm font-medium">ДЕМО РЕЖИМ</span>
        </div>
      </div>

      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            {step === 'method' && (
              <button onClick={onBack} className="p-2 hover:bg-white/20 rounded-full transition">
                <ArrowLeft className="w-6 h-6" />
              </button>
            )}
            {step === 'card' && (
              <button onClick={() => setStep('method')} className="p-2 hover:bg-white/20 rounded-full transition">
                <ArrowLeft className="w-6 h-6" />
              </button>
            )}
            <h1 className="text-white">Онлайн оплата</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Virtual Balance Banner */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 mb-6 text-white shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wallet className="w-6 h-6" />
              <span className="text-sm opacity-90">Виртуальный баланс</span>
            </div>
            <div className="text-xs bg-white/20 px-3 py-1 rounded-full">
              ∞ Бесконечно
            </div>
          </div>
          <div className="text-3xl font-bold mb-2">
            {virtualBalance.toLocaleString()} сум
          </div>
          <div className="text-sm opacity-90">
            ✨ В демо режиме у вас бесконечные деньги!
          </div>
        </div>

        {/* Сумма заказа */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="text-center">
            <div className="text-gray-500 mb-2">Сумма к оплате</div>
            <div className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
              {totalPrice.toLocaleString()} сум
            </div>
            <div className="text-sm text-gray-500">
              Товаров: {cart.reduce((sum, item) => sum + item.quantity, 0)} шт.
            </div>
          </div>
        </div>

        {/* Step 1: Выбор способа */}
        {step === 'method' && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl mb-4">Выберите способ оплаты</h2>
            
            <div className="space-y-3">
              {paymentMethods.map(method => (
                <button
                  key={method.id}
                  onClick={() => handleMethodSelect(method.id)}
                  className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-purple-400 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className={`text-4xl bg-gradient-to-br ${method.color} w-16 h-16 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                      <span className="text-2xl">{method.icon}</span>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-lg font-medium">{method.name}</div>
                      <div className="text-sm text-gray-500">{method.description}</div>
                      <div className="text-xs text-green-600 mt-1">✓ Виртуальные деньги • Всегда успешно</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Ввод карты */}
        {step === 'card' && selectedMethod && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl mb-4">Введите данные карты</h2>

            {/* Карточка */}
            <div className={`bg-gradient-to-br ${paymentMethods.find(m => m.id === selectedMethod)?.color} rounded-2xl p-6 mb-6 text-white shadow-xl`}>
              <div className="flex justify-between items-start mb-8">
                <div className="text-2xl">💳</div>
                <div className="text-sm opacity-90">
                  {selectedMethod === 'payme' ? 'Payme' : selectedMethod === 'click' ? 'Click' : 'Uzum'}
                </div>
              </div>
              
              <div className="mb-6 font-mono text-xl tracking-wider">
                {cardNumber || '•••• •••• •••• ••••'}
              </div>
              
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-xs opacity-75 mb-1">Владелец карты</div>
                  <div className="text-sm">{cardHolder || 'YOUR NAME'}</div>
                </div>
                <div>
                  <div className="text-xs opacity-75 mb-1">Срок</div>
                  <div className="text-sm">{cardExpiry || 'MM/YY'}</div>
                </div>
              </div>
            </div>

            {/* Поля ввода */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm text-gray-600 mb-2">Номер карты</label>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  placeholder="1234 5678 9012 3456"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none font-mono text-lg"
                  maxLength={19}
                />
                <p className="text-xs text-gray-500 mt-1">
                  💡 Можете ввести любую карту - в демо режиме все карты работают!
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Срок действия</label>
                  <input
                    type="text"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                    placeholder="MM/YY"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none font-mono"
                    maxLength={5}
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">CVC/CVV</label>
                  <input
                    type="text"
                    value={cardCVC}
                    onChange={(e) => setCardCVC(e.target.value.replace(/\D/g, '').slice(0, 3))}
                    placeholder="123"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none font-mono"
                    maxLength={3}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-2">Имя владельца</label>
                <input
                  type="text"
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                  placeholder="JOHN DOE"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none uppercase"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={saveCard}
                  onChange={(e) => setSaveCard(e.target.checked)}
                  className="mr-2"
                />
                <label className="text-sm text-gray-600">Сохранить кару для будущих покупок</label>
              </div>
            </div>

            {/* Кнопка оплаты */}
            <button
              onClick={handlePay}
              disabled={!isCardValid}
              className={`w-full py-4 rounded-xl font-medium text-white transition-all ${
                isCardValid
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:shadow-lg'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              {isCardValid ? `Оплатить ${totalPrice.toLocaleString()} сум` : 'Заполните все поля'}
            </button>

            {/* Подсказка */}
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                🎬 <strong>Демо режим:</strong> Оплата всегда проходит успешно! Вы можете ввести любые данные.
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Обработка */}
        {step === 'processing' && (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="relative">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full animate-spin mx-auto mb-6" style={{ 
                animation: 'spin 1s linear infinite',
                background: 'conic-gradient(from 0deg, #9333ea, #ec4899, #9333ea)'
              }}></div>
              <CreditCard className="w-10 h-10 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <h2 className="text-2xl font-medium mb-2">Обработка платежа...</h2>
            <p className="text-gray-500">Подождите пару секунд</p>
            <div className="mt-4 text-sm text-purple-600">
              ✨ Проверяем виртуальный баланс...
            </div>
          </div>
        )}

        {/* Step 4: Успех */}
        {step === 'success' && (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-medium mb-2">Оплата успешна!</h2>
            <p className="text-gray-500 mb-4">Спасибо за покупку!</p>
            
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 mb-4">
              <div className="text-sm text-gray-500 mb-1">Оплачено через</div>
              <div className="text-lg font-medium">
                {selectedMethod === 'payme' ? '💰 Payme' : selectedMethod === 'click' ? '🔵 Click' : '🟠 Uzum'}
              </div>
              <div className="text-2xl font-bold text-purple-600 mt-2">
                {totalPrice.toLocaleString()} сум
              </div>
            </div>

            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                ✅ Товар автоматически списан со склада компании
              </p>
            </div>

            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                🎬 Это была демо-оплата с виртуальными деньгами
              </p>
            </div>
            
            <p className="text-sm text-gray-500 mt-4">
              Перенаправление на главную...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}


