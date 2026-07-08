import React, { useState } from 'react';
import { User, Lock, Globe, Sparkles } from 'lucide-react';
import api from '../utils/api';
import LoadingAnimation from './LoadingAnimation'; // 🎨 Анимация загрузки

interface UserAuthPageProps {
  onLoginSuccess: (userData: any) => void;
  isPrivateMode: boolean;
  onBack?: () => void; // 🔄 Опционально - если не передано, кнопка не показывается
  onSwitchMode?: (mode: 'public' | 'private') => void; // 🎯 Переключение режима
  onSwitchToCompany?: () => void; // 🏢 Переход к входу в компанию
  onSwitchToReferralAgent?: () => void; // 👥 Переход к входу агента
}

export default function UserAuthPage({ onLoginSuccess, isPrivateMode, onBack, onSwitchMode, onSwitchToCompany, onSwitchToReferralAgent }: UserAuthPageProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  
  // Login fields
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginCompanyId, setLoginCompanyId] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // Register fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [registerCompanyId, setRegisterCompanyId] = useState('');
  const [registerError, setRegisterError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!loginPhone || !loginPassword) {
      setLoginError('Введите телефон и пароль');
      return;
    }

    if (isPrivateMode && !loginCompanyId) {
      setLoginError('Введите ID компании для приватного входа');
      return;
    }

    setLoading(true);
    try {
      // Новый API с поддержкой приватности
      const response = await fetch(`${api.baseURL}/api/auth/login/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: loginPhone,
          password: loginPassword,
          mode: isPrivateMode ? 'private' : 'public',
          privateCode: isPrivateMode ? loginCompanyId : undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка входа');
      }

      const data = await response.json();
      console.log('✅ Login successful:', data);
      
      onLoginSuccess({
        firstName: data.user.name || 'User',
        lastName: '',
        phone: data.user.phone,
        id: data.user.id,
        mode: data.user.mode || (isPrivateMode ? 'private' : 'public'),
        companyId: data.user.privateCompanyId || null
      });
    } catch (error) {
      console.error('Login error:', error);
      setLoginError(error instanceof Error ? error.message : 'Ошибка входа. Проверьте данные.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError('');

    if (!firstName || !lastName || !registerPassword || !confirmPassword || !registerPhone) {
      setRegisterError('Пожалуйста, заполните все поля');
      return;
    }

    if (isPrivateMode && !registerCompanyId) {
      setRegisterError('Введите ID компании для приватной регистрации');
      return;
    }

    if (registerPassword !== confirmPassword) {
      setRegisterError('Пароли не совпадают');
      return;
    }

    if (registerPhone.length < 9) {
      setRegisterError('Неверный формат номера телефона');
      return;
    }

    setLoading(true);

    try {
      // Новый API с поддержкой приватности
      const response = await fetch(`${api.baseURL}/api/auth/register/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: registerPhone,
          name: `${firstName} ${lastName}`,
          password: registerPassword,
          mode: isPrivateMode ? 'private' : 'public',
          privateCode: isPrivateMode ? registerCompanyId : undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка регистрации');
      }

      const data = await response.json();
      console.log('✅ Registration successful:', data);

      onLoginSuccess({
        firstName: firstName,
        lastName: lastName,
        phone: registerPhone,
        id: data.user.id,
        mode: data.user.mode || (isPrivateMode ? 'private' : 'public'),
        companyId: data.user.privateCompanyId || null
      });
    } catch (err) {
      console.error('❌ Registration error:', err);
      setRegisterError(err instanceof Error ? err.message : 'Произошла ошибка при регистрации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFF5F5] to-[#FFE5E5] flex flex-col px-6 py-8 relative">
      {/* 🎨 LOADING ANIMATION OVERLAY */}
      {loading && <LoadingAnimation />}
      
      {/* 🎯 MODE INDICATOR - Minimalistic Badge at Top Center */}
      <div className="absolute top-4 left-0 right-0 flex justify-center z-10">
        <div className={`px-6 py-2 rounded-full backdrop-blur-md border-2 shadow-lg transition-all duration-300 ${
          isPrivateMode 
            ? 'bg-gradient-to-r from-[#f093fb]/20 to-[#f5576c]/20 border-purple-300'
            : 'bg-gradient-to-r from-[#667eea]/20 to-[#764ba2]/20 border-blue-300'
        }`}>
          <div className="flex items-center gap-2">
            {isPrivateMode ? (
              <>
                <Lock className="w-4 h-4 text-purple-600" strokeWidth={2.5} />
                <span className="text-sm font-bold text-purple-700">PRIVATE</span>
                <Sparkles className="w-3 h-3 text-purple-400 animate-pulse" />
              </>
            ) : (
              <>
                <Globe className="w-4 h-4 text-blue-600" strokeWidth={2.5} />
                <span className="text-sm font-bold text-blue-700">PUBLIC</span>
                <Sparkles className="w-3 h-3 text-blue-400 animate-pulse" />
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Back button - только если onBack передан */}
      {onBack && (
        <button 
          onClick={onBack}
          className="absolute top-6 left-6 text-gray-600 hover:text-gray-800 transition-colors z-20"
        >
          ← Назад
        </button>
      )}

      <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full pt-8">{/* Added pt-8 for spacing from badge */}
        {/* Avatar */}
        <div className="mb-6">
          <div className="w-28 h-28 bg-gradient-to-br from-[#E0E0E0] to-[#BDBDBD] rounded-full flex items-center justify-center shadow-lg">
            <User className="w-14 h-14 text-white" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Здравствуйте!</h1>
          {isPrivateMode && (
            <p className="text-sm text-amber-700 font-medium">
              🔒 Приватный режим
            </p>
          )}
        </div>

        {/* Tabs */}
        <div className="w-full flex gap-2 mb-6 bg-white/50 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('login')}
            className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'login'
                ? 'bg-white text-gray-800 shadow-md'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Вход
          </button>
          <button
            onClick={() => setActiveTab('register')}
            className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'register'
                ? 'bg-white text-gray-800 shadow-md'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Регистрация
          </button>
        </div>

        {/* Login Form */}
        {activeTab === 'login' && (
          <form onSubmit={handleLoginSubmit} className="w-full space-y-4">
            <input
              type="tel"
              placeholder="Номер телефона"
              value={loginPhone}
              onChange={(e) => setLoginPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
              className="w-full bg-white/90 rounded-xl px-6 py-4 text-center placeholder-gray-400 text-gray-800 outline-none focus:ring-2 focus:ring-pink-300 transition-all shadow-sm"
            />

            <input
              type="password"
              placeholder="Пароль"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="w-full bg-white/90 rounded-xl px-6 py-4 text-center placeholder-gray-400 text-gray-800 outline-none focus:ring-2 focus:ring-pink-300 transition-all shadow-sm"
            />

            {isPrivateMode && (
              <input
                type="text"
                placeholder="ID компании"
                value={loginCompanyId}
                onChange={(e) => setLoginCompanyId(e.target.value)}
                className="w-full bg-amber-50 rounded-xl px-6 py-4 text-center placeholder-amber-600 text-gray-800 outline-none focus:ring-2 focus:ring-amber-400 transition-all shadow-sm border border-amber-200"
              />
            )}

            {loginError && (
              <div className="text-red-600 text-sm text-center font-medium bg-red-50 py-3 px-4 rounded-lg border border-red-200">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-gray-700 to-gray-900 text-white rounded-xl px-6 py-4 font-bold mt-4 hover:from-gray-800 hover:to-black transition-all active:scale-[0.98] shadow-lg disabled:opacity-50"
            >
              {loading ? 'Вход...' : 'Войти'}
            </button>
          </form>
        )}

        {/* Register Form */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="w-full flex flex-col gap-4">
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Имя"
              className="w-full bg-white/90 text-center py-4 px-4 rounded-xl placeholder-gray-400 text-gray-800 outline-none focus:ring-2 focus:ring-pink-300 transition-all shadow-sm"
            />

            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Фамилия"
              className="w-full bg-white/90 text-center py-4 px-4 rounded-xl placeholder-gray-400 text-gray-800 outline-none focus:ring-2 focus:ring-pink-300 transition-all shadow-sm"
            />

            <div className="grid grid-cols-2 gap-3">
              <input
                type="password"
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
                placeholder="Пароль"
                className="w-full bg-white/90 text-center py-4 px-3 rounded-xl placeholder-gray-400 text-gray-800 outline-none focus:ring-2 focus:ring-pink-300 transition-all shadow-sm text-sm"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Повторите"
                className="w-full bg-white/90 text-center py-4 px-3 rounded-xl placeholder-gray-400 text-gray-800 outline-none focus:ring-2 focus:ring-pink-300 transition-all shadow-sm text-sm"
              />
            </div>

            <input
              type="tel"
              value={registerPhone}
              onChange={(e) => setRegisterPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
              placeholder="Номер телефона"
              className="w-full bg-white/90 text-center py-4 px-4 rounded-xl placeholder-gray-400 text-gray-800 outline-none focus:ring-2 focus:ring-pink-300 transition-all shadow-sm"
            />

            {isPrivateMode && (
              <input
                type="text"
                value={registerCompanyId}
                onChange={(e) => setRegisterCompanyId(e.target.value)}
                placeholder="ID компании"
                className="w-full bg-amber-50 text-center py-4 px-4 rounded-xl placeholder-amber-600 text-gray-800 outline-none focus:ring-2 focus:ring-amber-400 transition-all shadow-sm border border-amber-200"
              />
            )}

            {registerError && (
              <div className="text-red-600 text-sm text-center mt-2 font-medium bg-red-50 py-3 px-4 rounded-lg border border-red-200">
                {registerError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-gray-700 to-gray-900 text-white py-4 rounded-xl mt-2 font-bold hover:from-gray-800 hover:to-black transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {loading ? 'Регистрация...' : 'Зарегистрироваться'}
            </button>
          </form>
        )}
      </div>

      {/* Footer с переключателями режима и переходами */}
      <div className="flex flex-col gap-3 pb-6 items-center">
        {/* Переключение режима Public/Private */}
        {onSwitchMode && (
          <div className="flex gap-2">
            <button
              onClick={() => onSwitchMode('public')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isPrivateMode
                  ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  : 'bg-blue-600 text-white'
              }`}
            >
              PUBLIC
            </button>
            <button
              onClick={() => onSwitchMode('private')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                !isPrivateMode
                  ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  : 'bg-purple-600 text-white'
              }`}
            >
              PRIVATE
            </button>
          </div>
        )}

        {/* Переход к входу в компанию */}
        {onSwitchToCompany && (
          <button
            onClick={onSwitchToCompany}
            className="text-gray-600 hover:text-gray-800 text-sm font-medium transition-colors"
          >
            Вход на компанию →
          </button>
        )}

        {/* Переход к входу реферального агента */}
        {onSwitchToReferralAgent && (
          <button
            onClick={onSwitchToReferralAgent}
            className="text-gray-500 hover:text-gray-700 text-xs font-medium transition-colors"
          >
            Вход для реферальных агентов →
          </button>
        )}
      </div>
    </div>
  );
}