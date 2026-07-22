/**
 * 📈 AxAreaChart — единая линейная диаграмма проекта (на visx).
 *
 * Построена на @visx (curveMonotoneX + AreaClosed + LinePath), чтобы все графики
 * «динамики» (выручка, продажи, закупки) выглядели одной системой:
 *   - плавная monotone-кривая (никаких перехлёстов ниже нуля, как у natural);
 *   - линия 2.5px со скруглениями, мягкая градиентная заливка-«дымка»;
 *   - тихая сплошная сетка-волосок только по горизонтали;
 *   - подсветка последнего сегмента (SegmentBackground + пунктирные границы
 *     «от/до») — визуальный акцент на самом свежем отрезке периода;
 *   - вертикальный crosshair + один тултип со всеми сериями (значение — главное);
 *   - точка при наведении с кольцом цвета поверхности;
 *   - вторая серия (прошлый период) — пунктир без заливки, приглушённая.
 *
 * Правило проекта: если серий две — вторая всегда «предыдущий период»
 * (для дня — вчера, для месяца — прошлый месяц), пунктиром и без заливки.
 *
 * Palette: #7C5CF0 + #0284C7 — проверена валидатором (CVD/контраст) на обеих
 * поверхностях темы; пунктир второй серии — вторичное кодирование.
 */
import { useCallback, useMemo, useState } from 'react';
import { AreaClosed, LinePath, Line } from '@visx/shape';
import { curveMonotoneX } from '@visx/curve';
import { scaleLinear, scalePoint } from '@visx/scale';
import { GridRows } from '@visx/grid';
import { ParentSize } from '@visx/responsive';
import { LinearGradient } from '@visx/gradient';
import { localPoint } from '@visx/event';

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
  /** interval для оси X (0 — все подписи; number — каждая N-ая) */
  xInterval?: number | 'preserveStartEnd';
  /** Подсветка последнего сегмента (SegmentBackground + границы). По умолч. вкл. */
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
  valueFormatter, yTickFormatter, xTickFormatter, xInterval, highlightLast = true,
}: AxAreaChartProps & { width: number; height: number }) {
  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerH = Math.max(0, height - MARGIN.top - MARGIN.bottom);

  const gradPrefix = useMemo(() => `axarea-${Math.random().toString(36).slice(2, 8)}`, []);
  const labels = useMemo(() => data.map((d) => String(d[xKey])), [data, xKey]);

  // Уважение к prefers-reduced-motion — без входной анимации кривой (CSS-класс).
  const reduceMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const xScale = useMemo(
    () => scalePoint<string>({ domain: labels, range: [0, innerW], padding: 0.35 }),
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

  // Подписи оси X: показываем подмножество, чтобы не слипались.
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

  if (innerW <= 0 || innerH <= 0 || data.length === 0) return null;

  const primary = series.find((s) => !s.dashed) ?? series[0];
  const segFrom = data.length >= 2 ? px(data.length - 2) : 0;
  const segTo = px(data.length - 1);

  return (
    <div style={{ position: 'relative' }}>
      <svg
        width={width}
        height={height}
        role="img"
        style={{ overflow: 'visible', animation: reduceMotion ? undefined : 'axAreaFade .6s ease-out both' }}
      >
        <defs>
          {series.map((s, i) => (
            <LinearGradient key={s.key} id={`${gradPrefix}-${i}`} from={s.color} to={s.color} fromOpacity={0.26} toOpacity={0} x1={0} y1={0} x2={0} y2={1} />
          ))}
        </defs>

        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {/* Тихая сетка: сплошной волосок, только горизонталь */}
          <GridRows scale={yScale} width={innerW} height={innerH} stroke="rgba(139,139,170,0.14)" strokeWidth={1} />

          {/* SegmentBackground + SegmentLineFrom/To — подсветка последнего отрезка */}
          {highlightLast && primary && data.length >= 2 && (
            <g pointerEvents="none">
              <rect x={segFrom} y={0} width={Math.max(0, segTo - segFrom)} height={innerH} fill={primary.color} opacity={0.06} />
              <Line from={{ x: segFrom, y: 0 }} to={{ x: segFrom, y: innerH }} stroke={primary.color} strokeOpacity={0.35} strokeWidth={1} strokeDasharray="3 4" />
              <Line from={{ x: segTo, y: 0 }} to={{ x: segTo, y: innerH }} stroke={primary.color} strokeOpacity={0.35} strokeWidth={1} strokeDasharray="3 4" />
            </g>
          )}

          {/* Y-подписи */}
          {yTicks.map((t) => (
            <text key={`y-${t}`} x={-10} y={yScale(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="#8B8BAA">{fmtY(t)}</text>
          ))}

          {/* Заливки + линии серий */}
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
            </g>
          ))}

          {/* X-подписи */}
          {xTickIdx.map((i) => (
            <text key={`x-${i}`} x={px(i)} y={innerH + 18} textAnchor="middle" fontSize={10.5} fill="#8B8BAA">
              {xTickFormatter ? xTickFormatter(labels[i]) : labels[i]}
            </text>
          ))}

          {/* Crosshair + активные точки */}
          {hover && (
            <g pointerEvents="none">
              <Line from={{ x: px(hover.index), y: 0 }} to={{ x: px(hover.index), y: innerH }} stroke="rgba(139,139,170,0.35)" strokeWidth={1} />
              {series.map((s) => {
                const v = Number(data[hover.index]?.[s.key]) || 0;
                return (
                  <circle key={s.key} cx={px(hover.index)} cy={yScale(v)} r={4.5} fill={s.color} stroke="var(--ax-card)" strokeWidth={2} />
                );
              })}
            </g>
          )}

          {/* Прозрачный слой для перехвата мыши */}
          <rect x={0} y={0} width={innerW} height={innerH} fill="transparent"
            onMouseMove={handleMove} onMouseLeave={() => setHover(null)} />
        </g>
      </svg>

      {/* Тултип: значение — главное, имя серии — вторичное */}
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
                <span aria-hidden="true" style={{ width: 14, height: 0, flexShrink: 0, borderTop: `3px ${s.dashed ? 'dashed' : 'solid'} ${s.color}`, borderRadius: 2 }} />
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

export default function AxAreaChart({ height = 280, ...props }: AxAreaChartProps) {
  return (
    <>
      <style>{`@keyframes axAreaFade{from{opacity:0}to{opacity:1}}`}</style>
      <ParentSize>
        {({ width }) => (width > 0 ? <AreaChartInner {...props} width={width} height={height} /> : null)}
      </ParentSize>
    </>
  );
}
