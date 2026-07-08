import { Globe, Lock, Building2, Users, ShieldCheck } from 'lucide-react';

interface CompanyModeSelectorProps {
  onSelectMode: (mode: 'public' | 'private') => void;
}

export default function CompanyModeSelector({ onSelectMode }: CompanyModeSelectorProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 flex items-center justify-center p-6">
      <div className="max-w-5xl w-full">
        {/* Заголовок */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <Building2 className="w-16 h-16 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">
            Регистрация компании
          </h1>
          <p className="text-purple-100 text-lg">
            Выберите режим работы вашей компании
          </p>
        </div>

        {/* Два варианта выбора */}
        <div className="grid grid-cols-2 gap-6">
          {/* 🌐 ПУБЛИЧНЫЙ РЕЖИМ */}
          <button
            onClick={() => onSelectMode('public')}
            className="group bg-white rounded-2xl p-8 shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105 hover:-translate-y-2 text-left relative overflow-hidden"
          >
            {/* Декоративный градиент */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-400 to-green-600 rounded-full opacity-10 -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
            
            <div className="relative z-10">
              {/* Иконка */}
              <div className="bg-gradient-to-br from-green-500 to-green-600 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <Globe className="w-8 h-8 text-white" />
              </div>

              {/* Заголовок */}
              <h2 className="text-2xl font-bold text-gray-900 mb-3 flex items-center gap-2">
                Публичный режим
                <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">Рекомендуется</span>
              </h2>

              {/* Описание */}
              <p className="text-gray-600 mb-6 leading-relaxed">
                Ваша компания будет видна всем покупателям на общей платформе. Получайте заказы от всех пользователей.
              </p>

              {/* Преимущества */}
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="bg-green-100 rounded-full p-1 mt-0.5">
                    <Users className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Больше покупателей</p>
                    <p className="text-xs text-gray-500">Доступны для всех пользователей платформы</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-green-100 rounded-full p-1 mt-0.5">
                    <Building2 className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Единая платформа</p>
                    <p className="text-xs text-gray-500">Ваши товары в общем каталоге</p>
                  </div>
                </div>
              </div>

              {/* Кнопка */}
              <div className="mt-8">
                <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-xl font-semibold group-hover:from-green-600 group-hover:to-green-700 transition-all shadow-lg text-center">
                  Выбрать публичный режим →
                </div>
              </div>
            </div>
          </button>

          {/* 🔒 ПРИВАТНЫЙ РЕЖИМ */}
          <button
            onClick={() => onSelectMode('private')}
            className="group bg-white rounded-2xl p-8 shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105 hover:-translate-y-2 text-left relative overflow-hidden"
          >
            {/* Декоративный градиент */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full opacity-10 -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
            
            <div className="relative z-10">
              {/* Иконка */}
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <Lock className="w-8 h-8 text-white" />
              </div>

              {/* Заголовок */}
              <h2 className="text-2xl font-bold text-gray-900 mb-3 flex items-center gap-2">
                Приватный режим
                <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-full">Эксклюзивно</span>
              </h2>

              {/* Описание */}
              <p className="text-gray-600 mb-6 leading-relaxed">
                Ваша компания будет работать отдельно. Покупатели получат доступ только по уникальному ID компании.
              </p>

              {/* Преимущества */}
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="bg-purple-100 rounded-full p-1 mt-0.5">
                    <ShieldCheck className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Полная приватность</p>
                    <p className="text-xs text-gray-500">Только ваши клиенты видят товары</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-purple-100 rounded-full p-1 mt-0.5">
                    <Lock className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Уникальный ID</p>
                    <p className="text-xs text-gray-500">Доступ только по вашему ID</p>
                  </div>
                </div>
              </div>

              {/* Кнопка */}
              <div className="mt-8">
                <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold group-hover:from-purple-600 group-hover:to-purple-700 transition-all shadow-lg text-center">
                  Выбрать приватный режим →
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* Информация внизу */}
        <div className="mt-8 text-center">
          <p className="text-purple-100 text-sm">
            💡 Режим можно будет изменить позже в настройках компании
          </p>
        </div>
      </div>
    </div>
  );
}