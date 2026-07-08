/**
 * 🧭 СИСТЕМА НАВИГАЦИИ С ПОДДЕРЖКОЙ КНОПКИ "НАЗАД"
 * 
 * Решает проблему: при нажатии кнопки "Назад" на телефоне Android/iOS
 * приложение должно возвращаться на предыдущую страницу внутри приложения,
 * а не выходить из приложения полностью.
 * 
 * Использует History API для создания правильной истории навигации.
 */

export type PageType =
  | 'login'
  | 'sms'
  | 'companyLogin'
  | 'companyKey'
  | 'home'
  | 'likes'
  | 'settings'
  | 'admin'
  | 'company'
  | 'payment'
  | 'referralAgent';

interface NavigationState {
  page: PageType;
  data?: any; // Дополнительные данные для страницы
}

class NavigationManager {
  private listeners: Set<(state: NavigationState) => void> = new Set();
  private currentState: NavigationState;
  
  constructor() {
    // Инициализируем начальное состояние
    const initialState = this.getStateFromHistory() || {
      page: 'companyLogin' as PageType,
      data: {}
    };
    
    this.currentState = initialState;
    
    // Слушаем события popstate (кнопка "Назад")
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', this.handlePopState);
      
      // Устанавливаем начальное состояние
      if (!window.history.state) {
        window.history.replaceState(initialState, '', `#${initialState.page}`);
      }
      
      console.log('🧭 [Navigation] Инициализирован с поддержкой кнопки "Назад"');
    }
  }
  
  /**
   * Получить текущее состояние из истории
   */
  private getStateFromHistory(): NavigationState | null {
    if (typeof window === 'undefined') return null;
    
    const state = window.history.state as NavigationState;
    if (state && state.page) {
      return state;
    }
    
    // Попытка восстановить из URL hash
    const hash = window.location.hash.slice(1);
    if (hash) {
      return { page: hash as PageType, data: {} };
    }
    
    return null;
  }
  
  /**
   * Обработчик события popstate (кнопка "Назад")
   */
  private handlePopState = (event: PopStateEvent) => {
    console.log('🔙 [Navigation] Нажата кнопка "Назад":', event.state);
    
    if (event.state && event.state.page) {
      this.currentState = event.state;
      this.notifyListeners(event.state);
    } else {
      // Если состояние пустое - это начальная страница
      const initialState: NavigationState = {
        page: 'companyLogin',
        data: {}
      };
      this.currentState = initialState;
      this.notifyListeners(initialState);
    }
  };
  
  /**
   * Навигация на новую страницу (добавляет в историю)
   */
  navigateTo(page: PageType, data?: any, replace: boolean = false) {
    console.log(`🧭 [Navigation] ${replace ? 'Замена' : 'Переход'} на:`, page, data);
    
    const newState: NavigationState = {
      page,
      data: data || {}
    };
    
    this.currentState = newState;
    
    if (typeof window !== 'undefined') {
      const url = `#${page}`;
      
      if (replace) {
        // Заменяем текущую запись в истории (не создает новую)
        window.history.replaceState(newState, '', url);
      } else {
        // Добавляем новую запись в историю
        window.history.pushState(newState, '', url);
      }
    }
    
    this.notifyListeners(newState);
  }
  
  /**
   * Вернуться назад
   */
  goBack() {
    console.log('🔙 [Navigation] Программный возврат назад');
    if (typeof window !== 'undefined') {
      window.history.back();
    }
  }
  
  /**
   * Заменить текущую страницу (не создает новую запись в истории)
   */
  replace(page: PageType, data?: any) {
    this.navigateTo(page, data, true);
  }
  
  /**
   * Получить текущее состояние
   */
  getCurrentState(): NavigationState {
    return this.currentState;
  }
  
  /**
   * Подписаться на изменения навигации
   */
  subscribe(callback: (state: NavigationState) => void) {
    this.listeners.add(callback);
    
    // Возвращаем функцию отписки
    return () => {
      this.listeners.delete(callback);
    };
  }
  
  /**
   * Уведомить всех слушателей об изменении
   */
  private notifyListeners(state: NavigationState) {
    this.listeners.forEach(callback => {
      try {
        callback(state);
      } catch (error) {
        console.error('❌ [Navigation] Ошибка в callback:', error);
      }
    });
  }
  
  /**
   * Очистить историю и начать заново
   */
  reset(page: PageType = 'companyLogin') {
    console.log('🔄 [Navigation] Сброс навигации к:', page);
    
    const newState: NavigationState = {
      page,
      data: {}
    };
    
    this.currentState = newState;
    
    if (typeof window !== 'undefined') {
      // Очищаем историю, заменяя текущее состояние
      window.history.replaceState(newState, '', `#${page}`);
    }
    
    this.notifyListeners(newState);
  }
  
  /**
   * Проверить, можно ли вернуться назад
   */
  canGoBack(): boolean {
    if (typeof window === 'undefined') return false;
    return window.history.length > 1;
  }
  
  /**
   * Уничтожить менеджер навигации
   */
  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('popstate', this.handlePopState);
    }
    this.listeners.clear();
  }
}

// Экспортируем singleton экземпляр
export const navigationManager = new NavigationManager();

/**
 * React Hook для использования навигации
 */
import { useState, useEffect } from 'react';

export function useNavigation() {
  const [currentState, setCurrentState] = useState<NavigationState>(
    navigationManager.getCurrentState()
  );
  
  useEffect(() => {
    // Подписываемся на изменения навигации
    const unsubscribe = navigationManager.subscribe((state) => {
      console.log('🧭 [useNavigation] Обновление состояния:', state);
      setCurrentState(state);
    });
    
    return () => {
      unsubscribe();
    };
  }, []);
  
  return {
    currentPage: currentState.page,
    pageData: currentState.data,
    navigateTo: (page: PageType, data?: any) => navigationManager.navigateTo(page, data),
    goBack: () => navigationManager.goBack(),
    replace: (page: PageType, data?: any) => navigationManager.replace(page, data),
    reset: (page?: PageType) => navigationManager.reset(page),
    canGoBack: () => navigationManager.canGoBack(),
  };
}

/**
 * 📱 Обработка кнопки "Назад" на Android
 * Предотвращает выход из приложения при нажатии "Назад"
 */
if (typeof window !== 'undefined') {
  // Добавляем обработчик для предотвращения выхода из приложения
  window.addEventListener('popstate', (event) => {
    // Если это первая страница в истории, предотвращаем дефолтное поведение
    if (window.history.length <= 1) {
      event.preventDefault();
      console.log('⚠️ [Navigation] Попытка выхода из приложения предотвращена');
      
      // Возвращаем пользователя на начальную страницу
      navigationManager.reset('companyLogin');
    }
  });
}
