import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ArrowLeft, Smartphone, PenTool, Shirt, Baby, Gamepad2, Search, X, Tag, Package } from 'lucide-react';
import ProductCard from './ProductCard';
import { getCurrentLanguage, useTranslation, type Language } from '../utils/translations';

interface Product {
  id: number;
  name: string;
  quantity: number;
  price: number;
  markupPercent?: number;
  availableForCustomers?: boolean;
  images?: string[];
  hasColorOptions?: boolean;
  category?: string;
}

interface CatalogPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isNight: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  products: Product[];
  cart?: { [key: number]: number };
  likedProductIds?: number[];
  displayMode?: any;
  onAddToCart?: (productId: number) => void;
  onToggleLike?: (productId: number) => void;
  formatPrice?: (price: number) => string;
  getPriceWithMarkup?: (product: Product) => number;
  onOpenProduct?: (product: Product) => void;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  gadget: Smartphone,
  phone: Smartphone,
  electronics: Smartphone,
  stationery: PenTool,
  office: PenTool,
  clothes: Shirt,
  clothing: Shirt,
  kiyimlar: Shirt,
  kids: Baby,
  baby: Baby,
  toys: Gamepad2,
  game: Gamepad2,
};

function getCategoryIcon(name: string): React.ElementType {
  const lower = name.toLowerCase();
  for (const [key, Icon] of Object.entries(CATEGORY_ICONS)) {
    if (lower.includes(key)) return Icon;
  }
  return Tag;
}

