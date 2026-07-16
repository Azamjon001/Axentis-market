import { useState, useEffect } from 'react';
import { ArrowLeft, Share2, Star, ChevronDown, ChevronUp, Store, Send, Package, User, CheckCircle, Heart, ShoppingCart } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import api, { getImageUrl } from '../utils/api';
import { LinkifiedText } from './LinkifiedText';
import ProductQA from './ProductQA';
import { toast } from 'sonner';

interface Product {
  id: number;
  name: string;
  price: number;
  quantity: number;
  markupPercent?: number;
  images?: Array<{ url: string; }>;
  description?: string;
  hasColorOptions?: boolean;
  company_id?: number;
}

interface Variant {
  id: number;
  color: string;
  size: string;
  price: number;
  markupPercent: number;
  stockQuantity: number;
  sellingPrice?: number;
}

interface ProductDetailsProps {
  product: Product;
  onBack: () => void;
  onAddToCart: (product: Product) => void;
  onBuyNow: (product: Product) => void;
  isNight: boolean;
  cartQuantity: number;
  formatPrice: (price: number) => string;
  getPriceWithMarkup: (product: Product) => number;
  getProductDiscount?: (product: Product) => any;
  getOriginalPrice?: (product: Product) => number;
  onViewCompany: (companyId: number) => void;
  userPhone?: string;
  userName?: string;
  onUserClick?: (phone: string, name: string) => void;
  isLiked?: boolean;
  onToggleLike?: (productId: number) => void;
  onVariantChange?: (productId: number, color: string, size: string, stock: number) => void;
  onGoToCart?: () => void; // 🛒 Быстрый переход в корзину из шапки
  cartCount?: number;      // Всего товаров в корзине (для бейджа)
}

interface Review {
  id: number;
  user_name: string;
  user_phone: string;
  rating: number;
  comment: string;
  created_at: string;
  avatar_url?: string;
}

