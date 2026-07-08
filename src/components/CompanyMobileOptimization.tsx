import { useEffect } from 'react';

/**
 * 🌐 КОМПАНИЯ КАК ОБЫЧНЫЙ ВЕБ-САЙТ
 * 
 * Минимальная оптимизация - компания работает как обычный веб-сайт
 * БЕЗ отключения зума, pull-to-refresh и других ограничений
 */
export default function CompanyMobileOptimization() {
  useEffect(() => {
    // ✅ Стандартный viewport - как обычный сайт
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute(
        'content',
        'width=device-width, initial-scale=1.0, viewport-fit=cover'
      );
    } else {
      const meta = document.createElement('meta');
      meta.name = 'viewport';
      meta.content = 'width=device-width, initial-scale=1.0, viewport-fit=cover';
      document.head.appendChild(meta);
    }

    // ✅ Минимальные CSS - только базовые стили
    const style = document.createElement('style');
    style.textContent = `
      /* Разрешаем выделение текста везде */
      * {
        -webkit-user-select: text;
        user-select: text;
      }
      
      /* Стандартный скролл */
      body {
        -webkit-overflow-scrolling: touch;
        position: relative;
        width: 100%;
        min-height: 100vh;
      }
      
      /* Отключаем горизонтальный скролл */
      html {
        overflow-x: hidden;
      }
    `;
    document.head.appendChild(style);

    console.log('✅ [Company] Работает как обычный веб-сайт');

    // Cleanup
    return () => {
      style.remove();
    };
  }, []);

  return null;
}