export default function CatalogPanel({
  isOpen,
  onClose,
  isNight,
  searchQuery,
  setSearchQuery,
  products = [],
  cart = {},
  likedProductIds = [],
  displayMode,
  onAddToCart,
  onToggleLike,
  formatPrice,
  getPriceWithMarkup,
  onOpenProduct,
}: CatalogPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // 🌍 Localization — react to the global language switch.
  const [language, setLanguage] = useState<Language>(getCurrentLanguage());
  const t = useTranslation(language);
  useEffect(() => {
    const onLang = (e: any) => setLanguage(e.detail);
    window.addEventListener('languageChange', onLang as EventListener);
    return () => window.removeEventListener('languageChange', onLang as EventListener);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current && !selectedCategory) {
      inputRef.current.focus();
    }
  }, [isOpen, selectedCategory]);

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      setSelectedCategory(null);
    }
  }, [isOpen]);

  const categories = useMemo(() => {
    const seen = new Set<string>();
    products.forEach(p => {
      if (p.category && !p.name?.startsWith('__CATEGORY_MARKER__')) seen.add(p.category);
    });
    return Array.from(seen).sort();
  }, [products]);

  const categoryProducts = useMemo(() => {
    if (!selectedCategory) return [];
    return products.filter(p =>
      p.category === selectedCategory &&
      !p.name?.startsWith('__CATEGORY_MARKER__') &&
      p.availableForCustomers !== false
    );
  }, [products, selectedCategory]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return products.filter(p =>
      !p.name?.startsWith('__CATEGORY_MARKER__') &&
      p.availableForCustomers !== false &&
      p.name.toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  if (!isOpen) return null;

  const bg = isNight ? 'bg-[#0F0F16]' : 'bg-[#F7F8FA]';
  const headerBg = isNight ? 'bg-[#16161F]' : 'bg-white';
  const borderColor = isNight ? 'border-white/8' : 'border-black/6';
  const textPrimary = isNight ? 'text-white' : 'text-gray-900';
  const textSecondary = isNight ? 'text-gray-400' : 'text-gray-500';
  const inputBg = isNight ? 'bg-[#1E1E2C]' : 'bg-[#F0F1F5]';

  const showSearch = searchQuery.trim().length > 0;
  const showCategory = !showSearch && selectedCategory !== null;
  const showCategories = !showSearch && selectedCategory === null;

  const renderProductGrid = (list: Product[]) => (
    <div className="grid grid-cols-2 gap-3 p-4">
      {list.map(product => (
        <ProductCard
          key={product.id}
          product={product}
          displayMode={displayMode || (isNight ? 'night' : 'day')}
          colorAnimationEnabled={false}
          highlightedProductId={null}
          isLiked={likedProductIds.includes(product.id)}
          cartQuantity={cart[product.id]}
          formatPrice={formatPrice || ((p) => `${p.toLocaleString()} сум`)}
          getPriceWithMarkup={getPriceWithMarkup || ((p) => p.price)}
          onToggleLike={onToggleLike || (() => {})}
          onViewImage={() => {}}
          onViewCompany={() => {}}
          onDoubleClick={() => {
            if (onOpenProduct) onOpenProduct(product);
            else if (onAddToCart) onAddToCart(product.id);
          }}
          onClick={() => {
            if (onOpenProduct) onOpenProduct(product);
            else if (onAddToCart) onAddToCart(product.id);
          }}
        />
      ))}
    </div>
  );

  return (
    <div className={`fixed inset-0 z-[100] flex flex-col ${bg}`}>
      {/* Header */}
      <div
        className={`${headerBg} border-b ${borderColor} px-4 flex items-center gap-3 shrink-0`}
        style={{ paddingTop: 'calc(0.875rem + env(safe-area-inset-top))', paddingBottom: '0.875rem' }}
      >
        <button
          onClick={selectedCategory ? () => setSelectedCategory(null) : onClose}
          className={`p-1.5 -ml-1.5 rounded-full transition-colors ${isNight ? 'hover:bg-white/10' : 'hover:bg-black/6'}`}
        >
          <ArrowLeft className={`w-5 h-5 ${textPrimary}`} />
        </button>

        {selectedCategory ? (
          <div className="flex items-center gap-2 flex-1">
            {React.createElement(getCategoryIcon(selectedCategory), { className: `w-5 h-5 ${isNight ? 'text-indigo-400' : 'text-indigo-600'}` })}
            <span className={`text-base font-semibold ${textPrimary}`}>{selectedCategory}</span>
            <span className={`text-xs ml-1 ${textSecondary}`}>({categoryProducts.length})</span>
          </div>
        ) : (
          <div className={`flex-1 flex items-center gap-2.5 ${inputBg} rounded-xl px-3 py-2`}>
            <Search className={`w-4 h-4 shrink-0 ${textSecondary}`} />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchProducts}
              className={`flex-1 bg-transparent text-sm outline-none ${textPrimary} placeholder:${textSecondary}`}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="shrink-0">
                <X className={`w-4 h-4 ${textSecondary}`} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {showSearch ? (
          searchResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Search className={`w-12 h-12 ${textSecondary} opacity-40`} />
              <p className={`text-sm ${textSecondary}`}>Ничего не найдено</p>
            </div>
          ) : (
            <>
              <p className={`px-4 pt-4 pb-1 text-xs font-medium ${textSecondary}`}>
                Найдено: {searchResults.length}
              </p>
              {renderProductGrid(searchResults)}
            </>
          )
        ) : showCategory ? (
          categoryProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Package className={`w-12 h-12 ${textSecondary} opacity-40`} />
              <p className={`text-sm ${textSecondary}`}>Нет товаров в этой категории</p>
            </div>
          ) : (
            renderProductGrid(categoryProducts)
          )
        ) : showCategories ? (
          <div className="p-4">
            <p className={`text-xs font-medium uppercase tracking-wide mb-4 ${textSecondary}`}>
              {language === 'uz' ? 'Kategoriyalar' : 'Категории'}
            </p>
            <div className="space-y-1">
              {categories.length === 0 ? (
                <p className={`text-sm ${textSecondary} text-center py-8`}>Нет категорий</p>
              ) : (
                categories.map((cat) => {
                  const Icon = getCategoryIcon(cat);
                  const count = products.filter(p =>
                    p.category === cat &&
                    !p.name?.startsWith('__CATEGORY_MARKER__') &&
                    p.availableForCustomers !== false
                  ).length;
                  return (
                    <button
                      key={cat}
                      className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl transition-colors active:scale-[0.98] ${
                        isNight
                          ? 'hover:bg-white/6 active:bg-white/10'
                          : 'hover:bg-black/4 active:bg-black/8'
                      }`}
                      onClick={() => setSelectedCategory(cat)}
                    >
                      <div className={`p-2 rounded-xl ${isNight ? 'bg-indigo-900/60' : 'bg-indigo-50'}`}>
                        <Icon className={`w-5 h-5 ${isNight ? 'text-indigo-400' : 'text-indigo-600'}`} />
                      </div>
                      <span className={`flex-1 text-left text-[15px] font-medium ${textPrimary}`}>{cat}</span>
                      <span className={`text-xs ${textSecondary}`}>{count}</span>
                      <svg className={`w-4 h-4 ${textSecondary}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
