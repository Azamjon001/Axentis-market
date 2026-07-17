/**
 * 📈 AxAreaChart — единая линейная диаграмма проекта.
 *
 * Все графики «динамики» (выручка, продажи, закупки) рисуются этим компонентом,
 * чтобы выглядеть одной системой:
 *   - плавная monotone-кривая (никаких перехлёстов ниже нуля, как у natural);
 *   - линия 2.5px со скруглениями, мягкая градиентная заливка-«дымка»;
 *   - тихая сплошная сетка-волосок только по горизонтали;
 *   - вертикальный crosshair + один тултип со всеми сериями (значение — главное);
 *   - точка при наведении с кольцом цвета поверхности;
 *   - вторая серия (прошлый период) — пунктир без заливки, приглушённая.
 *
 * Palette: #7C5CF0 + #0284C7 — проверена валидатором (CVD/контраст) на обеих
 * поверхностях темы; пунктир второй серии — вторичное кодирование.
 */
import { useMemo } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';

export interface AxChartSeries {
  key: string;          // ключ поля в data
  name: string;         // подпись серии в тултипе
  color: string;        // цвет линии
  dashed?: boolean;     // пунктир (прошлый период) — без заливки
  fill?: boolean;       // градиентная заливка под линией
}

interface AxAreaChartProps {
  data: any[];
  xKey: string;
  series: AxChartSeries[];
  height?: number;
  /** Формат значения в тултипе (например, «12 500 сум») */
  valueFormatter?: (v: number) => string;
  /** Формат делений оси Y (короткие числа: 12K, 1.2M) */
  yTickFormatter?: (v: number) => string;
  /** Формат подписей оси X */
  xTickFormatter?: (v: string) => string;
  /** interval для оси X (по умолчанию авторасчёт с minTickGap) */
  xInterval?: number | 'preserveStartEnd';
}

const shortNumber = (v: number): string => {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1).replace(/\.0$/, '')}K`;
  return String(v);
};

// Тултип: значение — главное (крупное, жирное), имя серии — вторичное.
// Ключ серии — короткий штрих цвета линии, не квадрат.
function AxTooltip({ active, payload, label, valueFormatter }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div style={{
      background: 'var(--ax-card)',
      border: '1px solid var(--ax-border)',
      borderRadius: 12,
      padding: '10px 14px',
      boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
      minWidth: 140,
    }}>
      <div style={{ color: 'var(--ax-text-3, #5A5A78)', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
        {label}
      </div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: i > 0 ? 5 : 0 }}>
          <span aria-hidden="true" style={{
            width: 14, height: 0, flexShrink: 0,
            borderTop: `3px ${p.strokeDasharray ? 'dashed' : 'solid'} ${p.stroke || p.color}`,
            borderRadius: 2,
          }} />
          <span style={{ color: 'var(--ax-text)', fontSize: 13.5, fontWeight: 700 }}>
            {valueFormatter ? valueFormatter(p.value) : p.value?.toLocaleString?.('ru-RU') ?? p.value}
          </span>
          <span style={{ color: 'var(--ax-text-2, #8B8BAA)', fontSize: 11.5, marginLeft: 'auto', paddingLeft: 6 }}>
            {p.name}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AxAreaChart({
  data, xKey, series, height = 280,
  valueFormatter, yTickFormatter, xTickFormatter, xInterval,
}: AxAreaChartProps) {
  // Уважение к prefers-reduced-motion: без входной анимации кривой
  const reduceMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    [],
  );
  const gradientPrefix = useMemo(() => `axgrad-${Math.random().toString(36).slice(2, 8)}`, []);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`${gradientPrefix}-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.24} />
              <stop offset="72%" stopColor={s.color} stopOpacity={0.04} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>

        {/* Тихая сетка: сплошной волосок, только горизонталь */}
        <CartesianGrid stroke="rgba(139,139,170,0.14)" strokeWidth={1} vertical={false} />

        <XAxis
          dataKey={xKey}
          tick={{ fill: '#8B8BAA', fontSize: 10.5 }}
          tickFormatter={xTickFormatter}
          axisLine={false}
          tickLine={false}
          interval={xInterval ?? 'preserveStartEnd'}
          minTickGap={28}
          tickMargin={8}
        />
        <YAxis
          tick={{ fill: '#8B8BAA', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={52}
          tickFormatter={yTickFormatter ?? shortNumber}
        />

        {/* Crosshair находит X — читатель целится в дату, а не в линию 2px */}
        <Tooltip
          cursor={{ stroke: 'rgba(139,139,170,0.35)', strokeWidth: 1 }}
          content={<AxTooltip valueFormatter={valueFormatter} />}
        />

        {series.map((s, i) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={s.dashed ? 2 : 2.5}
            strokeDasharray={s.dashed ? '6 5' : undefined}
            strokeOpacity={s.dashed ? 0.7 : 1}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={s.fill && !s.dashed ? `url(#${gradientPrefix}-${i})` : 'transparent'}
            dot={false}
            activeDot={{ r: 4.5, fill: s.color, stroke: 'var(--ax-card)', strokeWidth: 2 }}
            isAnimationActive={!reduceMotion}
            animationDuration={900}
            animationEasing="ease-out"
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
