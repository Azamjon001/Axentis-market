import { useState, useEffect } from 'react';
import { Ticket, Building2, Globe, Lock, LogOut, TrendingUp, Check, Clock, Users } from 'lucide-react';
import api from '../utils/api';
import { useTranslation, type Language } from '../utils/translations';
import ReferralAgentAnalyticsPanel from './ReferralAgentAnalyticsPanel';

interface ReferralAgent {
  id: number;
  phone: string;
  password?: string;
  name: string;
  unique_code: string;
  is_active: boolean;
}

interface ReferralCompany {
  id: number;
  name: string;
  phone: string;
  is_enabled: boolean;
  trial_end_date: string | null;
  trial_started_at: string | null;
  created_at: string;
}

interface AgentStats {
  total_companies: number;
  active_companies: number;
  trial_companies: number;
  disabled_companies: number;
}

interface ReferralAgentPanelProps {
  agentData?: any;
  onLogout?: () => void;
}

export default function ReferralAgentPanel({ agentData, onLogout }: ReferralAgentPanelProps) {
  const [activeTab, setActiveTab] = useState<'stats' | 'analytics'>('stats');

  // 🌍 Язык по умолчанию — узбекский
  const [language, setLanguage] = useState<Language>('uz');
  const t = useTranslation(language);

  const [agent, setAgent] = useState<ReferralAgent | null>(null);
  const [companies, setCompanies] = useState<ReferralCompany[]>([]);
  const [stats, setStats] = useState<AgentStats>({
    total_companies: 0,
    active_companies: 0,
    trial_companies: 0,
    disabled_companies: 0
  });

  useEffect(() => {
    if (agentData) {
      // Используем данные, переданные из App.tsx после единого входа
      setAgent(agentData);
      loadAgentData(agentData.id);
    }
  }, [agentData]);

  const loadAgentData = async (agentId: number) => {
    try {
      // Загружаем компании агента
      const companiesData = await api.referrals.getMyCompanies(agentId);
      setCompanies(companiesData || []);

      // Загружаем статистику
      const statsData = await api.referrals.getAgentStats(agentId);
      setStats(statsData || {
        total_companies: 0,
        active_companies: 0,
        trial_companies: 0,
        disabled_companies: 0
      });
    } catch (error: any) {
      console.error('Error loading agent data:', error);
      alert(t.dataLoadError + ': ' + (error.message || t.unknownError));
    }
  };

  const handleLogout = () => {
    api.removeAuthToken();
    if (onLogout) {
      onLogout();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert(`✅ ${t.codeCopied}: ${text}`);
  };

  const isTrialActive = (company: ReferralCompany) => {
    if (!company.trial_end_date) return false;
    return new Date(company.trial_end_date) > new Date();
  };

  const getDaysRemaining = (trialEndDate: string) => {
    const end = new Date(trialEndDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  // Панель агента
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Шапка с информацией об агенте */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl shadow-lg p-6 mb-6 text-white">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-lg">
                <Ticket className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{t.welcomeAgent}, {agent?.name}!</h1>
                <p className="text-purple-100 mt-1">+998 {agent?.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* 🌍 Переключатель языка */}
              <div className="flex bg-white/20 rounded-lg overflow-hidden">
                <button
                  onClick={() => setLanguage('uz')}
                  className={`px-3 py-2 text-sm font-medium transition-colors flex items-center gap-1 ${
                    language === 'uz' ? 'bg-white text-purple-700' : 'text-white hover:bg-white/10'
                  }`}
                >
                  <Globe className="w-4 h-4" />
                  UZ
                </button>
                <button
                  onClick={() => setLanguage('ru')}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    language === 'ru' ? 'bg-white text-purple-700' : 'text-white hover:bg-white/10'
                  }`}
                >
                  RU
                </button>
              </div>
              <button
                onClick={handleLogout}
                className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                <LogOut className="w-5 h-5" />
                {t.logout}
              </button>
            </div>
          </div>
        </div>

        {/* Реферальный код и пароль */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6 border-2 border-purple-100">
          <div className="text-center mb-6">
            <div className="inline-block bg-purple-50 p-4 rounded-lg mb-4">
              <Ticket className="w-12 h-12 text-purple-600 mx-auto" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">{t.yourLoginData}</h2>
            <p className="text-gray-500">{t.provideToCompanies}</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Реферальный код */}
            <div className="bg-gradient-to-r from-purple-100 to-blue-100 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <Ticket className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold text-gray-700">{t.referralCode}</h3>
              </div>
              <div className="text-5xl font-bold text-purple-600 font-mono tracking-widest mb-3">
                {agent?.unique_code}
              </div>
              <button
                onClick={() => agent && copyToClipboard(agent.unique_code)}
                className="w-full bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                📋 {t.copyReferralCode}
              </button>
            </div>

            {/* Пароль */}
            {agent?.password && (
              <div className="bg-gradient-to-r from-gray-100 to-gray-200 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Lock className="w-5 h-5 text-gray-600" />
                  <h3 className="font-semibold text-gray-700">{t.password}</h3>
                </div>
                <div className="text-5xl font-bold text-gray-700 font-mono mb-3">
                  {agent.password}
                </div>
                <button
                  onClick={() => agent.password && copyToClipboard(agent.password)}
                  className="w-full bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors font-medium"
                >
                  📋 {t.copyCode}
                </button>
              </div>
            )}
          </div>

          <p className="text-sm text-gray-500 text-center mt-4">
            💡 {t.trialPeriodInfo}
          </p>
        </div>

        {/* Вкладки */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'stats'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            📊 {t.myCompanies || 'Мои компании'}
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'analytics'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            💰 {t.financialAnalytics || 'Финансовая аналитика'}
          </button>
        </div>

        {activeTab === 'stats' && (
          <>
            {/* Статистика */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-purple-100">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-6 h-6 text-purple-600" />
              <span className="text-sm font-medium text-gray-600">{t.totalProducts}</span>
            </div>
            <div className="text-3xl font-bold text-purple-600">{stats.total_companies}</div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-green-100">
            <div className="flex items-center gap-3 mb-2">
              <Check className="w-6 h-6 text-green-600" />
              <span className="text-sm font-medium text-gray-600">{t.active}</span>
            </div>
            <div className="text-3xl font-bold text-green-600">{stats.active_companies}</div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-blue-100">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-6 h-6 text-blue-600" />
              <span className="text-sm font-medium text-gray-600">{t.trialCompanies}</span>
            </div>
            <div className="text-3xl font-bold text-blue-600">{stats.trial_companies}</div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-6 h-6 text-gray-600" />
              <span className="text-sm font-medium text-gray-600">{t.disabledCompanies}</span>
            </div>
            <div className="text-3xl font-bold text-gray-600">{stats.disabled_companies}</div>
          </div>
        </div>

        {/* Список компаний */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-purple-600" />
            {t.myCompanies}
          </h2>

          {companies.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">{t.noCompaniesYet}</h3>
              <p className="text-gray-500">
                {t.shareYourCode} <span className="font-mono font-bold text-purple-600">{agent?.unique_code}</span>
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {companies.map((company) => (
                <div
                  key={company.id}
                  className={`border-2 rounded-lg p-4 transition-all ${
                    company.is_enabled
                      ? 'border-green-200 bg-green-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-gray-800">{company.name}</h3>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            company.is_enabled
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {company.is_enabled ? `✓ ${t.active}` : `● ${t.disabled}`}
                        </span>
                        {isTrialActive(company) && (
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            🕐 {t.trial}
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-gray-600 mb-3">
                        📱 +998 {company.phone}
                      </p>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">{t.registeredOn}:</span>
                          <div className="font-medium text-gray-700">
                            {new Date(company.created_at).toLocaleDateString('ru-RU')}
                          </div>
                        </div>

                        {company.trial_end_date && (
                          <div>
                            <span className="text-gray-500">{t.trialUntil}:</span>
                            <div className={`font-medium ${isTrialActive(company) ? 'text-blue-600' : 'text-gray-600'}`}>
                              {new Date(company.trial_end_date).toLocaleDateString('ru-RU')}
                              {isTrialActive(company) && (
                                <span className="text-xs ml-2">
                                  ({getDaysRemaining(company.trial_end_date)} {t.days})
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
          </>
        )}

        {/* Финансовая аналитика */}
        {activeTab === 'analytics' && agent && (
          <ReferralAgentAnalyticsPanel agentId={agent.id} />
        )}
      </div>
    </div>
  );
}
