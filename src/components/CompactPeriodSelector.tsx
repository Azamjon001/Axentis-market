import { useState } from 'react';
import { Calendar, ChevronDown, Check } from 'lucide-react';
import { getCurrentLanguage } from '../utils/translations';

// Полный словарь периодов; каждая панель выбирает поддерживаемое ею
// подмножество через prop `options` — иначе селектор мог отдать период
// (например, 'custom'), который панель не умеет обрабатывать.
type PeriodType = 'day' | 'yesterday' | 'week' | 'month' | 'year' | 'all' | 'custom';

interface CompactPeriodSelectorProps<T extends PeriodType = PeriodType> {
  value: T;
  onChange: (period: T) => void;
  options?: readonly T[];
  label?: string;
  language?: string;
}

const periodLabelsRu: Record<PeriodType, string> = {
  day: 'Сегодня',
  yesterday: 'Вчера',
  week: 'Неделя',
  month: 'Месяц',
  year: 'Год',
  all: 'Всё время',
  custom: 'Период'
};

const periodLabelsUz: Record<PeriodType, string> = {
  day: 'Bugun',
  yesterday: 'Kecha',
  week: 'Hafta',
  month: 'Oy',
  year: 'Yil',
  all: 'Butun davr',
  custom: 'Davr'
};

const DEFAULT_OPTIONS: readonly PeriodType[] = ['day', 'week', 'month', 'year', 'custom'];

export default function CompactPeriodSelector<T extends PeriodType = PeriodType>({ value, onChange, options, label, language }: CompactPeriodSelectorProps<T>) {
  const [isOpen, setIsOpen] = useState(false);

  const lang = language || getCurrentLanguage();
  const periodLabels = lang === 'uz' ? periodLabelsUz : periodLabelsRu;
  const visibleOptions = (options ?? DEFAULT_OPTIONS) as readonly T[];

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
              {visibleOptions.map((period) => (
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
