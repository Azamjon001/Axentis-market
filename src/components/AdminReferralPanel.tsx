import { useState, useEffect } from 'react';
import { Users, UserPlus, Phone, Lock, User, Ticket, TrendingUp, Building2, Eye, EyeOff, Check, X, RefreshCw, Percent, Edit2 } from 'lucide-react';
import api from '../utils/api';
import { getCurrentLanguage, useTranslation, type Language } from '../utils/translations';

interface ReferralAgent {
  id: number;
  phone: string;
  password?: string; // Пароль в открытом виде
  name: string;
  surname?: string;
  commission_percent?: number; // % агента от комиссии платформы
  unique_code: string; // snake_case как в backend
  is_active: boolean; // snake_case как в backend
  created_at: string; // snake_case как в backend
  total_companies?: number;
  active_companies?: number;
  trial_companies?: number;
}

export default function AdminReferralPanel() {
  const [agents, setAgents] = useState<ReferralAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const language = getCurrentLanguage();
  const t = useTranslation(language);

  const [newAgent, setNewAgent] = useState({
    phone: '',
    password: '',
    name: '',
    surname: '',
    commission_percent: '10'
  });

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const data = await api.referrals.listAgents();
      setAgents(data || []);
    } catch (error: any) {
      console.error('Error loading agents:', error);
      alert('Ошибка загрузки агентов: ' + (error.message || 'Неизвестная ошибка'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddAgent = async (e: React.FormEvent) => {
    e.preventDefault();

    // Валидация
    const phone = newAgent.phone.replace(/\s/g, '');
    if (phone.length !== 9 || !/^\d+$/.test(phone)) {
      alert('Номер телефона должен содержать ровно 9 цифр');
      return;
    }

    // 🔢 ТОЛЬКО ЦИФРЫ для пароля реферального агента
    if (!newAgent.password || newAgent.password.length < 4) {
      alert('Пароль должен содержать минимум 4 цифры');
      return;
    }

    if (!/^\d+$/.test(newAgent.password)) {
      alert('Пароль должен содержать только цифры (0-9)');
      return;
    }

    if (!newAgent.name.trim()) {
      alert('Введите имя агента');
      return;
    }

    const commission = parseFloat(newAgent.commission_percent);
    if (isNaN(commission) || commission < 0 || commission > 100) {
      alert('Процент агента должен быть числом от 0 до 100');
      return;
    }

    try {
      const result = await api.referrals.createAgent({
        phone,
        password: newAgent.password,
        name: newAgent.name.trim(),
        surname: newAgent.surname.trim(),
        commission_percent: commission
      });

      alert(`✅ Агент "${newAgent.name} ${newAgent.surname}" создан!\n\n🎫 Уникальный код: ${result.unique_code}\n\n💰 Процент: ${commission}%\n\n📱 Телефон: +998 ${phone}`);

      // Очистка формы
      setNewAgent({ phone: '', password: '', name: '', surname: '', commission_percent: '10' });
      setShowAddForm(false);
      setShowPassword(false);

      // Перезагрузка списка
      loadAgents();
    } catch (error: any) {
      console.error('Error creating agent:', error);
      alert('Ошибка создания агента: ' + (error.message || 'Неизвестная ошибка'));
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    alert(`✅ ${label} скопирован: ${text}`);
  };

  const handleEditCommission = async (agent: ReferralAgent) => {
    const current = agent.commission_percent ?? 10;
    const input = window.prompt(
      `Процент агента "${agent.name}" от комиссии платформы (0–100):`,
      String(current)
    );
    if (input === null) return;
    const value = parseFloat(input.replace(',', '.'));
    if (isNaN(value) || value < 0 || value > 100) {
      alert('Введите число от 0 до 100');
      return;
    }
    try {
      await api.referrals.updateAgentCommission(agent.id, value);
      alert(`✅ Процент агента "${agent.name}" обновлён: ${value}%`);
      loadAgents();
    } catch (error: any) {
      alert('Ошибка обновления процента: ' + (error.message || 'Неизвестная ошибка'));
    }
  };

  const handleDeleteAgent = async (agentId: number, agentName: string) => {
    if (!confirm(`Вы уверены, что хотите удалить агента "${agentName}"?\n\nВсе привязанные компании будут отвязаны от этого агента.`)) {
      return;
    }

    try {
      await api.referrals.deleteAgent(agentId);
      alert(`✅ Агент "${agentName}" успешно удален!`);
      loadAgents(); // Перезагружаем список
    } catch (error: any) {
      console.error('Error deleting agent:', error);
      alert('Ошибка удаления агента: ' + (error.message || 'Неизвестная ошибка'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-purple-500 mx-auto mb-2" />
          <p className="text-gray-500">{t.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Заголовок */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl shadow-lg p-6 mb-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <Users className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t.referralAgents}</h1>
              <p className="text-purple-100 mt-1">{t.referralAgentsDescription}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{agents.length}</div>
            <div className="text-purple-100 text-sm">{t.totalAgents}</div>
          </div>
        </div>
      </div>

      {/* Кнопка добавления */}
      <div className="mb-6">
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
            showAddForm
              ? 'bg-gray-200 text-gray-700'
              : 'bg-purple-600 text-white hover:bg-purple-700 shadow-lg'
          }`}
        >
          {showAddForm ? <X className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
          {showAddForm ? t.cancel : t.addAgent}
        </button>
      </div>

      {/* Форма добавления */}
      {showAddForm && (
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-2 border-purple-200">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-purple-600" />
            {t.createNewAgent}
          </h2>

          <form onSubmit={handleAddAgent} className="space-y-4">
            {/* Имя агента */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t.agentName} {t.required}
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={newAgent.name}
                  onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                  className="w-full pl-11 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Иван"
                  required
                />
              </div>
            </div>

            {/* Фамилия агента */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Фамилия
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={newAgent.surname}
                  onChange={(e) => setNewAgent({ ...newAgent, surname: e.target.value })}
                  className="w-full pl-11 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Иванов"
                />
              </div>
            </div>

            {/* Процент агента */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Процент агента (% от комиссии платформы) {t.required}
              </label>
              <div className="relative">
                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={newAgent.commission_percent}
                  onChange={(e) => setNewAgent({ ...newAgent, commission_percent: e.target.value })}
                  className="w-full pl-11 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="10"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Агент получает этот процент от комиссии платформы по своим компаниям.
              </p>
            </div>

            {/* Номер телефона */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t.agentPhone} {t.required}
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <div className="absolute left-11 top-1/2 -translate-y-1/2 text-gray-600 font-medium">
                  +998
                </div>
                <input
                  type="text"
                  value={newAgent.phone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    if (value.length <= 9) {
                      setNewAgent({ ...newAgent, phone: value });
                    }
                  }}
                  className="w-full pl-20 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="90 123 45 67"
                  maxLength={9}
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">{t.phoneNumberHint}</p>
            </div>

            {/* Пароль */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t.agentPasswordDigitsOnly} {t.required}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newAgent.password}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setNewAgent({ ...newAgent, password: value });
                  }}
                  className="w-full pl-11 pr-12 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono"
                  placeholder="1234"
                  maxLength={10}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">🔢 {t.agentPasswordHint}</p>
            </div>

            {/* Кнопки */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 font-medium shadow-lg"
              >
                <Check className="w-5 h-5" />
                {t.addAgent} ({t.uniqueCode.toLowerCase()} {t.generate.toLowerCase()})
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewAgent({ phone: '', password: '', name: '', surname: '', commission_percent: '10' });
                  setShowPassword(false);
                }}
                className="px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                {t.cancel}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Список агентов */}
      {agents.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">{t.loading}</h3>
          <p className="text-gray-500 mb-6">
            Создайте первого реферального агента, чтобы начать работу
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors inline-flex items-center gap-2 font-medium"
          >
            <UserPlus className="w-5 h-5" />
            {t.addAgent}
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-100 hover:border-purple-200 transition-all"
            >
              <div className="flex items-start justify-between">
                {/* Основная информация */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`p-2 rounded-lg ${agent.is_active ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <User className={`w-6 h-6 ${agent.is_active ? 'text-green-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">
                        {agent.name}{agent.surname ? ` ${agent.surname}` : ''}
                      </h3>
                      <p className="text-sm text-gray-500">+998 {agent.phone}</p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        agent.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {agent.is_active ? `✓ ${t.active}` : `✗ ${t.inactive}`}
                    </span>
                    {/* Процент агента + быстрое редактирование */}
                    <button
                      onClick={() => handleEditCommission(agent)}
                      className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors text-sm font-medium"
                      title="Изменить процент агента"
                    >
                      <Percent className="w-4 h-4" />
                      {agent.commission_percent ?? 10}%
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Уникальный код */}
                  <div className="mb-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Ticket className="w-5 h-5 text-purple-600" />
                      <div>
                        <div className="text-xs text-gray-500 font-medium">{t.referralCode}</div>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-purple-600 font-mono tracking-wider">
                            {agent.unique_code}
                          </span>
                          <button
                            onClick={() => copyToClipboard(agent.unique_code, t.referralCode)}
                            className="text-purple-600 hover:text-purple-700 text-sm font-medium underline"
                          >
                            {t.copyCode}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Пароль */}
                    {agent.password && (
                      <div className="flex items-center gap-3">
                        <Lock className="w-5 h-5 text-gray-600" />
                        <div>
                          <div className="text-xs text-gray-500 font-medium">{t.password}</div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-gray-700 font-mono">
                              {agent.password}
                            </span>
                            <button
                            onClick={() => copyToClipboard(agent.password!, t.password)}
                            className="text-gray-600 hover:text-gray-700 text-sm font-medium underline"
                          >
                            {t.copyCode}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Статистика */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-purple-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-4 h-4 text-purple-600" />
                        <span className="text-xs font-medium text-purple-600">{t.totalProducts}</span>
                      </div>
                      <div className="text-2xl font-bold text-purple-700">
                        {agent.total_companies || 0}
                      </div>
                    </div>

                    <div className="bg-green-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Check className="w-4 h-4 text-green-600" />
                        <span className="text-xs font-medium text-green-600">{t.active}</span>
                      </div>
                      <div className="text-2xl font-bold text-green-700">
                        {agent.active_companies || 0}
                      </div>
                    </div>

                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-medium text-blue-600">{t.trialCompanies}</span>
                      </div>
                      <div className="text-2xl font-bold text-blue-700">
                        {agent.trial_companies || 0}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Дата создания и кнопка удаления */}
                <div className="flex flex-col items-end gap-3">
                  <div className="text-right text-sm text-gray-500">
                    <div>{t.today}:</div>
                    <div className="font-medium">
                      {new Date(agent.created_at).toLocaleDateString('ru-RU')}
                    </div>
                  </div>
                  
                  {/* Кнопка удаления */}
                  <button
                    onClick={() => handleDeleteAgent(agent.id, agent.name)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors border border-red-200 text-sm font-medium"
                    title={t.delete}
                  >
                    <X className="w-4 h-4" />
                    {t.delete}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
