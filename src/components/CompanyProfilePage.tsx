import { useState, useEffect } from 'react';
import { ArrowLeft, Search, Star, BadgeCheck, TrendingUp, Package, Heart, Users, ThumbsUp, ShoppingBag, MapPin, ShieldCheck, Plus, Check } from 'lucide-react';
import api, { getImageUrl } from '../utils/api';
// TODO: Company rating/subscriptions not yet in new API
// import { rateCompany } from '../utils/api-old-supabase.tsx.backup';

import { useCompanyProfile, useCompanyProducts } from '../utils/cache';
import { toast } from 'sonner';
import { LinkifiedText } from './LinkifiedText'; // 🆕 Компонент для ссылок

interface Product {
  id: number;
  name: string;
  quantity: number;
  price: number;
  markupPercent?: number;
  availableForCustomers?: boolean;
  images?: string[]; // 📸 Массив путей к изображениям товара
  hasColorOptions?: boolean;
  company_id?: number;
  category?: string;
  sellingPrice?: number;
}

interface CompanyProfilePageProps {
  companyId: number;
  onBack: () => void;
  onProductClick: (product: Product) => void;
  isNight: boolean;
  likedProductIds: number[];
  cart: { [key: number]: number };
  customerId?: string;
}

// 🎨 Компонент карточки товара со скроллом фотографий
function ProductCardWithScroll({
  product,
  onClick,
  isLiked,
  cartQuantity,
  formatPrice,
  getPriceWithMarkup,
  isNight,
  textColor,
  cardBg,
  secondaryText
}: {
  product: Product;
  onClick: () => void;
  isLiked: boolean;
  cartQuantity: number;
  formatPrice: (price: number) => string;
  getPriceWithMarkup: (product: Product) => number;
  isNight: boolean;
  textColor: string;
  cardBg: string;
  secondaryText: string;
}) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const images = product.images && product.images.length > 0 
    ? product.images.map(img => getImageUrl(img) || img) 
    : [];

  const handleImageScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = e.currentTarget.scrollLeft;
    const width = e.currentTarget.offsetWidth;
    const index = Math.round(scrollLeft / width);
    setCurrentImageIndex(index);
  };

  return (
    <div
      className={`${cardBg} rounded-xl overflow-hidden border ${isNight ? 'border-gray-800' : 'border-gray-200'} cursor-pointer active:scale-95 transition-transform`}
    >
      {/* Контейнер для фото со скроллом */}
      <div className="relative">
        <div 
          className={`aspect-square ${isNight ? 'bg-gray-800' : 'bg-gray-100'} overflow-x-auto no-scrollbar flex snap-x snap-mandatory`}
          onScroll={handleImageScroll}
        >
          {images.length > 0 ? (
            images.map((imageUrl, idx) => (
              <div 
                key={idx} 
                className="w-full h-full flex-shrink-0 snap-center"
                onClick={onClick}
              >
                <img
                  src={imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ))
          ) : (
            <div className="w-full h-full flex items-center justify-center flex-shrink-0" onClick={onClick}>
              <Package className={`w-12 h-12 ${secondaryText}`} />
            </div>
          )}
        </div>

        {/* Индикаторы точек */}
        {images.length > 1 && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
            {images.map((_, idx) => (
              <div
                key={idx}
                className={`w-1.5 h-1.5 rounded-full transition ${
                  idx === currentImageIndex 
                    ? 'bg-white' 
                    : 'bg-white/40'
                }`}
              />
            ))}
          </div>
        )}

        {/* Лайк */}
        {isLiked && (
          <div className="absolute top-2 right-2">
            <Heart className="w-4 h-4 fill-red-500 text-red-500" />
          </div>
        )}

        {/* Корзина */}
        {cartQuantity > 0 && (
          <div className="absolute top-2 left-2 bg-[#C0BCBC] text-white px-2 py-0.5 rounded-md text-xs font-medium">
            {cartQuantity}
          </div>
        )}
      </div>
      
      {/* Информация */}
      <div className="p-3" onClick={onClick}>
        <h4 className={`text-sm font-medium ${textColor} line-clamp-2 mb-1 min-h-[2.5rem]`}>
          {product.name}
        </h4>
        <p className={`text-sm font-semibold ${textColor}`}>
          {formatPrice(getPriceWithMarkup(product))}
        </p>
      </div>
    </div>
  );
}

