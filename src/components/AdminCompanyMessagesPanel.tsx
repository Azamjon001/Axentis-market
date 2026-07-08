import { useState, useEffect } from 'react';
import { Send, Building2, Search, X, CheckCircle, AlertCircle, MessageSquare } from 'lucide-react';
import api from '../utils/api';

interface CompanyItem {
  id: number;
  name: string;
  description: string;
}

export default function AdminCompanyMessagesPanel() {
  const [sendMode, setSendMode] = useState<'single' | 'all'>('single');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<CompanyItem[]>([]);
  const [showCompaniesList, setShowCompaniesList] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Загрузить список компаний
  useEffect(() => {
    loadCompanies();
  }, []);

  // Фильтрация компаний
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredCompanies(companies);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredCompanies(companies.filter(c => 
        c.name.toLowerCase().includes(query) || 
        c.description.toLowerCase().includes(query)
      ));
    }
  }, [searchQuery, companies]);

  const loadCompanies = async () => {
    try {
      // ✅ auth-aware api-хелпер: admin-endpoint защищён RequireAdmin,
      // «голый» fetch без JWT возвращал 401.
      const data = await api.companyMessages.adminListCompanies();
      const list = Array.isArray(data) ? data : (data?.companies || []);
      setCompanies(list);
      setFilteredCompanies(list);
    } catch (error) {
      console.error('Error loading companies:', error);
    }
  };

  const handleSend = async () => {
    // Валидация
    if (!title.trim()) {
      setResult({ success: false, message: 'Введите заголовок сообщения' });
      return;
    }
    if (!message.trim()) {
      setResult({ success: false, message: 'Введите текст сообщения' });
      return;
    }
    if (sendMode === 'single' && !companyId) {
      setResult({ success: false, message: 'Выберите компанию из списка' });
      return;
    }

    // Подтверждение для массовой рассылки
    if (sendMode === 'all') {
      if (!confirm(`📢 Отправить сообщение ВСЕМ компаниям (${companies.length} шт.)?\n\nЗаголовок: ${title}\n\nЭто действие нельзя отменить!`)) {
        return;
      }
    }

    setSending(true);
    setResult(null);

    try {
      const data = sendMode === 'all'
        ? await api.companyMessages.adminSendAll({ title: title.trim(), message: message.trim() })
        : await api.companyMessages.adminSend({ company_id: companyId as number, title: title.trim(), message: message.trim() });

      if (data && data.success) {
        const selectedCompany = companies.find(c => c.id === companyId);
        setResult({ 
          success: true, 
          message: sendMode === 'all' 
            ? `✅ Сообщение отправлено ${data.sentCount} компаниям!` 
            : `✅ Сообщение отправлено компании "${selectedCompany?.name}"!`
        });
        // Очистить форму
        setTitle('');
        setMessage('');
        setCompanyId(null);
        setSearchQuery('');
      } else {
        setResult({ success: false, message: data.error || 'Ошибка отправки' });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setResult({ success: false, message: error instanceof Error ? error.message : 'Ошибка сети при отправке' });
    } finally {
      setSending(false);
    }
  };

  const selectCompany = (company: CompanyItem) => {
    setCompanyId(company.id);
    setSearchQuery(company.name);
    setShowCompaniesList(false);
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Сообщения компаниям</h2>
            <p className="text-gray-500 text-sm">Отправка сообщений от имени Axis</p>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-3">Кому отправить?</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setSendMode('single');
                setCompanyId(null);
                setSearchQuery('');
              }}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                sendMode === 'single'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
              }`}
            >
              <Building2 className="w-5 h-5" />
              <span className="font-medium">Одной</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSendMode('all');
                setCompanyId(null);
                setSearchQuery('');
              }}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                sendMode === 'all'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
              }`}
            >
              <Building2 className="w-5 h-5" />
              <span className="font-medium">Всем ({companies.length})</span>
            </button>
          </div>
        </div>

        {/* Company Selection (only for single mode) */}
        {sendMode === 'single' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Выберите компанию
            </label>
            <div className="relative">
              <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                <Search className="w-5 h-5 text-gray-400 ml-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowCompaniesList(true);
                  }}
                  onFocus={() => setShowCompaniesList(true)}
                  placeholder="Поиск компании..."
                  className="flex-1 px-3 py-3 outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setCompanyId(null);
                    }}
                    className="p-2 hover:bg-gray-100"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>

              {/* Companies Dropdown */}
              {showCompaniesList && filteredCompanies.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredCompanies.map((company) => (
                    <button
                      key={company.id}
                      type="button"
                      onClick={() => selectCompany(company)}
                      className="w-full px-4 py-3 text-left hover:bg-blue-50 flex items-center gap-3 border-b border-gray-100 last:border-0"
                    >
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-800 truncate">
                          {company.name}
                        </div>
                        {company.description && (
                          <div className="text-sm text-gray-500 truncate">{company.description}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* No results */}
              {showCompaniesList && searchQuery && filteredCompanies.length === 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500">
                  Компании не найдены
                </div>
              )}
            </div>
          </div>
        )}

        {/* Title */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Заголовок сообщения
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например: 📢 Важное объявление от Axis"
            maxLength={100}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
            placeholder="Введите текст сообщения для компании... Можно использовать emoji 😊🎉✨

Без ограничения длины - пишите сколько нужно!"
            rows={8}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          />
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
          disabled={sending || (sendMode === 'single' && !companyId)}
          className={`w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-semibold text-white transition-all ${
            sending || (sendMode === 'single' && !companyId)
              ? 'bg-gray-400 cursor-not-allowed'
              : sendMode === 'all'
                ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 shadow-lg hover:shadow-xl'
                : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg hover:shadow-xl'
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
                  ? `Отправить всем (${companies.length} комп.)` 
                  : 'Отправить компании'}
              </span>
            </>
          )}
        </button>

        {/* Warning for mass send */}
        {sendMode === 'all' && (
          <p className="text-center text-sm text-orange-600 mt-3">
            ⚠️ Сообщение будет отправлено всем {companies.length} компаниям
          </p>
        )}
      </div>
    </div>
  );
}
