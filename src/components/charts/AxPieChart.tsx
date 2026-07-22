/**
 * 🍩 AxPieChart — единый круговой (donut) график проекта.
 *
 * API в духе присланного примера:
 *   <AxPieChart data={pieData} innerRadius={60} size={200} />
 * Внутри — слои PieSlice (сегменты) и PieCenter (центр с итогом). При наведении
 * сегмент слегка выдвигается, а центр показывает значение и подпись сегмента;
 * без наведения — общий итог и defaultLabel.
 *
 * Токены темы (--ax-*) и палитра проекта; уважение к prefers-reduced-motion.
 */
import { useMemo, useState } from 'react';

export interface AxPieDatum { name?: string; label?: string; value: number }

interface AxPieChartProps {
  data: AxPieDatum[];
  size?: number;
  innerRadius?: number;
  colors?: string[];
  /** Подпись в центре, когда ничего не выбрано (по умолч. «Всего») */
  defaultLabel?: string;
  valueFormatter?: (v: number) => string;
}

const DEFAULT_COLORS = ['#7C5CF0', '#0284C7', '#22C55E', '#FB923C', '#E879F9', '#38BDF8', '#F43F5E'];

function arcPath(cx: number, cy: number, rO: number, rI: number, a0: number, a1: number): string {
  const pt = (r: number, a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0o, y0o] = pt(rO, a0);
  const [x1o, y1o] = pt(rO, a1);
  const [x1i, y1i] = pt(rI, a1);
  const [x0i, y0i] = pt(rI, a0);
  return `M${x0o},${y0o} A${rO},${rO} 0 ${large} 1 ${x1o},${y1o} L${x1i},${y1i} A${rI},${rI} 0 ${large} 0 ${x0i},${y0i} Z`;
}

export default function AxPieChart({
  data, size = 200, innerRadius = 60, colors = DEFAULT_COLORS,
  defaultLabel = 'Всего', valueFormatter,
}: AxPieChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const reduceMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const total = useMemo(() => data.reduce((s, d) => s + (Number(d.value) || 0), 0), [data]);

  const slices = useMemo(() => {
    const cx = size / 2, cy = size / 2, rO = size / 2, rI = innerRadius;
    let angle = -Math.PI / 2; // старт сверху
    return data.map((d, i) => {
      const frac = total > 0 ? (Number(d.value) || 0) / total : 0;
      const a0 = angle;
      const a1 = angle + frac * Math.PI * 2;
      angle = a1;
      const mid = (a0 + a1) / 2;
      return { d, i, a0, a1, mid, cx, cy, rO, rI, frac };
    });
  }, [data, size, innerRadius, total]);

  const fmt = (v: number) => (valueFormatter ? valueFormatter(v) : v.toLocaleString('ru-RU'));
  const active = hover != null ? slices[hover] : null;
  const nameOf = (d: AxPieDatum) => d.name ?? d.label ?? '';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
      style={{ overflow: 'visible', animation: reduceMotion ? undefined : 'axPieFade .5s ease-out both' }}>
      <style>{`@keyframes axPieFade{from{opacity:0}to{opacity:1}}`}</style>

      {/* PieSlice — сегменты */}
      {slices.map((s) => {
        if (s.frac <= 0) return null;
        const isHover = hover === s.i;
        const pop = isHover && !reduceMotion ? 6 : 0; // лёгкое выдвижение
        const dx = pop * Math.cos(s.mid);
        const dy = pop * Math.sin(s.mid);
        // маленький зазор между сегментами
        const gap = data.length > 1 ? 0.012 : 0;
        return (
          <path
            key={nameOf(s.d) || s.i}
            d={arcPath(s.cx, s.cy, s.rO, s.rI, s.a0 + gap, s.a1 - gap)}
            fill={colors[s.i % colors.length]}
            transform={`translate(${dx},${dy})`}
            opacity={hover == null || isHover ? 1 : 0.5}
            style={{ transition: reduceMotion ? undefined : 'transform .18s ease, opacity .18s ease', cursor: 'pointer' }}
            onMouseEnter={() => setHover(s.i)}
            onMouseLeave={() => setHover(null)}
          />
        );
      })}

      {/* PieCenter — центр с итогом */}
      <g pointerEvents="none" textAnchor="middle">
        <text x={size / 2} y={size / 2 - 6} fontSize={size * 0.135} fontWeight={700} fill="var(--ax-text)">
          {active ? fmt(Number(active.d.value) || 0) : fmt(total)}
        </text>
        <text x={size / 2} y={size / 2 + 16} fontSize={size * 0.065} fill="var(--ax-text-2, #8B8BAA)">
          {active ? nameOf(active.d) : defaultLabel}
        </text>
      </g>
    </svg>
  );
}
