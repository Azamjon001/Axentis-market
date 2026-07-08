import { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Trash2, Eye, Clock, Plus, X, Image as ImageIcon } from 'lucide-react';
import api, { getImageUrl } from '../utils/api';
import { useUiLang } from '../hooks/useUiLang';

interface Story {
  id: number;
  imageUrl: string;
  caption: string;
  views: number;
  createdAt: string;
  expiresAt: string;
  active: boolean;
}

// 📸 Панель сторис магазина: продавец публикует короткие карточки (новинки,
// акции), которые покупатели листают вверху главной. Живут 24 часа.
export default function CompanyStoriesPanel({ companyId }: { companyId: number }) {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lang = useUiLang();

  const L = lang === 'uz' ? {
    title: 'Do\'kon storilari', subtitle: 'Qisqa kartochkalar 24 soat asosiy sahifada ko\'rinadi',
    add: 'Stori qo\'shish', publish: 'Chop etish', captionPh: 'Izoh (ixtiyoriy)',
    empty: 'Hali stori yo\'q', active: 'Faol', expired: 'Muddati tugagan', views: 'ko\'rish',
    delConfirm: 'O\'chirilsinmi?', pickImage: 'Rasm tanlang', cancel: 'Bekor',
  } : {
    title: 'Сторис магазина', subtitle: 'Короткие карточки 24 часа видны вверху главной',
    add: 'Добавить сторис', publish: 'Опубликовать', captionPh: 'Подпись (необязательно)',
    empty: 'Сторис пока нет', active: 'Активна', expired: 'Истекла', views: 'просмотров',
    delConfirm: 'Удалить?', pickImage: 'Выберите картинку', cancel: 'Отмена',
  };

  const load = useCallback(async () => {
    setLoading(true);
    try { setStories(await api.companies.listStories(companyId).catch(() => [])); }
    finally { setLoading(false); }
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const reset = () => {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setCaption('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const publish = async () => {
    if (!file) return;
    setUploading(true);
    try {
      await api.companies.createStory(companyId, file, caption.trim() || undefined);
      reset();
      await load();
    } catch (e) {
      alert('Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm(L.delConfirm)) return;
    await api.companies.deleteStory(companyId, id).catch(() => {});
    setStories((s) => s.filter((x) => x.id !== id));
  };

  const card = 'bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700';

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-2">
        <Camera className="w-6 h-6 text-pink-500" />
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{L.title}</h2>
          <p className="text-xs text-gray-400">{L.subtitle}</p>
        </div>
      </div>

      {/* Загрузка новой сторис */}
      <div className={`${card} p-4`}>
        {preview ? (
          <div className="flex flex-col sm:flex-row gap-4">
            <img src={preview} alt="preview" className="w-full sm:w-40 h-52 object-cover rounded-lg" />
            <div className="flex-1 flex flex-col gap-3">
              <input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder={L.captionPh}
                maxLength={120}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
              />
              <div className="flex gap-2 mt-auto">
                <button
                  onClick={publish}
                  disabled={uploading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-pink-500 text-white rounded-lg text-sm font-semibold hover:bg-pink-600 disabled:opacity-60"
                >
                  <Plus className="w-4 h-4" /> {L.publish}
                </button>
                <button onClick={reset} className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm font-semibold">
                  <X className="w-4 h-4" /> {L.cancel}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full flex flex-col items-center justify-center gap-2 py-10 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-400 hover:border-pink-400 hover:text-pink-500 transition-colors"
          >
            <ImageIcon className="w-8 h-8" />
            <span className="text-sm font-medium">{L.add}</span>
          </button>
        )}
        <input ref={inputRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
      </div>

      {/* Список сторис */}
      {loading ? (
        <p className="text-gray-400 text-sm">…</p>
      ) : stories.length === 0 ? (
        <div className="text-center py-12 text-gray-400 flex flex-col items-center gap-2">
          <Camera className="w-10 h-10 text-gray-300" />
          {L.empty}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {stories.map((s) => (
            <div key={s.id} className={`${card} overflow-hidden relative group`}>
              <img src={getImageUrl(s.imageUrl)} alt="" className="w-full h-44 object-cover" />
              {!s.active && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-white text-xs font-semibold flex items-center gap-1"><Clock className="w-3 h-3" /> {L.expired}</span>
                </div>
              )}
              <button
                onClick={() => remove(s.id)}
                className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <div className="p-2">
                {s.caption ? <p className="text-xs text-gray-700 dark:text-gray-300 truncate">{s.caption}</p> : null}
                <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-1">
                  <Eye className="w-3 h-3" /> {s.views} {L.views}
                  {s.active && <span className="ml-auto text-emerald-500 font-medium">{L.active}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
