import { useState, useEffect, useRef } from 'react';
import { Heart, Search } from 'lucide-react';
import api from '../utils/api';
import BottomNavigation from './BottomNavigation';
import ProductCard from './ProductCard'; 
import ProductDetails from './ProductDetails'; // ✅ НОВЫЙ: Импорт панели товара
import type { DisplayMode } from './SettingsPage';

interface Product {
  id: number;
  name: string;
  quantity: number;
  price: number;
  markupPercent?: number;
  availableForCustomers?: boolean;
  images?: string[]; // 📸 Массив путей к изображениям товара
  hasColorOptions?: boolean;
  company_id?: number; // 🏢 нужен для перехода в магазин компании
}

interface LikesPageProps {
  likedProductIds: number[];
  setLikedProductIds: (ids: number[] | ((prev: number[]) => number[])) => void;
  cart: { [key: number]: number };
  setCart: (cart: { [key: number]: number } | ((prev: { [key: number]: number }) => { [key: number]: number })) => void;
  selectedColors: { [key: number]: string }; 
  setSelectedColors: (colors: { [key: number]: string } | ((prev: { [key: number]: string }) => { [key: number]: string })) => void;
  onBackToHome: () => void;
  onLogout: () => void;
  userName?: string;
  userPhone?: string;
  viewingImage: { url: string; name: string } | null;
  setViewingImage: (image: { url: string; name: string } | null) => void;
  viewingImageIndex: number; 
  setViewingImageIndex: (index: number | ((prev: number) => number)) => void; 
  onNavigateTo?: (page: 'home' | 'cart' | 'settings') => void;
}

