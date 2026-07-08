import { useState, useEffect } from 'react';
import { Building2, Plus, Trash2, Eye, EyeOff, Key, Phone, Lock, Edit2, X, Check, Globe, LockIcon, Copy, Save, Truck, Power, Percent, BadgeCheck } from 'lucide-react';
import api from '../utils/api';

interface Company {
  id: number;
  name: string;
  phone: string;
  password?: string;
  accessKey: string;
  mode?: 'public' | 'private'; // 🔒 Режим компании
  privateCode?: string; // 🔒 Код доступа для приватной компании (5-6 цифр)
  deliveryEnabled?: boolean; // 🚚 Включена ли доставка для компании
  platformCommissionPercent?: number; // 💰 Процент комиссии платформы от выручки
  is_enabled?: boolean; // 👥 Включена ли компания (реферальная система)
  trial_end_date?: string; // 👥 Дата окончания пробного периода
  referral_code?: string; // 👥 Реферальный код
  status?: string;
  created_date?: string;
}

export default function CompanyManagement() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [hiddenPasswords, setHiddenPasswords] = useState<{ [key: number]: boolean }>({});
  const [showAccessKeys, setShowAccessKeys] = useState<{ [key: number]: boolean }>({});
  const [editingCompany, setEditingCompany] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingPhone, setEditingPhone] = useState('');
  const [editingPassword, setEditingPassword] = useState('');
  const [editingAccessKey, setEditingAccessKey] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Редактирование комиссии
  const [commissionEditCompany, setCommissionEditCompany] = useState<Company | null>(null);
  const [commissionValue, setCommissionValue] = useState('');
  const [commissionMessage, setCommissionMessage] = useState('');
  const [savingCommission, setSavingCommission] = useState(false);

  // Форма для новой компании
  const [newCompany, setNewCompany] = useState({
    name: '',
    phone: '',
    password: '',
    access_key: '',
    referral_code: '' // 👥 Реферальный код
  });

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const data = await api.companies.list();
      setCompanies(data || []);
    } catch (error) {
      console.error('Error loading companies:', error);
      alert('Ошибка загрузки компаний');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToClipboard = async (text: string, fieldName: string) => {
    try {
      // 📍 Проверяем наличие Clipboard API
      if (!navigator.clipboard) {
        // Fallback для старых браузеров
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (!successful) {
          throw new Error('execCommand failed');
        }
      } else {
        await navigator.clipboard.writeText(text);
      }
      
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
      console.log(`✅ Скопировано: ${text}`);
    } catch (err) {
      console.error('Ошибка копирования:', err);
      // Показываем более информативное сообщение
      alert(`Не удалось скопировать. \n\nКлюч доступа: ${text}\n\nСкопируйте вручную.`);
    }
  };

  const startEditing = (company: Company) => {
    setEditingCompany(company.id);
    setEditingName(company.name);
    setEditingPhone(company.phone);
    setEditingPassword('');
    setEditingAccessKey(company.accessKey || '');
  };

  const cancelEditing = (_companyId: number) => {
    setEditingCompany(null);
    setEditingName('');
    setEditingPhone('');
    setEditingPassword('');
    setEditingAccessKey('');
  };

  const saveCompanyChanges = async (companyId: number) => {
    if (editingAccessKey && (editingAccessKey.length !== 30 || /\D/.test(editingAccessKey))) {
      alert('❌ Ключ доступа должен содержать ровно 30 цифр (без букв и символов)');
      return;
    }
    try {
      await api.companies.update(companyId.toString(), {
        name: editingName,
        phone: editingPhone,
        password: editingPassword || undefined,
        access_key: editingAccessKey
      });

      alert('✅ Компания успешно обновлена!');
      setEditingCompany(null);
      loadCompanies();
    } catch (error) {
      console.error('Error updating company:', error);
      alert('Ошибка при обновлении компании');
    }
  };

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Валидация
    if (!newCompany.name.trim()) {
      alert('Введите название компании');
      return;
    }
    
    // Удаляем пробелы из телефона
    const phone = newCompany.phone.replace(/\s/g, '');
    
    if (phone.length !== 9 || !/^\d+$/.test(phone)) {
      alert('Номер телефона должен содержать ровно 9 цифр');
      return;
    }
    
    if (!newCompany.password) {
      alert('Введите пароль');
      return;
    }
    
    if (newCompany.access_key.length !== 30) {
      alert('Ключ доступа должен содержать ровно 30 символов');
      return;
    }

    try {
      await api.auth.registerCompany({
        name: newCompany.name,
        phone: phone,
        password: newCompany.password,
        mode: 'public', // или 'private' в зависимости от selectedMode
        description: '',
        accessKey: newCompany.access_key,
        referralCode: newCompany.referral_code || undefined // 👥 Реферальный код
      });
      
      alert(`✅ Компания "${newCompany.name}" успешно добавлена!`);
      
      // Очистка формы
      setNewCompany({
        name: '',
        phone: '',
        password: '',
        access_key: '',
        referral_code: ''
      });
      setShowAddForm(false);
      
      // Перезагрузка списка
      loadCompanies();
    } catch (error: any) {
      console.error('Error adding company:', error);
      alert('Ошибка: ' + (error.message || 'Не удалось добавить компанию'));
    }
  };

  const handleDeleteCompany = async (company: Company) => {
    if (company.id === 1) {
      alert('❌ Главную компанию нельзя удалить!');
      return;
    }
    
    if (!confirm(`Вы уверены что хотите удалить компанию "${company.name}"?\n\nВместе с компанией будут удалены:\n• Все товары компании\n• История продаж\n• Заказы покупателей\n\nЭто действие нельзя отменить!`)) {
      return;
    }

    try {
      await api.companies.delete(company.id.toString());
      alert(`✅ Компания "${company.name}" удалена`);
      loadCompanies();
    } catch (error) {
      console.error('Error deleting company:', error);
      alert('Ошибка при удалении компании');
    }
  };

  // 👥 Переключение статуса компании (включена/выключена)
  const handleToggleCompanyStatus = async (company: Company) => {
    const newStatus = !company.is_enabled;
    const statusText = newStatus ? 'включена' : 'выключена';

    if (!confirm(`Вы уверены, что хотите ${newStatus ? 'включить' : 'выключить'} компанию "${company.name}"?\n\n${newStatus ? 'Компания снова сможет входить в систему и работать.' : 'Компания не сможет войти в систему, но все данные сохранятся.'}`)) {
      return;
    }

    try {
      await api.referrals.toggleCompanyStatus(company.id, newStatus);
      alert(`✅ Компания "${company.name}" ${statusText}`);
      loadCompanies();
    } catch (error: any) {
      console.error('Error toggling company status:', error);
      alert('Ошибка при изменении статуса: ' + (error.message || 'Неизвестная ошибка'));
    }
  };

  // ✅ Выдать/снять значок «Проверенный магазин»
  const handleToggleVerified = async (company: Company) => {
    const next = !(company as any).isVerified;
    try {
      await api.companies.setVerified(company.id, next);
      loadCompanies();
    } catch (error: any) {
      console.error('Error toggling verified badge:', error);
      alert('Ошибка изменения значка: ' + (error.message || 'Неизвестная ошибка'));
    }
  };

  // 💰 Открыть форму редактирования комиссии
  const handleEditCommission = (company: Company) => {
    setCommissionEditCompany(company);
    setCommissionValue(String(company.platformCommissionPercent ?? 3));
    setCommissionMessage('');
  };

  // 💰 Сохранить комиссию после явного нажатия кнопки
  const handleSaveCommission = async () => {
    if (!commissionEditCompany) return;
    const value = parseFloat(commissionValue.replace(',', '.'));
    if (isNaN(value) || value < 0 || value > 100) {
      alert('Введите число от 0 до 100');
      return;
    }
    setSavingCommission(true);
    try {
      await api.referrals.updateCompanyCommission(commissionEditCompany.id, value, commissionMessage || undefined);
      setCommissionEditCompany(null);
      loadCompanies();
    } catch (error: any) {
      console.error('Error updating commission:', error);
      alert('Ошибка обновления процента: ' + (error.message || 'Неизвестная ошибка'));
    } finally {
      setSavingCommission(false);
    }
  };

  const generateAccessKey = () => {
    // Генерация случайного 30-значного ключа
    const chars = '0123456789';
    let key = '';
    for (let i = 0; i < 30; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewCompany({ ...newCompany, access_key: key });
  };

  const togglePasswordVisibility = (companyId: number) => {
    setHiddenPasswords(prev => ({
      ...prev,
      [companyId]: !prev[companyId]
    }));
  };

  const toggleAccessKeyVisibility = (companyId: number) => {
    setShowAccessKeys(prev => ({
      ...prev,
      [companyId]: !prev[companyId]
    }));
  };

  // � Функция переключения доставки для компании
  const handleToggleDelivery = async (company: Company) => {
    const newDeliveryEnabled = !(company.deliveryEnabled !== false); // по умолчанию true
    const confirmMsg = newDeliveryEnabled
      ? `✅ Включить доставку для компании "${company.name}"?\n\nПокупатели смогут выбрать доставку при оформлении заказа.`
      : `🚫 Отключить доставку для компании "${company.name}"?\n\nПокупатели смогут только делать самовывоз.`;

    if (!confirm(confirmMsg)) return;

    try {
      const response = await fetch(`${api.baseURL}/api/companies/${company.id}/delivery`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryEnabled: newDeliveryEnabled })
      });

      if (!response.ok) throw new Error('Failed to update delivery setting');

      alert(newDeliveryEnabled
        ? `✅ Доставка включена для компании "${company.name}"`
        : `🚫 Доставка отключена. Только самовывоз для "${company.name}"`);
      loadCompanies();
    } catch (error: any) {
      console.error('Error toggling delivery:', error);
      alert('❌ Ошибка: ' + (error.message || 'Не удалось изменить настройку доставки'));
    }
  };

  // �🔒 Функция переключения режима компании (public/private)
  const handleTogglePrivacy = async (company: Company) => {
    // Определяем текущий режим из поля mode
    const currentMode = company.mode || 'public';
    const newMode = currentMode === 'public' ? 'private' : 'public';
    
    try {
      if (newMode === 'private') {
        // Переключаем на приватный режим
        const confirmMessage = `🔒 Вы переводите компанию "${company.name}" в приватный режим.\n\nБудет сгенерирован уникальный код доступа (5-6 цифр).\n\nПокупатели смогут зарегистрироваться только с этим кодом.\n\nПродолжить?`;
        
        if (!confirm(confirmMessage)) {
          return;
        }
        
        const response = await fetch(`${api.baseURL}/api/companies/${company.id}/privacy`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'private' })
        });

        if (!response.ok) {
          throw new Error('Failed to update privacy mode');
        }

        const data = await response.json();
        alert(`✅ Компания переведена в приватный режим!\n\n🔐 Код доступа: ${data.privateCode}\n\nПокажите этот код вашим покупателям для регистрации.`);
      } else {
        // Переключаем на публичный режим
        const confirmMessage = `🌐 Вы переводите компанию "${company.name}" в публичный режим.\n\nКомпания станет доступна всем покупателям.\nКод доступа будет удалён.\n\nПродолжить?`;
        
        if (!confirm(confirmMessage)) {
          return;
        }
        
        const response = await fetch(`${api.baseURL}/api/companies/${company.id}/privacy`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'public' })
        });

        if (!response.ok) {
          throw new Error('Failed to update privacy mode');
        }

        alert(`✅ Компания переведена в публичный режим!`);
      }
      
      // Перезагружаем список компаний
      loadCompanies();
    } catch (error: any) {
      console.error('Error toggling privacy:', error);
      alert('❌ Ошибка: ' + (error.message || 'Не удалось изменить режим компании'));
    }
  };

  // 📋 Функция копирования ID (с fallback для старых браузеров)
  const handleCopyId = (id: string) => {
    // Пробуем использовать современный Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(id)
        .then(() => {
          alert('✅ ID скопирован в буфер обмена!');
        })
        .catch(() => {
          // Fallback если Clipboard API не работает
          copyToClipboardFallback(id);
        });
    } else {
      // Fallback для старых браузеров или небезопасного контекста
      copyToClipboardFallback(id);
    }
  };

  // Fallback метод копирования
  const copyToClipboardFallback = (text: string) => {
    // Создаем временный input элемент
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        alert('✅ ID скопирован: ' + text);
      } else {
        alert('📋 ID компании: ' + text + '\n\nСкопируйте вручную');
      }
    } catch (err) {
      alert('📋 ID компании: ' + text + '\n\nСкопируйте вручную');
    }
    
    document.body.removeChild(textArea);
  };

  if (loading) {
    return <div className="text-center py-12">Загрузка...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Модальное окно редактирования комиссии */}
      {commissionEditCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Percent className="w-5 h-5 text-purple-600" />
                Комиссия: {commissionEditCompany.name}
              </h3>
              <button onClick={() => setCommissionEditCompany(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Процент комиссии платформы (0–100%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={commissionValue}
                  onChange={e => setCommissionValue(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-lg font-bold"
                  placeholder="Например: 3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Текст уведомления (оставьте пустым для стандартного)
                </label>
                <textarea
                  value={commissionMessage}
                  onChange={e => setCommissionMessage(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  placeholder="Необязательно — стандартный текст о контракте"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setCommissionEditCompany(null)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleSaveCommission}
                disabled={savingCommission}
                className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {savingCommission ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg shadow-md p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="w-8 h-8" />
            <div>
              <h2 className="text-2xl">Управление компаниями</h2>
              <p className="text-purple-100 text-sm mt-1">
                Всего компаний: {companies.length}
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-white text-purple-600 px-6 py-3 rounded-lg hover:bg-purple-50 transition-colors flex items-center gap-2 font-medium"
          >
            {showAddForm ? (
              <>
                <X className="w-5 h-5" />
                Отмена
              </>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                Добавить компанию
              </>
            )}
          </button>
        </div>
      </div>

      {/* Информационный баннер */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Building2 className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-blue-900 mb-1">О системе компаний</h3>
            <p className="text-sm text-blue-700">
              Каждая компания работает <strong>полностью независимо</strong> с собственным складом, кассой, аналитикой и заказами. 
              Компании используют <strong>телефон (9 цифр)</strong>, <strong>пароль</strong> и <strong>30-значный ключ доступа</strong> для входа. 
              Главную компанию (ID #1) нельзя удалить.
            </p>
          </div>
        </div>
      </div>

      {/* Форма добавления компании */}
      {showAddForm && (
        <div className="bg-white rounded-lg shadow-md p-6 border-2 border-purple-200">
          <h3 className="text-xl mb-4 flex items-center gap-2">
            <Plus className="w-6 h-6 text-purple-600" />
            Добавить новую компанию
          </h3>
          
          <form onSubmit={handleAddCompany} className="space-y-4">
            {/* Название */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Название компании *
              </label>
              <input
                type="text"
                value={newCompany.name}
                onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Например: Мой магазин"
                required
              />
            </div>

            {/* Телефон */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Номер телефона * (9 цифр)
              </label>
              <div className="flex items-center gap-2">
                <Phone className="w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={newCompany.phone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 9);
                    setNewCompany({ ...newCompany, phone: value });
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="912345678"
                  maxLength={9}
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Только цифры, без пробелов и символов</p>
            </div>

            {/* Пароль */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Пароль *
              </label>
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={newCompany.password}
                  onChange={(e) => setNewCompany({ ...newCompany, password: e.target.value })}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Введите пароль"
                  required
                />
              </div>
            </div>

            {/* Ключ доступа */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ключ доступа * (30 символов)
              </label>
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={newCompany.access_key}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 30);
                    setNewCompany({ ...newCompany, access_key: value });
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono"
                  placeholder="123456789012345678901234567890"
                  maxLength={30}
                  required
                />
                <button
                  type="button"
                  onClick={generateAccessKey}
                  className="bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 transition-colors whitespace-nowrap"
                >
                  Генерировать
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Только цифры. {newCompany.access_key.length}/30 символов
              </p>
            </div>

            {/* Реферальный код (опционально) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Реферальный код <span className="text-gray-400">(опционально)</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newCompany.referral_code}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 7);
                    setNewCompany({ ...newCompany, referral_code: value });
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-lg tracking-wider"
                  placeholder="1234567"
                  maxLength={7}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                💡 Код от реферального агента (7 цифр): {newCompany.referral_code.length}/7
              </p>
            </div>

            {/* Кнопки */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <Check className="w-5 h-5" />
                Создать компанию
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewCompany({ name: '', phone: '', password: '', access_key: '', referral_code: '' });
                }}
                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Список команий */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {companies.map((company) => (
          <div
            key={company.id}
            className={`bg-white rounded-lg shadow-md p-6 border-2 transition-all ${
              company.id === 1
                ? 'border-yellow-300 bg-yellow-50'
                : company.is_enabled !== false
                ? 'border-green-200 hover:border-green-300'
                : 'border-gray-200 opacity-60'
            }`}
          >
            {/* Заголовок */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Building2 className={`w-6 h-6 ${company.id === 1 ? 'text-yellow-600' : 'text-purple-600'}`} />
                  <div>
                    <h3 className="text-xl font-medium">{company.name}</h3>
                    <p className="text-sm text-gray-500">ID: #{company.id}</p>
                  </div>
                </div>
                
                {company.id === 1 && (
                  <div className="bg-yellow-100 text-yellow-800 text-xs px-3 py-1 rounded-full inline-block mb-2">
                    ⭐ Главная компания
                  </div>
                )}

                {/* Статус компании */}
                {company.is_enabled !== undefined && (
                  <div className={`text-xs px-3 py-1 rounded-full inline-block mb-2 ${
                    company.is_enabled
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {company.is_enabled ? '✓ Активна' : '● Приостановлена'}
                  </div>
                )}

                {/* Пробный период */}
                {company.trial_end_date && new Date(company.trial_end_date) > new Date() && (
                  <div className="bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full inline-block mb-2 ml-2">
                    🕐 Пробный период до {new Date(company.trial_end_date).toLocaleDateString('ru-RU')}
                  </div>
                )}
              </div>

              {/* Кнопки управления */}
              {company.id !== 1 && (
                <div className="flex gap-2">
                  {/* Кнопка изменения % комиссии платформы */}
                  <button
                    onClick={() => handleEditCommission(company)}
                    className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors text-sm font-medium"
                    title="Изменить % комиссии платформы"
                  >
                    <Percent className="w-4 h-4" />
                    {company.platformCommissionPercent ?? 3}%
                  </button>

                  {/* ✅ Значок «Проверенный магазин» */}
                  <button
                    onClick={() => handleToggleVerified(company)}
                    className={`p-2 rounded-lg transition-colors ${
                      (company as any).isVerified
                        ? 'text-blue-600 hover:bg-blue-50'
                        : 'text-gray-400 hover:bg-gray-100'
                    }`}
                    title={(company as any).isVerified ? 'Снять значок «Проверенный магазин»' : 'Выдать значок «Проверенный магазин»'}
                  >
                    <BadgeCheck className="w-5 h-5" />
                  </button>

                  {/* Кнопка включения/выключения */}
                  <button
                    onClick={() => handleToggleCompanyStatus(company)}
                    className={`p-2 rounded-lg transition-colors ${
                      company.is_enabled
                        ? 'text-gray-600 hover:bg-gray-100'
                        : 'text-green-600 hover:bg-green-50'
                    }`}
                    title={company.is_enabled ? 'Выключить компанию' : 'Включить компанию'}
                  >
                    <Power className="w-5 h-5" />
                  </button>

                  {/* Кнопка удаления */}
                  <button
                    onClick={() => handleDeleteCompany(company)}
                    className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                    title="Удалить компанию"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            {/* Кнопка редактирования */}
            {editingCompany !== company.id && (
              <button
                onClick={() => startEditing(company)}
                className="w-full mb-4 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Редактировать данные
              </button>
            )}

            {/* Информация */}
            <div className="space-y-3">
              {/* Название компании */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Название компании</p>
                {editingCompany === company.id ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="w-full px-3 py-2 border border-purple-300 rounded focus:outline-none focus:border-purple-500"
                    autoComplete="off"
                  />
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{company.name}</p>
                    <button
                      onClick={() => handleCopyToClipboard(company.name, `name-${company.id}`)}
                      className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-xs flex items-center gap-1"
                    >
                      {copiedField === `name-${company.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                )}
              </div>

              {/* Телефон */}
              <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
                <Phone className="w-5 h-5 text-gray-600" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500">Телефон (9 цифр)</p>
                  {editingCompany === company.id ? (
                    <input
                      type="text"
                      value={editingPhone}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 9);
                        setEditingPhone(value);
                      }}
                      className="w-full px-3 py-2 border border-purple-300 rounded focus:outline-none focus:border-purple-500"
                      maxLength={9}
                    />
                  ) : (
                    <p className="font-medium">{company.phone}</p>
                  )}
                </div>
                {editingCompany !== company.id && (
                  <button
                    onClick={() => handleCopyToClipboard(company.phone, `phone-${company.id}`)}
                    className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-xs flex items-center gap-1"
                  >
                    {copiedField === `phone-${company.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </button>
                )}
              </div>

              {/* Пароль */}
              <div className="flex items-center gap-3 bg-gradient-to-r from-gray-50 to-gray-100 p-3 rounded-lg border border-gray-200">
                <Lock className="w-5 h-5 text-gray-600" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500 font-medium mb-1">🔐 Пароль</p>
                  {editingCompany === company.id ? (
                    <input
                      type="text"
                      value={editingPassword}
                      onChange={(e) => setEditingPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-purple-300 rounded focus:outline-none focus:border-purple-500 font-mono"
                      placeholder="Введите новый пароль..."
                      autoComplete="new-password"
                    />
                  ) : (
                    <code
                      className="block font-mono text-sm break-all bg-white px-3 py-2 rounded border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
                      style={{ userSelect: 'text' }}
                      onClick={() => {
                        const pwd = company.password;
                        if (pwd && !pwd.startsWith('$2')) handleCopyToClipboard(pwd, `pwd-${company.id}`);
                      }}
                      title="Нажмите для копирования"
                    >
                      {hiddenPasswords[company.id]
                        ? '••••••••'
                        : (company.password
                            ? company.password.startsWith('$2')
                              ? '🔒 зашифрован — пересохраните пароль'
                              : company.password
                            : '(не задан — нажмите редактировать)')}
                    </code>
                  )}
                </div>
                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility(company.id)}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    title={hiddenPasswords[company.id] ? 'Показать' : 'Скрыть'}
                  >
                    {hiddenPasswords[company.id] ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  {editingCompany !== company.id && !hiddenPasswords[company.id] && company.password && !company.password.startsWith('$2') && (
                    <button
                      type="button"
                      onClick={() => handleCopyToClipboard(company.password || '', `pwd-${company.id}`)}
                      className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-xs"
                      title="Копировать"
                    >
                      {copiedField === `pwd-${company.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Ключ доступа */}
              <div className="flex items-center gap-3 bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border-2 border-purple-200">
                <Key className="w-5 h-5 text-purple-600" />
                <div className="flex-1">
                  <p className="text-xs text-gray-600 font-medium mb-1">🔑 Ключ доступа (30 символов)</p>
                  {editingCompany === company.id ? (
                    <>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editingAccessKey}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '').slice(0, 30);
                            setEditingAccessKey(value);
                          }}
                          className={`flex-1 px-3 py-2 border-2 rounded-lg focus:outline-none font-mono text-sm select-all ${
                            editingAccessKey.length === 30
                              ? 'border-green-400 focus:border-green-500'
                              : 'border-red-300 focus:border-red-500'
                          }`}
                          maxLength={30}
                          placeholder="Только цифры, ровно 30"
                          style={{ userSelect: 'text' }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const chars = '0123456789';
                            let key = '';
                            for (let i = 0; i < 30; i++) key += chars[Math.floor(Math.random() * chars.length)];
                            setEditingAccessKey(key);
                          }}
                          className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-xs font-medium whitespace-nowrap"
                        >
                          Генерировать
                        </button>
                      </div>
                      <p className={`text-xs mt-1 ${editingAccessKey.length === 30 ? 'text-green-600' : 'text-red-500'}`}>
                        {editingAccessKey.length}/30 цифр {editingAccessKey.length === 30 ? '✓' : '— нужно ровно 30'}
                      </p>
                    </>
                  ) : (
                    <>
                      <code
                        className={`block font-mono text-sm break-all bg-white px-3 py-2 rounded border select-all cursor-pointer hover:bg-purple-50 transition-colors ${
                          company.accessKey?.length === 30 && /^\d+$/.test(company.accessKey)
                            ? 'border-purple-200'
                            : 'border-red-300 bg-red-50'
                        }`}
                        onClick={() => handleCopyToClipboard(company.accessKey, `key-${company.id}`)}
                        title="Нажмите для копирования"
                        style={{ userSelect: 'text' }}
                      >
                        {company.accessKey || '(не задан)'}
                      </code>
                      {company.accessKey && (company.accessKey.length !== 30 || !/^\d+$/.test(company.accessKey)) && (
                        <p className="text-xs text-red-500 mt-1">
                          ⚠ {company.accessKey.length} символов{/[^\d]/.test(company.accessKey) ? ', содержит не-цифры' : ''} — нажмите «Редактировать» и исправьте до 30 цифр
                        </p>
                      )}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {editingCompany !== company.id && (
                    <button
                      onClick={() => handleCopyToClipboard(company.accessKey, `key-${company.id}`)}
                      className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-xs flex items-center gap-1.5 font-medium shadow-sm"
                      title="Копировать ключ"
                    >
                      {copiedField === `key-${company.id}` ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>✓</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Копия</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Кнопки сохранения/отмены при редактировании */}
              {editingCompany === company.id && (
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => saveCompanyChanges(company.id)}
                    className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Сохранить
                  </button>
                  <button
                    onClick={() => cancelEditing(company.id)}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              )}

              {/* Режим компании (Приватный/Публичный) */}
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 rounded-lg border border-purple-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {company.mode === 'private' ? (
                      <LockIcon className="w-5 h-5 text-purple-600" />
                    ) : (
                      <Globe className="w-5 h-5 text-green-600" />
                    )}
                    <div>
                      <p className="text-xs text-gray-600">Режим компании</p>
                      <p className="font-semibold text-gray-900">
                        {company.mode === 'private' ? '🔒 Приватный' : '🌐 Публичный'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleTogglePrivacy(company)}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                      company.mode === 'private'
                        ? 'bg-purple-600 text-white hover:bg-purple-700'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    Изменить
                  </button>
                </div>

                {/* Код компании для приватного режима */}
                {company.mode === 'private' && company.privateCode && (
                  <div className="mt-3 pt-3 border-t border-purple-200">
                    <p className="text-xs text-gray-600 mb-1">Код доступа компании</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-white px-3 py-2 rounded border border-purple-300 font-mono text-lg font-bold text-purple-900">
                        {company.privateCode}
                      </code>
                      <button
                        onClick={() => handleCopyId(company.privateCode || '')}
                        className="bg-purple-600 text-white px-3 py-2 rounded hover:bg-purple-700 transition-colors text-xs font-medium flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        Копировать
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      💡 Покупатели вводят этот код при регистрации для доступа к товарам компании
                    </p>
                  </div>
                )}
              </div>

              {/* Доставка - вкл/выкл */}
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className={`w-5 h-5 ${company.deliveryEnabled !== false ? 'text-blue-600' : 'text-gray-400'}`} />
                    <div>
                      <p className="text-xs text-gray-600">Доставка</p>
                      <p className="font-semibold text-gray-900">
                        {company.deliveryEnabled !== false ? '🚚 Доставка включена' : '🚫 Только самовывоз'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleDelivery(company)}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                      company.deliveryEnabled !== false
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-500 text-white hover:bg-gray-600'
                    }`}
                  >
                    {company.deliveryEnabled !== false ? 'Отключить' : 'Включить'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {company.deliveryEnabled !== false
                    ? '💡 Покупатели могут оформить доставку или самовывоз'
                    : '💡 Покупатели могут только забрать товар самостоятельно'}
                </p>
              </div>

              {/* Статус */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <span className="text-sm text-gray-600">Статус:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  company.status === 'approved'
                    ? 'bg-green-100 text-green-800'
                    : company.status === 'pending'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {company.status === 'approved' ? '✓ Одобрена' : company.status === 'pending' ? '⏳ На модерации' : '✗ Отклонена'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {companies.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
          <Building2 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p>Нет зарегистрированных компаний</p>
          <p className="text-sm mt-2">Нажмите "Добавить компанию" чтобы создать первую компанию</p>
        </div>
      )}
    </div>
  );
}