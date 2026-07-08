import { useState, useEffect } from 'react';
import { DollarSign, Building2, Percent, Eye, EyeOff, Wallet } from 'lucide-react';
import api from '../utils/api';
import { getCurrentLanguage, useTranslation } from '../utils/translations';

interface CompanyFinancials {
  company_id: number;
  company_name: string;
  company_phone: string;
  total_sales: number;
  platform_percent: number;
  platform_fee: number;
  agent_commission: number;
  is_enabled: boolean;
  is_trial_active: boolean;
}

interface AnalyticsData {
  companies: CompanyFinancials[];
  total_companies: number;
  total_company_sales: number;
  total_platform_fees: number;
  total_agent_earnings: number;
  agent_percent: number;
}

interface ReferralAgentAnalyticsPanelProps {
  agentId?: number;
}

export default function ReferralAgentAnalyticsPanel({ agentId }: ReferralAgentAnalyticsPanelProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEarnings, setShowEarnings] = useState(true);
  
  // Translations
  const language = getCurrentLanguage();
  const t = useTranslation(language);

  useEffect(() => {
    if (agentId) {
      loadAnalytics();
    }
  }, [agentId]);

  const loadAnalytics = async () => {
    if (!agentId) return;
    
    try {
      setLoading(true);
      const data = await api.referrals.getAgentAnalytics(agentId);
      setAnalytics(data);
    } catch (error) {
      console.error('❌ Error loading analytics:', error);
      alert(t.errorLoadingData || 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU').format(Math.round(amount));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">{t.loading || 'Загрузка...'}</div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">{t.loading || 'Нет данных'}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">
          {t.financialAnalytics || 'Финансовая аналитика'}
        </h2>
        <button
          onClick={() => setShowEarnings(!showEarnings)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          {showEarnings ? (
            <>
              <Eye className="w-5 h-5" />
              {t.hideEarnings || 'Скрыть доходы'}
            </>
          ) : (
            <>
              <EyeOff className="w-5 h-5" />
              {t.showEarnings || 'Показать доходы'}
            </>
          )}
        </button>
      </div>

      {/* Основная статистика */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Общая выручка компаний */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="w-6 h-6" />
            <span className="text-sm font-medium opacity-90">
              {t.totalCompanySales || 'Продажи компаний'}
            </span>
          </div>
          <div className="text-3xl font-bold">
            {showEarnings ? `${formatCurrency(analytics.total_company_sales)} сум` : '••••••'}
          </div>
          <div className="text-sm opacity-75 mt-1">
            {analytics.total_companies} {t.companiesLinked || 'компаний'}
          </div>
        </div>

        {/* Комиссия платформы (10%) */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Percent className="w-6 h-6" />
            <span className="text-sm font-medium opacity-90">
              {t.platformFee || 'Комиссия платформы'}
            </span>
          </div>
          <div className="text-3xl font-bold">
            {showEarnings ? `${formatCurrency(analytics.total_platform_fees)} сум` : '••••••'}
          </div>
          <div className="text-sm opacity-75 mt-1">
            {t.fromCompanyRevenue || 'от выручки компаний'}
          </div>
        </div>

        {/* Доход агента */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Wallet className="w-6 h-6" />
            <span className="text-sm font-medium opacity-90">
              {t.yourEarnings || 'Ваш доход'}
            </span>
          </div>
          <div className="text-3xl font-bold">
            {showEarnings ? `${formatCurrency(analytics.total_agent_earnings)} сум` : '••••••'}
          </div>
          <div className="text-sm opacity-75 mt-1">
            {analytics.agent_percent}% {t.fromPlatformFee || 'от комиссии платформы'}
          </div>
        </div>
      </div>

      {/* Пояснение расчета */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <DollarSign className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-blue-900 mb-2">
              {t.howCalculated || 'Как рассчитывается ваш доход?'}
            </h4>
            <ul className="space-y-1 text-sm text-blue-800">
              <li>• Платформа берёт индивидуальный процент от выручки каждой компании</li>
              <li>• Вы получаете {analytics.agent_percent}% от этой комиссии платформы</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Таблица компаний */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-purple-600" />
            {t.companiesFinancials || 'Финансы по компаниям'}
          </h3>
        </div>

        {analytics.companies.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {t.noCompaniesYet || 'Компании еще не зарегистрировались'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t.company || 'Компания'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t.status || 'Статус'}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t.totalSales || 'Продажи'}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t.platformFee || 'Комиссия платформы'}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t.yourCommission || 'Ваша комиссия'}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analytics.companies.map((company) => (
                  <tr key={company.company_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="text-sm font-medium text-gray-900">{company.company_name}</div>
                        <div className="text-sm text-gray-500">+998 {company.company_phone}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            company.is_enabled
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {company.is_enabled ? (t.active || 'Активна') : (t.disabled || 'Отключена')}
                        </span>
                        {company.is_trial_active && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {t.trial || 'Пробный'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-medium text-gray-900">
                        {showEarnings ? `${formatCurrency(company.total_sales)} сум` : '••••••'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-medium text-purple-600">
                        {showEarnings ? `${formatCurrency(company.platform_fee)} сум` : '••••••'}
                      </div>
                      <div className="text-xs text-gray-400">{company.platform_percent}%</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-bold text-green-600">
                        {showEarnings ? `${formatCurrency(company.agent_commission)} сум` : '••••••'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