export default function LikesPage({ 
  likedProductIds,
  setLikedProductIds,
  cart,
  setCart, // ✅ Принимаем setCart
  onNavigateTo,
  userPhone,
  viewingImage,
  setViewingImage,
  viewingImageIndex,
  setViewingImageIndex
}: LikesPageProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  
  // State for like animation
  const [likeAnimation, setLikeAnimation] = useState<number | null>(null);
  const [isTogglingLike, setIsTogglingLike] = useState(false);
  
  // ✅ НОВЫЙ: Состояние для открытия панели товара
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
    return (localStorage.getItem('displayMode') as DisplayMode) || 'day';
  });

  // Background sync to backend (fire-and-forget, non-blocking)
  // localStorage in App.tsx is already the source of truth
  const likesSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadProducts();
    const interval = setInterval(loadProducts, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleDisplayModeChange = (e: CustomEvent) => {
      setDisplayMode(e.detail);
    };
    window.addEventListener('displayModeChange', handleDisplayModeChange as EventListener);
    return () => {
      window.removeEventListener('displayModeChange', handleDisplayModeChange as EventListener);
    };
  }, []);
  
  // Backend sync is called immediately in each action handler — no debounce needed here

  const loadProducts = async () => {
    try {
      const productsData = await api.products.list({ limit: 1000 });
      const productsArray = Array.isArray(productsData) ? productsData : (productsData.products || []);
      
      if (!Array.isArray(productsArray)) {
        setProducts([]);
        return;
      }
      
      // Нормализуем данные: парсим images если это строка JSON
      const normalizedProducts = productsArray.map((p: any) => {
        if (p.images && typeof p.images === 'string') {
          try {
            p.images = JSON.parse(p.images);
          } catch (e) {
            console.warn('⚠️ Не удалось парсить images для товара', p.id);
            p.images = [];
          }
        }
        if (!Array.isArray(p.images)) {
          p.images = [];
        }
        return p;
      });
      
      setProducts(normalizedProducts.filter((p: Product) => 
        p.quantity > 0 && p.availableForCustomers === true
      ));
    } catch (error) {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const safeLikedIds = Array.isArray(likedProductIds) ? likedProductIds : [];
  const likedProducts = products.filter(product => safeLikedIds.includes(product.id));
  
  // 🔧 ИСПРАВЛЕНИЕ: Очистка "мертвых" ID из лайков (с защитой от бесконечного цикла)
  const cleanedRef = useRef(false);
  useEffect(() => {
    if (products.length > 0 && safeLikedIds.length > 0 && !cleanedRef.current) {
      // Находим ID которые есть в лайках, но товаров уже нет
      const existingProductIds = products.map(p => p.id);
      const validLikedIds = safeLikedIds.filter(id => existingProductIds.includes(id));
      
      // Если есть "мертвые" ID - очищаем их
      if (validLikedIds.length !== safeLikedIds.length) {
        console.log('🧹 Cleaning dead product IDs from likes:', safeLikedIds.length - validLikedIds.length);
        cleanedRef.current = true; // Помечаем что очистили
        setLikedProductIds(validLikedIds);
        // Сбрасываем флаг через 100мс чтобы повторно проверить если нужно
        setTimeout(() => {
          cleanedRef.current = false;
        }, 100);
      }
    }
  }, [products.length, safeLikedIds.length]); // Только длины, не массивы
  
  // Защита: у товара может не быть имени (битые данные) — не роняем страницу
  const filteredProducts = likedProducts.filter(product =>
    (product?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('uz-UZ').format(price) + ' сум';
  };

  const getPriceWithMarkup = (product: Product) => {
    const markupPercent = product.markupPercent || 0;
    return product.price * (1 + markupPercent / 100);
  };

  // 🏢 Открыть магазин компании: ставим deep-link хэш и уходим на главную,
  // где HomePage по хэшу #company-ID откроет нужный магазин.
  const handleViewCompany = (companyId?: number) => {
    if (!companyId) return;
    window.location.hash = `company-${companyId}`;
    onNavigateTo?.('home');
  };

  const isNight = displayMode === 'night';

  return (
    <div className={`min-h-screen pb-20 relative transition-colors duration-500 ${
      isNight ? 'bg-[#08090D]' : 'bg-white'
    }`}>
      {/* Header — как в Homepage (FavoritesScreen) */}
      <header className={`sticky top-0 z-20 transition-colors duration-500 ${
        isNight ? 'bg-[#08090D]' : 'bg-white'
      }`}
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
      >
        <div className="px-4 pb-3 flex items-end justify-between">
          <h1 className={`text-2xl font-extrabold tracking-tight ${isNight ? 'text-white' : 'text-[#0B0E16]'}`}>
            Избранное
          </h1>
          {likedProducts.length > 0 && (
            <span className={`text-sm font-medium ${isNight ? 'text-[#9CA3AF]' : 'text-[#5B6472]'}`}>
              {likedProducts.length} товаров
            </span>
          )}
        </div>
      </header>

      <div className="container mx-auto px-4 py-3 relative z-10">
        {/* Search Bar */}
        {likedProductIds.length > 0 && (
          <div className="mb-5">
            <div className={`flex items-center gap-2 px-3.5 h-12 rounded-2xl border transition-colors ${
              isNight ? 'bg-[#171C2A] border-white/[0.06]' : 'bg-[#F2F3F6] border-black/[0.06]'
            }`}>
              <Search className={`w-[18px] h-[18px] ${isNight ? 'text-[#6B7280]' : 'text-[#9AA1AE]'}`} />
              <input
                type="text"
                placeholder="Поиск в избранном..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full bg-transparent outline-none text-[15px] ${
                  isNight ? 'text-white placeholder-[#6B7280]' : 'text-[#0B0E16] placeholder-[#9AA1AE]'
                }`}
              />
            </div>
          </div>
        )}

        {/* Products Grid */}
        {loading ? (
          <div className="text-center py-12">
            <p className={isNight ? 'text-gray-400' : 'text-gray-500'}>Загрузка...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
            <div className="w-24 h-24 rounded-full flex items-center justify-center mb-5" style={{ background: 'rgba(239,68,68,0.12)' }}>
              <Heart className="w-12 h-12 text-[#EF4444]" />
            </div>
            <h3 className={`text-lg font-bold mb-1.5 ${isNight ? 'text-white' : 'text-[#0B0E16]'}`}>
              {searchQuery ? 'Товары не найдены' : 'Список пуст'}
            </h3>
            <p className={`text-sm mb-6 ${isNight ? 'text-[#9CA3AF]' : 'text-[#5B6472]'}`}>
              {searchQuery ? 'Попробуйте изменить запрос' : 'Добавляйте товары в избранное, нажимая на сердечко'}
            </p>
            {!searchQuery && (
              <button
                onClick={onBackToHome}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold"
                style={{ background: '#6D5DFB' }}
              >
                <Search className="w-[18px] h-[18px]" />
                На главную
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:gap-4 md:gap-6">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                displayMode={displayMode}
                colorAnimationEnabled={false} // Отключаем анимацию
                highlightedProductId={null}
                isLiked={true}
                cartQuantity={cart[product.id]}
                likeAnimation={likeAnimation === product.id ? { productId: product.id, isLiked: false } : null}
                formatPrice={formatPrice}
                getPriceWithMarkup={getPriceWithMarkup}
                onToggleLike={(productId) => {
                  if (!isTogglingLike) {
                    setIsTogglingLike(true);
                    const newLikes = likedProductIds.filter(id => id !== productId);
                    setLikedProductIds(newLikes);
                    if (userPhone) { api.users.removeLike(userPhone, productId).catch(() => {}); }
                    setTimeout(() => setIsTogglingLike(false), 500);
                  }
                }}
                onViewImage={(url, name, index) => {
                  setViewingImage({ url, name });
                  setViewingImageIndex(index);
                }}
                onViewCompany={() => handleViewCompany(product.company_id)}
                onClick={() => {
                  // ✅ ОДИНАРНЫЙ КЛИК - открываем панель товара
                  setSelectedProduct(product);
                }}
                onDoubleClick={() => {
                  // ✅ ДВОЙНОЙ КЛИК - удаляем из избранного
                  if (!isTogglingLike) {
                    setIsTogglingLike(true);
                    const newLikes = likedProductIds.filter(id => id !== product.id);
                    setLikedProductIds(newLikes);
                    if (userPhone) { api.users.removeLike(userPhone, product.id).catch(() => {}); }
                    setLikeAnimation(product.id);
                    setTimeout(() => {
                      setLikeAnimation(null);
                      setIsTogglingLike(false);
                    }, 1000);
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation 
        currentPage="likes"
        cartItemsCount={Object.values(cart).reduce((acc, val) => acc + val, 0)}
        likesCount={likedProductIds.filter(id => {
          const product = products.find(p => p.id === id);
          return product && product.quantity > 0;
        }).length}
        displayMode={displayMode}
        onNavigate={(page) => {
          if (page === 'likes') return;
          if (onNavigateTo) onNavigateTo(page);
        }}
      />

      {/* Image Viewer Modal */}
      {viewingImage && (() => {
        const product = products.find(p => 
          p.images && p.images.some(img => img.url === viewingImage.url)
        );
        const allImages = product?.images || [viewingImage];
        const currentImage = allImages[viewingImageIndex % allImages.length] || viewingImage;
        
        return (
          <div 
            className="fixed inset-0 bg-black bg-opacity-90 z-[70] flex items-center justify-center p-4"
            onClick={() => {
              setViewingImage(null);
              setViewingImageIndex(0);
            }}
          >
            <div className="relative w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
               <img 
                 src={currentImage.url} 
                 alt={viewingImage.name} 
                 className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
               />
               <button
                 onClick={() => setViewingImage(null)}
                 className="absolute -top-10 right-0 text-white p-2"
               >
                 <span className="text-2xl">&times;</span>
               </button>
            </div>
          </div>
        );
      })()}

      {/* Product Details Modal */}
      {selectedProduct && (
        <ProductDetails
          product={selectedProduct}
          onBack={() => setSelectedProduct(null)}
          onAddToCart={(product) => {
            // Добавляем в корзину
            setCart(prev => ({
              ...prev,
              [product.id]: (prev[product.id] || 0) + 1
            }));
          }}
          onBuyNow={(product) => {
            // Добавляем в корзину и закрываем панель
            setCart(prev => ({
              ...prev,
              [product.id]: (prev[product.id] || 0) + 1
            }));
            setSelectedProduct(null);
            // Переходим в корзину
            if (onNavigateTo) onNavigateTo('cart');
          }}
          isNight={isNight}
          cartQuantity={cart[selectedProduct.id] || 0}
          formatPrice={formatPrice}
          getPriceWithMarkup={getPriceWithMarkup}
          onViewCompany={(companyId) => handleViewCompany(companyId ?? selectedProduct.company_id)}
          userPhone={userPhone}
          isLiked={likedProductIds.includes(selectedProduct.id)}
          onToggleLike={(productId) => {
            if (!isTogglingLike) {
              setIsTogglingLike(true);
              const wasLiked = likedProductIds.includes(productId);
              const newLikes = wasLiked
                ? likedProductIds.filter(id => id !== productId)
                : [...likedProductIds, productId];
              setLikedProductIds(newLikes);
              if (userPhone) {
                if (wasLiked) { api.users.removeLike(userPhone, productId).catch(() => {}); }
                else { api.users.addLike(userPhone, productId).catch(() => {}); }
              }
              setTimeout(() => setIsTogglingLike(false), 500);
            }
          }}
        />
      )}
    </div>
  );
}