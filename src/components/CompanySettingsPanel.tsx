import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Lock, Unlock, Copy, Check, RefreshCw, AlertCircle, Globe, Shield, Truck, RotateCcw, MapPin, X, QrCode, Download } from 'lucide-react';
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

  useEffect(() => {
    loadCompanyData();
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
      
      const response = await fetch(`${api.baseURL}/api/companies/${companyId}/privacy`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode })
      });

      if (!response.ok) {
        throw new Error('Failed to update privacy mode');
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
    </div>
  );
}
