import { useState, useEffect } from 'react';
import { X, MapPin, Package, Star, Heart, UserPlus, UserCheck, Users, TrendingUp, Navigation } from 'lucide-react';
import api, { getImageUrl } from '../utils/api';
// Wired to the existing backend POST /api/companies/:id/rate.
const rateCompany = async (companyId: any, userPhone: string, rating: number) =>
  api.companies.rate(companyId, userPhone, rating);

import { useCompanyProfile, useCompanyProducts, invalidateCompanyProfile } from '../utils/cache';
import ProductCardSimple from './ProductCardSimple';
import { toast } from 'sonner@2.0.3';

interface CompanyProfileProps {
  companyId: number;
  customerId: string; // Телефон покупателя
  onClose: () => void;
  onProductClick?: (product: Product) => void;
}

interface Product {
  id: number;
  name: string;
  price: number;
  barcode: string;
  quantity: number;
  category?: string;
  image_url?: string;
  images?: { url: string; id?: number }[];
  markupPercent?: number;
  sellingPrice?: number;
  company_name?: string;
  company_id?: number;
}

// 🎨 Иконки категорий
const CATEGORY_ICONS: { [key: string]: string } = {
  'Все': '🛒',
  'Канцтовары': '✏️',
  'Электроника': '💻',
  'Продукты': '🍎',
  'Одежда': '👕',
  'Обувь': '👟',
  'Косметика': '💄',
  'Книги': '📚',
  'Игрушки': '🧸',
  'Спорт': '⚽',
  'Мебель': '🪑',
  'Бытовая техника': '🔌',
  'Автотовары': '🚗',
  'Строительство': '🔨',
  'Сад': '🌻',
};

