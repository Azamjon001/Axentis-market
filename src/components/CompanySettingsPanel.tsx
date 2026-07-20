import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Lock, Unlock, Copy, Check, RefreshCw, AlertCircle, Globe, Shield, Truck, RotateCcw, MapPin, X, QrCode, Download, Send } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import api from '../utils/api';
import { useTranslation, getCurrentLanguage } from '../utils/translations';
import { UZBEKISTAN_REGIONS } from '../utils/uzbekistanRegions';

// 🗺️ Карта границ регионов (ленивая загрузка)
const RegionsMap = lazy(() => import('./RegionsMap'));

interface CompanySettingsPanelProps {
  companyId: number;
  companyName: string;
}

export default function CompanySettingsPanel({ companyId }: CompanySettingsPanelProps) {
  const language = getCurrentLanguage();
  const t = useTranslation(language);
  
  // 📱 QR-код магазина: скачивание как PNG (canvas → файл)
  const qrWrapRef = useRef<HTMLDivElement>(null);
  const downloadQR = () => {
    const canvas = qrWrapRef.current?.querySelector('canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `axentis-store-${companyId}-qr.png`;
    a.click();
  };

  const [companyMode, setCompanyMode] = useState<'public' | 'private'>('public');
  const [privateCode, setPrivateCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [switchingMode, setSwitchingMode] = useState(false);

  // 🚚 Доставка и ↩️ возвраты
  const [freeRadiusKm, setFreeRadiusKm] = useState('2');
  const [costPerKm, setCostPerKm] = useState('1500');
  const [returnEnabled, setReturnEnabled] = useState(true);
  const [returnWindowHours, setReturnWindowHours] = useState('24');
  const [savingDelivery, setSavingDelivery] = useState(false);

  // 🗺️ Регионы доставки (мультивыбор названий — именно по ним фильтруются товары)
  const [serviceRegions, setServiceRegions] = useState<string[]>([]);
  const [savingRegion, setSavingRegion] = useState(false);
  const [regionsMapOpen, setRegionsMapOpen] = useState(false);
  // Зоны, созданные админом в админ-панели (с границами GeoJSON) — выбираются
  // наравне с системными областями Узбекистана.
  const [adminRegions, setAdminRegions] = useState<Array<{ id: number; name: string; nameUz?: string; geojson?: any }>>([]);

  // 🤖 Telegram-оповещения: статус привязки + ссылка подключения
  const [tgStatus, setTgStatus] = useState<{ enabled: boolean; connected: boolean; connectLink?: string; botName?: string } | null>(null);
  const [tgBusy, setTgBusy] = useState(false);

  const loadTelegramStatus = async () => {
    try {
      setTgStatus(await api.companies.telegramStatus(companyId));
    } catch {
      setTgStatus(null);
    }
  };
  useEffect(() => { loadTelegramStatus(); }, [companyId]);

  const disconnectTelegram = async () => {
    setTgBusy(true);
    try {
      await api.companies.telegramDisconnect(companyId);
      await loadTelegramStatus();
    } finally {
      setTgBusy(false);
    }
  };

  useEffect(() => {
    loadCompanyData();
    // Кастомные зоны из админ-панели: системные области не дублируем
    api.regions.list()
      .then((list: any) => {
        const items = (Array.isArray(list) ? list : []).filter(
          (r: any) => r?.name && !UZBEKISTAN_REGIONS.some((u) => u.name === r.name)
        );
        setAdminRegions(items);
      })
      .catch(() => setAdminRegions([]));
  }, [companyId]);

  const loadCompanyData = async () => {
    try {
      setLoading(true);
      const companies = await api.companies.list();
      const company = companies.find((c: any) => c.id === companyId);

      if (company) {
        setCompanyMode(company.mode || 'public');
        setPrivateCode(company.privateCode || null);
      }

      // Полные настройки доставки/возвратов берём из детального эндпоинта
      try {
        const full = await api.companies.get(String(companyId));
        if (full) {
          if (full.deliveryRadiusKm != null) setFreeRadiusKm(String(full.deliveryRadiusKm));
          if (full.deliveryCostPerKm != null) setCostPerKm(String(full.deliveryCostPerKm));
          if (full.returnEnabled != null) setReturnEnabled(!!full.returnEnabled);
          if (full.returnWindowHours != null) setReturnWindowHours(String(full.returnWindowHours));
          if (Array.isArray(full.serviceRegions)) setServiceRegions(full.serviceRegions);
        }
      } catch { /* ignore */ }
    } catch (error) {
      console.error('Error loading company data:', error);
      alert(t.errorLoadingCompanyData);
    } finally {
      setLoading(false);
    }
  };

  // Переключаем регион и сразу сохраняем весь список serviceRegions.
  // Именно по этому полю бэкенд фильтрует товары для покупателей.
  const toggleRegion = async (regionName: string) => {
    const next = serviceRegions.includes(regionName)
      ? serviceRegions.filter((x) => x !== regionName)
      : [...serviceRegions, regionName];
    setServiceRegions(next);
    try {
      setSavingRegion(true);
      await api.companies.update(String(companyId), { serviceRegions: next });
    } catch (error) {
      console.error('Error saving regions:', error);
    } finally {
      setSavingRegion(false);
    }
  };

  const handleSaveDelivery = async () => {
    try {
      setSavingDelivery(true);
      await api.companies.update(String(companyId), {
        deliveryRadiusKm: parseFloat(freeRadiusKm) || 0,
        deliveryCostPerKm: parseFloat(costPerKm) || 0,
        returnEnabled,
        returnWindowHours: parseInt(returnWindowHours, 10) || 0,
      });
      alert('Настройки доставки и возвратов сохранены');
    } catch (error) {
      console.error('Error saving delivery settings:', error);
      alert('Не удалось сохранить настройки');
    } finally {
      setSavingDelivery(false);
    }
  };

  const handleTogglePrivacy = async () => {
    const newMode = companyMode === 'public' ? 'private' : 'public';
    
    const confirmMessage = newMode === 'private'
      ? t.switchToPrivateConfirm
      : t.switchToPublicConfirm;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setSwitchingMode(true);
      
      // Маршрут защищён JWT — без Authorization бэкенд отвечает 401,
      // из-за чего переключение режима «не работало».
      const response = await fetch(`${api.baseURL}/api/companies/${companyId}/privacy`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(api.getAuthToken() ? { Authorization: `Bearer ${api.getAuthToken()}` } : {})
        },
        body: JSON.stringify({ mode: newMode })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || 'Failed to update privacy mode');
      }

      const data = await response.json();
      
      setCompanyMode(newMode);
      setPrivateCode(data.privateCode || null);
      
      const successMessage = newMode === 'private'
        ? `${t.switchedToPrivate}\n${t.yourAccessCode}: ${data.privateCode}`
        : t.switchedToPublic;
      
      alert(successMessage);
    } catch (error) {
      console.error('Error toggling privacy:', error);
      alert(t.errorChangingPrivacy);
    } finally {
      setSwitchingMode(false);
    }
  };

  const handleCopyCode = async () => {
    if (!privateCode) return;
    
    try {
      await navigator.clipboard.writeText(privateCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
      alert(t.errorCopyingCode);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Заголовок */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-2">
          <Truck className="w-8 h-8" />
          <h2 className="text-2xl font-bold">
            {language === 'uz' ? 'Yetkazib berish va qaytarishlar' : 'Доставка и возвраты'}
          </h2>
        </div>
        <p className="text-emerald-100 text-sm">
          {language === 'uz'
            ? 'Har bir doʻkon uchun yetkazib berish tarifi va qaytarish qoidalari'
            : 'Тариф доставки и правила возврата для вашего магазина'}
        </p>
      </div>

      {/* 📱 QR-код магазина: распечатайте и поставьте на кассе */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <QrCode className="w-6 h-6 text-emerald-600" />
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
              {language === 'uz' ? 'Doʻkon QR-kodi' : 'QR-код магазина'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {language === 'uz'
                ? 'Chop etib kassaga qoʻying — xaridor skanerlaydi va doʻkoningizga tushadi (ilova oʻrnatilgan boʻlsa, ilova ochiladi).'
                : 'Распечатайте и поставьте на кассе — покупатель сканирует и попадает в ваш магазин (с приложением откроется приложение).'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <div ref={qrWrapRef} className="bg-white p-3 rounded-xl border border-gray-200">
            <QRCodeCanvas value={`https://axentis.uz/company/${companyId}`} size={160} level="M" includeMargin />
          </div>
          <div className="space-y-3">
            <div className="text-sm text-gray-700 dark:text-gray-300 font-mono break-all">
              https://axentis.uz/company/{companyId}
            </div>
            <button
              onClick={downloadQR}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-semibold"
            >
              <Download className="w-4 h-4" />
              {language === 'uz' ? 'PNG yuklab olish' : 'Скачать PNG'}
            </button>
          </div>
        </div>
      </div>

      {/* 🤖 Telegram-оповещения: критические остатки + дневной отчёт */}
      {tgStatus?.enabled && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Send className="w-6 h-6 text-sky-500" />
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                {language === 'uz' ? 'Telegram-ogohlantirishlar' : 'Telegram-оповещения'}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {language === 'uz'
                  ? 'Faqat muhim narsalar: tovar zaxirasi kritik darajaga tushganda ogohlantirish va soat 21:00 da bir xabar bilan kunlik hisobot. Qolgan hammasi — saytda.'
                  : 'Только критичное: сигнал, когда остаток товара падает до критического уровня, и дневной отчёт одним сообщением в 21:00. Всё остальное — на сайте.'}
              </p>
            </div>
          </div>

          {tgStatus.connected ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                <Check className="w-4 h-4" />
                {language === 'uz' ? 'Ulangan' : 'Подключено'}
              </span>
              <button
                onClick={disconnectTelegram}
                disabled={tgBusy}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-60"
              >
                <X className="w-4 h-4" />
                {language === 'uz' ? 'Uzish' : 'Отключить'}
              </button>
            </div>
          ) : tgStatus.connectLink ? (
            <div className="space-y-3">
              <a
                href={tgStatus.connectLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  // Через несколько секунд обновляем статус — бот успеет привязать чат
                  setTimeout(loadTelegramStatus, 6000);
                  setTimeout(loadTelegramStatus, 15000);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors text-sm font-semibold"
              >
                <Send className="w-4 h-4" />
                {language === 'uz' ? 'Telegramda ulash' : 'Подключить в Telegram'}
              </a>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {language === 'uz'
                  ? 'Havola botni ochadi — «Start» tugmasini bosing, doʻkon avtomatik ulanadi.'
                  : 'Ссылка откроет бота — нажмите «Start», магазин привяжется автоматически.'}
              </p>
              <button
                onClick={loadTelegramStatus}
                className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {language === 'uz' ? 'Holatni yangilash' : 'Обновить статус'}
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {language === 'uz' ? 'Bot vaqtincha mavjud emas' : 'Бот временно недоступен'}
            </p>
          )}
        </div>
      )}

      {/* 🗺️ Регион доставки */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Globe className="w-6 h-6 text-emerald-600" />
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
              {language === 'uz' ? 'Yetkazib berish hududlari' : 'Регионы доставки'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {language === 'uz'
                ? 'Bir nechta hududni tanlashingiz mumkin. Faqat tanlangan hududlardagi xaridorlar mahsulotlaringizni koʻradi.'
                : 'Можно выбрать несколько. Товары увидят только покупатели из выбранных регионов.'}
            </p>
          </div>
          {savingRegion && <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />}
        </div>

        <button
          onClick={() => setRegionsMapOpen(true)}
          className="flex items-center gap-2 px-4 py-2 mb-3 text-sm font-medium rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
        >
          <MapPin className="w-4 h-4" />
          {language === 'uz' ? 'Hudud chegaralarini xaritada koʻrish' : 'Показать границы регионов на карте'}
        </button>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {UZBEKISTAN_REGIONS.map((r) => {
            const active = serviceRegions.includes(r.name);
            return (
              <button
                key={r.name}
                disabled={savingRegion}
                onClick={() => toggleRegion(r.name)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-left font-medium border transition disabled:opacity-60 ${
                  active
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600 hover:border-emerald-400'
                }`}
              >
                <span className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border ${active ? 'bg-white border-white' : 'border-gray-400 dark:border-gray-500'}`}>
                  {active && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                </span>
                <span className="truncate">{language === 'uz' ? r.nameUz : r.name}</span>
              </button>
            );
          })}
        </div>

        {/* Зоны, созданные администратором платформы (с границами на карте) */}
        {adminRegions.length > 0 && (
          <>
            <div className="flex items-center gap-2 mt-5 mb-2">
              <MapPin className="w-4 h-4 text-sky-500" />
              <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100">
                {language === 'uz' ? 'Platforma hududlari' : 'Зоны платформы'}
              </h4>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {language === 'uz' ? '(admin tomonidan yaratilgan)' : '(созданы в админ-панели)'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {adminRegions.map((r) => {
                const active = serviceRegions.includes(r.name);
                return (
                  <button
                    key={`admin-${r.id}`}
                    disabled={savingRegion}
                    onClick={() => toggleRegion(r.name)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-left font-medium border transition disabled:opacity-60 ${
                      active
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600 hover:border-sky-400'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border ${active ? 'bg-white border-white' : 'border-gray-400 dark:border-gray-500'}`}>
                      {active && <Check className="w-3.5 h-3.5 text-sky-600" />}
                    </span>
                    <span className="truncate">{language === 'uz' && r.nameUz ? r.nameUz : r.name}</span>
                    {r.geojson && (
                      <MapPin className="w-3.5 h-3.5 ml-auto flex-shrink-0 opacity-60" />
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {serviceRegions.length > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            {language === 'uz' ? 'Tanlangan' : 'Выбрано'}: {serviceRegions.length}
          </p>
        )}
      </div>

      {/* 🗺️ Модал карты границ регионов */}
      {regionsMapOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-3 sm:p-6" onClick={() => setRegionsMapOpen(false)}>
          <div className="relative w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col bg-white dark:bg-gray-800" style={{ maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">
                {language === 'uz' ? 'Hududlar chegaralari' : 'Границы регионов'}
              </h3>
              <button onClick={() => setRegionsMapOpen(false)} className="text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div style={{ height: 460, width: '100%' }}>
              <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-gray-500">…</div>}>
                <RegionsMap selectedRegions={serviceRegions} />
              </Suspense>
            </div>
          </div>
        </div>
      )}

      {/* 🚚 Доставка */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-5">
          <Truck className="w-6 h-6 text-emerald-600" />
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Доставка</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Бесплатно в радиусе, далее — фиксированный тариф за каждый километр
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Бесплатный радиус (км)
            </label>
            <input
              type="number" min="0" step="0.5"
              value={freeRadiusKm}
              onChange={(e) => setFreeRadiusKm(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Цена за км сверх радиуса (сум)
            </label>
            <input
              type="number" min="0" step="500"
              value={costPerKm}
              onChange={(e) => setCostPerKm(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Пример: радиус 3 км и 1500 сум/км → заказ за 5 км = (5−3)×1500 = 3000 сум.
        </p>
      </div>

      {/* ↩️ Возвраты */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-5">
          <RotateCcw className="w-6 h-6 text-orange-600" />
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Возвраты</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Эти правила управляются вами, а не администратором платформы
            </p>
          </div>
        </div>
        <label className="flex items-center gap-3 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={returnEnabled}
            onChange={(e) => setReturnEnabled(e.target.checked)}
            className="w-5 h-5 accent-orange-600"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Принимать возвраты от покупателей</span>
        </label>
        <div className={returnEnabled ? '' : 'opacity-50 pointer-events-none'}>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Срок возврата (часов с момента заказа)
          </label>
          <input
            type="number" min="0" step="1"
            value={returnWindowHours}
            onChange={(e) => setReturnWindowHours(e.target.value)}
            className="w-full sm:w-1/2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          />
        </div>
      </div>

      <button
        onClick={handleSaveDelivery}
        disabled={savingDelivery}
        className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 ${
          savingDelivery
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg hover:shadow-xl'
        }`}
      >
        {savingDelivery ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Check className="w-6 h-6" />}
        {language === 'uz' ? 'Saqlash' : 'Сохранить доставку и возвраты'}
      </button>

      {/* 👥 РЕЖИМ КАССИРА: наёмный продавец видит только офлайн-кассу.
          PIN и флаг живут в localStorage этого браузера; CompanyPanel слушает
          событие cashierModeChange и переключается без перезагрузки. */}
      <div style={{ background: 'var(--ax-card)', border: '1px solid var(--ax-border)', borderRadius: 16, padding: 20, marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 11, background: 'rgba(220,38,38,0.12)', color: 'var(--ax-danger)' }}>👥</span>
          <div>
            <div style={{ color: 'var(--ax-text)', fontWeight: 700, fontSize: 15 }}>
              {language === 'uz' ? 'Kassir rejimi' : 'Режим кассира'}
            </div>
            <div style={{ color: 'var(--ax-text-3)', fontSize: 12.5 }}>
              {language === 'uz'
                ? 'Sotuvchi faqat kassani koʻradi — tahlil va foydasiz. Chiqish — PIN orqali.'
                : 'Продавец видит только кассу — без аналитики и прибыли. Выход — по PIN владельца.'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder={localStorage.getItem('axentis_cashier_pin') ? '••••' : (language === 'uz' ? 'PIN (4 raqam)' : 'PIN (4 цифры)')}
            id="ax-cashier-pin-input"
            style={{ flex: '1 1 140px', padding: '10px 14px', borderRadius: 12, background: 'var(--ax-input)', border: '1px solid var(--ax-border)', color: 'var(--ax-text)', fontSize: 14, outline: 'none', letterSpacing: 4 }}
            onChange={(e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); }}
          />
          <button
            onClick={() => {
              const input = document.getElementById('ax-cashier-pin-input') as HTMLInputElement | null;
              const pin = input?.value || '';
              if (pin.length !== 4) {
                alert(language === 'uz' ? 'PIN 4 raqamdan iborat boʻlishi kerak' : 'PIN должен состоять из 4 цифр');
                return;
              }
              localStorage.setItem('axentis_cashier_pin', pin);
              if (input) input.value = '';
              alert(language === 'uz' ? 'PIN saqlandi' : 'PIN сохранён');
            }}
            style={{ padding: '10px 18px', borderRadius: 12, background: 'var(--ax-primary-pale)', color: 'var(--ax-primary)', border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 600 }}
          >
            {language === 'uz' ? 'PIN saqlash' : 'Сохранить PIN'}
          </button>
          <button
            onClick={() => {
              if (!localStorage.getItem('axentis_cashier_pin')) {
                alert(language === 'uz' ? 'Avval PIN qoʻying' : 'Сначала задайте PIN');
                return;
              }
              if (!confirm(language === 'uz'
                ? 'Kassir rejimini yoqasizmi? Chiqish faqat PIN bilan.'
                : 'Включить режим кассира? Выход — только по PIN.')) return;
              localStorage.setItem('axentis_cashier_mode', '1');
              window.dispatchEvent(new Event('cashierModeChange'));
            }}
            style={{ padding: '10px 18px', borderRadius: 12, background: 'rgba(217,119,6,0.14)', color: 'var(--ax-warning)', border: '1px solid rgba(217,119,6,0.3)', cursor: 'pointer', fontSize: 13.5, fontWeight: 600 }}
          >
            {language === 'uz' ? 'Kassir rejimini yoqish' : 'Включить режим кассира'}
          </button>
        </div>

        {/* 🔐 PIN-защита отдельных разделов: выбранные разделы открываются
            только по PIN владельца. «Заказы» и «Офлайн» не блокируются. */}
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--ax-border)' }}>
          <div style={{ color: 'var(--ax-text)', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
            🔐 {language === 'uz' ? 'Boʻlimlarni PIN bilan himoyalash' : 'PIN-защита разделов'}
          </div>
          <div style={{ color: 'var(--ax-text-3)', fontSize: 12.5, marginBottom: 12 }}>
            {language === 'uz'
              ? 'Tanlangan boʻlimlar faqat PIN bilan ochiladi. «Buyurtmalar» va «Oflayn» doim ochiq.'
              : 'Выбранные разделы открываются только по PIN. «Заказы» и «Офлайн» всегда доступны.'}
          </div>
          <PanelLocksEditor language={language} />
        </div>
      </div>
    </div>
  );
}

// ─── Чекбоксы PIN-замков разделов (localStorage axentis_locked_tabs) ─────────
function PanelLocksEditor({ language }: { language: string }) {
  const [locked, setLocked] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('axentis_locked_tabs');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const isUz = language === 'uz';
  const lockable: { key: string; label: string }[] = [
    { key: 'dashboard', label: isUz ? 'Boshqaruv' : 'Дашборд' },
    { key: 'warehouse', label: isUz ? 'Ombor va sotuv' : 'Склад и продажи' },
    { key: 'debts', label: isUz ? 'Daftar (qarzlar)' : 'Дафтар (долги)' },
    { key: 'analytics', label: isUz ? 'Statistika' : 'Аналитика' },
    { key: 'chat', label: isUz ? 'Chat' : 'Чат' },
    { key: 'couriers', label: isUz ? 'Kuryerlar' : 'Курьеры' },
    { key: 'questions', label: isUz ? 'Savollar' : 'Вопросы' },
    { key: 'returns', label: isUz ? 'Qaytarishlar' : 'Возвраты' },
    { key: 'discounts', label: isUz ? 'Chegirmalar' : 'Скидки' },
    { key: 'stories', label: isUz ? 'Storilar' : 'Сторис' },
    { key: 'smm', label: 'SMM' },
    { key: 'settings', label: isUz ? 'Sozlamalar' : 'Настройки' },
  ];

  const toggle = (key: string) => {
    if (!localStorage.getItem('axentis_cashier_pin')) {
      alert(isUz ? 'Avval PIN qoʻying' : 'Сначала задайте PIN-код выше');
      return;
    }
    const next = locked.includes(key) ? locked.filter((x) => x !== key) : [...locked, key];
    setLocked(next);
    localStorage.setItem('axentis_locked_tabs', JSON.stringify(next));
    window.dispatchEvent(new Event('panelLocksChange'));
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
      {lockable.map((item) => {
        const on = locked.includes(item.key);
        return (
          <label
            key={item.key}
            style={{
              display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', borderRadius: 11,
              background: on ? 'var(--ax-primary-pale)' : 'var(--ax-input)',
              border: `1px solid ${on ? 'var(--ax-primary)' : 'var(--ax-border)'}`,
              cursor: 'pointer', userSelect: 'none',
            }}
          >
            <input type="checkbox" checked={on} onChange={() => toggle(item.key)} style={{ accentColor: 'var(--ax-primary)' }} />
            <span style={{ fontSize: 13, color: on ? 'var(--ax-primary)' : 'var(--ax-text-2)', fontWeight: on ? 600 : 500 }}>
              {on ? '🔒 ' : ''}{item.label}
            </span>
          </label>
        );
      })}
    </div>
  );
}
