import { useEffect, useState } from 'react';
import { X, ShieldCheck } from 'lucide-react';
import api from '../utils/api';

interface PolicyModalProps {
  audience: 'customer' | 'company';
  open: boolean;
  onClose: () => void;
  language?: 'ru' | 'uz';
}

/**
 * 📜 Модал с текстом политики конфиденциальности.
 * Текст хранится в БД и редактируется админом; здесь только просмотр.
 */
export default function PolicyModal({ audience, open, onClose, language = 'ru' }: PolicyModalProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.policies.get(audience)
      .then((p: any) => {
        const text = language === 'uz' && p?.contentUz ? p.contentUz : p?.contentRu;
        setContent(text || '');
      })
      .catch(() => setContent(language === 'uz' ? 'Matnni yuklab boʻlmadi' : 'Не удалось загрузить текст'))
      .finally(() => setLoading(false));
  }, [open, audience, language]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden bg-white dark:bg-gray-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </span>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              {language === 'uz' ? 'Maxfiylik siyosati' : 'Политика конфиденциальности'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            aria-label="close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-7 h-7 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-800 dark:text-gray-200">
              {content}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
