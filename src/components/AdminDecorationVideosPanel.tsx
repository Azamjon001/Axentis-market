import { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, Film, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import api, { getImageUrl } from '../utils/api';
import { getCurrentLanguage } from '../utils/translations';

interface DecorationVideo {
  id: number;
  title: string;
  url: string;
  createdAt?: string;
}

const MAX_VIDEO_MB = 12; // ролики до ~10 МБ, с небольшим запасом

export default function AdminDecorationVideosPanel() {
  const language = getCurrentLanguage();
  const [videos, setVideos] = useState<DecorationVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await api.decorationVideos.list();
      setVideos(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Ошибка загрузки видео:', error);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleFile = async (file: File) => {
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      toast.error(language === 'uz'
        ? `Video ${MAX_VIDEO_MB} MB dan oshmasligi kerak`
        : `Видео должно быть не больше ${MAX_VIDEO_MB} МБ`);
      return;
    }
    setUploading(true);
    try {
      toast.loading(language === 'uz' ? 'Yuklanmoqda…' : 'Загрузка…', { id: 'decor-upload' });
      await api.decorationVideos.upload(file, title.trim());
      toast.success(language === 'uz' ? 'Video yuklandi' : 'Видео загружено', { id: 'decor-upload' });
      setTitle('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await load();
    } catch (error) {
      console.error('Ошибка загрузки видео:', error);
      toast.error(language === 'uz' ? 'Yuklashda xatolik' : 'Ошибка загрузки', { id: 'decor-upload' });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(language === 'uz' ? 'Videoni oʻchirilsinmi?' : 'Удалить видео?')) return;
    try {
      toast.loading(language === 'uz' ? 'Oʻchirilmoqda…' : 'Удаление…', { id: 'decor-delete' });
      await api.decorationVideos.remove(id);
      toast.success(language === 'uz' ? 'Oʻchirildi' : 'Удалено', { id: 'decor-delete' });
      await load();
    } catch (error) {
      console.error('Ошибка удаления видео:', error);
      toast.error(language === 'uz' ? 'Xatolik' : 'Ошибка удаления', { id: 'decor-delete' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg p-6" style={{ background: 'rgba(124,92,240,0.06)', border: '1px solid rgba(124,92,240,0.3)', borderRadius: 14 }}>
        <div className="flex items-start gap-4">
          <div className="rounded-full p-2 flex-shrink-0" style={{ background: 'linear-gradient(135deg, #7C5CF0, #5B3DD4)' }}>
            <Film className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h4 className="text-lg font-semibold mb-2" style={{ color: '#FFFFFF' }}>
              {language === 'uz' ? 'Video-bezaklar' : 'Видео-декорации'}
            </h4>
            <p className="text-sm" style={{ color: '#8B8BAA' }}>
              {language === 'uz'
                ? `Qisqa videolarni yuklang (${MAX_VIDEO_MB} MB gacha, mp4/webm). Ular barcha kompaniyalarga magazin sahifasi foni sifatida ochiq boʻladi.`
                : `Загружайте короткие видео (до ${MAX_VIDEO_MB} МБ, mp4/webm). Они станут доступны всем компаниям как анимированный фон страницы магазина.`}
            </p>
          </div>
        </div>
      </div>

      {/* Форма загрузки */}
      <div className="rounded-2xl p-6" style={{ background: 'var(--ax-card)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16 }}>
        <label className="block text-sm mb-2" style={{ color: '#8B8BAA' }}>
          {language === 'uz' ? 'Sarlavha (ixtiyoriy)' : 'Название (необязательно)'}
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-4 py-2 mb-4 rounded-lg"
          style={{ background: 'var(--ax-input)', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--ax-text)', borderRadius: 10 }}
          placeholder={language === 'uz' ? 'Masalan: Tog manzarasi' : 'Например: Горы'}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-5 py-2.5 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #7C5CF0, #5B3DD4)', color: '#FFFFFF', borderRadius: 10, border: 'none' }}
        >
          {uploading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
          {language === 'uz' ? 'Video yuklash' : 'Загрузить видео'}
        </button>
      </div>

      {/* Список видео */}
      {loading ? (
        <div className="text-center py-12" style={{ color: '#8B8BAA' }}>
          {language === 'uz' ? 'Yuklanmoqda…' : 'Загрузка…'}
        </div>
      ) : videos.length === 0 ? (
        <div className="p-12 text-center" style={{ background: 'rgba(124,92,240,0.06)', border: '2px dashed rgba(124,92,240,0.3)', borderRadius: 14 }}>
          <Film className="w-12 h-12 mx-auto mb-4" style={{ color: '#7C5CF0' }} />
          <p style={{ color: '#8B8BAA' }}>
            {language === 'uz' ? 'Hozircha video yoʻq' : 'Пока нет загруженных видео'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {videos.map((v) => (
            <div key={v.id} className="overflow-hidden" style={{ background: 'var(--ax-card)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
              <div className="relative" style={{ aspectRatio: '16 / 9', background: '#1A1A35' }}>
                <video
                  src={getImageUrl(v.url) || v.url}
                  className="w-full h-full object-cover"
                  muted
                  loop
                  playsInline
                  controls
                />
              </div>
              <div className="p-3 flex items-center justify-between gap-2">
                <span className="text-sm truncate" style={{ color: '#FFFFFF' }}>
                  {v.title || `#${v.id}`}
                </span>
                <button
                  onClick={() => handleDelete(v.id)}
                  className="p-2 rounded-lg flex-shrink-0"
                  style={{ color: '#F87171' }}
                  title={language === 'uz' ? 'Oʻchirish' : 'Удалить'}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
