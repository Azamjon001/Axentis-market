import { useState, useEffect } from 'react';
import { X, Download, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Проверяем установлено ли приложение
    if (window.matchMedia('(display-mode: standalone)').matches) {
      console.log('✅ [PWA] App is running in standalone mode');
      setIsInstalled(true);
      return;
    }

    // Проверяем iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);

    // Проверяем localStorage - показывали ли уже промпт
    const dismissed = localStorage.getItem('pwa-prompt-dismissed');
    if (dismissed) {
      const dismissedDate = new Date(dismissed);
      const now = new Date();
      const daysDiff = (now.getTime() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      
      // Показываем снова через 7 дней
      if (daysDiff < 7) {
        console.log('ℹ️ [PWA] Install prompt was dismissed recently');
        return;
      }
    }

    // Слушаем событие beforeinstallprompt (Android/Desktop)
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('🚀 [PWA] beforeinstallprompt event fired');
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Показываем промпт через 3 секунды после загрузки
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Для iOS показываем кастомный промпт
    if (iOS && !isInstalled) {
      setTimeout(() => {
        setShowPrompt(true);
      }, 5000); // Показываем через 5 секунд на iOS
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Регистрация Service Worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/service-worker.js')
          .then((registration) => {
            console.log('✅ [PWA] Service Worker registered successfully:', registration.scope);
            
            // Проверяем обновления каждый час
            setInterval(() => {
              registration.update();
            }, 60 * 60 * 1000);
          })
          .catch((error) => {
            console.error('❌ [PWA] Service Worker registration failed:', error);
          });
      });
    } else {
      console.warn('⚠️ [PWA] Service Workers are not supported in this browser');
    }
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      console.log('ℹ️ [PWA] No deferred prompt available');
      return;
    }

    console.log('🚀 [PWA] Showing install prompt');
    deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;
    console.log(`👤 [PWA] User response: ${outcome}`);

    if (outcome === 'accepted') {
      console.log('✅ [PWA] User accepted the install prompt');
      setIsInstalled(true);
    } else {
      console.log('❌ [PWA] User dismissed the install prompt');
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    console.log('🔕 [PWA] User dismissed install prompt');
    setShowPrompt(false);
    localStorage.setItem('pwa-prompt-dismissed', new Date().toISOString());
  };

  if (isInstalled || !showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[9999] animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-2xl shadow-2xl p-4 max-w-md mx-auto">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-12 h-12 bg-white rounded-xl flex items-center justify-center">
            <Download className="w-6 h-6 text-purple-600" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg mb-1">
              Установите приложение
            </h3>
            <p className="text-sm opacity-90 mb-3">
              {isIOS 
                ? 'Добавьте на главный экран для быстрого доступа' 
                : 'Используйте как обычное приложение на вашем устройстве'
              }
            </p>
            
            {isIOS ? (
              <div className="text-xs space-y-1 opacity-80">
                <div className="flex items-center gap-2">
                  <Share className="w-4 h-4" />
                  <span>1. Нажмите кнопку "Поделиться" внизу Safari</span>
                </div>
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  <span>2. Выберите "На экран Домой"</span>
                </div>
              </div>
            ) : (
              <button
                onClick={handleInstallClick}
                className="bg-white text-purple-600 font-semibold px-6 py-2 rounded-lg hover:bg-purple-50 active:scale-95 transition-all shadow-lg"
              >
                Установить
              </button>
            )}
          </div>
          
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