export default function ProductDetails({
  product,
  onBack,
  onAddToCart,
  onBuyNow,
  isNight,
  cartQuantity,
  formatPrice,
  getPriceWithMarkup,
  getProductDiscount,
  getOriginalPrice,
  onViewCompany,
  userPhone,
  userName,
  onUserClick,
  isLiked,
  onToggleLike,
  onVariantChange,
  onGoToCart,
  cartCount = 0,
}: ProductDetailsProps) {
  const [descriptionOpen, setDescriptionOpen] = useState(true);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [companyName, setCompanyName] = useState<string>('Загрузка...');
  const [isCompanyLoading, setIsCompanyLoading] = useState(true);

  const [userRating, setUserRating] = useState(5);
  const [userComment, setUserComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Variant selection
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [variantsLoading, setVariantsLoading] = useState(false);

  const discount = getProductDiscount ? getProductDiscount(product) : null;
  const hasDiscount = discount && discount.discountPercent > 0;

  // Derive the active variant (matches selected color + size)
  const activeVariant = variants.find(
    v => (!selectedColor || v.color === selectedColor) && (!selectedSize || v.size === selectedSize)
  ) || null;

  // Effective price: variant selling price > variant base * markup > product price
  const effectivePrice = activeVariant
    ? (activeVariant.sellingPrice && activeVariant.sellingPrice > activeVariant.price
        ? activeVariant.sellingPrice
        : activeVariant.price * (1 + (activeVariant.markupPercent || 0) / 100))
    : getPriceWithMarkup(product);

  const effectiveStock = activeVariant ? activeVariant.stockQuantity : product.quantity;

  const originalPrice = getOriginalPrice ? getOriginalPrice(product) : effectivePrice;
  const isBelowCost = effectivePrice < product.price;

  // Derived color and size lists from variants
  const uniqueColors = [...new Set(variants.map(v => v.color).filter(Boolean))];
  const sizesForColor = selectedColor
    ? variants.filter(v => v.color === selectedColor).map(v => v.size).filter(Boolean)
    : [...new Set(variants.map(v => v.size).filter(Boolean))];

  const rawImages = Array.isArray(product.images) ? product.images
    : typeof product.images === 'string' ? (() => { try { return JSON.parse(product.images as any); } catch { return []; } })()
    : [];
  const images = rawImages.length > 0 ? rawImages : [{ url: '' }];

  // 🔗 Поделиться товаром — чистая ссылка /product/:id, как у витрины Expo Web
  // и приложения Homepage. Открывается приложение (App Links) или сайт-карточка.
  const handleShare = async () => {
    const url = `${window.location.origin}/product/${product.id}`;
    try {
      if (typeof navigator !== 'undefined' && (navigator as any).share) {
        await (navigator as any).share({ title: product.name, text: `${product.name}\n${url}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Ссылка на товар скопирована');
      }
    } catch {
      /* пользователь отменил шеринг — игнорируем */
    }
  };

  // 🎨 Палитра Homepage (Luxury Dark Minimalism)
  const hp = {
    bg: isNight ? '#08090D' : '#FFFFFF',
    surface: isNight ? '#10131F' : '#F6F7F9',
    card: isNight ? '#171C2A' : '#FFFFFF',
    cardAlt: isNight ? '#1B2233' : '#F2F3F6',
    text: isNight ? '#FFFFFF' : '#0B0E16',
    textSec: isNight ? '#9CA3AF' : '#5B6472',
    textMuted: isNight ? '#6B7280' : '#9AA1AE',
    border: isNight ? 'rgba(255,255,255,0.06)' : 'rgba(11,14,22,0.08)',
    primary: '#6D5DFB',
    price: '#E8472A',
    error: '#EF4444',
    star: '#F5B50A',
  };
  const themeColor = hp.bg;
  const textColor = isNight ? 'text-white' : 'text-black';
  const bgColor = isNight ? 'bg-[#08090D]' : 'bg-white';
  const cardBg = isNight ? 'bg-[#171C2A]' : 'bg-[#F6F7F9]';
  const secondaryText = isNight ? 'text-gray-400' : 'text-gray-500';

  useEffect(() => {
    let isMounted = true;
    const fetchCompany = async () => {
      if (!product.company_id) {
        if (isMounted) { setCompanyName('Magazin'); setIsCompanyLoading(false); }
        return;
      }
      try {
        const data = await api.companies.get(product.company_id.toString());
        if (isMounted) setCompanyName(data?.name || 'Magazin');
      } catch {
        if (isMounted) setCompanyName('Magazin');
      } finally {
        if (isMounted) setIsCompanyLoading(false);
      }
    };
    fetchCompany();
    loadReviews();
    loadVariants();
    return () => { isMounted = false; };
  }, [product.id, product.company_id]);

  const loadVariants = async () => {
    setVariantsLoading(true);
    try {
      const data = await api.products.getVariants(product.id, false);
      if (Array.isArray(data) && data.length > 0) {
        setVariants(data);
        // Auto-select first available color
        const firstColor = data.find((v: Variant) => v.stockQuantity > 0)?.color || data[0]?.color || '';
        setSelectedColor(firstColor);
        const firstSize = data.find((v: Variant) => v.color === firstColor && v.stockQuantity > 0)?.size
          || data.find((v: Variant) => v.color === firstColor)?.size || '';
        setSelectedSize(firstSize);
        const firstVariant = data.find((v: Variant) => v.color === firstColor && v.size === firstSize);
        if (onVariantChange) onVariantChange(product.id, firstColor, firstSize, firstVariant?.stockQuantity ?? product.quantity);
      }
    } catch {
      setVariants([]);
    } finally {
      setVariantsLoading(false);
    }
  };

  const handleSelectColor = (color: string) => {
    setSelectedColor(color);
    // Auto-select first available size for this color
    const sizesForThisColor = variants.filter(v => v.color === color);
    const firstAvailableSize = sizesForThisColor.find(v => v.stockQuantity > 0)?.size
      || sizesForThisColor[0]?.size || '';
    setSelectedSize(firstAvailableSize);
    const newVariant = variants.find(v => v.color === color && v.size === firstAvailableSize);
    if (onVariantChange) onVariantChange(product.id, color, firstAvailableSize, newVariant?.stockQuantity ?? product.quantity);
  };

  const handleSelectSize = (size: string) => {
    setSelectedSize(size);
    const sizeVariant = variants.find(v => v.color === selectedColor && v.size === size);
    if (onVariantChange) onVariantChange(product.id, selectedColor, size, sizeVariant?.stockQuantity ?? product.quantity);
  };

  const loadReviews = async () => {
    try {
      const data = await api.products.getReviews(product.id.toString());
      setReviews(data);
    } catch {
      setReviews([]);
    }
  };

  const handleSubmitReview = async () => {
    if (!userPhone) { alert('Пожалуйста, войдите в систему, чтобы оставить отзыв'); return; }
    if (!userComment.trim()) { alert('Напишите комментарий'); return; }
    setSubmitting(true);
    try {
      await api.reviews.create({
        product_id: product.id,
        user_phone: userPhone,
        user_name: userName || 'Пользователь',
        rating: userRating,
        comment: userComment,
      });
      setUserComment('');
      setUserRating(5);
      await loadReviews();
      alert('Спасибо за ваш отзыв!');
    } catch {
      alert('Ошибка при отправке отзыва');
    } finally {
      setSubmitting(false);
    }
  };

  const averageRating = reviews.length > 0
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : '0.0';

  const stockColor = effectiveStock === 0 ? 'bg-red-100 text-red-700'
    : effectiveStock <= 3 ? 'bg-orange-100 text-orange-700'
    : 'bg-green-100 text-green-700';

  return (
    <div className={`flex flex-col h-full ${bgColor}`}>
      {/* Header — как в Homepage: круглые кнопки на фоне, без заголовка */}
      <header
        className="shrink-0 px-4 py-3 flex items-center justify-between"
        style={{ backgroundColor: hp.bg, paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
      >
        <button onClick={onBack} className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: hp.card, border: `1px solid ${hp.border}` }}>
          <ArrowLeft className="w-[22px] h-[22px]" style={{ color: hp.text }} />
        </button>
        <div className="flex items-center gap-2">
          <button onClick={handleShare} className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: hp.card, border: `1px solid ${hp.border}` }} title="Поделиться">
            <Share2 className="w-5 h-5" style={{ color: hp.text }} />
          </button>
          {onToggleLike && (
            <button onClick={() => onToggleLike(product.id)}
              className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: hp.card, border: `1px solid ${hp.border}` }}>
              <Heart className="w-5 h-5 transition-all" style={{ color: isLiked ? hp.error : hp.text, fill: isLiked ? hp.error : 'transparent' }} />
            </button>
          )}
          {/* 🛒 Быстрый переход в корзину — не нужно возвращаться на главную */}
          {onGoToCart && (
            <button onClick={onGoToCart}
              className="relative w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: hp.card, border: `1px solid ${hp.border}` }} title="Корзина">
              <ShoppingCart className="w-5 h-5" style={{ color: hp.text }} />
              {cartCount > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ backgroundColor: hp.primary || '#7C5CF0', border: `2px solid ${hp.bg}` }}
                >
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </button>
          )}
        </div>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto min-h-0 pb-32" style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
        <div className="pb-4">
          {/* Photos Carousel */}
          <div className="w-full overflow-x-scroll snap-x snap-mandatory scrollbar-hide mb-4"
            style={{ WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory', display: 'flex', gap: '12px', padding: '0 16px' }}>
            {images.map((img: any, idx: number) => (
              <div key={idx} className="snap-start shrink-0 rounded-2xl overflow-hidden bg-gray-300 relative"
                style={{ width: 'calc(100vw - 44px)', aspectRatio: '4/5', scrollSnapAlign: 'start', scrollSnapStop: 'always' }}>
                <ImageWithFallback src={img.url} alt={`${product.name} ${idx + 1}`}
                  className="w-full h-full object-cover"
                  style={{ pointerEvents: 'none', userSelect: 'none', maxWidth: '100%', height: '100%', objectFit: 'cover' }}
                  loading="lazy" />
                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white text-sm font-medium px-3 py-1.5 rounded-full">
                  {idx + 1} / {images.length}
                </div>
              </div>
            ))}
          </div>

          <div className="px-4 space-y-4">
            <h2 className="text-2xl font-extrabold leading-tight" style={{ color: hp.text }}>{product.name}</h2>

            {/* Price & Stock */}
            <div className="p-4 rounded-2xl" style={{ backgroundColor: hp.surface, border: `1px solid ${hp.border}` }}>
              <div className="flex justify-between items-start">
                <div className="flex flex-col flex-1">
                  <span className="text-[28px] font-extrabold leading-none" style={{ color: hp.price }}>
                    {formatPrice(effectivePrice)}
                  </span>
                  {hasDiscount && (
                    <span className="text-sm line-through mt-1.5" style={{ color: hp.textMuted }}>{formatPrice(originalPrice)}</span>
                  )}
                  {hasDiscount && (
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                        discount.isAggressive ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-blue-100 text-blue-700 border border-blue-200'
                      }`}>
                        {discount.isAggressive ? '🔥' : '🏷️'} -{discount.discountPercent}%
                      </span>
                      {isBelowCost && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
                          ⚠️ Цена ниже закупочной
                        </span>
                      )}
                    </div>
                  )}
                  {discount && (discount.title || discount.description) && (
                    <div className="mt-3 text-sm">
                      {discount.title && <div className="font-semibold text-red-600 mb-1">{discount.title}</div>}
                      {discount.description && <div className={secondaryText}>{discount.description}</div>}
                    </div>
                  )}
                </div>
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${stockColor}`}>
                  <Package className="w-4 h-4" />
                  <span>{effectiveStock > 0 ? `${effectiveStock} шт.` : 'Нет в наличии'}</span>
                </div>
              </div>
            </div>

            {/* ── VARIANT SELECTOR ─────────────────────────────────── */}
            {variantsLoading && (
              <div className={`p-3 rounded-xl text-sm text-center ${secondaryText}`}>Загрузка вариантов...</div>
            )}
            {!variantsLoading && variants.length > 0 && (
              <div className="p-4 rounded-2xl space-y-4" style={{ backgroundColor: hp.surface, border: `1px solid ${hp.border}` }}>
                {/* Color picker */}
                {uniqueColors.length > 0 && (
                  <div>
                    <p className="text-sm font-bold mb-2.5" style={{ color: hp.text }}>
                      Цвет: <span style={{ color: hp.primary }}>{selectedColor || 'не выбран'}</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {uniqueColors.map(color => {
                        const hasStock = variants.some(v => v.color === color && v.stockQuantity > 0);
                        const sel = selectedColor === color;
                        return (
                          <button
                            key={color}
                            onClick={() => handleSelectColor(color)}
                            disabled={!hasStock}
                            className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${!hasStock ? 'line-through cursor-not-allowed opacity-40' : ''}`}
                            style={{
                              backgroundColor: hp.cardAlt,
                              border: `${sel ? 2 : 1}px solid ${sel ? hp.primary : hp.border}`,
                              color: hp.text,
                            }}
                          >
                            {color}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Size picker */}
                {sizesForColor.length > 0 && (
                  <div>
                    <p className="text-sm font-bold mb-2.5" style={{ color: hp.text }}>
                      Размер: <span style={{ color: hp.primary }}>{selectedSize || 'не выбран'}</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {sizesForColor.map(size => {
                        const v = variants.find(x => x.color === selectedColor && x.size === size);
                        const hasStock = v ? v.stockQuantity > 0 : false;
                        const sel = selectedSize === size;
                        return (
                          <button
                            key={size}
                            onClick={() => hasStock && handleSelectSize(size)}
                            disabled={!hasStock}
                            className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all min-w-[44px] text-center ${!hasStock ? 'line-through cursor-not-allowed opacity-40' : ''}`}
                            style={{
                              backgroundColor: hp.cardAlt,
                              border: `${sel ? 2 : 1}px solid ${sel ? hp.primary : hp.border}`,
                              color: hp.text,
                            }}
                          >
                            {size}
                            {v && v.stockQuantity > 0 && v.stockQuantity <= 3 && (
                              <span className="block text-xs text-orange-500">ост. {v.stockQuantity}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Selected variant info */}
                {activeVariant && (
                  <div className={`flex items-center justify-between text-xs pt-2 border-t ${isNight ? 'border-gray-700 text-gray-400' : 'border-gray-100 text-gray-500'}`}>
                    <span>В наличии: <strong className={effectiveStock <= 3 ? 'text-orange-500' : 'text-green-600'}>{effectiveStock} шт.</strong></span>
                    {activeVariant.price > 0 && (
                      <span>Закупка: {activeVariant.price.toLocaleString()} сум</span>
                    )}
                  </div>
                )}
              </div>
            )}
            {/* ── END VARIANT SELECTOR ─────────────────────────────── */}

            {/* Description */}
            <div className={`rounded-xl overflow-hidden ${cardBg} shadow-sm`}>
              <button className="w-full p-4 flex items-center justify-between font-bold"
                onClick={() => setDescriptionOpen(!descriptionOpen)}>
                <span className={textColor}>Описание товара</span>
                {descriptionOpen ? <ChevronUp className={secondaryText} /> : <ChevronDown className={secondaryText} />}
              </button>
              {descriptionOpen && (
                <div className={`px-4 pb-4 text-sm ${isNight ? 'text-gray-300' : 'text-gray-600'} animate-in slide-in-from-top-2 duration-200`}>
                  {product.description
                    ? <LinkifiedText text={product.description} className="mb-4 whitespace-pre-wrap" linkClassName="text-blue-600 hover:text-blue-800 underline font-medium" />
                    : <p className="mb-4 text-gray-400 italic">Описание отсутствует.</p>}
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <div className="text-xs font-semibold uppercase opacity-60 mb-2 tracking-wide">Продавец</div>
                    <button
                      onClick={(e) => { e.stopPropagation(); if (product.company_id) onViewCompany(product.company_id); }}
                      disabled={!product.company_id}
                      className={`w-full p-3 rounded-lg flex items-center justify-between ${isNight ? 'bg-black/20 hover:bg-black/30' : 'bg-gray-50 hover:bg-gray-100'} active:scale-[0.98] transition-all ${!product.company_id ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${isNight ? 'bg-purple-900/30' : 'bg-purple-100'}`}>
                          <Store className={`w-4 h-4 ${isNight ? 'text-purple-300' : 'text-purple-600'}`} />
                        </div>
                        <span className={`font-bold ${textColor} flex items-center gap-2`}>
                          {isCompanyLoading ? 'Загрузка...' : companyName}
                          {!isCompanyLoading && <CheckCircle className="w-4 h-4 text-blue-500 fill-current" />}
                        </span>
                      </div>
                      <div className="text-purple-500 font-medium text-xs flex items-center gap-1">
                        Профиль <ArrowLeft className="w-3 h-3 rotate-180" />
                      </div>
                    </button>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs opacity-50 font-mono">
                    ID товара: {product.id}
                  </div>
                </div>
              )}
            </div>

            {/* Reviews */}
            <div className={`rounded-xl overflow-hidden ${cardBg} shadow-sm`}>
              <button className="w-full p-4 flex items-center justify-between" onClick={() => setReviewsOpen(!reviewsOpen)}>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-yellow-500">
                    <Star className="w-5 h-5 fill-current" />
                    <span className={`font-bold text-lg ml-1 ${textColor}`}>{averageRating}</span>
                  </div>
                  <span className={secondaryText}>({reviews.length} отзывов)</span>
                </div>
                {reviewsOpen ? <ChevronUp className={secondaryText} /> : <ChevronDown className={secondaryText} />}
              </button>
              {reviewsOpen && (
                <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-200">
                  <div className={`mb-6 p-4 rounded-xl ${isNight ? 'bg-black/20' : 'bg-gray-50'}`}>
                    <h3 className={`font-semibold mb-3 ${textColor}`}>Оставить отзыв</h3>
                    <div className="flex gap-2 mb-3">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button key={star} onClick={() => setUserRating(star)} className="focus:outline-none transition-transform active:scale-90">
                          <Star className={`w-7 h-7 ${star <= userRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input type="text" value={userComment} onChange={(e) => setUserComment(e.target.value)}
                        placeholder="Напишите комментарий..."
                        className={`flex-1 px-4 py-2 rounded-lg text-sm outline-none border ${isNight ? 'bg-[#08090D] border-[#2d1222] text-white placeholder-gray-500' : 'bg-white border-gray-200 text-black'}`} />
                      <button onClick={handleSubmitReview} disabled={submitting || !userComment.trim()}
                        className={`p-2 rounded-lg text-white transition-colors ${submitting || !userComment.trim() ? 'bg-gray-300' : 'bg-purple-600 hover:bg-purple-700'}`}>
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {reviews.length > 0 ? reviews.map((review) => (
                      <div key={review.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0 pb-4 last:pb-0">
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center bg-gray-200">
                              {review.avatar_url ? (
                                <img src={getImageUrl(review.avatar_url) || ''} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <User className="w-4 h-4 text-gray-500" />
                              )}
                            </div>
                            <span className={`font-medium text-sm ${textColor}`}>{review.user_name || 'Пользователь'}</span>
                          </div>
                          <span className="text-xs text-gray-400">{new Date(review.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-1 mb-1.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star key={star} className={`w-3 h-3 ${star <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} />
                          ))}
                        </div>
                        <p className={`text-sm ${secondaryText}`}>{review.comment}</p>
                      </div>
                    )) : (
                      <div className="text-center py-6 opacity-60">
                        <p className={textColor}>Пока нет отзывов</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <ProductQA productId={product.id} userPhone={userPhone} userName={userName} isNight={isNight} />
          </div>
        </div>
      </div>

      {/* Footer Actions — как в Homepage: цена слева, акцентные кнопки */}
      <div className="fixed bottom-[50px] left-0 right-0 z-40 pt-4 px-4 pb-4 rounded-t-[2rem]"
        style={{ backgroundColor: hp.bg, borderTop: `1px solid ${hp.border}`, boxShadow: '0 -8px 24px rgba(0,0,0,0.18)' }}>
        <div className="flex items-center gap-3 max-w-md mx-auto">
          <button onClick={() => onAddToCart(product)} disabled={effectiveStock === 0}
            className="flex-1 active:scale-[0.98] font-semibold text-[15px] py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: hp.cardAlt, color: hp.text, border: `1px solid ${hp.border}` }}>
            {cartQuantity > 0 && <span className="text-white text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: hp.primary }}>{cartQuantity}</span>}
            {effectiveStock === 0 ? 'Нет в наличии' : cartQuantity > 0 ? 'В корзине' : 'В корзину'}
          </button>
          <button onClick={() => onBuyNow(product)} disabled={effectiveStock === 0}
            className="flex-1 active:scale-[0.98] text-white font-bold text-[15px] py-3.5 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: hp.primary }}>
            Купить
          </button>
        </div>
      </div>
    </div>
  );
}
