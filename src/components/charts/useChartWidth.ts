import { useEffect, useRef, useState } from 'react';

/**
 * Надёжное измерение ширины контейнера через ResizeObserver.
 * Возвращает [ref, width]. До первого замера отдаёт fallback-ширину,
 * чтобы график отрисовался сразу (а не оставался пустым, как с ParentSize
 * при нулевой начальной ширине в grid/flex-контейнерах).
 */
export function useChartWidth(fallback = 640): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setWidth(w);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, width];
}
