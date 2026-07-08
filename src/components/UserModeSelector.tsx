import { ArrowRight, Lock, Globe, Sparkles } from 'lucide-react';
import { useState } from 'react';

interface UserModeSelectorProps {
  onSelectPublic: () => void;
  onSelectPrivate: () => void;
  onSwitchToCompany: () => void;
  onSwitchToReferralAgent?: () => void; // 👥 Вход для реферальных агентов
}

export default function UserModeSelector({ onSelectPublic, onSelectPrivate, onSwitchToCompany, onSwitchToReferralAgent }: UserModeSelectorProps) {
  const [hoveredMode, setHoveredMode] = useState<'public' | 'private' | null>(null);
  const [selectedMode, setSelectedMode] = useState<'public' | 'private' | null>(null);

  const handlePublicClick = () => {
    setSelectedMode('public');
    setTimeout(() => onSelectPublic(), 600); // Небольшая задержка для анимации
  };

  const handlePrivateClick = () => {
    setSelectedMode('private');
    setTimeout(() => onSelectPrivate(), 600);
  };

  // Определяем режим для отображения иконки (hover или selected)
  const displayMode = selectedMode || hoveredMode;
  const shouldShowIcon = displayMode !== null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#8B8B9B] via-[#6B5B6B] to-[#4A2F3F] flex flex-col justify-between px-6 py-8 relative overflow-hidden">
      {/* Animated Icon Area - Появляется вверху по центру */}
      <div className={`absolute top-24 left-0 right-0 flex justify-center transition-all duration-500 ${
        shouldShowIcon ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'
      }`}>
        <div className="relative">
          {/* Анимированное свечение */}
          <div className={`absolute inset-0 blur-2xl transition-all duration-700 ${
            displayMode === 'public' 
              ? 'bg-blue-400/30 scale-150' 
              : 'bg-purple-400/30 scale-150'
          }`}></div>
          
          {/* Иконка */}
          <div className={`relative bg-white/10 backdrop-blur-md p-6 rounded-3xl border-2 transition-all duration-500 ${
            displayMode === 'public'
              ? 'border-blue-400/50 shadow-lg shadow-blue-500/20'
              : 'border-purple-400/50 shadow-lg shadow-purple-500/20'
          }`}>
            {displayMode === 'public' ? (
              <Globe className="w-16 h-16 text-white drop-shadow-lg" strokeWidth={1.5} />
            ) : (
              <Lock className="w-16 h-16 text-white drop-shadow-lg" strokeWidth={1.5} />
            )}
          </div>

          {/* Sparkles анимация */}
          <div className="absolute -top-2 -right-2">
            <Sparkles className={`w-6 h-6 text-yellow-300 transition-all duration-500 ${
              shouldShowIcon ? 'opacity-100 animate-pulse' : 'opacity-0'
            }`} />
          </div>
        </div>
      </div>

      {/* Main Content Area - Кнопки статично внизу */}
      <div className="flex-1 flex flex-col justify-end gap-6 pb-20">
        {/* Buttons in horizontal layout */}
        <div className="flex gap-4 items-stretch">
          {/* Public Option */}
          <div className="flex-1 flex flex-col gap-3">
            <button
              onClick={handlePublicClick}
              onMouseEnter={() => setHoveredMode('public')}
              onMouseLeave={() => setHoveredMode(null)}
              className={`w-full h-64 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 active:scale-[0.98] flex items-center justify-center relative overflow-hidden group ${
                selectedMode === 'public' ? 'scale-105 ring-4 ring-blue-400/50' : 'hover:scale-[1.02]'
              }`}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
              }}
            >
              {/* Анимированный overlay при hover */}
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-all duration-300"></div>
              
              <div className="text-white text-4xl font-bold opacity-90 relative z-10">
                PUBLIC
              </div>

              {/* Плавающие частицы */}
              <div className="absolute top-4 right-4 w-2 h-2 bg-white/40 rounded-full animate-pulse"></div>
              <div className="absolute bottom-6 left-6 w-3 h-3 bg-white/30 rounded-full animate-pulse delay-150"></div>
            </button>
            
            <div className="bg-white/10 backdrop-blur-md px-4 py-4 rounded-2xl shadow-md border border-white/20">
              <p className="text-white text-base text-center font-medium leading-relaxed">
                Публичная регистрация
              </p>
              <p className="text-white/70 text-sm text-center mt-1">
                Доступ ко всем компаниям
              </p>
            </div>
          </div>

          {/* Private Option */}
          <div className="flex-1 flex flex-col gap-3">
            <button
              onClick={handlePrivateClick}
              onMouseEnter={() => setHoveredMode('private')}
              onMouseLeave={() => setHoveredMode(null)}
              className={`w-full h-64 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 active:scale-[0.98] flex items-center justify-center relative overflow-hidden group ${
                selectedMode === 'private' ? 'scale-105 ring-4 ring-purple-400/50' : 'hover:scale-[1.02]'
              }`}
              style={{
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
              }}
            >
              {/* Анимированный overlay при hover */}
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-all duration-300"></div>
              
              <div className="text-white text-4xl font-bold opacity-90 relative z-10">
                PRIVATE
              </div>

              {/* Плавающие частицы */}
              <div className="absolute top-6 left-4 w-2 h-2 bg-white/40 rounded-full animate-pulse delay-75"></div>
              <div className="absolute bottom-4 right-6 w-3 h-3 bg-white/30 rounded-full animate-pulse delay-300"></div>
            </button>
            
            <div className="bg-white/10 backdrop-blur-md px-4 py-4 rounded-2xl shadow-md border border-white/20">
              <p className="text-white text-base text-center font-medium leading-relaxed">
                Приватная регистрация
              </p>
              <p className="text-white/70 text-sm text-center mt-1">
                По ID компании
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Links */}
      <div className="flex flex-col gap-3 pb-8 items-center">
        <button 
          onClick={onSwitchToCompany}
          className="flex items-center gap-2 text-white/90 font-semibold text-base hover:text-white transition-colors"
        >
          Вход на компанию <ArrowRight className="w-5 h-5" />
        </button>
        
        {onSwitchToReferralAgent && (
          <button 
            onClick={onSwitchToReferralAgent}
            className="flex items-center gap-2 text-white/70 font-medium text-sm hover:text-white transition-colors"
          >
            Вход для реферальных агентов <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}