export default function CompanyProfile({ companyId, customerId, onClose, onProductClick }: CompanyProfileProps) {
  // 🚀 Кэшированные данные
  const { data: profileData, isLoading: profileLoading } = useCompanyProfile(companyId);
  const { data: cachedProducts = [], isLoading: productsLoading, refetch: refetchProducts } = useCompanyProducts(companyId);
  
  const [selectedRating, setSelectedRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  
  // 🆕 Фильтр по категориям
  const [selectedCategory, setSelectedCategory] = useState<string>('Все');
  
  // 🆕 Состояние подписки
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribersCount, setSubscribersCount] = useState(0);

  // Извлекаем данные компании из кэша
  const company = profileData?.company;
  const loading = profileLoading;

  // 🔍 Получаем все уникальные категории из товаров
  const categories = ['Все', ...Array.from(new Set(cachedProducts.map((p: Product) => p.category).filter(Boolean)))];

  // 🔍 Фильтруем товары по категории
  const filteredProducts = selectedCategory === 'Все'
    ? cachedProducts
    : cachedProducts.filter((p: Product) => p.category === selectedCategory);

  useEffect(() => {
    loadUserRating();
    loadSubscriptionStatus();
  }, [companyId]);

  // 💰 Функция для расчета цены с наценкой
  const getPriceWithMarkup = (product: Product): number => {
    if (product.sellingPrice && product.sellingPrice > 0) {
      return product.sellingPrice;
    }
    
    const basePrice = product.price || 0;
    const markupPercent = product.markupPercent || 0;
    
    if (markupPercent > 0) {
      const markupAmount = Math.round((basePrice * markupPercent) / 100);
      return basePrice + markupAmount;
    }
    
    return basePrice;
  };

  // 🆕 Загружаем оценку пользователя
  const loadUserRating = async () => {
    try {
      const response = await fetch(
        `/api/companies/${companyId}/my-rating?customer_id=${customerId}`,
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );
      const data = await response.json();
      if (data.success && data.rating > 0) {
        setSelectedRating(data.rating);
      }
    } catch (error) {
      console.error('Ошибка загрузки оценки:', error);
    }
  };

  // 🆕 Загружаем статус подписки
  const loadSubscriptionStatus = async () => {
    try {
      const response = await fetch(
        `/api/companies/${companyId}/subscription?customer_id=${customerId}`,
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );
      const data = await response.json();
      if (data.success) {
        setIsSubscribed(data.isSubscribed);
        setSubscribersCount(data.subscribersCount);
      }
    } catch (error) {
      console.error('Ошибка загрузки подписки:', error);
    }
  };


  // 🆕 Обработчик подписки/отписки
  const handleSubscribe = async () => {
    try {
      const action = isSubscribed ? 'unsubscribe' : 'subscribe';
      const response = await fetch(
        `/api/companies/${companyId}/subscription`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ customer_id: customerId, action })
        }
      );
      
      const data = await response.json();
      if (data.success) {
        setIsSubscribed(!isSubscribed);
        setSubscribersCount(prev => isSubscribed ? prev - 1 : prev + 1);
        toast.success(isSubscribed ? '❌ Вы отписались' : '✅ Вы подписались!');
      }
    } catch (error) {
      console.error('Ошибка при подписке:', error);
      toast.error('Ошибка при подписке');
    }
  };

  const handleRate = async (rating: number) => {
    try {
      await rateCompany(companyId, customerId, rating);
      setSelectedRating(rating);
      toast.success('✅ Спасибо за вашу оценку!');
    } catch (error) {
      console.error('Ошибка при оценке:', error);
      toast.error('❌ Ошибка при сохранении оценки');
    }
  };

  const handleProductClick = (product: Product) => {
    if (onProductClick) {
      onProductClick(product);
    }
    onClose();
  };

  // ️ Функция открытия карты
  const handleOpenMap = () => {
    if (company.latitude && company.longitude) {
      // Открываем Google Maps с меткой
      const url = `https://www.google.com/maps?q=${company.latitude},${company.longitude}`;
      window.open(url, '_blank');
    } else {
      toast.error('Локация компании не указана');
    }
  };

  if (loading || !company) {
    return null;
  }

  const averageRating = company.rating || 0;
  const totalRatings = company.total_ratings || 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full h-full sm:max-w-4xl sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 sm:p-6 relative flex-shrink-0">
          {/* Логотип в верхнем левом углу */}
          <div className="absolute top-4 left-4 w-16 h-16 rounded-full bg-white border-4 border-white shadow-lg overflow-hidden">
            {company.logoUrl ? (
              <img 
                src={getImageUrl(company.logoUrl) || ''} 
                alt={company.name} 
                className="w-full h-full object-cover" 
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement!.innerHTML = `<div class="w-full h-full bg-purple-600 flex items-center justify-center text-white text-xl font-bold">${company.name.charAt(0)}</div>`;
                }}
              />
            ) : (
              <div className="w-full h-full bg-purple-600 flex items-center justify-center text-white text-xl font-bold">
                {company.name.charAt(0)}
              </div>
            )}
          </div>
          
          {/* Кнопка закрытия */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition"
          >
            <X className="w-6 h-6" />
          </button>
          
          {/* Название компании */}
          <div className="mt-16 mb-3">
            <h2 className="text-3xl font-bold mb-2">{company.name}</h2>
            
            {/* Кнопка Локация под названием */}
            {company.latitude && company.longitude && (
              <button
                onClick={handleOpenMap}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
              >
                <MapPin className="w-4 h-4" />
                <span className="text-sm font-medium">Локация</span>
              </button>
            )}
          </div>

          {/* Статистика компании в 3 колонки */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col items-center gap-0.5 bg-white/10 rounded-lg p-2">
              <Star className="w-4 h-4 text-yellow-400" />
              <div className="text-[10px] opacity-80">Рейтинг</div>
              <div className="text-base font-bold">{averageRating.toFixed(1)}</div>
            </div>
            <div className="flex flex-col items-center gap-0.5 bg-white/10 rounded-lg p-2">
              <Package className="w-4 h-4" />
              <div className="text-[10px] opacity-80">Товаров</div>
              <div className="text-base font-bold">{company.available_products || 0}</div>
            </div>
            <div className="flex flex-col items-center gap-0.5 bg-white/10 rounded-lg p-2">
              <Users className="w-4 h-4" />
              <div className="text-[10px] opacity-80">Подписчиков</div>
              <div className="text-base font-bold">{subscribersCount}</div>
            </div>
          </div>

          {/* Кнопка подписки */}
          <button
            onClick={handleSubscribe}
            className={`w-full mt-4 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition ${
              isSubscribed
                ? 'bg-white/20 hover:bg-white/30'
                : 'bg-white text-purple-600 hover:bg-gray-100'
            }`}
          >
            {isSubscribed ? <UserCheck className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            {isSubscribed ? 'Вы подписаны' : 'Подписаться'}
          </button>
        </div>

        {/* Категории товаров */}
        {categories.length > 1 && (
          <div className="border-b border-gray-200 bg-white flex-shrink-0 overflow-x-auto p-4">
            <div className="flex gap-2 min-w-max">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition ${
                    selectedCategory === category
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span className="text-lg">{CATEGORY_ICONS[category] || '📦'}</span>
                  <span className="font-medium">{category}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    selectedCategory === category ? 'bg-white/20' : 'bg-gray-200'
                  }`}>
                    {category === 'Все' 
                      ? cachedProducts.length 
                      : cachedProducts.filter((p: Product) => p.category === category).length
                    }
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Контент - Товары */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Товары не найдены</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {filteredProducts.map((product: Product) => (
                <ProductCardSimple
                  key={product.id}
                  product={product}
                  onClick={() => handleProductClick(product)}
                  getPriceWithMarkup={getPriceWithMarkup}
                />
              ))}
            </div>
          )}
        </div>

        {/* Оценить компанию - внизу */}
        <div className="bg-gray-50 border-t border-gray-200 p-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm text-gray-900 mb-1 flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-500" />
                Оцените компанию
              </h4>
              <p className="text-xs text-gray-500">Ваша оценка помогает другим покупателям</p>
            </div>
            
            {/* Звезды для оценки */}
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => handleRate(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-8 h-8 ${
                      star <= (hoveredRating || selectedRating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
          
          {selectedRating > 0 && (
            <div className="text-center mt-2 text-sm text-green-600">
              ✅ Вы поставили {selectedRating} звезд
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


