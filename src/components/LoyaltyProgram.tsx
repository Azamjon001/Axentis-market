import React, { useState, useEffect } from 'react';
import { Award, Gift, TrendingUp, Star, Crown, Zap, History } from 'lucide-react';


interface LoyaltyProgramProps {
  userPhone: string;
  userName?: string;
}

interface LoyaltyData {
  points: number;
  total_earned: number;
  total_spent: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
}

interface LoyaltyTransaction {
  id: string;
  type: string;
  points: number;
  description: string;
  created_at: string;
}

export default function LoyaltyProgram({ userPhone, userName }: LoyaltyProgramProps) {
  const [loyaltyData, setLoyaltyData] = useState<LoyaltyData | null>(null);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [promoCode, setPromoCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [applyingPromo, setApplyingPromo] = useState(false);

  useEffect(() => {
    loadLoyaltyData();
    loadTransactions();
  }, [userPhone]);

  const loadLoyaltyData = async () => {
    try {
      const response = await fetch(
        `/api/loyalty/${userPhone}`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setLoyaltyData(data.loyalty || {
          points: 0,
          total_earned: 0,
          total_spent: 0,
          tier: 'bronze'
        });
      }
    } catch (error) {
      console.error('Error loading loyalty data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    try {
      const response = await fetch(
        `/api/loyalty/${userPhone}/transactions`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const applyPromoCode = async () => {
    if (!promoCode.trim()) return;

    setApplyingPromo(true);
    try {
      const response = await fetch(
        `/api/promo-codes/validate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            code: promoCode,
            user_phone: userPhone
          })
        }
      );

      const data = await response.json();

      if (response.ok && data.valid) {
        alert(`✅ Промокод применён! ${data.message}`);
        setPromoCode('');
        loadLoyaltyData(); // Обновляем баллы
      } else {
        alert(`❌ ${data.error || 'Промокод недействителен'}`);
      }
    } catch (error) {
      console.error('Error applying promo code:', error);
      alert('❌ Ошибка применения промокода');
    } finally {
      setApplyingPromo(false);
    }
  };

  const getTierInfo = (tier: string) => {
    switch (tier) {
      case 'platinum':
        return {
          name: 'Платина',
          icon: <Crown className="w-8 h-8 text-purple-400" />,
          color: 'from-purple-500 to-purple-700',
          cashback: '10%',
          nextTier: null,
          pointsNeeded: 0
        };
      case 'gold':
        return {
          name: 'Золото',
          icon: <Star className="w-8 h-8 text-yellow-400" />,
          color: 'from-yellow-500 to-yellow-700',
          cashback: '7%',
          nextTier: 'Платина',
          pointsNeeded: 10000
        };
      case 'silver':
        return {
          name: 'Серебро',
          icon: <Award className="w-8 h-8 text-gray-400" />,
          color: 'from-gray-400 to-gray-600',
          cashback: '5%',
          nextTier: 'Золото',
          pointsNeeded: 5000
        };
      default:
        return {
          name: 'Бронза',
          icon: <Zap className="w-8 h-8 text-orange-400" />,
          color: 'from-orange-500 to-orange-700',
          cashback: '3%',
          nextTier: 'Серебро',
          pointsNeeded: 1000
        };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!loyaltyData) return null;

  const tierInfo = getTierInfo(loyaltyData.tier);
  const progressToNextTier = tierInfo.pointsNeeded > 0 
    ? (loyaltyData.points / tierInfo.pointsNeeded) * 100 
    : 100;

  return (
    <div className="space-y-6">
      {/* Карточка уровня */}
      <div className={`bg-gradient-to-br ${tierInfo.color} rounded-2xl p-8 text-white shadow-xl`}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm opacity-90">Программа лояльности</p>
            <h2 className="text-3xl font-bold mt-1">{userName || 'Пользователь'}</h2>
          </div>
          <div className="bg-white bg-opacity-20 rounded-full p-4">
            {tierInfo.icon}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-sm opacity-90">Ваш уровень</p>
            <p className="text-2xl font-bold">{tierInfo.name}</p>
          </div>
          <div>
            <p className="text-sm opacity-90">Кэшбэк</p>
            <p className="text-2xl font-bold">{tierInfo.cashback}</p>
          </div>
        </div>

        <div className="bg-white bg-opacity-20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm">Доступно баллов</span>
            <span className="text-2xl font-bold">{loyaltyData.points.toLocaleString()}</span>
          </div>
          
          {tierInfo.nextTier && (
            <>
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span>До уровня {tierInfo.nextTier}</span>
                  <span>{tierInfo.pointsNeeded - loyaltyData.points} баллов</span>
                </div>
                <div className="w-full bg-white bg-opacity-30 rounded-full h-2">
                  <div
                    className="bg-white rounded-full h-2 transition-all duration-500"
                    style={{ width: `${Math.min(progressToNextTier, 100)}%` }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Всего заработано</h3>
          </div>
          <p className="text-3xl font-bold text-green-600">{loyaltyData.total_earned.toLocaleString()}</p>
          <p className="text-sm text-gray-500 mt-1">баллов за всё время</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <Gift className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Всего потрачено</h3>
          </div>
          <p className="text-3xl font-bold text-purple-600">{loyaltyData.total_spent.toLocaleString()}</p>
          <p className="text-sm text-gray-500 mt-1">баллов за всё время</p>
        </div>
      </div>

      {/* Промокод */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Gift className="w-5 h-5 text-purple-600" />
          У вас есть промокод?
        </h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            placeholder="Введите промокод"
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
          <button
            onClick={applyPromoCode}
            disabled={!promoCode.trim() || applyingPromo}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            {applyingPromo ? 'Проверка...' : 'Применить'}
          </button>
        </div>
      </div>

      {/* История транзакций */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-blue-600" />
          История баллов
        </h3>
        
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <History className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p>История пока пуста</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.slice(0, 10).map(transaction => (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{transaction.description}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(transaction.created_at).toLocaleString('ru-RU')}
                  </p>
                </div>
                <div className={`text-lg font-bold ${
                  transaction.type === 'earned' || transaction.type === 'bonus'
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}>
                  {transaction.type === 'earned' || transaction.type === 'bonus' ? '+' : '-'}
                  {Math.abs(transaction.points)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Информация о программе */}
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Как это работает?</h3>
        <ul className="space-y-3">
          <li className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">1</div>
            <div>
              <p className="font-semibold text-gray-900">Зарабатывайте баллы</p>
              <p className="text-sm text-gray-600">Получайте {tierInfo.cashback} кэшбэка от каждой покупки</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm">2</div>
            <div>
              <p className="font-semibold text-gray-900">Повышайте уровень</p>
              <p className="text-sm text-gray-600">Чем больше покупаете, тем выше кэшбэк</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm">3</div>
            <div>
              <p className="font-semibold text-gray-900">Тратьте баллы</p>
              <p className="text-sm text-gray-600">1 балл = 1 сум при оплате заказа</p>
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
}


