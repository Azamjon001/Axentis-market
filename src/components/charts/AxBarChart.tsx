/**
 * 📊 AxBarChart — единая столбцовая диаграмма проекта (на visx) с 3D-перспективой.
 *
 * Для панели «Финансы и аналитика»: те же токены темы и та же палитра, что и у
 * AxAreaChart, но объём вместо линии. Каждый столбец рисуется тремя гранями —
 * передней, верхней (подсветка) и боковой (тень) — что даёт мягкую 3D-глубину
 * (аналог BarDepthBack / Bar perspective / BarDepthFront).
 *
 *   - тихая горизонтальная сетка-волосок;
 *   - grouped (по умолчанию) — сравнение периодов бок о бок; stacked — состав;
 *   - правило проекта: если серий две — вторая всегда «предыдущий период»;
 *   - один тултип со всеми сериями, значение — главное;
 *   - уважение к prefers-reduced-motion (без анимации появления).
 *
 * Palette: #7C5CF0 (текущий) + #0284C7 (прошлый) — как у линейной диаграммы.
 */
import { useCallback, useMemo, useState } from 'react';
import { scaleBand, scaleLinear } from '@visx/scale';
import { GridRows } from '@visx/grid';
import { localPoint } from '@visx/event';
import { useChartWidth } from './useChartWidth';

export interface AxBarSeries {
  key: string;    // ключ поля в data
  name: string;   // подпись серии в тултипе
  color: string;  // цвет грани
}

interface AxBarChartProps {
  data: any[];
  xKey: string;
  series: AxBarSeries[];
  height?: number;
  /** stacked — сегменты копятся в одном столбце; иначе grouped (бок о бок) */
  stacked?: boolean;
  valueFormatter?: (v: number) => string;
  yTickFormatter?: (v: number) => string;
  xTickFormatter?: (v: string) => string;
  /** глубина 3D-грани в пикселях (авто, если не задано) */
  depth?: number;
}

