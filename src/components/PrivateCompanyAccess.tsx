import { useState } from 'react';
import { Lock, Building2, ArrowRight, Key, Search } from 'lucide-react';
import api from '../utils/api';

interface PrivateCompanyAccessProps {
  onAccessGranted: (companyId: string) => void;
  onBack: () => void;
}

export default function PrivateCompanyAccess({ onAccessGranted, onBack }: PrivateCompanyAccessProps) {
  const [companyId, setCompanyId] = useState('');
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!companyId.trim()) {
      setError('Введите ID компании');
      return;
    }

    if (companyId.length < 6) {
      setError('ID компании должен содержать минимум 6 символов');
      return;
    }

    setSearching(true);
    setError('');

    // Real existence check against the backend.
    try {
      const company: any = await api.companies.get(companyId);
      if (company && (company.id || company.name)) {
        onAccessGranted(companyId);
      } else {
        setError('Компания с таким ID не найдена');
      }
    } catch {
      setError('Компания с таким ID не найдена');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        {/* Кнопка назад */}
        <button
          onClick={onBack}
          className="mb-6 text-white hover:text-purple-200 transition-colors flex items-center gap-2"
        >
          ← Назад
        </button>

        {/* Карточка */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Иконка */}
          <div className="flex justify-center mb-6">
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg">
              <Lock className="w-10 h-10 text-white" />
            </div>
          </div>

          {/* Заголовок */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Приватная компания
            </h1>
            <p className="text-gray-600">
              Введите ID компании для доступа к её товарам
            </p>
          </div>

          {/* Форма */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Поле ввода ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ID компании <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={companyId}
                  onChange={(e) => {
                    setCompanyId(e.target.value.toUpperCase());
                    setError('');
                  }}
                  className={`w-full pl-11 pr-4 py-4 border-2 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all font-mono text-lg ${
                    error ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="MYSHOP01"
                  maxLength={12}
                  disabled={searching}
                />
              </div>
              {error && (
                <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                  <span className="text-lg">⚠️</span>
                  {error}
                </p>
              )}
              <p className="mt-2 text-xs text-gray-500">
                💡 ID компании предоставляется владельцем магазина
              </p>
            </div>

            {/* Кнопка */}
            <button
              type="submit"
              disabled={searching || !companyId.trim()}
              className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white px-6 py-4 rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all font-semibold text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {searching ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Поиск компании...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Найти компанию
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* Информация */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Building2 className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-purple-900 mb-1">
                    Что такое приватная компания?
                  </p>
                  <p className="text-xs text-purple-700">
                    Приватные компании работают отдельно от общей платформы. 
                    Доступ к их товарам возможен только по уникальному ID компании.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Примеры */}
          <div className="mt-6">
            <p className="text-xs text-gray-500 mb-2">Примеры ID компаний:</p>
            <div className="flex gap-2 flex-wrap">
              {['SHOP123', 'MYSTORE', 'ABCD1234'].map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setCompanyId(example)}
                  className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-xs font-mono hover:bg-gray-200 transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Помощь */}
        <div className="mt-6 text-center">
          <p className="text-purple-100 text-sm">
            Не знаете ID компании? Свяжитесь с владельцем магазина
          </p>
        </div>
      </div>
    </div>
  );
}
