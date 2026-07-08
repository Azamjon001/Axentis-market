import { useState, useEffect } from 'react';
import { Shield, Phone, Lock, Eye, EyeOff, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import api from '../utils/api';

/**
 * 🔐 Раздел «Безопасность» админ-панели.
 *
 * Позволяет сменить телефон-логин и пароль администратора платформы.
 * Новые данные хранятся в базе данных (таблица admin_credentials, пароль —
 * bcrypt-хэш). Пока смена не сделана, работает старый логин из .env
 * (ADMIN_PHONE / ADMIN_CODE). После первой смены действует только пароль из БД.
 */
export default function AdminSecurityPanel() {
  const [currentPhone, setCurrentPhone] = useState('');
  const [usingDefault, setUsingDefault] = useState(false);
  const [loadingPhone, setLoadingPhone] = useState(true);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.auth.getAdminCredentials();
        setCurrentPhone(res?.phone || '');
        setNewPhone(res?.phone || '');
        setUsingDefault(!!res?.usingDefault);
      } catch (e) {
        // Панель показывается только админу; ошибка чтения не критична
      } finally {
        setLoadingPhone(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setMessage(null);

    if (!currentPassword) {
      setMessage({ type: 'error', text: 'Введите текущий пароль для подтверждения' });
      return;
    }
    if (newPassword.length < 4) {
      setMessage({ type: 'error', text: 'Новый пароль должен быть не короче 4 символов' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Новый пароль и подтверждение не совпадают' });
      return;
    }

    const phoneToSave = (newPhone || currentPhone).replace(/\D/g, '');
    if (!phoneToSave) {
      setMessage({ type: 'error', text: 'Укажите телефон-логин' });
      return;
    }

    setSaving(true);
    try {
      const res = await api.auth.updateAdminCredentials(currentPassword, phoneToSave, newPassword);
      setCurrentPhone(res?.phone || phoneToSave);
      setUsingDefault(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage({
        type: 'success',
        text: 'Данные администратора обновлены. Теперь для входа используйте новый пароль.',
      });
    } catch (e) {
      const text = e instanceof Error ? e.message : 'Не удалось сохранить';
      setMessage({
        type: 'error',
        text: /incorrect|invalid/i.test(text) ? 'Текущий пароль указан неверно' : text,
      });
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition';

  return (
    <div className="max-w-2xl">
      {/* Текущий логин */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
            <Shield className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Доступ администратора</h2>
            <p className="text-sm text-gray-500">Телефон-логин и пароль для входа в админ-панель</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg px-4 py-3">
          <Phone className="w-4 h-4 text-gray-400" />
          <span className="text-gray-600">Текущий логин:</span>
          <span className="font-semibold text-gray-900">
            {loadingPhone ? '…' : currentPhone || 'не задан'}
          </span>
        </div>

        {usingDefault && !loadingPhone && (
          <div className="mt-3 flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              Сейчас используется пароль по умолчанию из настроек сервера (.env). Рекомендуем
              задать собственный пароль — после сохранения он будет храниться в базе данных.
            </span>
          </div>
        )}
      </div>

      {/* Форма смены */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-center gap-2 mb-5">
          <Lock className="w-5 h-5 text-purple-600" />
          <h3 className="text-base font-bold text-gray-900">Сменить данные для входа</h3>
        </div>

        <div className="space-y-4">
          {/* Текущий пароль */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Текущий пароль <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputCls}
                placeholder="Введите действующий пароль"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Новый телефон */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Новый телефон-логин</label>
            <input
              type="text"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, '').slice(0, 12))}
              className={inputCls}
              placeholder="Например, 901234567"
              inputMode="numeric"
            />
            <p className="text-xs text-gray-400 mt-1">Оставьте как есть, если менять телефон не нужно</p>
          </div>

          {/* Новый пароль */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Новый пароль <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputCls}
                placeholder="Минимум 4 символа"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Подтверждение */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Подтвердите новый пароль <span className="text-red-500">*</span>
            </label>
            <input
              type={showNew ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputCls}
              placeholder="Повторите новый пароль"
              autoComplete="new-password"
            />
          </div>

          {message && (
            <div
              className={`flex items-start gap-2 text-sm rounded-lg px-4 py-3 ${
                message.type === 'success'
                  ? 'text-green-700 bg-green-50 border border-green-200'
                  : 'text-red-700 bg-red-50 border border-red-200'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Сохранение…
              </>
            ) : (
              <>
                <Shield className="w-4 h-4" /> Сохранить новые данные
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
