import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Receipt, Save, X, TrendingDown, Plus, Trash2, Calendar, Clock, DollarSign, Edit2, Percent, AlertCircle, ChevronRight } from 'lucide-react';
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
  // 📌 Внешний сигнал «открыть форму добавления»: кнопка «Добавить расход»
  // живёт в карточке «Расходы компании» (AnalyticsPanel) и при каждом клике
  // увеличивает счётчик — здесь по нему открывается модальная форма.
  openAddFormSignal?: number;
}

const TYPE_LABELS: Record<ExpenseType, { ru: string; uz: string; color: string }> = {
  monthly:    { ru: 'Ежемесячный', uz: 'Oylik',      color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  percentage: { ru: 'Процентный',  uz: 'Foizli',     color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  one_time:   { ru: 'Разовый',     uz: 'Bir martalik', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
};

export default function ExpensesManager({ companyId, onCustomExpensesUpdate, openAddFormSignal }: ExpensesManagerProps) {
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
  // 🔻 Расходы разделены на 3 типа; списки не разворачиваются на странице,
  // а открываются мини-панелью по клику на карточку типа (как на дашборде)
  const [openPanel, setOpenPanel] = useState<ExpenseType | null>(null);

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

  const totalOneTime = useMemo(() =>
    oneTimeExpenses.reduce((sum, e) => sum + (e.amount || 0), 0),
    [oneTimeExpenses]
  );

  useEffect(() => { loadExpenses(); }, [companyId]);

  // Открытие формы по сигналу извне (кнопка «Добавить расход» в аналитике)
  useEffect(() => {
    if (openAddFormSignal) setShowAddForm(true);
  }, [openAddFormSignal]);

  useEffect(() => {
    if (onCustomExpensesUpdate) {
      onCustomExpensesUpdate(totalMonthlyAccumulated, expenses);
    }
  }, [totalMonthlyAccumulated, expenses, onCustomExpensesUpdate]);

  const loadExpenses = async () => {
    try {
      setLoadingCustom(true);
      // GET требует авторизацию компании (RequireCompany + RequireCompanyScope),
      // иначе сервер отвечает 401 и расходы не подгружаются в аналитику.
      const res = await fetch(`/api/custom-expenses?companyId=${companyId}`, { headers: authHeaders() });
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

  const renderCard = (expense: CustomExpense, _index: number) => {
    const type: ExpenseType = expense.expense_type || 'monthly';
    const typeLabel = TYPE_LABELS[type];
    const isEditing = editingId === expense.id;

    // Компактный акцент по типу расхода — без громоздких градиентных карточек
    const accent = type === 'percentage' ? '#A78BFA' : type === 'one_time' ? '#FB923C' : '#38BDF8';
    const RowIcon = type === 'percentage' ? Percent : type === 'one_time' ? AlertCircle : Receipt;
    const mainValue = type === 'percentage'
      ? `${expense.percentage_value || 0}%`
      : type === 'one_time'
        ? formatPrice(expense.amount || 0)
        : `${formatPrice(expense.monthly_amount || 0)}`;
    const secondary = type === 'percentage'
      ? (language === 'uz' ? 'davr daromadidan' : 'от выручки периода')
      : type === 'one_time'
        ? (expense.expense_date ? new Date(expense.expense_date).toLocaleDateString(language === 'uz' ? 'uz-UZ' : 'ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
        : `${language === 'uz' ? 'kuniga' : 'в день'} ${formatPrice(getDailyRate(expense.monthly_amount || 0))}`;

    return (
      <motion.div
        key={expense.id}
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="relative rounded-xl"
        style={{ background: 'var(--ax-card)', border: '1px solid var(--ax-border)', padding: isEditing ? 14 : '10px 12px' }}
      >
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
          <div className="flex items-center gap-3">
            <span style={{ width: 34, height: 34, borderRadius: 10, background: `${accent}1F`, color: accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <RowIcon className="w-4 h-4" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate font-semibold" style={{ color: 'var(--ax-text)', fontSize: 14 }} title={expense.expense_name}>
                  {expense.expense_name}
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 8, background: `${accent}1A`, color: accent, flexShrink: 0 }}>
                  {language === 'uz' ? typeLabel.uz : typeLabel.ru}
                </span>
              </div>
              <div className="truncate" style={{ fontSize: 11, color: 'var(--ax-text-3)', marginTop: 2 }}>
                {secondary}{expense.description ? ` · ${expense.description}` : ''}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ax-text)', whiteSpace: 'nowrap' }}>{mainValue}</div>
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => handleStartEdit(expense)} className="p-1.5 rounded-lg transition-colors" style={{ background: 'rgba(56,189,248,0.12)', color: '#38BDF8' }} title={t.save}>
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => handleDelete(expense.id)} className="p-1.5 rounded-lg transition-colors" style={{ background: 'rgba(248,113,113,0.12)', color: '#F87171' }} title={t.cancel}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
      {/* Header — добавление расхода живёт на кнопке «Добавить расход»
          в карточке «Расходы компании» (открывает эту же форму) */}
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
        /* 🔻 Три типа расходов — компактные карточки, как показатели на
           дашборде: клик открывает мини-панель со списком. Даже при десятках
           записей секция не разрастается. */
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {([
            {
              type: 'monthly' as ExpenseType,
              icon: <Clock className="w-5 h-5 text-white" />,
              gradient: 'from-sky-500 to-blue-600',
              border: 'border-sky-200 dark:border-sky-700 hover:border-sky-400 dark:hover:border-sky-500',
              bg: 'bg-sky-50 dark:bg-sky-900/20',
              badge: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
              title: language === 'uz' ? 'Oylik xarajatlar' : 'Месячные расходы',
              count: monthlyExpenses.length,
              summary: `${formatPrice(totalMonthlyFull)} ${language === 'uz' ? 'oyiga' : 'в месяц'}`,
            },
            {
              type: 'one_time' as ExpenseType,
              icon: <AlertCircle className="w-5 h-5 text-white" />,
              gradient: 'from-orange-500 to-orange-600',
              border: 'border-orange-200 dark:border-orange-700 hover:border-orange-400 dark:hover:border-orange-500',
              bg: 'bg-orange-50 dark:bg-orange-900/20',
              badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
              title: language === 'uz' ? 'Bir martalik xarajatlar' : 'Разовые расходы',
              count: oneTimeExpenses.length,
              summary: `${language === 'uz' ? 'Jami' : 'Всего'}: ${formatPrice(totalOneTime)}`,
            },
            {
              type: 'percentage' as ExpenseType,
              icon: <Percent className="w-5 h-5 text-white" />,
              gradient: 'from-purple-500 to-purple-600',
              border: 'border-purple-200 dark:border-purple-700 hover:border-purple-400 dark:hover:border-purple-500',
              bg: 'bg-purple-50 dark:bg-purple-900/20',
              badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
              title: language === 'uz' ? 'Foizli xarajatlar' : 'Процентные расходы',
              count: percentageExpenses.length,
              summary: percentageExpenses.length > 0
                ? `${percentageExpenses.reduce((s, e) => s + (e.percentage_value || 0), 0)}% ${language === 'uz' ? 'daromaddan' : 'от выручки'}`
                : (language === 'uz' ? 'Yoʻq' : 'Нет'),
            },
          ]).map((card) => (
            <button
              key={card.type}
              onClick={() => card.count > 0 && setOpenPanel(card.type)}
              disabled={card.count === 0}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-colors text-left ${card.border} ${card.bg} ${card.count === 0 ? 'opacity-50 cursor-default' : ''}`}
            >
              <span className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center shrink-0 shadow-md`}>
                {card.icon}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {card.title}
                  <span className={`ml-2 text-xs font-bold px-2 py-0.5 rounded-full ${card.badge}`}>
                    {card.count}
                  </span>
                </span>
                <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                  {card.summary}{card.count > 0 ? ` · ${language === 'uz' ? 'Batafsil' : 'Подробно'}` : ''}
                </span>
              </span>
              {card.count > 0 && <ChevronRight className="w-5 h-5 shrink-0 text-gray-400" />}
            </button>
          ))}
        </div>
      )}

      {/* 🔻 Мини-панель: список расходов выбранного типа (месячные / разовые / процентные) */}
      {openPanel && (() => {
        const panelExpenses = openPanel === 'monthly' ? monthlyExpenses
          : openPanel === 'percentage' ? percentageExpenses
          : oneTimeExpenses;
        const panelTitle = openPanel === 'monthly'
          ? (language === 'uz' ? 'Oylik xarajatlar' : 'Месячные расходы')
          : openPanel === 'percentage'
            ? (language === 'uz' ? 'Foizli xarajatlar' : 'Процентные расходы')
            : (language === 'uz' ? 'Bir martalik xarajatlar' : 'Разовые расходы');
        const panelGradient = openPanel === 'monthly' ? 'from-sky-500 to-blue-600'
          : openPanel === 'percentage' ? 'from-purple-500 to-purple-600'
          : 'from-orange-500 to-orange-600';
        const PanelIcon = openPanel === 'monthly' ? Clock : openPanel === 'percentage' ? Percent : AlertCircle;
        const panelTotalLabel = openPanel === 'monthly'
          ? (language === 'uz' ? 'Jami oyiga' : 'Итого в месяц')
          : openPanel === 'percentage'
            ? (language === 'uz' ? 'Jami foiz' : 'Итого процентов')
            : (language === 'uz' ? 'Jami bir martalik' : 'Итого разовых');
        const panelTotalValue = openPanel === 'monthly'
          ? formatPrice(totalMonthlyFull)
          : openPanel === 'percentage'
            ? `${percentageExpenses.reduce((s, e) => s + (e.percentage_value || 0), 0)}%`
            : formatPrice(totalOneTime);
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setOpenPanel(null); setEditingId(null); }}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
              {/* Заголовок */}
              <div className="flex items-center justify-between gap-3 p-5 border-b border-gray-200 dark:border-gray-700 shrink-0">
                <div className="flex items-center gap-3">
                  <span className={`w-9 h-9 rounded-xl bg-gradient-to-br ${panelGradient} flex items-center justify-center shrink-0`}>
                    <PanelIcon className="w-4 h-4 text-white" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold dark:text-white">{panelTitle}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {panelExpenses.length} {language === 'uz' ? 'ta yozuv' : 'записей'} · {panelTotalValue}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setOpenPanel(null); setEditingId(null); }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  aria-label="close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Список расходов типа — со скроллом, страница не разрастается */}
              <div className="overflow-y-auto p-4 space-y-2">
                {panelExpenses.map((e, i) => renderCard(e, i))}
                {panelExpenses.length === 0 && (
                  <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-6">
                    {language === 'uz' ? 'Xarajatlar yoʻq' : 'Расходов нет'}
                  </p>
                )}
              </div>

              {/* Итог */}
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{panelTotalLabel}</span>
                <span className="text-base font-bold text-red-600 dark:text-red-400">{panelTotalValue}</span>
              </div>
            </div>
          </div>
        );
      })()}

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
