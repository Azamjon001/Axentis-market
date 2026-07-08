import { useState, useEffect, useRef } from 'react';
import { Package, ChevronLeft, ChevronRight } from 'lucide-react';
import { getImageUrl } from '../utils/api';

interface ProductImage {
  url: string;
  id?: number;
}

interface Product {
  id: number;
  name: string;
  price: number;
  quantity: number;
  category?: string;
  image_url?: string;
  images?: ProductImage[];
  markupPercent?: number;
  sellingPrice?: number;
}

interface ProductCardSimpleProps {
  product: Product;
  onClick: () => void;
  getPriceWithMarkup: (product: Product) => number;
}

export default function ProductCardSimple({ product, onClick, getPriceWithMarkup }: ProductCardSimpleProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pauseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  
  // 👆 Swipe/Drag detection
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Преобразуем image_url в images[] если нужно и преобразуем пути в URL
  const images = product.images && product.images.length > 0 
    ? product.images.map(img => ({
        url: typeof img === 'string' ? (getImageUrl(img) || img) : (img.url || '')
      }))
    : product.image_url 
      ? [{ url: product.image_url }] 
      : [];
      
  const hasMultipleImages = images.length > 1;
  const minSwipeDistance = 50;

  // 🎯 Автоматическое листание
  useEffect(() => {
    if (!hasMultipleImages) return;

    const randomDelay = Math.random() * 2000;

    const startAutoPlay = () => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
      }
      
      autoPlayTimerRef.current = setInterval(() => {
        if (!isPaused) {
          setDirection('next');
          setCurrentImageIndex((prev) => (prev + 1) % images.length);
        }
      }, 3000);
    };

    const initialTimer = setTimeout(startAutoPlay, randomDelay);

    return () => {
      clearTimeout(initialTimer);
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
      }
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current);
      }
    };
  }, [hasMultipleImages, images.length, isPaused]);

  // 🛑 Пауза на 10 секунд
  const pauseAutoPlay = () => {
    setIsPaused(true);
    
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
    }
    
    pauseTimerRef.current = setTimeout(() => {
      setIsPaused(false);
    }, 10000);
  };

  // Навигация стрелками
  const goToPrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasMultipleImages) return;
    
    pauseAutoPlay();
    setDirection('prev');
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const goToNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasMultipleImages) return;
    
    pauseAutoPlay();
    setDirection('next');
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const goToImage = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (index === currentImageIndex) return;
    
    pauseAutoPlay();
    setDirection(index > currentImageIndex ? 'next' : 'prev');
    setCurrentImageIndex(index);
  };

  // 🆕 Обработчик клика на всю карточку
  const handleCardClick = () => {
    if (!isDragging) {
      onClick();
    }
  };
  
  // Touch handlers
  const onTouchStart = (e: React.TouchEvent) => {
    if (!hasMultipleImages) return;
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!hasMultipleImages) return;
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!hasMultipleImages || !touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      pauseAutoPlay();
      setDirection('next');
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
      setIsDragging(true);
      setTimeout(() => setIsDragging(false), 100);
    } else if (isRightSwipe) {
      pauseAutoPlay();
      setDirection('prev');
      setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
      setIsDragging(true);
      setTimeout(() => setIsDragging(false), 100);
    }

    setTouchStart(null);
    setTouchEnd(null);
  };

  // Mouse handlers
  const onMouseDown = (e: React.MouseEvent) => {
    if (!hasMultipleImages) return;
    e.preventDefault();
    setTouchEnd(null);
    setTouchStart(e.clientX);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!hasMultipleImages || !touchStart) return;
    setTouchEnd(e.clientX);
  };

  const onMouseUp = () => {
    if (!hasMultipleImages || !touchStart || touchEnd === null) {
      setTouchStart(null);
      setTouchEnd(null);
      return;
    }
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      pauseAutoPlay();
      setDirection('next');
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
      setIsDragging(true);
      setTimeout(() => setIsDragging(false), 100);
    } else if (isRightSwipe) {
      pauseAutoPlay();
      setDirection('prev');
      setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
      setIsDragging(true);
      setTimeout(() => setIsDragging(false), 100);
    }

    setTouchStart(null);
    setTouchEnd(null);
  };

  const onMouseLeave = () => {
    setTouchStart(null);
    setTouchEnd(null);
  };

  return (
    <div 
      className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
      onClick={handleCardClick}
    >
      {/* Изображение с галереей */}
      <div className="relative aspect-square bg-gray-100 group">
        {images.length > 0 ? (
          <>
            <div 
              className="relative w-full h-full overflow-hidden"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseLeave}
            >
              {/* Плавное листание */}
              {images.map((image, index) => {
                let position = 'hidden';
                if (index === currentImageIndex) {
                  position = 'current';
                } else if (index === (currentImageIndex - 1 + images.length) % images.length) {
                  position = 'prev';
                } else if (index === (currentImageIndex + 1) % images.length) {
                  position = 'next';
                }

                let transform = 'translateX(0%)';
                if (position === 'current') {
                  transform = 'translateX(0%)';
                } else if (position === 'prev') {
                  transform = 'translateX(-100%)';
                } else if (position === 'next') {
                  transform = 'translateX(100%)';
                } else {
                  return null;
                }

                return (
                  <img
                    key={index}
                    src={image.url}
                    alt={product.name}
                    className="absolute top-0 left-0 w-full h-full object-cover"
                    style={{ 
                      transform,
                      transition: 'transform 500ms cubic-bezier(0.4, 0.0, 0.2, 1)',
                    }}
                  />
                );
              })}
            </div>
            
            {/* Стрелки */}
            {hasMultipleImages && (
              <>
                <button
                  onClick={goToPrevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-20"
                  aria-label="Предыдущее фото"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={goToNextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-20"
                  aria-label="Следующее фото"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}
            
            {/* Круглые точки */}
            {hasMultipleImages && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
                {images.map((_, index) => (
                  <button
                    key={index}
                    onClick={(e) => goToImage(index, e)}
                    className={`transition-all duration-300 rounded-full ${
                      index === currentImageIndex
                        ? 'w-2 h-2 bg-white'
                        : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/75'
                    }`}
                    aria-label={`Перейти к фото ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="aspect-square bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
            <Package className="w-12 h-12 text-purple-600" />
          </div>
        )}
      </div>
      
      {/* Информация о товаре */}
      <div className="p-3">
        <h4 className="text-gray-900 mb-1 line-clamp-2">{product.name}</h4>
        {product.category && (
          <p className="text-xs text-gray-500 mb-2">{product.category}</p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-purple-600">{getPriceWithMarkup(product).toLocaleString()} сум</span>
          <span className="text-xs text-gray-500">В наличии: {product.quantity}</span>
        </div>
      </div>
    </div>
  );
}