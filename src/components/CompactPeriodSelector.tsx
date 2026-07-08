import { useState } from 'react';
import { Calendar, ChevronDown, Check } from 'lucide-react';
import { getCurrentLanguage } from '../utils/translations';

type PeriodType = 'day' | 'week' | 'month' | 'year' | 'custom';

interface CompactPeriodSelectorProps {
  value: PeriodType;
  onChange: (period: PeriodType) => void;
  label?: string;
  language?: string;
}

const periodLabelsRu: Record<PeriodType, string> = {
  day: 'Сегодня',
  week: 'Неделя',
  month: 'Месяц',
  year: 'Год',
  custom: 'Период'
};

const periodLabelsUz: Record<PeriodType, string> = {
  day: 'Bugun',
  week: 'Hafta',
  month: 'Oy',
  year: 'Yil',
  custom: 'Davr'
};

export default function CompactPeriodSelector({ value, onChange, label, language }: CompactPeriodSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const lang = language || getCurrentLanguage();
  const periodLabels = lang === 'uz' ? periodLabelsUz : periodLabelsRu;

  return (
    <div className="relative inline-block">
      {label && (
        <div className="text-xs mb-1 font-medium" style={{ color: 'var(--ax-text-2)' }}>{label}</div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg transition-all duration-200 text-sm font-semibold active:scale-95"
        style={{
          padding: '9px 14px',
          background: 'var(--ax-card)',
          border: '1px solid var(--ax-border)',
          color: 'var(--ax-text)',
          cursor: 'pointer',
        }}
      >
        <Calendar className="w-4 h-4" style={{ color: 'var(--ax-primary)' }} />
        <span>{periodLabels[value] ?? periodLabels['day']}</span>
        <ChevronDown
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          style={{ color: 'var(--ax-text-2)' }}
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          <div
            className="absolute right-0 mt-2 w-44 rounded-xl z-50 overflow-hidden"
            style={{
              background: 'var(--ax-card)',
              border: '1px solid var(--ax-border)',
              boxShadow: 'var(--ax-shadow)',
            }}
          >
            <div className="p-1">
              {(Object.keys(periodLabels) as PeriodType[]).map((period) => (
                <button
                  key={period}
                  onClick={() => {
                    onChange(period);
                    setIsOpen(false);
                  }}
                  className="w-full text-left rounded-lg text-sm transition-all duration-150 flex items-center justify-between"
                  style={{
                    padding: '10px 12px',
                    border: 'none',
                    cursor: 'pointer',
                    background: value === period ? 'var(--ax-primary-pale)' : 'transparent',
                    color: value === period ? 'var(--ax-primary)' : 'var(--ax-text)',
                    fontWeight: value === period ? 600 : 400,
                  }}
                >
                  <span>{periodLabels[period]}</span>
                  {value === period && (
                    <Check className="w-4 h-4" style={{ color: 'var(--ax-primary)' }} />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