export default function CompanyProfilePage({
  companyId,
  onBack,
  onProductClick,
  isNight,
  likedProductIds,
  cart,
  customerId
}: CompanyProfilePageProps) {
  const { data: profileData, isLoading: profileLoading } = useCompanyProfile(companyId);
  const { data: cachedProducts = [] } = useCompanyProducts(companyId);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribersCount, setSubscribersCount] = useState(0);
  // const [profileViews, setProfileViews] = useState(0); // Not used - backend endpoints not implemented
  const [selectedCategory, setSelectedCategory] = useState<string>('Все');
  const [selectedRating, setSelectedRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);

  // API может вернуть профиль как { company: {...} } или плоским объектом — поддерживаем оба
  const company = profileData?.company || profileData;
  const loading = profileLoading;

  const categories: string[] = ['Все', ...Array.from(new Set(cachedProducts.map((p: Product) => p.category).filter(Boolean))) as string[]];

  const SUBS_KEY = 'subscribedCompanies';

  useEffect(() => {
    // 👁️ Засчитываем просмотр магазина (счётчик view_count на бэкенде)
    api.companies.trackView(companyId).catch(() => {});
    // 👥 Актуальное число подписчиков
    api.companies.getStats(String(companyId))
      .then((s: any) => setSubscribersCount(Number(s?.subscribers ?? 0)))
      .catch(() => {});
    // 🔔 Подписан ли текущий покупатель (хранится локально, как в приложении)
    try {
      const subs: number[] = JSON.parse(localStorage.getItem(SUBS_KEY) || '[]');
      setIsSubscribed(subs.includes(companyId));
    } catch { /* ignore */ }
  }, [companyId, customerId]);

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

  // ⚠️ Временно отключено - backend endpoint'ы не реализованы
  // const loadUserRating = async () => {
  //   if (!customerId) return;
  //   try {
  //     const response = await fetch(
  //       `/api/companies/${companyId}/my-rating?customer_id=${customerId}`,
  //       { headers: { 'Content-Type': 'application/json' } }
  //     );
  //     const data = await response.json();
  //     if (data.success && data.rating > 0) {
  //       setSelectedRating(data.rating);
  //     }
  //   } catch (error) {
  //     console.error('Ошибка загрузки оценки:', error);
  //   }
  // };

  // const loadSubscriptionStatus = async () => {
  //   if (!customerId) return;
  //   try {
  //     const response = await fetch(
  //       `/api/companies/${companyId}/subscription?customer_id=${customerId}`,
  //       { headers: { 'Content-Type': 'application/json' } }
  //     );
  //     const data = await response.json();
  //     if (data.success) {
  //       setIsSubscribed(data.isSubscribed);
  //       setSubscribersCount(data.subscribersCount);
  //     }
  //   } catch (error) {
  //     console.error('Ошибка загрузки подписки:', error);
  //   }
  // };

  // const loadProfileViews = async () => {
  //   try {
  //     const response = await fetch(
  //       `/api/companies/${companyId}/profile-views`,
  //       { headers: { 'Content-Type': 'application/json' } }
  //     );
  //     const data = await response.json();
  //     if (data.success) {
  //       setProfileViews(data.views);
  //     }
  //   } catch (error) {
  //     console.error('Ошибка загрузки просмотров:', error);
  //   }
  // };

  // const incrementProfileViews = async () => {
  //   if (!customerId) return;
  //   try {
  //     const response = await fetch(
  //       `/api/companies/${companyId}/profile-view`,
  //       {
  //         method: 'POST',
  //         headers: { 
  //           'Content-Type': 'application/json',
  //         },
  //         body: JSON.stringify({ customer_id: customerId })
  //       }
  //     );
  //     const data = await response.json();
  //     if (data.success) {
  //       setProfileViews(data.views);
  //     }
  //   } catch (error) {
  //     console.error('Ошибка при увеличении просмотров профиля:', error);
  //   }
  // };

  const handleSubscribe = async () => {
    if (!customerId) {
      toast.error('Требуется авторизация');
      return;
    }
    const willSubscribe = !isSubscribed;
    try {
      if (willSubscribe) {
        await api.companies.subscribe(companyId, customerId);
      } else {
        await api.companies.unsubscribe(companyId, customerId);
      }
      // Локально запоминаем подписку (как в мобильном приложении)
      try {
        const subs: number[] = JSON.parse(localStorage.getItem(SUBS_KEY) || '[]');
        const next = willSubscribe ? [...new Set([...subs, companyId])] : subs.filter(id => id !== companyId);
        localStorage.setItem(SUBS_KEY, JSON.stringify(next));
      } catch { /* ignore */ }
      setIsSubscribed(willSubscribe);
      setSubscribersCount(prev => Math.max(0, willSubscribe ? prev + 1 : prev - 1));
      toast.success(willSubscribe ? 'Вы подписались' : 'Вы отписались');
    } catch (error) {
      console.error('Ошибка при подписке:', error);
      toast.error('Ошибка при подписке');
    }
  };

  const handleRate = async (rating: number) => {
    if (!customerId) {
      toast.error('Требуется авторизация');
      return;
    }
    try {
      await api.companies.rate(companyId, customerId, rating);
      setSelectedRating(rating);
      toast.success('Спасибо за вашу оценку');
    } catch (error) {
      console.error('Ошибка при оценке:', error);
      toast.error('Ошибка при сохранении оценки');
    }
  };

  // const handleOpenMap = () => {
  //   if (company?.latitude && company?.longitude) {
  //     const url = `https://www.google.com/maps?q=${company.latitude},${company.longitude}`;
  //     window.open(url, '_blank');
  //   } else {
  //     toast.error('Локация компании не указана');
  //   }
  // };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('uz-UZ').format(price) + ' сум';
  };

  const filteredByCategory = selectedCategory === 'Все'
    ? cachedProducts
    : cachedProducts.filter((p: Product) => p.category === selectedCategory);

  const filteredProducts = filteredByCategory.filter((product: Product) =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const topProducts = cachedProducts.slice(0, 4);

  if (loading || !company) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F7F9]">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-[#C0BCBC] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">Загрузка...</p>
        </div>
      </div>
    );
  }

  const averageRating = company.rating || 0;
  const totalRatings = company.total_ratings || 0;

  const textColor = isNight ? 'text-white' : 'text-black';
  const bgColor = isNight ? 'bg-[#08090D]' : 'bg-white';
  const cardBg = isNight ? 'bg-[#171C2A]' : 'bg-[#F6F7F9]';
  const secondaryText = isNight ? 'text-gray-400' : 'text-gray-500';

  // 🎨 Палитра Homepage (CompanyStoreScreen)
  const hp = {
    bg: isNight ? '#08090D' : '#FFFFFF',
    surface: isNight ? 'rgba(20,24,38,0.6)' : 'rgba(255,255,255,0.72)',
    text: isNight ? '#FFFFFF' : '#0B0E16',
    textSec: isNight ? '#9CA3AF' : '#5B6472',
    textMuted: isNight ? '#6B7280' : '#9AA1AE',
    border: isNight ? 'rgba(255,255,255,0.08)' : 'rgba(11,14,22,0.08)',
    primary: '#6D5DFB',
    primaryDark: '#5546E0',
    star: '#F5B50A',
    divider: isNight ? 'rgba(255,255,255,0.06)' : 'rgba(11,14,22,0.06)',
  };
  const coverUrl = (company as any).coverUrl ? getImageUrl((company as any).coverUrl) : '';
  const coverVideoUrl = (company as any).coverVideoUrl ? getImageUrl((company as any).coverVideoUrl) : '';
  const logoUrl = (company as any).logoUrl ? getImageUrl((company as any).logoUrl) : '';
  const positivePct = averageRating > 0 ? Math.round((averageRating / 5) * 100) : null;
  const subsLabel = subscribersCount >= 1000 ? `${(subscribersCount / 1000).toFixed(1)}K` : String(subscribersCount);
  // ✅ Значок «Проверенный магазин» выдаёт админ (is_verified), рейтинг на него не влияет
  const verified = !!((company as any).isVerified || (company as any).verified);

  return (
    <div className="h-screen relative" style={{ background: hp.bg }}>
      {/* Прозрачная шапка поверх обложки (как в Homepage) */}
      <div
        className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)', paddingBottom: 12 }}
      >
        <button onClick={onBack} className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.32)' }}>
          <ArrowLeft className="w-[22px] h-[22px] text-white" />
        </button>
        <h1 className="text-[17px] font-bold text-white truncate max-w-[55%] text-center" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
          {company.name}
        </h1>
        <div className="w-10 h-10" />
      </div>

      <div className="h-full overflow-y-auto">
        <div className="max-w-2xl mx-auto pb-6">
          {/* ── Обложка ── */}
          <div className="relative" style={{ height: 300, overflow: 'hidden' }}>
            {coverVideoUrl ? (
              <video key={coverVideoUrl} src={coverVideoUrl} className="w-full h-full object-cover" autoPlay muted loop playsInline />
            ) : coverUrl ? (
              <img src={coverUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full" style={{ background: `${hp.primary}22` }} />
            )}
            {/* Затемнение сверху для читаемости шапки */}
            <div className="absolute top-0 left-0 right-0" style={{ height: 150, background: 'linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0.15) 45%, transparent)' }} />
            {/* Низ обложки растворяется в фоне */}
            <div className="absolute bottom-0 left-0 right-0" style={{ height: 180, background: `linear-gradient(to top, ${hp.bg}, ${hp.bg}CC 32%, transparent)` }} />
          </div>

          {/* ── Карточка 1: логотип + имя + рейтинг ── */}
          <div className="mx-4 -mt-16 relative z-10 rounded-3xl p-4 flex items-center gap-3.5" style={{ backgroundColor: hp.surface, border: `1px solid ${hp.border}`, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
            {logoUrl ? (
              <img src={logoUrl} alt="" className="w-[72px] h-[72px] rounded-full object-cover flex-shrink-0" style={{ border: `1px solid ${hp.border}` }} />
            ) : (
              <div className="w-[72px] h-[72px] rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: hp.primary }}>
                <span className="text-2xl font-extrabold text-white">{company.name?.charAt(0).toUpperCase() || '?'}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-xl font-extrabold truncate" style={{ color: hp.text }}>{company.name}</h2>
                {verified && <BadgeCheck className="w-[18px] h-[18px] flex-shrink-0" style={{ color: '#3B82F6' }} />}
              </div>
              {(company as any).address && (
                <div className="flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: hp.textMuted }} />
                  <span className="text-[13px] truncate" style={{ color: hp.textMuted }}>{(company as any).address}</span>
                </div>
              )}
              {verified && (
                <div className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.10)' }}>
                  <ShieldCheck className="w-3 h-3" style={{ color: '#3B82F6' }} />
                  <span className="text-[11px] font-bold" style={{ color: '#3B82F6' }}>Магазин подтверждён</span>
                </div>
              )}
            </div>
            <div className="text-center pl-2 flex-shrink-0">
              <div className="flex items-center gap-1 justify-center">
                <Star className="w-[18px] h-[18px]" style={{ color: hp.star, fill: hp.star }} />
                <span className="text-2xl font-extrabold" style={{ color: hp.text }}>{averageRating.toFixed(1)}</span>
              </div>
              <div className="text-[11px] font-semibold mt-0.5 leading-tight" style={{ color: hp.textMuted }}>Рейтинг<br />магазина</div>
            </div>
          </div>

          {/* ── Карточка 2: статистика + подписка ── */}
          <div className="mx-4 mt-3.5 rounded-3xl p-4" style={{ backgroundColor: hp.surface, border: `1px solid ${hp.border}`, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
            <div className="flex items-center">
              <div className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: `${hp.primary}1A`, border: `1px solid ${hp.primary}3A` }}>
                  <ShoppingBag className="w-5 h-5" style={{ color: '#8B7FFF' }} />
                </div>
                <span className="text-[22px] font-extrabold" style={{ color: hp.text }}>{cachedProducts.length}</span>
                <span className="text-[11px] font-semibold" style={{ color: hp.textMuted }}>товаров</span>
              </div>
              <div style={{ width: 1, alignSelf: 'stretch', margin: '8px 0', background: hp.divider }} />
              <div className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.23)' }}>
                  <Users className="w-5 h-5" style={{ color: '#5C9BFF' }} />
                </div>
                <span className="text-[22px] font-extrabold" style={{ color: hp.text }}>{subsLabel}</span>
                <span className="text-[11px] font-semibold" style={{ color: hp.textMuted }}>подписчиков</span>
              </div>
              <div style={{ width: 1, alignSelf: 'stretch', margin: '8px 0', background: hp.divider }} />
              <div className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.23)' }}>
                  <ThumbsUp className="w-5 h-5" style={{ color: '#3DDC84' }} />
                </div>
                <span className="text-[22px] font-extrabold" style={{ color: hp.text }}>{positivePct != null ? `${positivePct}%` : '—'}</span>
                <span className="text-[11px] font-semibold text-center leading-tight" style={{ color: hp.textMuted }}>положительных<br />отзывов</span>
              </div>
            </div>

            <button
              onClick={handleSubscribe}
              className="w-full mt-4 py-4 rounded-2xl flex items-center justify-center gap-2.5 font-bold transition-transform active:scale-[0.98]"
              style={isSubscribed
                ? { background: isNight ? '#1B2233' : '#F2F3F6', color: hp.textSec, border: `1px solid ${hp.border}` }
                : { background: `linear-gradient(135deg, ${hp.primary}, ${hp.primaryDark})`, color: '#FFFFFF' }}
            >
              {isSubscribed ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              {isSubscribed ? 'Вы подписаны' : 'Подписаться'}
            </button>

            {/* ⭐ Оценка магазина покупателем */}
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="text-[13px] font-semibold" style={{ color: hp.textMuted }}>
                {selectedRating > 0 ? 'Ваша оценка:' : 'Оцените магазин:'}
              </span>
              <div className="flex items-center gap-1" onMouseLeave={() => setHoveredRating(0)}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleRate(star)}
                    onMouseEnter={() => setHoveredRating(star)}
                    className="transition-transform active:scale-90"
                    aria-label={`Оценить на ${star}`}
                  >
                    <Star
                      className="w-6 h-6"
                      style={{
                        color: star <= (hoveredRating || selectedRating) ? hp.star : hp.textMuted,
                        fill: star <= (hoveredRating || selectedRating) ? hp.star : 'transparent',
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Описание товаров компании */}
          {company.productsDescription && (
            <div className="mx-4 mt-3.5 rounded-2xl p-4" style={{ backgroundColor: hp.surface, border: `1px solid ${hp.border}` }}>
              <div className="text-xs font-bold mb-2" style={{ color: hp.textMuted }}>📝 О ТОВАРАХ</div>
              <LinkifiedText
                text={company.productsDescription}
                className="text-sm whitespace-pre-wrap"
                linkClassName="underline font-medium"
              />
            </div>
          )}

          {/* ПОИСК - ПЕРЕМЕЩЁН ВВЕРХ */}
          <div className="px-4 mt-4">
            <div className={`${cardBg} rounded-xl px-4 py-3 flex items-center gap-3 border ${isNight ? 'border-gray-800' : 'border-gray-200'}`}>
              <Search className={`w-5 h-5 ${secondaryText} flex-shrink-0`} />
              <input
                type="text"
                placeholder="Поиск товаров"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`flex-1 outline-none ${textColor} ${cardBg} placeholder-gray-400 min-w-0`}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className={`${secondaryText} hover:text-gray-600 flex-shrink-0`}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* КАТЕГОРИИ */}
          {categories.length > 1 && (
            <div className="px-4 mt-4">
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition flex-shrink-0 ${
                      selectedCategory === category
                        ? 'bg-[#C0BCBC] text-white'
                        : `${isNight ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-700'} border ${isNight ? 'border-gray-700' : 'border-gray-200'}`
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TOP ТОВАРЫ */}
          {topProducts.length > 0 && (
            <div className="px-4 mt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-sm font-semibold ${textColor}`}>Популярные товары</h3>
                <TrendingUp className={`w-4 h-4 ${secondaryText}`} />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {topProducts.map((product: Product) => (
                  <ProductCardWithScroll
                    key={product.id}
                    product={product}
                    onClick={() => onProductClick(product)}
                    isLiked={likedProductIds.includes(product.id)}
                    cartQuantity={cart[product.id] || 0}
                    formatPrice={formatPrice}
                    getPriceWithMarkup={getPriceWithMarkup}
                    isNight={isNight}
                    textColor={textColor}
                    cardBg={cardBg}
                    secondaryText={secondaryText}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ВСЕ ТОВАРЫ */}
          <div className="px-4 mt-6 pb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className={`text-sm font-semibold ${textColor}`}>Все товары</h3>
              <span className={`text-xs ${secondaryText}`}>{filteredProducts.length}</span>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="text-center py-12">
                <Search className={`w-12 h-12 ${secondaryText} mx-auto mb-3`} />
                <p className={`${secondaryText} text-sm`}>Товары не найдены</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredProducts.map((product: Product) => (
                  <ProductCardWithScroll
                    key={product.id}
                    product={product}
                    onClick={() => onProductClick(product)}
                    isLiked={likedProductIds.includes(product.id)}
                    cartQuantity={cart[product.id] || 0}
                    formatPrice={formatPrice}
                    getPriceWithMarkup={getPriceWithMarkup}
                    isNight={isNight}
                    textColor={textColor}
                    cardBg={cardBg}
                    secondaryText={secondaryText}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CSS для скрытия scrollbar */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}


