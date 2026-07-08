import { useState, useEffect, useRef } from 'react';
import { Megaphone, Check, X, Clock, Building2, Calendar, AlertCircle, Plus, Link, Upload } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import api, { getImageUrl } from '../utils/api';

interface Advertisement {
  id: string;
  title: string;
  content: string;
  caption?: string;
  image_url?: string;
  link_url?: string;
  status: 'pending' | 'approved' | 'rejected' | 'deleted';
  company_id?: string;
  company_name?: string;
  created_at?: string;
  submitted_at?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  admin_message?: string; // 🆕 Подробное сообщение от админа
}

export default function AdminAdsPanel() {
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'pending' | 'approved' | 'rejected' | 'deleted'>('pending');
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedAd, setSelectedAd] = useState<Advertisement | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [adminMessage, setAdminMessage] = useState('');

  // Create ad modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createContent, setCreateContent] = useState('');
  const [createLinkUrl, setCreateLinkUrl] = useState('');
  const [createImageUrl, setCreateImageUrl] = useState('');
  const [createFile, setCreateFile] = useState<File | null>(null);
  const [createPreview, setCreatePreview] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inline link editing
  const [editingLinkAdId, setEditingLinkAdId] = useState<string | null>(null);
  const [editingLinkValue, setEditingLinkValue] = useState('');

  useEffect(() => {
    loadAds();
    
    // Автообновление каждые 10 секунд
    const interval = setInterval(loadAds, 10000);
    return () => clearInterval(interval);
  }, [activeFilter]);

  const loadAds = async () => {
    try {
      console.log('📢 [Admin Ads] Loading advertisements with filter:', activeFilter);
      const filters: any = { status: activeFilter as 'pending' | 'approved' | 'rejected' | 'deleted' };
      const result = await api.ads.list(filters);
      
      console.log('📢 [Admin Ads] API Response:', result);
      
      if (result && result.ads) {
        console.log(`✅ [Admin Ads] Loaded ${result.ads.length || 0} advertisements`);
        setAds(result.ads || []);
      } else {
        console.error('❌ [Admin Ads] Failed to load:', result.error);
        setAds([]);
      }
    } catch (error) {
      console.error('❌ [Admin Ads] Exception:', error);
      setAds([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (adId: string) => {
    try {
      console.log('✅ [Admin Approve] Approving ad:', adId);
      toast.loading('Утверждение рекламы...', { id: 'approve-ad' });
      
      const result = await api.ads.moderate(adId, 'approved');
      console.log('✅ [Admin Approve] Result:', result);
      
      toast.success('✅ Реклама утверждена!', { id: 'approve-ad' });
      loadAds();
    } catch (error) {
      console.error('❌ [Admin Approve] Error:', error);
      toast.error('Ошибка утверждения рекламы', { id: 'approve-ad' });
    }
  };

  const handleReject = async () => {
    if (!selectedAd) return;

    try {
      toast.loading('Отклонение рекламы...', { id: 'reject-ad' });
      
      await api.ads.moderate(selectedAd.id, 'rejected', rejectionReason || undefined, adminMessage || undefined);
      
      toast.success('Реклама отклонена', { id: 'reject-ad' });
      setRejectModalOpen(false);
      setRejectionReason('');
      setAdminMessage(''); // 🆕 Очистка
      setSelectedAd(null);
      loadAds();
    } catch (error) {
      toast.error('Ошибка отклонения рекламы', { id: 'reject-ad' });
    }
  };

  const handleDelete = async (adId: string) => {
    if (!confirm('Удалить эту рекламу?')) return;

    try {
      console.log('🗑️ [Admin Delete] Starting delete for ad:', adId);
      toast.loading('Удаление...', { id: 'delete-ad' });
      
      await api.ads.delete(adId);
      
      console.log('✅ [Admin Delete] Ad deleted successfully');
      toast.success('Реклама удалена', { id: 'delete-ad' });
      loadAds();
    } catch (error) {
      console.error('❌ [Admin Delete] Exception:', error);
      toast.error('Ошибка удаления', { id: 'delete-ad' });
    }
  };

  const openRejectModal = (ad: Advertisement) => {
    setSelectedAd(ad);
    setRejectModalOpen(true);
  };

  const handleCreateAd = async () => {
    if (!createTitle.trim()) { toast.error('Введите заголовок'); return; }
    if (!createImageUrl.trim() && !createFile) { toast.error('Загрузите изображение или введите URL'); return; }

    setCreating(true);
    try {
      let finalImageUrl = createImageUrl;
      if (createFile) {
        const uploadResult = await api.ads.uploadImage(createFile);
        finalImageUrl = uploadResult.image_url;
      }
      const result = await api.ads.create({
        title: createTitle,
        content: createContent || createTitle,
        imageUrl: finalImageUrl,
        linkUrl: createLinkUrl || '',
        adType: 'company',
      });
      if (result?.id) {
        // Auto-approve admin-created ads
        await api.ads.moderate(String(result.id), 'approved');
        toast.success('Реклама создана и опубликована');
        setCreateModalOpen(false);
        setCreateTitle(''); setCreateContent(''); setCreateLinkUrl('');
        setCreateImageUrl(''); setCreateFile(null); setCreatePreview(null);
        loadAds();
      }
    } catch (error) {
      toast.error('Ошибка создания рекламы');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateFileSelect = (file: File) => {
    setCreateFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setCreatePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const startEditLink = (ad: Advertisement) => {
    setEditingLinkAdId(ad.id);
    setEditingLinkValue(ad.link_url || '');
  };

  const saveLink = async (adId: string) => {
    try {
      await api.ads.updateLink(adId, editingLinkValue);
      toast.success('Ссылка сохранена');
      setEditingLinkAdId(null);
      loadAds();
    } catch {
      toast.error('Ошибка сохранения ссылки');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm flex items-center gap-1">
          <Clock className="w-4 h-4" />
          Ожидает
        </span>;
      case 'approved':
        return <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm flex items-center gap-1">
          <Check className="w-4 h-4" />
          Подтверждено
        </span>;
      case 'rejected':
        return <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm flex items-center gap-1">
          <X className="w-4 h-4" />
          Отклонено
        </span>;
      case 'deleted':
        return <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm flex items-center gap-1">
          <X className="w-4 h-4" />
          Удалено
        </span>;
      default:
        return null;
    }
  };

  const pendingCount = ads.filter(ad => ad.status === 'pending').length;
  const approvedCount = ads.filter(ad => ad.status === 'approved').length;
  const rejectedCount = ads.filter(ad => ad.status === 'rejected').length;
  const deletedCount = ads.filter(ad => ad.status === 'deleted').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Загрузка реклам...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="bg-gradient-to-r from-purple-600 to-fuchsia-600 rounded-2xl p-6 text-white shadow-lg shadow-purple-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-white/15 rounded-xl p-2">
              <Megaphone className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold">Модерация рекламы</h2>
          </div>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-2 bg-white text-purple-700 px-4 py-2 rounded-lg hover:bg-purple-50 transition-colors font-medium shadow"
          >
            <Plus className="w-4 h-4" />
            Добавить рекламу
          </button>
        </div>
        <p className="text-purple-100">
          Проверяйте и утверждайте рекламные материалы от компаний
        </p>
      </div>

      {/* Фильтры */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
        <div className="flex gap-2 items-center justify-between flex-wrap">
          <div className="flex gap-1.5 bg-gray-50 p-1 rounded-xl flex-wrap">
            {([
              { key: 'pending', label: 'Ожидающие', count: pendingCount, active: 'bg-amber-500 text-white shadow-sm' },
              { key: 'approved', label: 'Подтверждено', count: approvedCount, active: 'bg-emerald-600 text-white shadow-sm' },
              { key: 'rejected', label: 'Отклонённые', count: rejectedCount, active: 'bg-rose-600 text-white shadow-sm' },
              { key: 'deleted', label: 'Удалённые', count: deletedCount, active: 'bg-gray-600 text-white shadow-sm' },
            ] as const).map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeFilter === f.key ? f.active : 'text-gray-600 hover:bg-white'
                }`}
              >
                {f.label}
                <span className={`ml-1.5 text-xs ${activeFilter === f.key ? 'opacity-90' : 'opacity-60'}`}>
                  {f.count}
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={loadAds}
            className="px-4 py-2 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 transition-colors text-sm font-medium"
          >
            Обновить
          </button>
        </div>
      </div>

      {/* Список реклам */}
      <div className="space-y-4">
        {ads.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <Megaphone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              {activeFilter === 'pending' ? 'Нет ожидающих реклам' : 
               activeFilter === 'approved' ? 'Нет подтверждённых реклам' : 
               activeFilter === 'rejected' ? 'Нет отклонённых реклам' :
               'Нет удалённых реклам'}
            </p>
          </div>
        ) : (
          ads.map((ad) => {
            return (
            <div key={ad.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
              <div className="md:flex">
                {/* Изображение */}
                <div className="md:w-72 lg:w-80 flex-shrink-0 bg-gray-50">
                  {ad.image_url ? (
                    <img
                      src={getImageUrl(ad.image_url) || ''}
                      alt={ad.caption || 'Реклама'}
                      className="w-full h-48 md:h-full object-cover aspect-[16/9] md:aspect-auto"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-48 md:h-full md:min-h-[180px] flex flex-col items-center justify-center text-gray-300">
                      <AlertCircle className="w-12 h-12" />
                      <p className="text-xs mt-2">Нет изображения</p>
                    </div>
                  )}
                </div>

                {/* Контент */}
                <div className="flex-1 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <Building2 className="w-5 h-5 text-gray-400" />
                        <span className="text-gray-900">{ad.company_name || '(Компания не указана)'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        <Calendar className="w-4 h-4" />
                        <span>
                          Отправлено {ad.submitted_at ? new Date(ad.submitted_at).toLocaleString('ru-RU', {
                            day: 'numeric',
                            month: 'long',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : 'Invalid Date'}
                        </span>
                      </div>
                    </div>
                    {getStatusBadge(ad.status)}
                  </div>

                  {ad.title && (
                    <h3 className="text-gray-900 font-semibold text-base mb-1">{ad.title}</h3>
                  )}
                  <div className="mb-4">
                    <p className="text-gray-600 text-sm">{ad.content || ad.caption || '(Описание отсутствует)'}</p>
                  </div>

                  {ad.status === 'rejected' && ad.rejection_reason && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-red-900">
                          <strong>Причина отклонения:</strong> {ad.rejection_reason}
                        </p>
                      </div>
                    </div>
                  )}

                  {ad.status === 'approved' && ad.reviewed_at && (
                    <div className="mb-4 text-sm text-gray-500">
                      Утверждено {new Date(ad.reviewed_at).toLocaleString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  )}

                  {/* URL-ссылка рекламы */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Link className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-medium text-gray-700">URL-ссылка при нажатии:</span>
                    </div>
                    {editingLinkAdId === ad.id ? (
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={editingLinkValue}
                          onChange={(e) => setEditingLinkValue(e.target.value)}
                          className="flex-1 px-3 py-1.5 text-sm border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="https://t.me/... или https://youtube.com/..."
                          autoFocus
                        />
                        <button onClick={() => saveLink(ad.id)} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                          Сохранить
                        </button>
                        <button onClick={() => setEditingLinkAdId(null)} className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300">
                          Отмена
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {ad.link_url ? (
                          <a href={ad.link_url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline truncate max-w-xs">
                            {ad.link_url}
                          </a>
                        ) : (
                          <span className="text-sm text-gray-400 italic">Не указан</span>
                        )}
                        <button onClick={() => startEditLink(ad)} className="text-xs text-blue-500 hover:text-blue-700 underline flex-shrink-0">
                          {ad.link_url ? 'Изменить' : 'Добавить'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Действия */}
                  <div className="flex gap-2">
                    {ad.status === 'pending' && (
                      <>
                        <button
                          key={`approve-${ad.id}`}
                          onClick={() => handleApprove(ad.id)}
                          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <Check className="w-4 h-4" />
                          Утвердить
                        </button>
                        <button
                          key={`reject-${ad.id}`}
                          onClick={() => openRejectModal(ad)}
                          className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                        >
                          <X className="w-4 h-4" />
                          Отклонить
                        </button>
                      </>
                    )}
                    {ad.status === 'approved' && (
                      <button
                        key={`cancel-${ad.id}`}
                        onClick={() => openRejectModal(ad)}
                        className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                      >
                        <X className="w-4 h-4" />
                        Отменить публикацию
                      </button>
                    )}
                    <button
                      key={`delete-${ad.id}`}
                      onClick={() => handleDelete(ad.id)}
                      className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              </div>
            </div>
            );
          })
        )}
      </div>

      {/* Модальное окно создания рекламы */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setCreateModalOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-gray-900 font-semibold text-lg">Добавить рекламу</h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Заголовок *</label>
                <input
                  type="text"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  placeholder="Название рекламы"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
                <textarea
                  value={createContent}
                  onChange={(e) => setCreateContent(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  rows={3}
                  placeholder="Текст рекламного объявления"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">🔗 URL-ссылка (необязательно)</label>
                <input
                  type="url"
                  value={createLinkUrl}
                  onChange={(e) => setCreateLinkUrl(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  placeholder="https://t.me/yourcompany или https://youtube.com/..."
                />
                <p className="text-xs text-gray-400 mt-1">При нажатии на баннер откроется этот адрес</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Изображение *</label>
                {createPreview ? (
                  <div className="space-y-2">
                    <img src={createPreview} alt="Preview" className="max-h-48 mx-auto rounded-lg shadow" />
                    <button
                      type="button"
                      onClick={() => { setCreateFile(null); setCreatePreview(null); setCreateImageUrl(''); }}
                      className="text-sm text-red-500 hover:text-red-700"
                    >
                      Удалить
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div
                      className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-purple-400 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Нажмите для загрузки файла</p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCreateFileSelect(f); }}
                    />
                    <div className="text-center text-sm text-gray-400">или</div>
                    <input
                      type="url"
                      value={createImageUrl}
                      onChange={(e) => setCreateImageUrl(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent text-sm"
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-200">
              <button onClick={() => setCreateModalOpen(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Отмена
              </button>
              <button
                onClick={handleCreateAd}
                disabled={creating}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {creating ? 'Создание...' : 'Создать и опубликовать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно отклонения */}
      {rejectModalOpen && selectedAd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setRejectModalOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-gray-900">Отклонить рекламу</h3>
              <button onClick={() => setRejectModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-gray-600">
                Вы уверены, что хотите отклонить рекламу от <strong>{selectedAd.company_name}</strong>?
              </p>

              <div>
                <label className="block text-sm text-gray-600 mb-2">
                  Краткая причина (необязательно)
                </label>
                <input
                  type="text"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                  placeholder="Например: Низкое качество"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-2">
                  Подробное сообщение для компании (необязательно)
                </label>
                <textarea
                  value={adminMessage}
                  onChange={(e) => setAdminMessage(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                  rows={4}
                  placeholder="Например: Изображение имеет низкое разрешение (менее 800px). Пожалуйста, загрузите фото высокого качества и повторите попытку."
                />
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setRejectModalOpen(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleReject}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Отклонить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}