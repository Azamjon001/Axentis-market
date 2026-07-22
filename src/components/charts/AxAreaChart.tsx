/**
 * 📈 AxAreaChart — единая линейная диаграмма проекта (на visx).
 *
 * Построена на @visx (curveMonotoneX + AreaClosed + LinePath), чтобы все графики
 * «динамики» (выручка, продажи, закупки) выглядели одной системой:
 *   - плавная monotone-кривая;
 *   - линия 2.5px со скруглениями, мягкая градиентная заливка-«дымка»;
 *   - точки на узлах данных — график виден даже когда значений мало;
 *   - тихая сплошная сетка-волосок только по горизонтали;
 *   - вертикальный crosshair + один тултип со всеми сериями;
 *   - вторая серия (прошлый период) — пунктир без заливки, приглушённая.
 *
 * Правило проекта: если серий две — вторая всегда «предыдущий период».
 * Ширина берётся через ResizeObserver (useChartWidth) — надёжно в grid/flex.
 *
 * Palette: #7C5CF0 + #0284C7 — проверена валидатором (CVD/контраст).
 */
import { useCallback, useMemo, useState } from 'react';
import { AreaClosed, LinePath, Line } from '@visx/shape';
import { curveMonotoneX } from '@visx/curve';
import { scaleLinear, scalePoint } from '@visx/scale';
import { GridRows } from '@visx/grid';
import { LinearGradient } from '@visx/gradient';
import { localPoint } from '@visx/event';
import { useChartWidth } from './useChartWidth';

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
  valueFormatter?: (v: number) => string;
  yTickFormatter?: (v: number) => string;
  xTickFormatter?: (v: string) => string;
  xInterval?: number | 'preserveStartEnd';
  /** Подсветка последнего сегмента (мягкая заливка). По умолчанию выкл. */
  highlightLast?: boolean;
}

