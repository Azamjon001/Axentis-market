import { useState, useEffect } from 'react';
import { MessageCircleQuestion, Send, CheckCircle, Trash2, Star, Plus, X } from 'lucide-react';
import api from '../utils/api';
import { useUiLang } from '../hooks/useUiLang';

interface CompanyQuestion {
  id: number;
  productId: number;
  productName: string;
  userName: string;
  question: string;
  answer: string;
  isAnswered: boolean;
  createdAt: string;
}

interface CompanyReview {
  id: number;
  productId: number;
  productName: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

interface CompanyQuestionsPanelProps {
  companyId: number;
  companyName?: string;
}

/**
 * Seller panel: answer customer questions about products AND manage the reviews
 * left on the company's products. Each item shows which product it belongs to
 * and can be deleted.
 * Backend: GET /api/questions/company/:id, POST /api/questions/:id/answer,
 *          DELETE /api/questions/:id, GET /api/companies/:id/product-reviews,
 *          DELETE /api/reviews/:id.
 */
export default function CompanyQuestionsPanel({ companyId, companyName }: CompanyQuestionsPanelProps) {
  const [tab, setTab] = useState<'questions' | 'reviews'>('questions');
  const [questions, setQuestions] = useState<CompanyQuestion[]>([]);
  const [productReviews, setProductReviews] = useState<CompanyReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [onlyUnanswered, setOnlyUnanswered] = useState(true);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  // ⚡ Быстрые шаблоны ответов (хранятся локально по компании)
  const templatesKey = `qa_templates_${companyId}`;
  const [templates, setTemplates] = useState<string[]>([]);
  const [newTemplate, setNewTemplate] = useState('');
  const [managingTemplates, setManagingTemplates] = useState(false);
  const lang = useUiLang();
  const L = lang === 'uz' ? {
    title: 'Savollar va sharhlar', tabQ: 'Savollar', tabR: 'Mahsulot sharhlari',
    onlyUn: 'Faqat javobsiz', loading: 'Yuklanmoqda...',
    noUn: 'Javobsiz savollar yoʻq 🎉', none: 'Hozircha savollar yoʻq', noReviews: 'Hozircha sharhlar yoʻq',
    buyer: 'Xaridor', yourAnswer: 'Javobingiz...', answer: 'Javob berish', seller: 'Sotuvchi',
    saveFail: 'Javobni saqlab boʻlmadi', delConfirm: 'Oʻchirilsinmi?', delFail: 'Oʻchirib boʻlmadi',
    quickReplies: 'Tez javoblar', manage: 'Sozlash', done: 'Tayyor', newTpl: 'Yangi shablon...',
    defaults: ['Ha, mavjud ✅', 'Rahmat savolingiz uchun! 🙏', 'Yetkazib berish 1-2 kun ichida', 'Kafolat 12 oy', 'Kechirasiz, hozircha yoʻq'],
  } : {
    title: 'Вопросы и отзывы', tabQ: 'Вопросы', tabR: 'Отзывы о товарах',
    onlyUn: 'Только без ответа', loading: 'Загрузка...',
    noUn: 'Нет неотвеченных вопросов 🎉', none: 'Вопросов пока нет', noReviews: 'Отзывов пока нет',
    buyer: 'Покупатель', yourAnswer: 'Ваш ответ...', answer: 'Ответить', seller: 'Продавец',
    saveFail: 'Не удалось сохранить ответ', delConfirm: 'Удалить?', delFail: 'Не удалось удалить',
    quickReplies: 'Быстрые ответы', manage: 'Настроить', done: 'Готово', newTpl: 'Новый шаблон...',
    defaults: ['Да, в наличии ✅', 'Спасибо за вопрос! 🙏', 'Доставка 1–2 дня', 'Гарантия 12 месяцев', 'К сожалению, сейчас нет'],
  };

  // Загрузка шаблонов из localStorage (или дефолтные при первом запуске)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(templatesKey);
      setTemplates(raw ? JSON.parse(raw) : L.defaults);
    } catch {
      setTemplates(L.defaults);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const saveTemplates = (list: string[]) => {
    setTemplates(list);
    try { localStorage.setItem(templatesKey, JSON.stringify(list)); } catch { /* ignore */ }
  };

  const addTemplate = () => {
    const val = newTemplate.trim();
    if (!val || templates.includes(val)) { setNewTemplate(''); return; }
    saveTemplates([...templates, val]);
    setNewTemplate('');
  };

  const removeTemplate = (tpl: string) => saveTemplates(templates.filter((x) => x !== tpl));

  // Вставить шаблон в поле ответа (добавляет с пробелом, если уже что-то введено)
  const applyTemplate = (qid: number, tpl: string) => {
    setDrafts((d) => {
      const cur = (d[qid] || '').trim();
      return { ...d, [qid]: cur ? `${cur} ${tpl}` : tpl };
    });
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.productQuestions.listByCompany(companyId, onlyUnanswered);
      setQuestions(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Load questions failed:', e);
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  const loadReviews = async () => {
    setLoadingReviews(true);
    try {
      const data = await api.reviews.listByCompany(companyId);
      const list = Array.isArray(data) ? data : (data?.reviews || []);
      setProductReviews(list);
    } catch (e) {
      console.error('Load product reviews failed:', e);
      setProductReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, onlyUnanswered]);

  useEffect(() => {
    loadReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const submitAnswer = async (id: number) => {
    const answer = (drafts[id] || '').trim();
    if (!answer) return;
    setSavingId(id);
    try {
      await api.productQuestions.answer(id, { answer, answeredBy: companyName || L.seller });
      setDrafts((d) => ({ ...d, [id]: '' }));
      await load();
    } catch (e) {
      console.error('Answer failed:', e);
      alert(L.saveFail);
    } finally {
      setSavingId(null);
    }
  };

  const deleteQuestion = async (id: number) => {
    if (!confirm(L.delConfirm)) return;
    try {
      await api.productQuestions.delete(id);
      setQuestions((qs) => qs.filter((q) => q.id !== id));
    } catch (e) {
      console.error('Delete question failed:', e);
      alert(L.delFail);
    }
  };

  const deleteReview = async (id: number) => {
    if (!confirm(L.delConfirm)) return;
    try {
      await api.reviews.delete(id);
      setProductReviews((rs) => rs.filter((r) => r.id !== id));
    } catch (e) {
      console.error('Delete review failed:', e);
      alert(L.delFail);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircleQuestion className="w-6 h-6 text-blue-600" />
        <h2 className="text-lg font-bold">{L.title}</h2>
      </div>

      {/* Переключатель: вопросы / отзывы */}
      <div className="flex gap-2 mb-4">
        {([['questions', L.tabQ], ['reviews', `${L.tabR}${productReviews.length ? ` (${productReviews.length})` : ''}`]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'questions' ? (
        <>
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={onlyUnanswered}
                onChange={(e) => setOnlyUnanswered(e.target.checked)}
              />
              {L.onlyUn}
            </label>
            <button
              onClick={() => setManagingTemplates((v) => !v)}
              className="text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              ⚡ {L.quickReplies}: {managingTemplates ? L.done : L.manage}
            </button>
          </div>

          {/* ⚙️ Управление шаблонами быстрых ответов */}
          {managingTemplates && (
            <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
              <div className="flex flex-wrap gap-2 mb-3">
                {templates.map((tpl) => (
                  <span key={tpl} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">
                    {tpl}
                    <button onClick={() => removeTemplate(tpl)} className="text-gray-400 hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={newTemplate}
                  onChange={(e) => setNewTemplate(e.target.value)}
                  placeholder={L.newTpl}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && addTemplate()}
                />
                <button
                  onClick={addTemplate}
                  disabled={!newTemplate.trim()}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-50 active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <p className="text-gray-400">{L.loading}</p>
          ) : questions.length === 0 ? (
            <p className="text-gray-400">{onlyUnanswered ? L.noUn : L.none}</p>
          ) : (
            <div className="space-y-3">
              {questions.map((q) => (
                <div key={q.id} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs text-gray-400 mb-1">
                      {q.productName} · {q.userName || L.buyer} ·{' '}
                      {q.createdAt ? new Date(q.createdAt).toLocaleDateString() : ''}
                    </div>
                    <button
                      onClick={() => deleteQuestion(q.id)}
                      className="text-gray-300 hover:text-red-500 flex-shrink-0"
                      title={L.delConfirm}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="font-medium text-gray-900 mb-2">{q.question}</p>

                  {q.isAnswered ? (
                    <div className="flex gap-2 rounded-lg p-2 bg-green-50">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-gray-700">{q.answer}</p>
                    </div>
                  ) : (
                    <>
                      {/* ⚡ Быстрые ответы — клик подставляет шаблон в поле */}
                      {templates.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {templates.map((tpl) => (
                            <button
                              key={tpl}
                              type="button"
                              onClick={() => applyTemplate(q.id, tpl)}
                              className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100 active:scale-95 transition-colors"
                            >
                              {tpl}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <input
                          value={drafts[q.id] || ''}
                          onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                          placeholder={L.yourAnswer}
                          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm"
                          onKeyDown={(e) => e.key === 'Enter' && submitAnswer(q.id)}
                        />
                        <button
                          onClick={() => submitAnswer(q.id)}
                          disabled={savingId === q.id || !(drafts[q.id] || '').trim()}
                          className="flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-50 active:scale-95"
                        >
                          <Send className="w-4 h-4" />
                          {L.answer}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {loadingReviews ? (
            <p className="text-gray-400">{L.loading}</p>
          ) : productReviews.length === 0 ? (
            <p className="text-gray-400">{L.noReviews}</p>
          ) : (
            <div className="space-y-3">
              {productReviews.map((r) => (
                <div key={r.id} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs text-gray-400 mb-1">
                      {r.productName} · {r.userName || L.buyer} ·{' '}
                      {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}
                    </div>
                    <button
                      onClick={() => deleteReview(r.id)}
                      className="text-gray-300 hover:text-red-500 flex-shrink-0"
                      title={L.delConfirm}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex gap-0.5 mb-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-4 h-4 ${s <= r.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`}
                      />
                    ))}
                  </div>
                  {r.comment ? <p className="text-sm text-gray-700">{r.comment}</p> : null}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
