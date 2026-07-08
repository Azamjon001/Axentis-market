import { useState, useEffect, useMemo } from 'react';
import { Receipt, Save, X, TrendingDown, Plus, Trash2, Calendar, Clock, DollarSign, Edit2, Percent, AlertCircle } from 'lucide-react';
import { getCurrentLanguage, useTranslation, type Language } from '../utils/translations';
import { getAuthToken } from '../utils/api';

// Заголовки с токеном компании — create/update/delete расходов требуют авторизации
const authHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

type ExpenseType = 'monthly' | 'percentage' | 'one_time';

interface CustomExpense {
  id: number;
  company_id: number;
  expense_name: string;
  amount: number;
  monthly_amount: number;
  expense_type: ExpenseType;
  percentage_value: number;
  description: string | null;
  expense_date: string;
  created_at: string;
}

interface ExpensesManagerProps {
  companyId: number;
  onCustomExpensesUpdate?: (totalAccumulated: number, expenses: CustomExpense[]) => void;
}

const TYPE_LABELS: Record<ExpenseType, { ru: string; uz: string; color: string }> = {
  monthly:    { ru: 'Ежемесячный', uz: 'Oylik',      color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  percentage: { ru: 'Процентный',  uz: 'Foizli',     color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  one_time:   { ru: 'Разовый',     uz: 'Bir martalik', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
};

export default function ExpensesManager({ companyId, onCustomExpensesUpdate }: ExpensesManagerProps) {
  const [language, setLanguage] = useState<Language>(getCurrentLanguage());
  const t = useTranslation(language);

  useEffect(() => {
    const handleLang = (e: CustomEvent) => setLanguage(e.detail);
    window.addEventListener('languageChange', handleLang as EventListener);
    return () => window.removeEventListener('languageChange', handleLang as EventListener);
  }, []);

  const [expenses, setExpenses] = useState<CustomExpense[]>([]);
  const [loadingCustom, setLoadingCustom] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const emptyForm = {
    expense_name: '',
    expense_type: 'monthly' as ExpenseType,
    monthly_amount: '',
    percentage_value: '',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    description: '',
  };
  const [newForm, setNewForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();
  const progressPercent = (currentDay / daysInMonth) * 100;

  const getDailyRate = (monthlyAmount: number) => monthlyAmount / daysInMonth;
  const getAccumulatedThisMonth = (monthlyAmount: number) => getDailyRate(monthlyAmount) * currentDay;

  const monthlyExpenses = useMemo(() => expenses.filter(e => (e.expense_type || 'monthly') === 'monthly'), [expenses]);
  const percentageExpenses = useMemo(() => expenses.filter(e => e.expense_type === 'percentage'), [expenses]);
  const oneTimeExpenses = useMemo(() => expenses.filter(e => e.expense_type === 'one_time'), [expenses]);

  const totalMonthlyAccumulated = useMemo(() =>
    monthlyExpenses.reduce((sum, e) => sum + getAccumulatedThisMonth(e.monthly_amount || 0), 0),
    [monthlyExpenses, currentDay, daysInMonth]
  );

  const totalMonthlyFull = useMemo(() =>
    monthlyExpenses.reduce((sum, e) => sum + (e.monthly_amount || 0), 0),
    [monthlyExpenses]
  );

  useEffect(() => { loadExpenses(); }, [companyId]);

  useEffect(() => {
    if (onCustomExpensesUpdate) {
      onCustomExpensesUpdate(totalMonthlyAccumulated, expenses);
    }
  }, [totalMonthlyAccumulated, expenses, onCustomExpensesUpdate]);

  const loadExpenses = async () => {
    try {
      setLoadingCustom(true);
      const res = await fetch(`/api/custom-expenses?companyId=${companyId}`);
      if (res.ok) {
        const data = await res.json();
        setExpenses(data || []);
      } else {
        setExpenses([]);
      }
    } catch {
      setExpenses([]);
    } finally {
      setLoadingCustom(false);
    }
  };

  const handleAdd = async () => {
    if (!newForm.expense_name.trim()) { alert(t.fillNameAndAmount); return; }

    const type = newForm.expense_type;
    if (type === 'monthly' && !newForm.monthly_amount) { alert(t.fillNameAndAmount); return; }
    if (type === 'percentage' && !newForm.percentage_value) { alert(t.fillNameAndAmount); return; }
    if (type === 'one_time' && !newForm.amount) { alert(t.fillNameAndAmount); return; }

    const body: any = {
      company_id: companyId,
      expense_name: newForm.expense_name,
      expense_type: type,
      amount: type === 'one_time' ? parseFloat(newForm.amount) || 0 : 0,
      monthly_amount: type === 'monthly' ? parseFloat(newForm.monthly_amount) || 0 : 0,
      percentage_value: type === 'percentage' ? parseFloat(newForm.percentage_value) || 0 : 0,
      description: newForm.description || null,
    };
    if (type === 'one_time') body.expense_date = newForm.expense_date;

    try {
      const res = await fetch('/api/custom-expenses', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setNewForm(emptyForm);
        setShowAddForm(false);
        await loadExpenses();
        alert(t.expenseAddedSuccess);
      } else {
        alert(t.errorAddingExpense);
      }
    } catch {
      alert(t.errorAddingExpense);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t.deleteExpenseConfirm)) return;
    try {
      const res = await fetch(`/api/custom-expenses/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (res.ok) { await loadExpenses(); }
    } catch { /* ignore */ }
  };

  const handleStartEdit = (e: CustomExpense) => {
    setEditingId(e.id);
    setEditForm({
      expense_name: e.expense_name,
      expense_type: e.expense_type || 'monthly',
      monthly_amount: String(e.monthly_amount || 0),
      percentage_value: String(e.percentage_value || 0),
      amount: String(e.amount || 0),
      expense_date: e.expense_date ? e.expense_date.split('T')[0] : new Date().toISOString().split('T')[0],
      description: e.description || '',
    });
  };

  const handleSaveEdit = async (id: number) => {
    const type = editForm.expense_type;
    const body: any = {
      expense_name: editForm.expense_name,
      expense_type: type,
      amount: type === 'one_time' ? parseFloat(editForm.amount) || 0 : 0,
      monthly_amount: type === 'monthly' ? parseFloat(editForm.monthly_amount) || 0 : 0,
      percentage_value: type === 'percentage' ? parseFloat(editForm.percentage_value) || 0 : 0,
      description: editForm.description || null,
    };
    if (type === 'one_time') body.expense_date = editForm.expense_date;

    try {
      const res = await fetch(`/api/custom-expenses/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (res.ok) { setEditingId(null); await loadExpenses(); }
      else alert(t.errorUpdatingExpenses);
    } catch {
      alert(t.errorUpdatingExpenses);
    }
  };

  const formatPrice = (n: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + ' сум';

  const cardColors = [
    { gradient: 'from-blue-500 to-blue-600', lightBg: 'from-blue-50 to-blue-100', border: 'border-blue-200', text: 'text-blue-900', textLight: 'text-blue-600', darkBg: 'dark:from-blue-900/30 dark:to-blue-800/30', darkBorder: 'dark:border-blue-700', darkText: 'dark:text-blue-300', darkTextLight: 'dark:text-blue-400' },
    { gradient: 'from-emerald-500 to-emerald-600', lightBg: 'from-emerald-50 to-emerald-100', border: 'border-emerald-200', text: 'text-emerald-900', textLight: 'text-emerald-600', darkBg: 'dark:from-emerald-900/30 dark:to-emerald-800/30', darkBorder: 'dark:border-emerald-700', darkText: 'dark:text-emerald-300', darkTextLight: 'dark:text-emerald-400' },
    { gradient: 'from-orange-500 to-orange-600', lightBg: 'from-orange-50 to-orange-100', border: 'border-orange-200', text: 'text-orange-900', textLight: 'text-orange-600', darkBg: 'dark:from-orange-900/30 dark:to-orange-800/30', darkBorder: 'dark:border-orange-700', darkText: 'dark:text-orange-300', darkTextLight: 'dark:text-orange-400' },
    { gradient: 'from-purple-500 to-purple-600', lightBg: 'from-purple-50 to-purple-100', border: 'border-purple-200', text: 'text-purple-900', textLight: 'text-purple-600', darkBg: 'dark:from-purple-900/30 dark:to-purple-800/30', darkBorder: 'dark:border-purple-700', darkText: 'dark:text-purple-300', darkTextLight: 'dark:text-purple-400' },
    { gradient: 'from-pink-500 to-pink-600', lightBg: 'from-pink-50 to-pink-100', border: 'border-pink-200', text: 'text-pink-900', textLight: 'text-pink-600', darkBg: 'dark:from-pink-900/30 dark:to-pink-800/30', darkBorder: 'dark:border-pink-700', darkText: 'dark:text-pink-300', darkTextLight: 'dark:text-pink-400' },
  ];

  const renderTypeSelector = (value: ExpenseType, onChange: (v: ExpenseType) => void) => (
    <div className="grid grid-cols-3 gap-2">
      {(['monthly', 'percentage', 'one_time'] as ExpenseType[]).map(type => (
        <button
          key={type}
          type="button"
          onClick={() => onChange(type)}
          className={`px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
            value === type
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
              : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-blue-300'
          }`}
        >
          {type === 'monthly'    && (language === 'uz' ? 'Oylik' : 'Ежемес.')}
          {type === 'percentage' && (language === 'uz' ? 'Foizli' : 'Процент')}
          {type === 'one_time'   && (language === 'uz' ? 'Bir martalik' : 'Разовый')}
        </button>
      ))}
    </div>
  );

  const renderAmountFields = (form: typeof newForm, setForm: (f: typeof newForm) => void) => {
    const type = form.expense_type;
    return (
      <>
        {type === 'monthly' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {language === 'uz' ? 'Oylik summa (so\'m)' : 'Сумма в месяц (сум)'}
            </label>
            <input
              type="number"
              value={form.monthly_amount}
              onChange={e => setForm({ ...form, monthly_amount: e.target.value })}
              className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg focus:outline-none focus:border-green-500"
              placeholder="3 000 000"
            />
            {form.monthly_amount && parseFloat(form.monthly_amount) > 0 && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                ≈ {formatPrice(parseFloat(form.monthly_amount) / daysInMonth)} / {language === 'uz' ? 'kun' : 'день'}
              </p>
            )}
          </div>
        )}
        {type === 'percentage' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {language === 'uz' ? 'Foiz (%)' : 'Процент (%)'}
            </label>
            <input
              type="number"
              value={form.percentage_value}
              onChange={e => setForm({ ...form, percentage_value: e.target.value })}
              className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg focus:outline-none focus:border-green-500"
              placeholder="5"
              step="0.01"
              min="0"
              max="100"
            />
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
              {language === 'uz' ? 'Daromaddan hisoblangan foiz' : 'Процент от выручки периода'}
            </p>
          </div>
        )}
        {type === 'one_time' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {language === 'uz' ? 'Summa (so\'m)' : 'Сумма (сум)'}
              </label>
              <input
                type="number"
                value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg focus:outline-none focus:border-green-500"
                placeholder="500 000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {language === 'uz' ? 'Sana' : 'Дата расхода'}
              </label>
              <input
                type="date"
                value={form.expense_date}
                onChange={e => setForm({ ...form, expense_date: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg focus:outline-none focus:border-green-500"
              />
            </div>
          </>
        )}
      </>
    );
  };

  const renderCard = (expense: CustomExpense, index: number) => {
    const colors = cardColors[index % cardColors.length];
    const type: ExpenseType = expense.expense_type || 'monthly';
    const typeLabel = TYPE_LABELS[type];
    const isEditing = editingId === expense.id;

    return (
      <div key={expense.id} className={`group bg-gradient-to-br ${colors.lightBg} ${colors.darkBg} border-2 ${colors.border} ${colors.darkBorder} rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 relative`}>
        {/* Action buttons */}
        <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isEditing && (
            <>
              <button onClick={() => handleStartEdit(expense)} className="p-2 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 transition-colors">
                <Edit2 className="w-4 h-4" />
              </button>
              <button onClick={() => handleDelete(expense.id)} className="p-2 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-3">
            <input
              type="text"
              value={editForm.expense_name}
              onChange={e => setEditForm({ ...editForm, expense_name: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg text-sm"
              placeholder={t.expenseName}
            />
            {renderTypeSelector(editForm.expense_type, (v) => setEditForm({ ...editForm, expense_type: v }))}
            {renderAmountFields(editForm, setEditForm)}
            <input
              type="text"
              value={editForm.description}
              onChange={e => setEditForm({ ...editForm, description: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg text-sm"
              placeholder={t.descriptionOptional}
            />
            <div className="flex gap-2">
              <button onClick={() => handleSaveEdit(expense.id)} className="flex-1 flex items-center justify-center gap-1 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 text-sm font-medium">
                <Save className="w-3 h-3" /> {t.save}
              </button>
              <button onClick={() => setEditingId(null)} className="flex-1 flex items-center justify-center gap-1 bg-gray-500 text-white px-3 py-2 rounded-lg hover:bg-gray-600 text-sm font-medium">
                <X className="w-3 h-3" /> {t.cancel}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Header: icon + name + type badge */}
            <div className="flex items-start gap-3 mb-4 pr-16">
              <div className={`bg-gradient-to-br ${colors.gradient} p-3 rounded-xl shadow-md shrink-0`}>
                {type === 'percentage' ? <Percent className="w-6 h-6 text-white" /> :
                 type === 'one_time'   ? <AlertCircle className="w-6 h-6 text-white" /> :
                                         <Receipt className="w-6 h-6 text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-lg font-semibold ${colors.text} ${colors.darkText} truncate`} title={expense.expense_name}>
                  {expense.expense_name}
                </div>
                <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-1 ${typeLabel.color}`}>
                  {language === 'uz' ? typeLabel.uz : typeLabel.ru}
                </span>
              </div>
            </div>

            {/* Amount display per type */}
            {type === 'monthly' && (
              <>
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <DollarSign className="w-3 h-3" />
                    {language === 'uz' ? 'Oylik summa' : 'Сумма в месяц'}
                  </div>
                  <div className={`text-2xl font-bold ${colors.text} ${colors.darkText}`}>
                    {formatPrice(expense.monthly_amount || 0)}
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-2 bg-white/60 dark:bg-gray-800/40 rounded-lg px-3 py-2">
                  <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">{language === 'uz' ? 'Kuniga' : 'В день'}:</span>
                  <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                    {formatPrice(getDailyRate(expense.monthly_amount || 0))}
                  </span>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                      {language === 'uz' ? `${currentDay} kunga yig'ildi` : `Накоплено за ${currentDay} дней`}
                    </span>
                    <span className="text-lg font-bold text-red-700 dark:text-red-300">
                      {formatPrice(getAccumulatedThisMonth(expense.monthly_amount || 0))}
                    </span>
                  </div>
                  <div className="w-full bg-red-100 dark:bg-red-900/40 rounded-full h-1.5 mt-1.5">
                    <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${progressPercent}%` }} />
                  </div>
                </div>
              </>
            )}

            {type === 'percentage' && (
              <>
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <Percent className="w-3 h-3" />
                    {language === 'uz' ? 'Foiz stavkasi' : 'Процентная ставка'}
                  </div>
                  <div className={`text-3xl font-bold ${colors.text} ${colors.darkText}`}>
                    {expense.percentage_value || 0}%
                  </div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg px-3 py-2 text-xs text-purple-700 dark:text-purple-300">
                  {language === 'uz'
                    ? 'Tanlangan davr daromadidan hisoblanadi'
                    : 'Рассчитывается от выручки выбранного периода'}
                </div>
              </>
            )}

            {type === 'one_time' && (
              <>
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <DollarSign className="w-3 h-3" />
                    {language === 'uz' ? 'Summa' : 'Сумма'}
                  </div>
                  <div className={`text-2xl font-bold ${colors.text} ${colors.darkText}`}>
                    {formatPrice(expense.amount || 0)}
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg px-3 py-2">
                  <Calendar className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
                  <div>
                    <div className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                      {language === 'uz' ? 'Sana' : 'Дата расхода'}
                    </div>
                    <div className="text-sm font-bold text-orange-800 dark:text-orange-200">
                      {expense.expense_date
                        ? new Date(expense.expense_date).toLocaleDateString(language === 'uz' ? 'uz-UZ' : 'ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
                        : '—'}
                    </div>
                  </div>
                </div>
              </>
            )}

            {expense.description && (
              <div className={`text-sm ${colors.textLight} ${colors.darkTextLight} mt-3 truncate`} title={expense.description}>
                {expense.description}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
          <div>
            <h2 className="text-xl font-bold dark:text-white">
              {language === 'uz' ? 'Kompaniya xarajatlari' : 'Расходы компании'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {language === 'uz' ? 'Oylik to\'plangan' : 'Накоплено за месяц'}:{' '}
              <strong className="text-red-600 dark:text-red-400">{formatPrice(totalMonthlyAccumulated)}</strong>
              <span className="ml-2 text-gray-400 dark:text-gray-500">
                / {formatPrice(totalMonthlyFull)} {language === 'uz' ? 'oyiga' : 'в месяц'}
              </span>
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t.addExpense}
        </button>
      </div>

      {/* Month progress bar */}
      <div className="mb-6 bg-gray-100 dark:bg-gray-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <Calendar className="w-4 h-4" />
            <span>{language === 'uz' ? 'Oyning borishi' : 'Прогресс месяца'}</span>
          </div>
          <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
            {currentDay} / {daysInMonth} {language === 'uz' ? 'kun' : 'дней'}
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
          <span>{language === 'uz' ? 'Oy boshi' : 'Начало'}</span>
          <span>{language === 'uz' ? 'Oy oxiri' : 'Конец месяца'}</span>
        </div>
      </div>

      {/* Add form modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setShowAddForm(false); setNewForm(emptyForm); }}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 dark:text-white">
                <Plus className="w-5 h-5 text-green-600" />
                {language === 'uz' ? 'Yangi xarajat' : 'Новый расход'}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.expenseName}</label>
                  <input
                    type="text"
                    value={newForm.expense_name}
                    onChange={e => setNewForm({ ...newForm, expense_name: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg focus:outline-none focus:border-green-500"
                    placeholder={t.expenseNamePlaceholder}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {language === 'uz' ? 'Xarajat turi' : 'Тип расхода'}
                  </label>
                  {renderTypeSelector(newForm.expense_type, (v) => setNewForm({ ...newForm, expense_type: v }))}
                </div>

                {renderAmountFields(newForm, setNewForm)}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.descriptionOptional}</label>
                  <input
                    type="text"
                    value={newForm.description}
                    onChange={e => setNewForm({ ...newForm, description: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg focus:outline-none focus:border-green-500"
                    placeholder={t.additionalInfo}
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button onClick={handleAdd} className="flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium">
                  <Save className="w-4 h-4" /> {t.saveExpense}
                </button>
                <button onClick={() => { setShowAddForm(false); setNewForm(emptyForm); }} className="flex items-center gap-2 bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 transition-colors font-medium">
                  <X className="w-4 h-4" /> {t.cancel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expense cards - grouped by type */}
      {loadingCustom ? (
        <div className="flex items-center justify-center p-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">{language === 'uz' ? 'Xarajatlar yo\'q' : 'Нет расходов'}</p>
          <p className="text-sm mt-1">{language === 'uz' ? 'Yangi xarajat qo\'shish uchun yuqoridagi tugmani bosing' : 'Нажмите «Добавить расход» чтобы начать'}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Monthly */}
          {monthlyExpenses.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {language === 'uz' ? 'Oylik xarajatlar' : 'Ежемесячные расходы'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {monthlyExpenses.map((e, i) => renderCard(e, i))}
              </div>
            </div>
          )}

          {/* Percentage */}
          {percentageExpenses.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Percent className="w-4 h-4" />
                {language === 'uz' ? 'Foizli xarajatlar' : 'Процентные расходы'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {percentageExpenses.map((e, i) => renderCard(e, monthlyExpenses.length + i))}
              </div>
            </div>
          )}

          {/* One-time */}
          {oneTimeExpenses.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {language === 'uz' ? 'Bir martalik xarajatlar' : 'Разовые расходы'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {oneTimeExpenses.map((e, i) => renderCard(e, monthlyExpenses.length + percentageExpenses.length + i))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary footer */}
      {expenses.length > 0 && (
        <div className="mt-6 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border border-red-200 dark:border-red-700 rounded-xl p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{language === 'uz' ? 'Oylik jami' : 'Всего в месяц'}</div>
              <div className="text-xl font-bold text-gray-800 dark:text-gray-200">{formatPrice(totalMonthlyFull)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{language === 'uz' ? 'Kuniga jami' : 'Всего в день'}</div>
              <div className="text-xl font-bold text-orange-600 dark:text-orange-400">{formatPrice(getDailyRate(totalMonthlyFull))}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {language === 'uz' ? `${currentDay} kunga yig'ildi` : `Накоплено за ${currentDay} дней`}
              </div>
              <div className="text-xl font-bold text-red-600 dark:text-red-400">{formatPrice(totalMonthlyAccumulated)}</div>
            </div>
          </div>
          {percentageExpenses.length > 0 && (
            <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-700 text-center text-sm text-purple-600 dark:text-purple-400">
              {language === 'uz'
                ? `+ ${percentageExpenses.map(e => `${e.expense_name}: ${e.percentage_value}%`).join(', ')} (daromaddan)`
                : `+ ${percentageExpenses.map(e => `${e.expense_name}: ${e.percentage_value}%`).join(', ')} (от выручки)`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
