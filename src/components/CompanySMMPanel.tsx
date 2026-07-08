import { useState, useEffect, lazy, Suspense } from 'react';
import { Star, Upload, Video, Megaphone, MapPin, Package, TrendingUp, X, Navigation, Users, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import MapLocationPicker from './MapLocationPicker';
import api, { getImageUrl } from '../utils/api';
import { invalidateCompanyProfile } from '../utils/cache';

// 🗺️ Карта границ регионов доставки (ленивая загрузка, открывается в модалке)
const RegionsMap = lazy(() => import('./RegionsMap'));
import { useResponsive, useResponsiveClasses } from '../hooks/useResponsive';
import { getCurrentLanguage, useTranslation, type Language } from '../utils/translations';
import { UZBEKISTAN_REGIONS, getDistrictsByRegion } from '../utils/uzbekistanRegions';

interface CompanySMMPanelProps {
  companyId: number;
  companyName: string;
}

interface CompanyProfile {
  id: number;
  name: string;
  phone: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  rating: number;
  total_ratings: number;
  total_products: number;
  total_sales: number;
  logo_image?: string;
}

interface MediaItem {
  id: string;
  type: 'photo' | 'video' | 'ad';
  url: string;
  title: string;
  description?: string;
  created_at: string;
  status?: 'pending' | 'approved' | 'rejected';
  admin_message?: string; // 🆕 Сообщение от админа при отклонении
  rejection_reason?: string; // Краткая причина отклонения
}

export default function CompanySMMPanel({ companyId, companyName }: CompanySMMPanelProps) {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [activeTab, setActiveTab] = useState<'profile' | 'photos'>('profile');
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [coverImage, setCoverImage] = useState('');
  const [uploadingCover, setUploadingCover] = useState(false);
  
  // 📱 Адаптивность
  const { isMobile } = useResponsive();
  const responsive = useResponsiveClasses();
  
  // � Переводы
  const [language, setLanguage] = useState<Language>(getCurrentLanguage());
  const t = useTranslation(language);
  
  // �🆕 Статистика подписчиков
  const [subscribersCount, setSubscribersCount] = useState(0);

  // Временные данные профиля
  const [formData, setFormData] = useState({
    location: '',
    latitude: 0,
    longitude: 0,
    description: '',
    logo_image: '',
    region: '',
    district: '',
    serviceRegions: [] as string[], // 🗺️ регионы доставки (мультивыбор)
    coverVideoUrl: '' // 🎬 видео-декорация
  });

  // 🎬 Декоративные видео, загруженные админом (доступны всем компаниям)
  const [decorationVideos, setDecorationVideos] = useState<Array<{ id: number; title: string; url: string }>>([]);
  const [savingVideo, setSavingVideo] = useState(false);
  const [videoPickerOpen, setVideoPickerOpen] = useState(false);
  const [regionsMapOpen, setRegionsMapOpen] = useState(false); // 🗺️ карта границ регионов
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [deliveryRadius, setDeliveryRadius] = useState({ km: 0, lat: 0, lng: 0 });
  const [savingRadius, setSavingRadius] = useState(false);

  useEffect(() => {
    loadCompanyProfile();
    loadMediaItems();
    loadSubscriberStats();
    loadDecorationVideos();
    
    // ⚠️ Realtime подписки отключены - Supabase удален
    // TODO: Реализовать через WebSocket или polling если нужно
    
    return () => {
      // Cleanup - ничего не делаем
    };
  }, [companyId]);
  
  // � Слушаем изменения языка
  useEffect(() => {
    const handleLanguageChange = (e: CustomEvent<Language>) => setLanguage(e.detail);
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    return () => window.removeEventListener('languageChange', handleLanguageChange as EventListener);
  }, []);
  
  // �🆕 Загрузка статистики подписчиков
  const loadSubscriberStats = async () => {
    try {
      const stats = await api.companies.getStats(companyId.toString());
      console.log('📊 Stats loaded:', stats);
      setSubscribersCount(stats.subscribers || 0);
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
      setSubscribersCount(0);
    }
  };

  // 🎬 Загрузка списка декоративных видео
  const loadDecorationVideos = async () => {
    try {
      const list = await api.decorationVideos.list();
      setDecorationVideos(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Ошибка загрузки декоративных видео:', error);
      setDecorationVideos([]);
    }
  };

  // 🎬 Компания выбирает (или убирает) видео-декорацию для страницы магазина
  const handleSelectDecorationVideo = async (url: string) => {
    const next = formData.coverVideoUrl === url ? '' : url;
    setSavingVideo(true);
    try {
      await api.companies.update(companyId.toString(), { coverVideoUrl: next });
      setFormData(prev => ({ ...prev, coverVideoUrl: next }));
      // 🧹 Сбрасываем кэш профиля, чтобы страница магазина сразу подхватила новую анимацию
      invalidateCompanyProfile(companyId);
      toast.success(next
        ? (language === 'uz' ? 'Video-bezak tanlandi' : 'Видео-декорация выбрана')
        : (language === 'uz' ? 'Video-bezak olib tashlandi' : 'Видео-декорация убрана'));
    } catch (error) {
      console.error('Ошибка сохранения видео-декорации:', error);
      toast.error(language === 'uz' ? 'Saqlashda xatolik' : 'Ошибка сохранения');
    } finally {
      setSavingVideo(false);
    }
  };

  const loadCompanyProfile = async () => {
    try {
      console.log('📡 Loading company profile for SMM panel...');
      const data = await api.companies.get(companyId.toString());
      console.log('✅ Company profile loaded:', data);
      
      // Get stats as well
      let statsData = { total_products: 0, total_sales: 0, views: 0, subscribers: 0 };
      try {
        statsData = await api.companies.getStats(companyId.toString());
      } catch (e) {
        console.warn('Could not load stats:', e);
      }
      
      // Строим полный URL для логотипа
      const logoUrl = data.logoUrl || '';
      console.log('🖼️ Logo URL from API:', logoUrl);
      const fullLogoUrl = getImageUrl(logoUrl) || '';
      console.log('🖼️ Full Logo URL:', fullLogoUrl);
      setCoverImage(getImageUrl(data.coverUrl || '') || '');
      
      setProfile({
        id: data.id,
        name: data.name,
        phone: data.phone,
        location: data.address || '',
        latitude: 0,
        longitude: 0,
        description: data.description || '',
        rating: data.averageRating || 0,
        total_ratings: data.ratingCount || 0,
        total_products: statsData.total_products || 0,
        total_sales: statsData.total_sales || 0,
        logo_image: fullLogoUrl
      });
      
      setFormData({
        location: data.address || '',
        latitude: data.latitude || 0,
        longitude: data.longitude || 0,
        description: data.description || '',
        logo_image: fullLogoUrl,
        region: data.region || '',
        district: data.district || '',
        serviceRegions: Array.isArray(data.serviceRegions) ? data.serviceRegions : [],
        coverVideoUrl: data.coverVideoUrl || ''
      });
      setDeliveryRadius({
        km: data.deliveryRadiusKm || 0,
        lat: data.deliveryRadiusLat || data.latitude || 41.2995,
        lng: data.deliveryRadiusLng || data.longitude || 69.2401
      });
      
      setLoading(false);
    } catch (error) {
      console.error('❌ Ошибка загрузки профиля компании:', error);
      // Создаем базовый профиль если не загрузился
      setProfile({
        id: companyId,
        name: companyName,
        phone: '',
        location: '',
        latitude: 41.2995,
        longitude: 69.2401,
        description: '',
        rating: 0,
        total_ratings: 0,
        total_products: 0,
        total_sales: 0,
        logo_image: ''
      });
      setFormData({
        location: '',
        latitude: 41.2995,
        longitude: 69.2401,
        description: '',
        logo_image: '',
        region: '',
        district: '',
        serviceRegions: [],
        coverVideoUrl: ''
      });
      setLoading(false);
    }
  };

  const loadMediaItems = async () => {
    try {
      console.log('📸 [Media] Loading company advertisements...');
      const response = await api.ads.list({ companyId: companyId.toString() });
      console.log('✅ [Media] Loaded advertisements:', response);
      
      // Конвертируем рекламу в MediaItem формат, отфильтровываем deleted
      const items: MediaItem[] = (response.ads || [])
        .filter((ad: any) => ad.status !== 'deleted') // 🆕 Фильтруем удаленные рекламы
        .map((ad: any) => ({
          id: ad.id.toString(),
          type: 'ad' as const,
          url: ad.image_url || '',
          title: ad.title,
          description: ad.caption || ad.content,
          created_at: ad.created_at,
          status: ad.status,
          admin_message: ad.admin_message,
          rejection_reason: ad.rejection_reason
        }));
      
      setMediaItems(items);
    } catch (error) {
      console.error('❌ [Media] Error loading media:', error);
      setMediaItems([]);
    }
  };

  const handleSaveProfile = async () => {
    try {
      console.log('💾 Сохранение профиля компании:', companyId);
      console.log('📝 Данные для сохранения:', formData);
      
      toast.loading(t.saving, { id: 'save-profile' });
      
      // Отправляем данные на backend
      await api.companies.update(companyId.toString(), {
        description: formData.description,
        address: formData.location,
        latitude: formData.latitude,
        longitude: formData.longitude,
        region: formData.region,
        district: formData.district,
        serviceRegions: formData.serviceRegions, // 🗺️ регионы доставки (мультивыбор)
        locationAddress: formData.location
      });
      
      toast.success(t.profileSaved, { id: 'save-profile' });
      setEditMode(false);
      loadCompanyProfile();
    } catch (error) {
      console.error('❌ Ошибка сохранения профиля:', error);
      toast.error(`${t.saveProfileError} ${error instanceof Error ? error.message : 'Unknown error'}`, { id: 'save-profile' });
    }
  };

  const handleSaveDeliveryRadius = async () => {
    setSavingRadius(true);
    try {
      await api.companies.update(companyId.toString(), {
        deliveryRadiusKm: deliveryRadius.km,
        deliveryRadiusLat: deliveryRadius.lat || formData.latitude,
        deliveryRadiusLng: deliveryRadius.lng || formData.longitude
      } as any);
      toast.success('Зона доставки сохранена');
    } catch {
      toast.error('Ошибка сохранения зоны доставки');
    } finally {
      setSavingRadius(false);
    }
  };

  const handleMediaUpload = async (imageUrl: string, title: string, description: string, adType: 'company' | 'product', productId?: number, file?: File, linkUrl?: string) => {
    try {
      console.log('📸 [UPLOAD] Creating advertisement...', { title, adType, productId, companyId });
      
      // Показываем прогресс
      toast.loading(t.creatingAd, { id: 'media-upload' });
      
      let finalImageUrl = imageUrl;
      
      // Если есть файл - загружаем его
      if (file) {
        console.log('📤 [UPLOAD] Uploading image file...');
        const uploadResult = await api.ads.uploadImage(file);
        finalImageUrl = uploadResult.image_url;
        console.log('✅ [UPLOAD] Image uploaded:', finalImageUrl);
      }
      
      // Создаем рекламу с указанием типа
      const result = await api.ads.create({
        title: title,
        content: description || title,
        imageUrl: finalImageUrl,
        linkUrl: linkUrl || '',
        adType: adType,
        companyId: companyId,
        productId: productId
      });
      
      console.log('✅ [UPLOAD] Advertisement created:', result);
      
      if (result && result.id) {
        const adTypeText = adType === 'company' ? t.companyGenitive : t.productGenitive;
        toast.success(`${t.adCreated} ${adTypeText} ${t.adCreatedStatus}`, { id: 'media-upload' });
        setUploadModalOpen(false);
        // Перезагружаем список рекламы
        await loadMediaItems();
      } else {
        throw new Error('Failed to create advertisement');
      }
    } catch (error) {
      console.error('❌ [UPLOAD] Error:', error);
      toast.error(error instanceof Error ? error.message : t.adDeleteError, { id: 'media-upload' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">{t.loading}</div>
      </div>
    );
  }

  return (
    <div className={responsive.spacing} style={{ background: 'var(--ax-bg)', color: 'var(--ax-text)', minHeight: '100vh' }}>
      {/* Навигация */}
      <div style={{ background: 'var(--ax-card)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 4 }}>
        <div className="flex overflow-x-auto">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center ${responsive.gap} ${isMobile ? 'px-4 py-3' : 'px-6 py-4'} transition-colors whitespace-nowrap`}
            style={activeTab === 'profile'
              ? { background: 'linear-gradient(135deg, #7C5CF0, #5B3DD4)', color: '#FFFFFF', borderRadius: 10 }
              : { background: 'rgba(255,255,255,0.05)', color: '#8B8BAA', borderRadius: 10 }}
          >
            <Star className={responsive.iconSmall} />
            {isMobile ? t.profileTab : t.companyProfileTab}
          </button>
          <button
            onClick={() => setActiveTab('photos')}
            className={`flex items-center ${responsive.gap} ${isMobile ? 'px-4 py-3' : 'px-6 py-4'} transition-colors whitespace-nowrap`}
            style={activeTab === 'photos'
              ? { background: 'linear-gradient(135deg, #7C5CF0, #5B3DD4)', color: '#FFFFFF', borderRadius: 10 }
              : { background: 'rgba(255,255,255,0.05)', color: '#8B8BAA', borderRadius: 10 }}
          >
            <Megaphone className={responsive.iconSmall} />
            {t.adsTab}
          </button>
        </div>
      </div>

      {/* Профиль компании */}
      {activeTab === 'profile' && (
        <div className={responsive.spacing}>
          {/* Профиль компании с логотипом */}
          <div className={`${responsive.card} overflow-hidden`} style={{ background: 'var(--ax-card)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16 }}>
            {/* Фоновое (обложка) фото магазина — весь блок кликабелен для загрузки */}
            <div className="mb-6">
              <label
                className="relative block w-full rounded-2xl overflow-hidden border cursor-pointer group"
                style={{ aspectRatio: '3 / 1', background: 'linear-gradient(135deg, #1b2440, #0f1730)', borderColor: 'rgba(255,255,255,0.07)' }}
              >
                {formData.coverVideoUrl ? (
                  // 🎬 Выбранная видео-декорация показывается как зацикленный фон магазина
                  // key обязателен: без remount браузер не перезагружает <video> при смене src
                  <video
                    key={formData.coverVideoUrl}
                    src={getImageUrl(formData.coverVideoUrl) || formData.coverVideoUrl}
                    className="w-full h-full object-cover"
                    autoPlay
                    muted
                    loop
                    playsInline
                  />
                ) : coverImage ? (
                  <img src={coverImage} alt="Обложка магазина" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ color: '#8B8BAA' }}>
                    <Upload className="w-7 h-7" />
                    <span className="text-sm font-medium">{language === 'uz' ? 'Fon rasmini yuklash uchun bosing' : 'Нажмите, чтобы загрузить фоновое фото'}</span>
                  </div>
                )}
                <span className="absolute bottom-3 right-3 flex items-center gap-2 bg-black/60 backdrop-blur-sm text-white px-3 py-2 rounded-lg text-sm font-medium pointer-events-none">
                  {uploadingCover ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {coverImage
                    ? (language === 'uz' ? 'Almashtirish' : 'Заменить фон')
                    : (language === 'uz' ? 'Fon rasmni yuklash' : 'Загрузить фон')}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={uploadingCover}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) {
                      toast.error(language === 'uz' ? 'Rasm 5 MB dan oshmasligi kerak' : 'Файл должен быть не больше 5 МБ');
                      return;
                    }
                    try {
                      setUploadingCover(true);
                      toast.loading(language === 'uz' ? 'Yuklanmoqda…' : 'Загрузка…', { id: 'upload-cover' });
                      const res = await api.companies.uploadCover(companyId.toString(), file);
                      toast.success(language === 'uz' ? 'Fon rasmi yuklandi' : 'Фоновое фото загружено', { id: 'upload-cover' });
                      setCoverImage(getImageUrl(res?.cover_url || '') || '');
                      await loadCompanyProfile();
                    } catch (error) {
                      console.error('❌ Ошибка загрузки обложки:', error);
                      toast.error(language === 'uz' ? 'Yuklashda xatolik' : 'Ошибка загрузки фона', { id: 'upload-cover' });
                    } finally {
                      setUploadingCover(false);
                    }
                  }}
                />
              </label>
              <p className="mt-2 text-xs" style={{ color: '#8B8BAA' }}>
                {language === 'uz'
                  ? 'Tavsiya etiladi: 1200×400 px (3:1), JPG yoki PNG, 5 MB gacha. Bu rasm magazin sahifasida logotip orqasida koʻrinadi.'
                  : 'Рекомендуется: 1200×400 px (соотношение 3:1), формат JPG или PNG, до 5 МБ. Это фото показывается на странице магазина за логотипом.'}
              </p>
            </div>

            {/* 🎬 Видео-декорация: одна кнопка открывает галерею роликов админа,
                компания выбирает ОДИН — он зацикленно играет фоном магазина. */}
            {decorationVideos.length > 0 && (
              <div className="mb-6">
                <label className="block text-sm mb-2" style={{ color: '#8B8BAA' }}>
                  🎬 {language === 'uz' ? 'Video-bezak (ixtiyoriy)' : 'Видео-декорация (необязательно)'}
                </label>
                <p className="text-xs mb-3" style={{ color: '#5A5A78' }}>
                  {language === 'uz'
                    ? 'Tayyor animatsiyalardan birini tanlang — u magazin sahifasida fonda aylanib turadi.'
                    : 'Выберите одну из готовых анимаций — она будет зациклено проигрываться фоном страницы магазина.'}
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    type="button"
                    disabled={savingVideo}
                    onClick={() => setVideoPickerOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #7C5CF0, #5B3DD4)', color: '#FFFFFF', borderRadius: 10, border: 'none' }}
                  >
                    <Video className="w-4 h-4" />
                    {formData.coverVideoUrl
                      ? (language === 'uz' ? 'Animatsiyani almashtirish' : 'Сменить анимацию')
                      : (language === 'uz' ? 'Animatsiyani tanlash' : 'Выбрать анимацию')}
                  </button>
                  {formData.coverVideoUrl && (
                    <button
                      type="button"
                      disabled={savingVideo}
                      onClick={() => handleSelectDecorationVideo(formData.coverVideoUrl)}
                      className="text-xs font-medium"
                      style={{ color: '#F87171' }}
                    >
                      {language === 'uz' ? 'Video-bezakni olib tashlash' : 'Убрать видео-декорацию'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Логотип и основная информация */}
            <div className={`flex ${isMobile ? 'flex-col' : 'items-start'} ${responsive.gapLarge} mb-6`}>
              <div className={`relative ${isMobile ? 'mx-auto' : ''}`}>
                <div className={`${isMobile ? 'w-24 h-24' : 'w-32 h-32'} rounded-full bg-white border-4 border-[#141B2A]/30 shadow-lg overflow-hidden`}>
                  {formData.logo_image ? (
                    <img src={formData.logo_image} alt="Логотип" className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-b from-white to-[#141B2A] flex items-center justify-center text-[#141B2A] ${isMobile ? 'text-base' : 'text-lg'} font-bold`}>
                      {companyName.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                {editMode && (
                  <label className={`absolute bottom-0 right-0 bg-[#141B2A] text-white ${isMobile ? 'p-1.5' : 'p-2'} rounded-full cursor-pointer hover:bg-[#141B2A]/90 transition-colors shadow-lg`}>
                    <Upload className="w-4 h-4" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            setUploadingLogo(true);
                            toast.loading(t.uploadingLogo, { id: 'upload-logo' });
                            await api.companies.uploadLogo(companyId.toString(), file);
                            toast.success(t.logoUploaded, { id: 'upload-logo' });
                            // Перезагружаем профиль чтобы получить обновленный логотип
                            await loadCompanyProfile();
                          } catch (error) {
                            console.error('❌ Ошибка загрузки логотипа:', error);
                            toast.error(t.logoUploadError, { id: 'upload-logo' });
                          } finally {
                            setUploadingLogo(false);
                          }
                        }
                      }}
                      disabled={uploadingLogo}
                    />
                  </label>
                )}
              </div>
              
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl mb-2" style={{ color: '#FFFFFF', fontWeight: 700 }}>{companyName}</h2>
                    {profile && (
                      <div className="flex items-center gap-4" style={{ color: '#8B8BAA' }}>
                        <div className="flex items-center gap-1">
                          <Star
                            key={1}
                            className={`w-5 h-5 ${
                              1 <= Math.round(profile.rating)
                                ? 'fill-yellow-400 text-yellow-400'
                                : ''
                            }`}
                            style={1 <= Math.round(profile.rating) ? {} : { color: '#5A5A78' }}
                          />
                          <span className="ml-2">
                            {profile.rating.toFixed(1)} ({profile.total_ratings} {t.ratings})
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => editMode ? handleSaveProfile() : setEditMode(true)}
                    className="px-6 py-2 transition-colors"
                    style={{ background: 'linear-gradient(135deg, #7C5CF0, #5B3DD4)', color: '#FFFFFF', borderRadius: 10, border: 'none' }}
                  >
                    {editMode ? t.saveButton : t.editButton}
                  </button>
                </div>
              </div>
            </div>
            
            {/* Статистика */}
            <div className="grid grid-cols-4 gap-4 mt-6">
              <div className="rounded-lg p-4" style={{ background: 'rgba(124,92,240,0.08)' }}>
                <div className="flex items-center gap-2 mb-2" style={{ color: '#8B8BAA' }}>
                  <Package className="w-5 h-5" />
                  <span className="text-sm">{t.productsCount}</span>
                </div>
                <p className="text-2xl" style={{ color: '#7C5CF0', fontWeight: 700 }}>{profile?.total_products || 0}</p>
              </div>
              <div className="rounded-lg p-4" style={{ background: 'rgba(124,92,240,0.08)' }}>
                <div className="flex items-center gap-2 mb-2" style={{ color: '#8B8BAA' }}>
                  <TrendingUp className="w-5 h-5" />
                  <span className="text-sm">{t.salesCount}</span>
                </div>
                <p className="text-2xl" style={{ color: '#7C5CF0', fontWeight: 700 }}>{profile?.total_sales || 0}</p>
              </div>
              <div className="rounded-lg p-4" style={{ background: 'rgba(124,92,240,0.08)' }}>
                <div className="flex items-center gap-2 mb-2" style={{ color: '#8B8BAA' }}>
                  <Users className="w-5 h-5" />
                  <span className="text-sm">{t.subscribersCount}</span>
                </div>
                <p className="text-2xl" style={{ color: '#7C5CF0', fontWeight: 700 }}>{subscribersCount}</p>
              </div>
            </div>

            {/* Информация о компании */}
            <div className="mt-6 space-y-4">
              {/* Регион и Район */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-2" style={{ color: '#8B8BAA' }}>
                    🗺️ {language === 'uz' ? 'Viloyat' : 'Регион/Область'}
                  </label>
                  {editMode ? (
                    <select
                      value={formData.region}
                      onChange={(e) => {
                        setFormData({ ...formData, region: e.target.value, district: '' });
                      }}
                      className="w-full px-4 py-3 rounded-lg"
                      style={{ background: 'var(--ax-input)', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--ax-text)', borderRadius: 10 }}
                    >
                      <option value="">{language === 'uz' ? 'Viloyatni tanlang' : 'Выберите регион'}</option>
                      {UZBEKISTAN_REGIONS.map(r => (
                        <option key={r.name} value={r.name}>
                          {language === 'uz' ? r.nameUz : r.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p style={{ color: '#FFFFFF' }}>{formData.region || t.notSpecified}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm mb-2" style={{ color: '#8B8BAA' }}>
                    📍 {language === 'uz' ? 'Tuman' : 'Район'}
                  </label>
                  {editMode ? (
                    <select
                      value={formData.district}
                      onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                      className="w-full px-4 py-3 rounded-lg"
                      style={{ background: 'var(--ax-input)', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--ax-text)', borderRadius: 10, opacity: !formData.region ? 0.5 : 1 }}
                      disabled={!formData.region}
                    >
                      <option value="">{language === 'uz' ? 'Tumanni tanlang' : 'Выберите район'}</option>
                      {formData.region && getDistrictsByRegion(formData.region).map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  ) : (
                    <p style={{ color: '#FFFFFF' }}>{formData.district || t.notSpecified}</p>
                  )}
                </div>
              </div>

              {/* 🗺️ Регионы доставки — мультивыбор (можно выбрать сколько угодно).
                  Товары компании увидят только покупатели из выбранных регионов. */}
              <div>
                <label className="block text-sm mb-2" style={{ color: '#8B8BAA' }}>
                  🚚 {language === 'uz' ? 'Yetkazib berish hududlari (bir nechta)' : 'Регионы доставки (можно несколько)'}
                </label>
                <p className="text-xs mb-3" style={{ color: '#5A5A78' }}>
                  {language === 'uz'
                    ? 'Tanlangan hududlardagi xaridorlargina sizning mahsulotlaringizni koʻradi.'
                    : 'Ваши товары будут видны только покупателям из выбранных регионов.'}
                </p>
                <button
                  type="button"
                  onClick={() => setRegionsMapOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 mb-3 text-sm font-medium"
                  style={{ background: 'rgba(124,92,240,0.12)', border: '1px solid rgba(124,92,240,0.35)', color: '#7C5CF0', borderRadius: 10 }}
                >
                  <MapPin className="w-4 h-4" />
                  {language === 'uz' ? 'Hudud chegaralarini xaritada koʻrish' : 'Показать границы регионов на карте'}
                </button>
                {editMode ? (
                  <div className="grid grid-cols-2 gap-2">
                    {UZBEKISTAN_REGIONS.map(r => {
                      const checked = formData.serviceRegions.includes(r.name);
                      return (
                        <button
                          key={r.name}
                          type="button"
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            serviceRegions: checked
                              ? prev.serviceRegions.filter(x => x !== r.name)
                              : [...prev.serviceRegions, r.name]
                          }))}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-all"
                          style={checked
                            ? { background: 'rgba(124,92,240,0.15)', border: '1px solid #7C5CF0', color: '#FFFFFF' }
                            : { background: 'var(--ax-input)', border: '1px solid rgba(255,255,255,0.07)', color: '#8B8BAA' }}
                        >
                          <span style={{ color: checked ? '#7C5CF0' : '#5A5A78' }}>{checked ? '☑' : '☐'}</span>
                          <span className="truncate">{language === 'uz' ? r.nameUz : r.name}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {formData.serviceRegions.length > 0 ? (
                      formData.serviceRegions.map(rn => (
                        <span key={rn} className="px-3 py-1 rounded-full text-xs" style={{ background: 'rgba(124,92,240,0.15)', color: '#7C5CF0' }}>
                          {rn}
                        </span>
                      ))
                    ) : (
                      <p style={{ color: '#FFFFFF' }}>{t.notSpecified}</p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm mb-2" style={{ color: '#8B8BAA' }}>
                  <MapPin className="w-4 h-4 inline mr-1" />
                  {t.locationLabel}
                </label>
                {editMode ? (
                  <div className="space-y-2">
                    <button
                      onClick={() => setLocationModalOpen(true)}
                      className="w-full px-4 py-3 transition-colors text-left flex items-center justify-between"
                      style={{ background: 'var(--ax-input)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, color: 'var(--ax-text)' }}
                    >
                      <span>{formData.location || t.selectLocation}</span>
                      <Navigation className="w-5 h-5" style={{ color: '#7C5CF0' }} />
                    </button>
                    {formData.latitude && formData.longitude && (
                      <p className="text-xs" style={{ color: '#5A5A78' }}>
                        📍 {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <p style={{ color: '#FFFFFF' }}>{formData.location || t.notSpecified}</p>
                    {formData.latitude && formData.longitude && (
                      <p className="text-xs mt-1" style={{ color: '#5A5A78' }}>
                        📍 {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm mb-2" style={{ color: '#8B8BAA' }}>{t.companyDescription}</label>
                {editMode ? (
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg"
                    style={{ background: 'var(--ax-input)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, color: 'var(--ax-text)' }}
                    rows={4}
                    placeholder={t.companyDescPlaceholder}
                  />
                ) : (
                  <p style={{ color: '#FFFFFF' }}>{formData.description || t.noDescription}</p>
                )}
              </div>
            </div>
          </div>

          {/* Зона доставки */}
          <div className="rounded-2xl p-6 mb-4" style={{ background: 'var(--ax-card)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16 }}>
            <h3 className="text-base font-bold mb-4 flex items-center gap-2" style={{ color: '#FFFFFF' }}>
              <MapPin className="w-5 h-5" style={{ color: '#7C5CF0' }} />
              Зона доставки
            </h3>
            <p className="text-sm mb-4" style={{ color: '#8B8BAA' }}>
              Укажите радиус (в км) в котором ваша компания осуществляет доставку. Если радиус не указан — доставка принимается из любого места.
            </p>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1">
                <label className="block text-xs mb-1" style={{ color: '#8B8BAA' }}>{language === 'uz' ? 'Yetkazib berish radiusi (km)' : 'Радиус доставки (км)'}</label>
                <input
                  type="number"
                  min={0}
                  max={500}
                  step={0.5}
                  value={deliveryRadius.km}
                  onChange={e => setDeliveryRadius(prev => ({ ...prev, km: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--ax-input)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, color: 'var(--ax-text)' }}
                  placeholder={language === 'uz' ? 'masalan: 10' : 'например: 10'}
                />
              </div>
              <div className="flex-1 text-center pt-5">
                {deliveryRadius.km > 0
                  ? <span className="text-sm font-medium" style={{ color: '#7C5CF0' }}>{language === 'uz' ? `${deliveryRadius.km} km gacha` : `Доставка до ${deliveryRadius.km} км`}</span>
                  : <span className="text-sm" style={{ color: '#5A5A78' }}>{language === 'uz' ? 'Cheklanmagan' : 'Не ограничено'}</span>
                }
              </div>
            </div>
            {formData.latitude && formData.longitude && (
              <p className="text-xs mb-3" style={{ color: '#5A5A78' }}>
                Центр зоны: широта {(deliveryRadius.lat || formData.latitude).toFixed(5)}, долгота {(deliveryRadius.lng || formData.longitude).toFixed(5)}
              </p>
            )}
            <button
              onClick={handleSaveDeliveryRadius}
              disabled={savingRadius}
              className="w-full py-2.5 font-medium text-sm disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #7C5CF0, #5B3DD4)', color: '#FFFFFF', borderRadius: 10, border: 'none' }}
            >
              {savingRadius ? 'Сохранение...' : 'Сохранить зону доставки'}
            </button>
          </div>
        </div>
      )}

      {/* Реклама */}
      {activeTab === 'photos' && (
        <div className="space-y-6">
          {/* Инструкция по загрузке рекламы */}
          <div className="rounded-lg p-6" style={{ background: 'rgba(124,92,240,0.06)', border: '1px solid rgba(124,92,240,0.3)', borderRadius: 14 }}>
            <div className="flex items-start gap-4">
              <div className="rounded-full p-2 flex-shrink-0" style={{ background: 'linear-gradient(135deg, #7C5CF0, #5B3DD4)' }}>
                <Megaphone className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-semibold mb-2" style={{ color: '#FFFFFF' }}>{t.adsInstruction}</h4>
                <div className="text-sm space-y-2" style={{ color: '#8B8BAA' }}>
                  <p><strong style={{ color: '#FFFFFF' }}>{t.recommendedSizes}</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>{t.aspectRatio} <strong style={{ color: '#FFFFFF' }}>16:9</strong> {language === 'uz' ? 'yoki' : 'или'} <strong style={{ color: '#FFFFFF' }}>21:9</strong> {language === 'uz' ? '(namunadagi rasm kabi)' : '(как на фото в примере)'}</li>
                    <li>{t.minWidth} <strong style={{ color: '#FFFFFF' }}>1200 пикселей</strong></li>
                    <li>{t.maxFileSize} <strong style={{ color: '#FFFFFF' }}>5 МБ</strong></li>
                    <li>{t.formats} <strong style={{ color: '#FFFFFF' }}>JPG, PNG, WebP</strong></li>
                  </ul>
                  <p className="mt-3" style={{ color: '#7C5CF0' }}>
                    <strong>{t.adsTip}</strong> {t.adsTipText}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold" style={{ color: '#FFFFFF' }}>{t.adBanners}</h3>
            <div className="flex gap-2">
              {mediaItems.filter(item => item.status !== 'cancelled').length > 0 && (
                <button
                  onClick={async () => {
                    if (!confirm(t.deleteAllAdsConfirm)) return;
                    try {
                      toast.loading(t.deletingAllAds, { id: 'delete-all-ads' });
                      const result = await api.ads.deleteAll(companyId.toString());
                      toast.success(`${t.adsDeleted} ${result.deleted || 0} реклам(ы)`, { id: 'delete-all-ads' });
                      await loadMediaItems();
                    } catch (error) {
                      console.error('❌ Error deleting all ads:', error);
                      toast.error(t.adsDeleteError, { id: 'delete-all-ads' });
                    }
                  }}
                  className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors shadow-md hover:shadow-lg"
                >
                  <Trash2 className="w-5 h-5" />
                  {t.deleteAllButton}
                </button>
              )}
              <button
                onClick={() => setUploadModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 transition-colors"
                style={{ background: 'linear-gradient(135deg, #7C5CF0, #5B3DD4)', color: '#FFFFFF', borderRadius: 10, border: 'none' }}
              >
                <Upload className="w-5 h-5" />
                {t.uploadAd}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {mediaItems
              .filter((item) => item.type === 'ad')
              .map((item) => (
                <MediaCard key={item.id} item={item} companyId={companyId} companyName={companyName} onReload={loadMediaItems} />
              ))}
            {mediaItems.filter((item) => item.type === 'ad').length === 0 && (
              <div className="col-span-3 p-12 text-center" style={{ background: 'rgba(124,92,240,0.06)', border: '2px dashed rgba(124,92,240,0.3)', borderRadius: 14 }}>
                <Megaphone className="w-12 h-12 mx-auto mb-4" style={{ color: '#7C5CF0' }} />
                <p className="mb-4" style={{ color: '#8B8BAA' }}>{t.noAdBannersYet}</p>
                <p className="text-sm mb-4" style={{ color: '#8B8BAA' }}>{t.uploadImageForModeration}</p>
                <button
                  onClick={() => setUploadModalOpen(true)}
                  className="px-6 py-2 transition-colors"
                  style={{ background: 'linear-gradient(135deg, #7C5CF0, #5B3DD4)', color: '#FFFFFF', borderRadius: 10, border: 'none' }}
                >
                  {t.uploadFirstAd}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Модальное окно загрузки */}
      {uploadModalOpen && (
        <UploadModal
          onClose={() => setUploadModalOpen(false)}
          onUpload={handleMediaUpload}
          companyId={companyId}
        />
      )}

      {/* 🎬 Галерея видео-декораций: выбор одной анимации */}
      {videoPickerOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setVideoPickerOpen(false)}>
          <div className="rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" style={{ background: 'var(--ax-card)', border: '1px solid rgba(255,255,255,0.07)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 sm:p-6 sticky top-0 z-10" style={{ background: 'var(--ax-card)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <h3 className="text-base sm:text-lg font-semibold" style={{ color: '#FFFFFF' }}>
                {language === 'uz' ? 'Animatsiyani tanlang' : 'Выберите анимацию'}
              </h3>
              <button onClick={() => setVideoPickerOpen(false)} style={{ color: '#8B8BAA' }}>
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
            <div className="p-4 sm:p-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {decorationVideos.map(v => {
                const selected = formData.coverVideoUrl === v.url;
                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={savingVideo}
                    onClick={async () => { await handleSelectDecorationVideo(v.url); setVideoPickerOpen(false); }}
                    className="relative rounded-lg overflow-hidden transition-all disabled:opacity-50"
                    style={{ aspectRatio: '16 / 9', border: selected ? '2px solid #7C5CF0' : '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <video
                      key={v.url}
                      src={getImageUrl(v.url) || v.url}
                      muted
                      loop
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    {selected && (
                      <span className="absolute top-1 right-1 text-xs px-2 py-0.5 rounded-full" style={{ background: '#7C5CF0', color: '#FFF' }}>✓</span>
                    )}
                    {v.title && (
                      <span className="absolute bottom-0 left-0 right-0 text-[10px] px-1 py-0.5 truncate" style={{ background: 'rgba(0,0,0,0.55)', color: '#FFF' }}>
                        {v.title}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 🗺️ Карта границ регионов доставки */}
      {regionsMapOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-3 sm:p-6" onClick={() => setRegionsMapOpen(false)}>
          <div className="relative w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col" style={{ background: 'var(--ax-card)', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <h3 className="text-base font-semibold" style={{ color: '#FFFFFF' }}>
                {language === 'uz' ? 'Yetkazib berish hududlari chegaralari' : 'Границы регионов доставки'}
              </h3>
              <button onClick={() => setRegionsMapOpen(false)} style={{ color: '#8B8BAA' }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div style={{ height: isMobile ? '60vh' : 460, width: '100%' }}>
              <Suspense fallback={<div className="w-full h-full flex items-center justify-center" style={{ color: '#8B8BAA' }}>{language === 'uz' ? 'Xarita yuklanmoqda…' : 'Загрузка карты…'}</div>}>
                <RegionsMap selectedRegions={formData.serviceRegions} />
              </Suspense>
            </div>
            <div className="p-3 text-xs flex items-center gap-4 flex-wrap" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', color: '#8B8BAA' }}>
              <span className="flex items-center gap-1.5"><span style={{ width: 12, height: 12, background: 'rgba(124,92,240,0.5)', border: '1px solid #7C5CF0', borderRadius: 3 }} /> {language === 'uz' ? 'Tanlangan' : 'Выбранные'}</span>
              <span className="flex items-center gap-1.5"><span style={{ width: 12, height: 12, background: 'rgba(148,163,184,0.2)', border: '1px solid #94A3B8', borderRadius: 3 }} /> {language === 'uz' ? 'Boshqa hududlar' : 'Другие регионы'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно выбора локации */}
      {locationModalOpen && (
        <MapLocationPicker
          currentLocation={formData.location}
          currentLatitude={formData.latitude}
          currentLongitude={formData.longitude}
          onClose={() => setLocationModalOpen(false)}
          onSelect={(location, lat, lng) => {
            setFormData({ ...formData, location, latitude: lat, longitude: lng });
            setLocationModalOpen(false);
            toast.success(t.locationSelected);
          }}
        />
      )}
    </div>
  );
}

// Карточка медиа
function MediaCard({ item, companyId: _companyId, companyName: _companyName, onReload }: { 
  item: MediaItem; 
  companyId?: number; 
  companyName?: string;
  onReload?: () => void;
}) {
  const language = getCurrentLanguage();
  const t = useTranslation(language);

  const handleDelete = async () => {
    if (!confirm(t.deleteAdConfirm)) return;
    
    try {
      toast.loading(t.deletingAd, { id: 'delete-ad' });
      await api.ads.delete(item.id);
      toast.success(t.adDeleted, { id: 'delete-ad' });
      
      // Перезагружаем список
      if (onReload) {
        onReload();
      }
    } catch (error) {
      console.error('❌ Error deleting ad:', error);
      toast.error(t.adDeleteError, { id: 'delete-ad' });
    }
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return null;

    const badges: Record<string, { text: string; style: React.CSSProperties }> = {
      pending: { text: t.statusPending, style: { background: 'rgba(251,191,36,0.15)', color: '#FBBF24' } },
      approved: { text: t.statusApproved, style: { background: 'rgba(34,197,94,0.15)', color: '#22C55E' } },
      rejected: { text: t.statusRejected, style: { background: 'rgba(248,113,113,0.15)', color: '#F87171' } },
      cancelled: { text: t.statusRejected, style: { background: 'rgba(90,90,120,0.2)', color: '#8B8BAA' } }
    };

    const badge = badges[status as keyof typeof badges];
    if (!badge) return null;
    return (
      <div className="absolute top-2 right-2 px-3 py-1 rounded-full text-xs font-medium" style={badge.style}>
        {badge.text}
      </div>
    );
  };

  // Формируем полный URL для изображения
  const imageUrl = item.url ? (getImageUrl(item.url) || null) : null;

  return (
    <div className="overflow-hidden transition-shadow" style={{ background: 'var(--ax-card)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
      <div className="relative aspect-video" style={{ background: '#1A1A35' }}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center" style={{ color: '#5A5A78' }}>
            <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-xs">{language === 'uz' ? 'Rasm yoʻq' : 'Нет изображения'}</p>
          </div>
        )}
        {item.type === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-black/50 rounded-full p-4">
              <Video className="w-8 h-8 text-white" />
            </div>
          </div>
        )}
        {getStatusBadge(item.status)}
      </div>
      <div className="p-4">
        <h4 className="mb-2 font-medium" style={{ color: '#FFFFFF' }}>{item.title}</h4>

        {/* Показываем причину отклонения для rejected реклам */}
        {item.status === 'rejected' && (item.admin_message || item.rejection_reason) ? (
          <div className="mb-3 p-3 rounded-lg" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
            <p className="text-xs font-semibold mb-1" style={{ color: '#F87171' }}>{t.rejectionReason}</p>
            <p className="text-sm" style={{ color: '#F87171' }}>
              {item.admin_message || item.rejection_reason}
            </p>
          </div>
        ) : null}

        {/* Кнопка удаления */}
        <div className="flex justify-end">
          {item.status !== 'deleted' && (
            <button
              onClick={handleDelete}
              className="transition-colors p-2 rounded-lg"
              style={{ color: '#F87171' }}
              title={language === 'uz' ? 'Reklamani oʻchirish' : 'Удалить рекламу'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Модальное окно загрузки
function UploadModal({
  onClose,
  onUpload,
  companyId
}: {
  onClose: () => void;
  onUpload: (imageUrl: string, title: string, description: string, adType: 'company' | 'product', productId?: number, file?: File, linkUrl?: string) => void;
  companyId: number;
}) {
  const language = getCurrentLanguage();
  const t = useTranslation(language);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<'url' | 'file'>('file');
  const [isDragging, setIsDragging] = useState(false);
  const [adType, setAdType] = useState<'company' | 'product'>('company');
  const [selectedProductId, setSelectedProductId] = useState<number>();
  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // 🆕 Загрузка товаров компании
  useEffect(() => {
    if (adType === 'product') {
      loadCompanyProducts();
    }
  }, [adType]);

  const loadCompanyProducts = async () => {
    try {
      setLoadingProducts(true);
      const result = await api.products.list({ companyId: companyId.toString() });
      // Бэкенд может вернуть массив напрямую или { products: [...] } — поддерживаем оба
      const list = Array.isArray(result) ? result : (result?.products || []);
      setProducts(list);
    } catch (error) {
      console.error('❌ Error loading products:', error);
      toast.error(t.productsLoadError);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    
    // Создаем превью
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPreview(result);
    };
    reader.readAsDataURL(selectedFile);
    
    // Автоматически заполняем название
    if (!title) {
      setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith('image/')) {
      handleFileSelect(droppedFile);
    } else {
      toast.error(t.pleaseUploadImage);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleUploadClick = () => {
    if (uploadMode === 'file' && !file && !preview) {
      toast.error(t.selectFileToUpload);
      return;
    }
    if (uploadMode === 'url' && !imageUrl.trim()) {
      toast.error(t.enterImageURL);
      return;
    }
    if (!title.trim()) {
      toast.error(t.enterTitle);
      return;
    }
    // 🆕 Проверка выбора товара для product рекламы
    if (adType === 'product' && !selectedProductId) {
      toast.error(t.selectProductForAd);
      return;
    }
    // Для рекламы товара ссылку не передаём — клик ведёт на товар внутри приложения
    const finalLink = adType === 'company' ? (linkUrl || undefined) : undefined;
    onUpload(uploadMode === 'url' ? imageUrl : '', title, description, adType, selectedProductId, uploadMode === 'file' ? file || undefined : undefined, finalLink);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto" style={{ background: 'var(--ax-card)', border: '1px solid rgba(255,255,255,0.07)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 sm:p-6 sticky top-0 z-10" style={{ background: 'var(--ax-card)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <h3 className="text-base sm:text-lg font-semibold" style={{ color: '#FFFFFF' }}>
            {t.uploadAdTitle}
          </h3>
          <button onClick={onClose} className="flex-shrink-0" style={{ color: '#8B8BAA' }}>
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {/* 🆕 Выбор типа рекламы */}
          <div>
            <label className="block text-sm font-medium mb-3" style={{ color: '#8B8BAA' }}>{t.adType}</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAdType('company')}
                className="px-4 py-3 rounded-lg transition-all text-sm font-medium"
                style={adType === 'company'
                  ? { background: 'rgba(124,92,240,0.15)', border: '2px solid #7C5CF0', color: '#7C5CF0' }
                  : { background: 'var(--ax-input)', border: '2px solid rgba(255,255,255,0.07)', color: '#8B8BAA' }}
              >
                <span className="flex flex-col items-center gap-1">
                  <span className="text-2xl">🏢</span>
                  <span>{t.companyAd}</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setAdType('product')}
                className="px-4 py-3 rounded-lg transition-all text-sm font-medium"
                style={adType === 'product'
                  ? { background: 'rgba(124,92,240,0.15)', border: '2px solid #7C5CF0', color: '#7C5CF0' }
                  : { background: 'var(--ax-input)', border: '2px solid rgba(255,255,255,0.07)', color: '#8B8BAA' }}
              >
                <span className="flex flex-col items-center gap-1">
                  <span className="text-2xl">📦</span>
                  <span>{t.productAd}</span>
                </span>
              </button>
            </div>
            <p className="text-xs mt-2" style={{ color: '#5A5A78' }}>
              {adType === 'company'
                ? t.companyAdDescription
                : t.productAdDescription}
            </p>
          </div>

          {/* 🆕 Выбор товара (только для product рекламы) */}
          {adType === 'product' && (
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#8B8BAA' }}>{t.selectProductRequired}</label>
              {loadingProducts ? (
                <div className="text-sm py-2" style={{ color: '#8B8BAA' }}>{t.loadingProducts}</div>
              ) : products.length === 0 ? (
                <div className="text-sm py-2" style={{ color: '#8B8BAA' }}>{t.noProductsAddFirst}</div>
              ) : (
                <select
                  value={selectedProductId || ''}
                  onChange={(e) => setSelectedProductId(Number(e.target.value))}
                  className="w-full px-3 sm:px-4 py-2 text-sm rounded-lg"
                  style={{ background: 'var(--ax-input)', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--ax-text)', borderRadius: 10 }}
                >
                  <option value="">{t.selectProductOption}</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({new Intl.NumberFormat('uz-UZ').format(product.price)} сум)
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm mb-2" style={{ color: '#8B8BAA' }}>{t.nameRequired}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 text-sm rounded-lg"
              style={{ background: 'var(--ax-input)', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--ax-text)', borderRadius: 10 }}
              placeholder={t.enterNamePlaceholder}
            />
          </div>

          <div>
            <label className="block text-sm mb-2" style={{ color: '#8B8BAA' }}>{t.descriptionLabel}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 text-sm rounded-lg"
              style={{ background: 'var(--ax-input)', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--ax-text)', borderRadius: 10 }}
              rows={3}
              placeholder={t.addDescriptionPlaceholder}
            />
          </div>

          {/* 🔗 URL — только для рекламы компании (внешней). Для рекламы товара
              ссылка не нужна: клик ведёт на сам товар внутри приложения. */}
          {adType === 'company' && (
            <div>
              <label className="block text-sm mb-1" style={{ color: '#8B8BAA' }}>🔗 URL-ссылка (необязательно)</label>
              <p className="text-xs mb-2" style={{ color: '#5A5A78' }}>{language === 'uz' ? 'Reklama bosilganda shu manzil ochiladi (YouTube, Telegram, Uzum va h.k.)' : 'При нажатии на рекламу откроется этот адрес (YouTube, Telegram, Uzum и т.д.)'}</p>
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 text-sm rounded-lg"
                style={{ background: 'var(--ax-input)', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--ax-text)', borderRadius: 10 }}
                placeholder="https://t.me/yourcompany или https://youtube.com/..."
              />
            </div>
          )}

          {/* Переключатель режимов */}
          <div>
            <label className="block text-sm mb-3" style={{ color: '#8B8BAA' }}>{t.uploadMethod}</label>
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <button
                type="button"
                onClick={() => setUploadMode('file')}
                className="flex-1 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium"
                style={uploadMode === 'file'
                  ? { background: 'rgba(124,92,240,0.15)', border: '2px solid #7C5CF0', color: '#7C5CF0' }
                  : { background: 'var(--ax-input)', border: '2px solid rgba(255,255,255,0.07)', color: '#8B8BAA' }}
              >
                <span className="flex items-center justify-center gap-2">
                  <span>📁</span>
                  <span>{t.uploadFile.replace('📁 ', '')}</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setUploadMode('url')}
                className="flex-1 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium"
                style={uploadMode === 'url'
                  ? { background: 'rgba(124,92,240,0.15)', border: '2px solid #7C5CF0', color: '#7C5CF0' }
                  : { background: 'var(--ax-input)', border: '2px solid rgba(255,255,255,0.07)', color: '#8B8BAA' }}
              >
                <span className="flex items-center justify-center gap-2">
                  <span>🔗</span>
                  <span>{t.insertURL.replace('🔗 ', '')}</span>
                </span>
              </button>
            </div>
          </div>

          {/* Загрузка файла */}
          {uploadMode === 'file' && (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className="p-8 text-center transition-colors"
              style={{
                background: isDragging ? 'rgba(124,92,240,0.12)' : 'rgba(124,92,240,0.06)',
                border: `2px dashed ${isDragging ? '#7C5CF0' : 'rgba(124,92,240,0.3)'}`,
                borderRadius: 14
              }}
            >
              {preview ? (
                <div className="space-y-3">
                  <img src={preview} alt="Preview" className="max-h-48 mx-auto rounded-lg shadow" />
                  <p className="text-sm" style={{ color: '#8B8BAA' }}>{file?.name}</p>
                  <p className="text-xs" style={{ color: '#5A5A78' }}>{file ? (file.size / 1024 / 1024).toFixed(2) : 0} MB</p>
                  <button
                    type="button"
                    onClick={() => { setFile(null); setPreview(null); setImageUrl(''); }}
                    className="text-sm font-medium"
                    style={{ color: '#7C5CF0' }}
                  >
                    {t.removeFile}
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-12 h-12 mx-auto mb-4" style={{ color: '#7C5CF0' }} />
                  <p className="mb-2" style={{ color: '#8B8BAA' }}>{t.dragImageHere}</p>
                  <p className="text-sm mb-4" style={{ color: '#8B8BAA' }}>{t.or}</p>
                  <label className="inline-block cursor-pointer">
                    <span className="px-6 py-2 transition-colors" style={{ background: 'linear-gradient(135deg, #7C5CF0, #5B3DD4)', color: '#FFFFFF', borderRadius: 10 }}>
                      {t.selectFile}
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleFileInput}
                    />
                  </label>
                  <p className="text-xs mt-4" style={{ color: '#5A5A78' }}>
                    {t.recommendedTip}
                  </p>
                </>
              )}
            </div>
          )}

          {/* Ввод URL */}
          {uploadMode === 'url' && (
            <div>
              <label className="block text-sm mb-2" style={{ color: '#8B8BAA' }}>
                {t.imageURL}
                <span className="text-xs ml-2" style={{ color: '#5A5A78' }}>{t.imageURLExample}</span>
              </label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full px-4 py-2 rounded-lg"
                style={{ background: 'var(--ax-input)', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--ax-text)', borderRadius: 10 }}
                placeholder={t.imageURLPlaceholder}
              />
              <p className="text-xs mt-2" style={{ color: '#5A5A78' }}>
                {t.urlTip}
              </p>

              {imageUrl && (
                <div className="mt-4 rounded-lg p-4" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-sm mb-2" style={{ color: '#8B8BAA' }}>{t.previewLabel}</p>
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="max-h-40 mx-auto rounded"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 p-4 sm:p-6 sticky bottom-0" style={{ background: 'var(--ax-card)', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium transition-colors"
            style={{ background: 'var(--ax-input)', border: '1px solid rgba(255,255,255,0.07)', color: '#8B8BAA', borderRadius: 10 }}
          >
            {t.cancelButton}
          </button>
          <button
            onClick={handleUploadClick}
            disabled={(uploadMode === 'file' && !preview) || (uploadMode === 'url' && !imageUrl.trim()) || !title.trim()}
            className="flex-1 px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #7C5CF0, #5B3DD4)', color: '#FFFFFF', borderRadius: 10, border: 'none' }}
          >
            {t.createAdButton}
          </button>
        </div>
      </div>
    </div>
  );
}