const shortNumber = (v: number): string => {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1).replace(/\.0$/, '')}K`;
  return String(v);
};

const MARGIN = { top: 16, right: 16, bottom: 28, left: 48 };

/** Один 3D-столбец: передняя грань + верхняя (свет) + боковая (тень). */
function Bar3D({ x, y, w, h, color, depth }: { x: number; y: number; w: number; h: number; color: string; depth: number }) {
  if (h <= 0 || w <= 0) return null;
  const d = Math.min(depth, w * 0.6);
  const top = `${x},${y} ${x + d},${y - d} ${x + w + d},${y - d} ${x + w},${y}`;
  const side = `${x + w},${y} ${x + w + d},${y - d} ${x + w + d},${y - d + h} ${x + w},${y + h}`;
  return (
    <g>
      {/* BarDepthFront — передняя грань */}
      <rect x={x} y={y} width={w} height={h} fill={color} rx={2} />
      {/* верхняя грань — тот же цвет + белая подсветка */}
      <polygon points={top} fill={color} />
      <polygon points={top} fill="#FFFFFF" opacity={0.22} />
      {/* BarDepthBack — боковая грань, тот же цвет + тень */}
      <polygon points={side} fill={color} />
      <polygon points={side} fill="#000000" opacity={0.20} />
    </g>
  );
}

interface HoverState { index: number; left: number; top: number; }

function BarChartInner({
  data, xKey, series, width, height, stacked = false,
  valueFormatter, yTickFormatter, xTickFormatter, depth,
}: AxBarChartProps & { width: number; height: number }) {
  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerH = Math.max(0, height - MARGIN.top - MARGIN.bottom);
  const labels = useMemo(() => data.map((d) => String(d[xKey])), [data, xKey]);

  const reduceMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const x0 = useMemo(
    () => scaleBand<string>({ domain: labels, range: [0, innerW], padding: 0.32 }),
    [labels, innerW],
  );
  const x1 = useMemo(
    () => scaleBand<string>({ domain: series.map((s) => s.key), range: [0, x0.bandwidth()], padding: 0.18 }),
    [series, x0],
  );

  const maxY = useMemo(() => {
    let m = 0;
    for (const d of data) {
      if (stacked) {
        let sum = 0; for (const s of series) sum += Number(d[s.key]) || 0;
        m = Math.max(m, sum);
      } else {
        for (const s of series) m = Math.max(m, Number(d[s.key]) || 0);
      }
    }
    return m === 0 ? 1 : m;
  }, [data, series, stacked]);

  const d3 = depth ?? Math.min(12, Math.max(6, x0.bandwidth() * 0.16));
  const yScale = useMemo(
    () => scaleLinear<number>({ domain: [0, maxY * 1.16], range: [innerH - d3, 0], nice: true }),
    [maxY, innerH, d3],
  );

  const [hover, setHover] = useState<HoverState | null>(null);
  const handleMove = useCallback((e: React.MouseEvent<SVGRectElement>) => {
    const p = localPoint(e);
    if (!p) return;
    const cx = p.x - MARGIN.left;
    let best = 0; let bestD = Infinity;
    for (let i = 0; i < labels.length; i++) {
      const c = (x0(labels[i]) ?? 0) + x0.bandwidth() / 2;
      const dd = Math.abs(c - cx);
      if (dd < bestD) { bestD = dd; best = i; }
    }
    setHover({ index: best, left: p.x, top: p.y });
  }, [labels, x0]);

  const yTicks = yScale.ticks(4);
  const fmtY = yTickFormatter ?? shortNumber;

  const xTickIdx = useMemo(() => {
    const n = labels.length;
    if (n <= 1) return [0];
    const maxTicks = Math.max(2, Math.floor(innerW / 70));
    const step = Math.max(1, Math.ceil(n / maxTicks));
    const idx: number[] = [];
    for (let i = 0; i < n; i += step) idx.push(i);
    if (idx[idx.length - 1] !== n - 1) idx.push(n - 1);
    return idx;
  }, [labels.length, innerW]);

  if (innerW <= 0 || innerH <= 0 || data.length === 0) return null;

  return (
    <div style={{ position: 'relative' }}>
      <svg width={width} height={height} role="img"
        style={{ display: 'block', overflow: 'visible', animation: reduceMotion ? undefined : 'axBarFade .6s ease-out both' }}>
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          <GridRows scale={yScale} width={innerW} height={innerH - d3} stroke="rgba(139,139,170,0.14)" strokeWidth={1} />

          {yTicks.map((t) => (
            <text key={`y-${t}`} x={-10} y={yScale(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="#8B8BAA">{fmtY(t)}</text>
          ))}

          {/* Подсветка активной категории */}
          {hover && (
            <rect x={(x0(labels[hover.index]) ?? 0) - 4} y={0} width={x0.bandwidth() + 8} height={innerH - d3}
              fill="rgba(139,139,170,0.08)" rx={6} pointerEvents="none" />
          )}

          {/* Столбцы */}
          {data.map((d, i) => {
            const gx = x0(labels[i]) ?? 0;
            if (stacked) {
              let acc = 0;
              const bw = x0.bandwidth();
              return (
                <g key={i}>
                  {series.map((s) => {
                    const v = Number(d[s.key]) || 0;
                    const yTop = yScale(acc + v);
                    const yBot = yScale(acc);
                    acc += v;
                    return <Bar3D key={s.key} x={gx} y={yTop} w={bw} h={yBot - yTop} color={s.color} depth={d3} />;
                  })}
                </g>
              );
            }
            return (
              <g key={i}>
                {series.map((s) => {
                  const v = Number(d[s.key]) || 0;
                  const bx = gx + (x1(s.key) ?? 0);
                  const yTop = yScale(v);
                  return <Bar3D key={s.key} x={bx} y={yTop} w={x1.bandwidth()} h={(innerH - d3) - yTop} color={s.color} depth={d3} />;
                })}
              </g>
            );
          })}

          {/* X-подписи */}
          {xTickIdx.map((i) => (
            <text key={`x-${i}`} x={(x0(labels[i]) ?? 0) + x0.bandwidth() / 2} y={innerH + 16} textAnchor="middle" fontSize={10.5} fill="#8B8BAA">
              {xTickFormatter ? xTickFormatter(labels[i]) : labels[i]}
            </text>
          ))}

          <rect x={0} y={0} width={innerW} height={innerH} fill="transparent"
            onMouseMove={handleMove} onMouseLeave={() => setHover(null)} />
        </g>
      </svg>

      {hover && (
        <div style={{
          position: 'absolute',
          left: Math.min(Math.max(hover.left + 12, 8), width - 160),
          top: Math.max(hover.top - 12, 0),
          pointerEvents: 'none',
          background: 'var(--ax-card)',
          border: '1px solid var(--ax-border)',
          borderRadius: 12,
          padding: '10px 14px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
          minWidth: 140,
        }}>
          <div style={{ color: 'var(--ax-text-3, #5A5A78)', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
            {xTickFormatter ? xTickFormatter(labels[hover.index]) : labels[hover.index]}
          </div>
          {series.map((s) => {
            const v = Number(data[hover.index]?.[s.key]) || 0;
            return (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                <span aria-hidden="true" style={{ width: 11, height: 11, flexShrink: 0, borderRadius: 3, background: s.color }} />
                <span style={{ color: 'var(--ax-text)', fontSize: 13.5, fontWeight: 700 }}>
                  {valueFormatter ? valueFormatter(v) : v.toLocaleString('ru-RU')}
                </span>
                <span style={{ color: 'var(--ax-text-2, #8B8BAA)', fontSize: 11.5, marginLeft: 'auto', paddingLeft: 6 }}>
                  {s.name}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AxBarChart({ height = 300, ...props }: AxBarChartProps) {
  const [ref, width] = useChartWidth();
  return (
    <div ref={ref} style={{ width: '100%' }}>
      <style>{`@keyframes axBarFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
      {width > 0 && <BarChartInner {...props} width={width} height={height} />}
    </div>
  );
}
