import { useState, useEffect } from 'react';
import { Star, BadgeCheck } from 'lucide-react';
import api, { getImageUrl } from '../utils/api';
import { getCurrentLanguage } from '../utils/translations';

interface TopCompany {
  id: number;
  name: string;
  logoUrl: string;
  address: string;
  soldUnits: number;
  rating: number;
  ratingCount: number;
  productCount: number;
  isVerified?: boolean;
}

interface HitCompaniesProps {
  isNight?: boolean;
  onOpenCompany: (companyId: number) => void;
}

/**
 * Instagram-style "recommended shops" row: a horizontally scrolling list of the
 * top-selling, best-rated shops. Backend: GET /api/companies/top.
 */
export default function HitCompanies({ isNight, onOpenCompany }: HitCompaniesProps) {
  const [companies, setCompanies] = useState<TopCompany[]>([]);
  const [lang, setLang] = useState(getCurrentLanguage());

  useEffect(() => {
    const onLang = (e: any) => setLang(e.detail);
    window.addEventListener('languageChange', onLang as EventListener);
    return () => window.removeEventListener('languageChange', onLang as EventListener);
  }, []);

  useEffect(() => {
    let active = true;
    api.companies
      .top()
      .then((d: any) => active && setCompanies(Array.isArray(d) ? d : []))
      .catch((e) => console.error('Load top companies failed:', e));
    return () => {
      active = false;
    };
  }, []);

  if (companies.length < 2) return null;

  const initials = (name: string) =>
    name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className={`text-base font-bold ${isNight ? 'text-white' : 'text-gray-900'}`}>
          ⭐ {lang === 'uz' ? 'Mashhur do‘konlar' : 'Хитовые магазины'}
        </h2>
      </div>
      <div
        className="-mx-4 px-4 overflow-x-auto scrollbar-none"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as any}
      >
        <div className="flex gap-3 pb-1" style={{ width: 'max-content' }}>
          {companies.map((co) => {
            const logo = co.logoUrl ? getImageUrl(co.logoUrl) : null;
            return (
              <button
                key={co.id}
                onClick={() => onOpenCompany(co.id)}
                className={`shrink-0 w-28 rounded-2xl p-3 text-center transition-transform active:scale-95 ${
                  isNight ? 'bg-white/8' : 'bg-white shadow-sm'
                }`}
              >
                {/* Avatar with gradient ring (Instagram-style) */}
                <div className="mx-auto mb-2 w-16 h-16 rounded-full p-[2px]" style={{ background: 'linear-gradient(45deg,#f59e0b,#ec4899,#8b5cf6)' }}>
                  <div className={`w-full h-full rounded-full overflow-hidden flex items-center justify-center ${isNight ? 'bg-slate-800' : 'bg-white'}`}>
                    {logo ? (
                      <img src={logo} alt={co.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-bold text-purple-500">{initials(co.name)}</span>
                    )}
                  </div>
                </div>
                <div className={`text-xs font-semibold line-clamp-1 flex items-center justify-center gap-0.5 ${isNight ? 'text-white' : 'text-gray-900'}`}>
                  {co.name}
                  {/* ✅ Значок показывается только магазинам, проверенным админом */}
                  {co.isVerified && <BadgeCheck className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />}
                </div>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  <span className={`text-[11px] ${isNight ? 'text-gray-400' : 'text-gray-500'}`}>
                    {co.rating > 0 ? co.rating.toFixed(1) : '—'}
                  </span>
                </div>
                <div className={`text-[10px] mt-0.5 ${isNight ? 'text-gray-500' : 'text-gray-400'}`}>
                  {lang === 'uz' ? 'Sotildi' : 'Продано'} {co.soldUnits}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
