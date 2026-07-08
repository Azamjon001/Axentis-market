import React, { useState, useEffect } from 'react';
import { Send, Users, User, Search, X, CheckCircle, AlertCircle, Bell } from 'lucide-react';
import { getAuthToken } from '../utils/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Заголовки с токеном администратора — эндпоинт /notifications/send защищён RequireAdmin,
// без Authorization сервер отвечал 401 и уведомления не отправлялись.
const authHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

interface UserItem {
  phone: string;
  name: string;
}

export default function AdminNotificationsPanel() {
  const [sendMode, setSendMode] = useState<'single' | 'all'>('single');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [phone, setPhone] = useState('');
  const [users, setUsers] = useState<UserItem[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserItem[]>([]);
  const [showUsersList, setShowUsersList] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Загрузить список пользователей
  useEffect(() => {
    loadUsers();
  }, []);

  // Фильтрация пользователей
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredUsers(users.filter(u => 
        u.phone.toLowerCase().includes(query) || 
        u.name.toLowerCase().includes(query)
      ));
    }
  }, [searchQuery, users]);

  const loadUsers = async () => {
    try {
      const response = await fetch(`${API_URL}/notifications/users-list`);
      if (response.ok) {
        const data = await response.json();
        setUsers(data || []);
        setFilteredUsers(data || []);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleSend = async () => {
    // Валидация
    if (!title.trim()) {
      setResult({ success: false, message: 'Введите заголовок уведомления' });
      return;
    }
    if (!message.trim()) {
      setResult({ success: false, message: 'Введите текст сообщения' });
      return;
    }
    if (sendMode === 'single' && !phone.trim()) {
      setResult({ success: false, message: 'Выберите пользователя или введите номер телефона' });
      return;
    }

    // Подтверждение для массовой рассылки
    if (sendMode === 'all') {
      if (!confirm(`📢 Отправить уведомление ВСЕМ пользователям (${users.length} чел.)?\n\nЗаголовок: ${title}\n\nЭто действие нельзя отменить!`)) {
        return;
      }
    }

    setSending(true);
    setResult(null);

    try {
      const response = await fetch(`${API_URL}/notifications/send`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          phone: sendMode === 'single' ? phone.trim() : '',
          sendToAll: sendMode === 'all'
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setResult({ 
          success: true, 
          message: sendMode === 'all' 
            ? `✅ Уведомление отправлено ${data.sentCount} пользователям!` 
            : `✅ Уведомление отправлено пользователю ${phone}!`
        });
        // Очистить форму
        setTitle('');
        setMessage('');
        setPhone('');
        setSearchQuery('');
      } else {
        setResult({ success: false, message: data.error || 'Ошибка отправки' });
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      setResult({ success: false, message: 'Ошибка сети при отправке' });
    } finally {
      setSending(false);
    }
  };

  const selectUser = (user: UserItem) => {
    setPhone(user.phone);
    setSearchQuery(user.name ? `${user.name} (${user.phone})` : user.phone);
    setShowUsersList(false);
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Bell className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Уведомления</h2>
            <p className="text-gray-500 text-sm">Отправка сообщений пользователям</p>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-3">Кому отправить?</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSendMode('single')}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                sendMode === 'single'
                  ? 'border-purple-500 bg-purple-50 text-purple-700'
                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
              }`}
            >
              <User className="w-5 h-5" />
              <span className="font-medium">Одному</span>
            </button>
            <button
              type="button"
              onClick={() => setSendMode('all')}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                sendMode === 'all'
                  ? 'border-purple-500 bg-purple-50 text-purple-700'
                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
              }`}
            >
              <Users className="w-5 h-5" />
              <span className="font-medium">Всем ({users.length})</span>
            </button>
          </div>
        </div>

        {/* User Selection (only for single mode) */}
        {sendMode === 'single' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Выберите пользователя
            </label>
            <div className="relative">
              <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-purple-500">
                <Search className="w-5 h-5 text-gray-400 ml-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowUsersList(true);
                  }}
                  onFocus={() => setShowUsersList(true)}
                  placeholder="Поиск по имени или номеру..."
                  className="flex-1 px-3 py-3 outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setPhone('');
                    }}
                    className="p-2 hover:bg-gray-100"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>

              {/* Users Dropdown */}
              {showUsersList && filteredUsers.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredUsers.map((user, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => selectUser(user)}
                      className="w-full px-4 py-3 text-left hover:bg-purple-50 flex items-center gap-3 border-b border-gray-100 last:border-0"
                    >
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-gray-500" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-800">
                          {user.name || 'Без имени'}
                        </div>
                        <div className="text-sm text-gray-500">{user.phone}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Manual phone input */}
            <div className="mt-3">
              <label className="block text-xs text-gray-500 mb-1">
                Или введите номер вручную:
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7XXXXXXXXXX"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </div>
        )}

        {/* Title */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Заголовок уведомления
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например: 📢 Важное объявление!"
            maxLength={100}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
          <div className="text-xs text-gray-400 mt-1 text-right">{title.length}/100</div>
        </div>

        {/* Message */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Текст сообщения
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Введите текст уведомления... Можно использовать emoji 😊🎉✨"
            rows={5}
            maxLength={1000}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
          />
          <div className="text-xs text-gray-400 mt-1 text-right">{message.length}/1000</div>
        </div>

        {/* Result Message */}
        {result && (
          <div className={`mb-4 p-4 rounded-lg flex items-center gap-3 ${
            result.success 
              ? 'bg-green-50 border border-green-200 text-green-700' 
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {result.success ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <span>{result.message}</span>
          </div>
        )}

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={sending}
          className={`w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-semibold text-white transition-all ${
            sending
              ? 'bg-gray-400 cursor-not-allowed'
              : sendMode === 'all'
                ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 shadow-lg hover:shadow-xl'
                : 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 shadow-lg hover:shadow-xl'
          }`}
        >
          {sending ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Отправка...</span>
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              <span>
                {sendMode === 'all' 
                  ? `Отправить всем (${users.length} чел.)` 
                  : 'Отправить пользователю'}
              </span>
            </>
          )}
        </button>

        {/* Warning for mass send */}
        {sendMode === 'all' && (
          <p className="text-center text-sm text-orange-600 mt-3">
            ⚠️ Уведомление будет отправлено всем {users.length} пользователям приложения
          </p>
        )}
      </div>
    </div>
  );
}
