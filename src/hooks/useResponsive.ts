import { useState, useEffect } from 'react';

/**
 * 📱 Хук для определения размера экрана и адаптивности
 * 
 * Breakpoints:
 * - mobile: < 640px
 * - tablet: 640px - 1024px
 * - desktop: >= 1024px
 */

interface ResponsiveState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
  height: number;
}

export function useResponsive(): ResponsiveState {
  const [state, setState] = useState<ResponsiveState>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080
  });

  useEffect(() => {
    const updateSize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      setState({
        isMobile: width < 640,
        isTablet: width >= 640 && width < 1024,
        isDesktop: width >= 1024,
        width,
        height
      });
    };

    // Инициализация
    updateSize();

    // Слушаем изменения размера
    window.addEventListener('resize', updateSize);
    
    // Слушаем изменение ориентации
    window.addEventListener('orientationchange', updateSize);

    return () => {
      window.removeEventListener('resize', updateSize);
      window.removeEventListener('orientationchange', updateSize);
    };
  }, []);

  return state;
}

/**
 * 🎨 Получить CSS классы на основе размера экрана
 */
export function useResponsiveClasses() {
  const { isMobile, isTablet } = useResponsive();

  return {
    // Контейнеры
    container: isMobile ? 'px-2 py-2' : isTablet ? 'px-4 py-3' : 'px-6 py-4',
    maxWidth: isMobile ? 'max-w-full' : isTablet ? 'max-w-4xl' : 'max-w-7xl',
    
    // Сетки
    grid: isMobile ? 'grid-cols-1' : isTablet ? 'grid-cols-2' : 'grid-cols-3',
    gridAuto: isMobile ? 'grid-cols-1' : isTablet ? 'grid-cols-2' : 'grid-cols-auto-fit',
    
    // Текст
    heading: isMobile ? 'text-xl' : isTablet ? 'text-2xl' : 'text-3xl',
    subheading: isMobile ? 'text-lg' : isTablet ? 'text-xl' : 'text-2xl',
    body: isMobile ? 'text-sm' : 'text-base',
    small: isMobile ? 'text-xs' : 'text-sm',
    
    // Кнопки
    button: isMobile ? 'px-3 py-2 text-sm' : isTablet ? 'px-4 py-2.5 text-base' : 'px-6 py-3 text-base',
    buttonSmall: isMobile ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm',
    
    // Карточки
    card: isMobile ? 'p-3 rounded-lg' : isTablet ? 'p-4 rounded-xl' : 'p-6 rounded-xl',
    cardCompact: isMobile ? 'p-2 rounded-md' : 'p-3 rounded-lg',
    
    // Промежутки
    gap: isMobile ? 'gap-2' : isTablet ? 'gap-3' : 'gap-4',
    gapLarge: isMobile ? 'gap-3' : isTablet ? 'gap-4' : 'gap-6',
    
    // Отступы
    spacing: isMobile ? 'space-y-2' : isTablet ? 'space-y-3' : 'space-y-4',
    spacingLarge: isMobile ? 'space-y-3' : isTablet ? 'space-y-4' : 'space-y-6',
    
    // Иконки
    icon: isMobile ? 'w-4 h-4' : isTablet ? 'w-5 h-5' : 'w-6 h-6',
    iconSmall: isMobile ? 'w-3 h-3' : 'w-4 h-4',
    iconLarge: isMobile ? 'w-6 h-6' : isTablet ? 'w-8 h-8' : 'w-10 h-10',
  };
}

/**
 * 📐 Получить размеры для конкретных элементов
 */
export function useResponsiveDimensions() {
  const { isMobile, isTablet } = useResponsive();

  return {
    // Модальные окна
    modalWidth: isMobile ? '95vw' : isTablet ? '80vw' : '60vw',
    modalMaxWidth: isMobile ? '100%' : isTablet ? '640px' : '800px',
    
    // Изображения
    imageSize: isMobile ? 80 : isTablet ? 100 : 120,
    avatarSize: isMobile ? 40 : isTablet ? 48 : 56,
    
    // Таблицы
    tableRowHeight: isMobile ? 60 : isTablet ? 70 : 80,
    
    // Sidebar
    sidebarWidth: isMobile ? '85vw' : isTablet ? '280px' : '320px',
    
    // Карточки товаров
    productCardWidth: isMobile ? '160px' : isTablet ? '200px' : '240px',
  };
}
