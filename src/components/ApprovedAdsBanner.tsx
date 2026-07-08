import { useState, useEffect, useRef } from 'react';
import api, { getImageUrl } from '../utils/api';

interface Advertisement {
  id: string;
  title: string;
  content: string;
  caption?: string;
  image_url?: string;
  link_url?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'; // 🆕 Добавлен cancelled
  ad_type: 'company' | 'product'; // 🆕 Тип рекламы
  company_id?: string;
  product_id?: string; // 🆕 ID товара для рекламы товара
  product_name?: string; // 🆕 Название товара
  product_price?: number; // 🆕 Цена товара
  product_image?: string; // 🆕 Фото товара
  created_at?: string;
}

interface ApprovedAdsBannerProps {
  onCompanyClick?: (companyId: string) => void;
  onProductClick?: (productId: string) => void; // 🆕 Обработчик клика на товар
}

export default function ApprovedAdsBanner({ onCompanyClick, onProductClick }: ApprovedAdsBannerProps) {
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadApprovedAds();
    
    // Автообновление каждые 30 секунд
    const interval = setInterval(loadApprovedAds, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadApprovedAds = async () => {
    try {
      console.log('📢 [Approved Ads Banner] Loading approved advertisements...');
      const result = await api.ads.list({ status: 'approved' });
      
      console.log('📢 [Approved Ads Banner] API Response:', result);
      
      if (result && result.ads && result.ads.length > 0) {
        console.log(`✅ [Approved Ads Banner] Loaded ${result.ads.length} approved ads`);
        setAds(result.ads);
      } else {
        console.log('⚠️ [Approved Ads Banner] No approved ads found');
        setAds([]);
      }
    } catch (error) {
      console.error('❌ [Approved Ads Banner] Error loading ads:', error);
      setAds([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdClick = (ad: Advertisement) => {
    console.log('🔗 Клик по рекламе:', ad);
    
    if (ad.ad_type === 'company' && ad.company_id && onCompanyClick) {
      // Реклама компании -> переход на профиль компании
      console.log('🏢 Открытие профиля компании:', ad.company_id);
      onCompanyClick(ad.company_id);
    } else if (ad.ad_type === 'product' && ad.product_id && onProductClick) {
      // Реклама товара -> переход на товар
      console.log('📦 Открытие товара:', ad.product_id);
      onProductClick(ad.product_id);
    }
  };

  if (loading || ads.length === 0) {
    return null; // Не показываем ничего если нет утвержденных реклам
  }

  return (
    <div className="mb-4 px-4">
      {/* Горизонтальная прокрутка рекламных баннеров */}
      <div 
        ref={scrollContainerRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {ads.map((ad) => (
          <div
            key={ad.id}
            onClick={() => handleAdClick(ad)}
            className={`flex-shrink-0 snap-start cursor-pointer group ${
              ad.ad_type === 'product' 
                ? 'w-[45%] sm:w-[30%] md:w-[23%] lg:w-[18%]' // Карточка товара - меньше и квадратная
                : 'w-[85%] sm:w-[45%] md:w-[32%] lg:w-[24%]' // Баннер компании - широкий
            }`}
          >
            {/* Карточка рекламы или товара */}
            <div className={`relative overflow-hidden shadow-lg transform transition-all duration-300 group-hover:scale-105 group-hover:shadow-2xl ${
              ad.ad_type === 'product'
                ? 'rounded-lg bg-white aspect-square' // Квадратная карточка для товара
                : 'rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 aspect-[16/9]' // Широкий баннер для компании
            }`}>
              {/* Определяем какую картинку показать */}
              {ad.ad_type === 'product' && ad.product_image ? (
                // Для рекламы товара - показываем фото товара
                <img
                  src={getImageUrl(ad.product_image) || ''}
                  alt={ad.product_name || ad.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : ad.image_url ? (
                // Для рекламы компании или если указан image_url
                <img
                  src={getImageUrl(ad.image_url) || ''}
                  alt={ad.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Если изображение не загрузилось, показываем градиент
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : null}
              
              {/* Градиент для текста - только для баннеров компании */}
              {ad.ad_type === 'company' && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              )}

              {/* Текст только для баннеров компании */}
              {ad.ad_type === 'company' && (
                <>
                  {/* Текст поверх баннера */}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    {ad.title && (
                      <h3 className="text-white font-bold text-sm mb-1 line-clamp-1 drop-shadow-lg">
                        {ad.title}
                      </h3>
                    )}
                    {ad.content && (
                      <p className="text-white/90 text-xs line-clamp-2 drop-shadow-lg">
                        {ad.content}
                      </p>
                    )}
                  </div>

                  {/* Бейдж "Реклама" */}
                  <div className="absolute top-2 right-2">
                    <span className="px-2 py-1 bg-white/90 backdrop-blur text-gray-700 rounded-lg text-[10px] font-medium">
                      🏢 Реклама
                    </span>
                  </div>
                </>
              )}
              
              {/* Для товаров - только маленький значок в углу */}
              {ad.ad_type === 'product' && (
                <div className="absolute top-2 right-2">
                  <span className="px-1.5 py-0.5 bg-purple-600 text-white rounded text-[9px] font-medium shadow-sm">
                    AD
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}