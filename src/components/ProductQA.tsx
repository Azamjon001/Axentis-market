import { useState, useEffect } from 'react';
import { MessageCircleQuestion, Send, User, CheckCircle } from 'lucide-react';
import api from '../utils/api';

interface ProductQuestion {
  id: number;
  userName: string;
  question: string;
  answer: string;
  answeredBy: string;
  isAnswered: boolean;
  createdAt: string;
}

interface ProductQAProps {
  productId: number;
  userPhone?: string;
  userName?: string;
  isNight?: boolean;
}

/**
 * Self-contained "Questions & Answers" block for a product page.
 * Buyers can ask a question; answered questions show the seller's reply.
 * Backend: GET/POST /api/products/:id/questions.
 */
export default function ProductQA({ productId, userPhone, userName, isNight }: ProductQAProps) {
  const [open, setOpen] = useState(false);
  const [questions, setQuestions] = useState<ProductQuestion[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const textColor = isNight ? 'text-gray-100' : 'text-gray-900';
  const secondaryText = isNight ? 'text-gray-400' : 'text-gray-600';

  const loadQuestions = async () => {
    try {
      const data = await api.productQuestions.listByProduct(productId);
      setQuestions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading questions:', error);
      setQuestions([]);
    }
  };

  useEffect(() => {
    loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const handleSubmit = async () => {
    if (!newQuestion.trim()) return;
    if (!userPhone) {
      alert('Пожалуйста, войдите в систему, чтобы задать вопрос');
      return;
    }
    setSubmitting(true);
    try {
      await api.productQuestions.ask(productId, {
        userPhone,
        userName: userName || 'Пользователь',
        question: newQuestion.trim(),
      });
      setNewQuestion('');
      await loadQuestions();
    } catch (error) {
      console.error('Error submitting question:', error);
      alert('Не удалось отправить вопрос');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`rounded-2xl p-4 mt-4 ${isNight ? 'bg-gray-800/50' : 'bg-white'} shadow-sm`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <MessageCircleQuestion className="w-5 h-5 text-blue-500" />
          <span className={`font-semibold ${textColor}`}>Вопросы и ответы</span>
          <span className="text-sm text-gray-400">({questions.length})</span>
        </div>
        <span className={`text-sm ${secondaryText}`}>{open ? 'Скрыть' : 'Показать'}</span>
      </button>

      {open && (
        <div className="mt-4">
          {/* Ask form */}
          <div className={`rounded-xl p-3 mb-4 ${isNight ? 'bg-gray-700/40' : 'bg-gray-50'}`}>
            <textarea
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Задайте вопрос о товаре..."
              rows={2}
              className={`w-full rounded-lg p-2 text-sm resize-none border ${
                isNight ? 'bg-gray-800 border-gray-600 text-gray-100' : 'bg-white border-gray-200 text-gray-900'
              }`}
            />
            <button
              onClick={handleSubmit}
              disabled={submitting || !newQuestion.trim()}
              className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium disabled:opacity-50 active:scale-95 transition-all"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Отправка...' : 'Спросить'}
            </button>
          </div>

          {/* Questions list */}
          <div className="space-y-4">
            {questions.length > 0 ? (
              questions.map((q) => (
                <div key={q.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0 pb-3 last:pb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`p-1.5 rounded-full ${isNight ? 'bg-gray-700' : 'bg-gray-100'}`}>
                      <User className="w-3 h-3 text-gray-500" />
                    </div>
                    <span className={`font-medium text-sm ${textColor}`}>{q.userName || 'Пользователь'}</span>
                    <span className="text-xs text-gray-400 ml-auto">
                      {q.createdAt ? new Date(q.createdAt).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <p className={`text-sm ${textColor} mb-2`}>{q.question}</p>
                  {q.isAnswered && q.answer ? (
                    <div className={`flex gap-2 rounded-lg p-2 ${isNight ? 'bg-green-900/20' : 'bg-green-50'}`}>
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className={`text-sm ${secondaryText}`}>{q.answer}</p>
                        {q.answeredBy && (
                          <p className="text-xs text-green-600 mt-0.5">Ответ: {q.answeredBy}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">Ожидает ответа продавца</p>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-4 opacity-60">
                <p className={textColor}>Пока нет вопросов</p>
                <p className="text-sm text-gray-400">Задайте первый!</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