const shortNumber = (v: number): string => {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1).replace(/\.0$/, '')}K`;
  return String(v);
};

const MARGIN = { top: 12, right: 16, bottom: 26, left: 48 };

interface HoverState { index: number; left: number; top: number; }

function AreaChartInner({
  data, xKey, series, width, height,
  valueFormatter, yTickFormatter, xTickFormatter, xInterval, highlightLast = false,
}: AxAreaChartProps & { width: number; height: number }) {
  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerH = Math.max(0, height - MARGIN.top - MARGIN.bottom);

  const gradPrefix = useMemo(() => `axarea-${Math.random().toString(36).slice(2, 8)}`, []);
  const labels = useMemo(() => data.map((d) => String(d[xKey])), [data, xKey]);

  const reduceMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const xScale = useMemo(
    () => scalePoint<string>({ domain: labels, range: [0, innerW], padding: 0.5 }),
    [labels, innerW],
  );

  const maxY = useMemo(() => {
    let m = 0;
    for (const d of data) for (const s of series) m = Math.max(m, Number(d[s.key]) || 0);
    return m === 0 ? 1 : m;
  }, [data, series]);

  const yScale = useMemo(
    () => scaleLinear<number>({ domain: [0, maxY * 1.15], range: [innerH, 0], nice: true }),
    [maxY, innerH],
  );

  const px = useCallback((i: number) => xScale(labels[i]) ?? 0, [xScale, labels]);

  const [hover, setHover] = useState<HoverState | null>(null);
  const handleMove = useCallback((e: React.MouseEvent<SVGRectElement>) => {
    const p = localPoint(e);
    if (!p) return;
    const cx = p.x - MARGIN.left;
    let best = 0; let bestD = Infinity;
    for (let i = 0; i < labels.length; i++) {
      const d = Math.abs((xScale(labels[i]) ?? 0) - cx);
      if (d < bestD) { bestD = d; best = i; }
    }
    setHover({ index: best, left: p.x, top: p.y });
  }, [labels, xScale]);

  const yTicks = yScale.ticks(4);
  const fmtY = yTickFormatter ?? shortNumber;

  const xTickIdx = useMemo(() => {
    const n = labels.length;
    if (n <= 1) return [0];
    let step: number;
    if (typeof xInterval === 'number' && xInterval > 0) step = xInterval + 1;
    else {
      const maxTicks = Math.max(2, Math.floor(innerW / 64));
      step = Math.max(1, Math.ceil(n / maxTicks));
    }
    const idx: number[] = [];
    for (let i = 0; i < n; i += step) idx.push(i);
    if (idx[idx.length - 1] !== n - 1) idx.push(n - 1);
    return idx;
  }, [labels.length, xInterval, innerW]);

  // Точки на узлах — показываем только когда их немного, иначе линия чище.
  const showDots = labels.length <= 16;

  if (innerW <= 0 || innerH <= 0 || data.length === 0) return null;

  const primary = series.find((s) => !s.dashed) ?? series[0];
  const segFrom = data.length >= 2 ? px(data.length - 2) : 0;
  const segTo = px(data.length - 1);

  return (
    <div style={{ position: 'relative' }}>
      <svg width={width} height={height} role="img"
        style={{ display: 'block', overflow: 'visible', animation: reduceMotion ? undefined : 'axAreaFade .5s ease-out both' }}>
        <defs>
          {series.map((s, i) => (
            <LinearGradient key={s.key} id={`${gradPrefix}-${i}`} from={s.color} to={s.color} fromOpacity={0.28} toOpacity={0} x1={0} y1={0} x2={0} y2={1} />
          ))}
        </defs>

        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          <GridRows scale={yScale} width={innerW} height={innerH} stroke="rgba(139,139,170,0.14)" strokeWidth={1} />

          {highlightLast && primary && data.length >= 2 && (
            <rect x={segFrom} y={0} width={Math.max(0, segTo - segFrom)} height={innerH} fill={primary.color} opacity={0.06} pointerEvents="none" />
          )}

          {yTicks.map((t) => (
            <text key={`y-${t}`} x={-10} y={yScale(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="#8B8BAA">{fmtY(t)}</text>
          ))}

          {series.map((s, i) => (
            <g key={s.key}>
              {s.fill && !s.dashed && (
                <AreaClosed
                  data={data}
                  x={(d) => px(data.indexOf(d))}
                  y={(d) => yScale(Number(d[s.key]) || 0)}
                  yScale={yScale}
                  curve={curveMonotoneX}
                  fill={`url(#${gradPrefix}-${i})`}
                  stroke="transparent"
                />
              )}
              <LinePath
                data={data}
                x={(d) => px(data.indexOf(d))}
                y={(d) => yScale(Number(d[s.key]) || 0)}
                curve={curveMonotoneX}
                stroke={s.color}
                strokeWidth={s.dashed ? 2 : 2.5}
                strokeOpacity={s.dashed ? 0.7 : 1}
                strokeDasharray={s.dashed ? '6 5' : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              {showDots && !s.dashed && data.map((d, di) => (
                <circle key={di} cx={px(di)} cy={yScale(Number(d[s.key]) || 0)} r={2.6} fill={s.color} stroke="var(--ax-card)" strokeWidth={1.5} />
              ))}
            </g>
          ))}

          {xTickIdx.map((i) => (
            <text key={`x-${i}`} x={px(i)} y={innerH + 18} textAnchor="middle" fontSize={10.5} fill="#8B8BAA">
              {xTickFormatter ? xTickFormatter(labels[i]) : labels[i]}
            </text>
          ))}

          {hover && (
            <g pointerEvents="none">
              <Line from={{ x: px(hover.index), y: 0 }} to={{ x: px(hover.index), y: innerH }} stroke="rgba(139,139,170,0.35)" strokeWidth={1} />
              {series.map((s) => {
                const v = Number(data[hover.index]?.[s.key]) || 0;
                return <circle key={s.key} cx={px(hover.index)} cy={yScale(v)} r={4.5} fill={s.color} stroke="var(--ax-card)" strokeWidth={2} />;
              })}
            </g>
          )}

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
          background: 'var(--ax-card)', border: '1px solid var(--ax-border)', borderRadius: 12,
          padding: '10px 14px', boxShadow: '0 12px 32px rgba(0,0,0,0.35)', minWidth: 140,
        }}>
          <div style={{ color: 'var(--ax-text-3, #5A5A78)', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
            {xTickFormatter ? xTickFormatter(labels[hover.index]) : labels[hover.index]}
          </div>
          {series.map((s) => {
            const v = Number(data[hover.index]?.[s.key]) || 0;
            return (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                <span aria-hidden="true" style={{ width: 14, height: 0, flexShrink: 0, borderTop: `3px ${s.dashed ? 'dashed' : 'solid'} ${s.color}`, borderRadius: 2 }} />
                <span style={{ color: 'var(--ax-text)', fontSize: 13.5, fontWeight: 700 }}>
                  {valueFormatter ? valueFormatter(v) : v.toLocaleString('ru-RU')}
                </span>
                <span style={{ color: 'var(--ax-text-2, #8B8BAA)', fontSize: 11.5, marginLeft: 'auto', paddingLeft: 6 }}>{s.name}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AxAreaChart({ height = 280, ...props }: AxAreaChartProps) {
  const [ref, width] = useChartWidth();
  return (
    <div ref={ref} style={{ width: '100%' }}>
      <style>{`@keyframes axAreaFade{from{opacity:0}to{opacity:1}}`}</style>
      {width > 0 && <AreaChartInner {...props} width={width} height={height} />}
    </div>
  );
}
