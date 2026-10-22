import { useEffect, useRef, useState } from 'react';

const MAX_GLIDE_MS = 12 * 3_600_000;

/**
 * Display clock that follows `target` (the instant of the shown weather frame) with a short glide:
 * it only ever moves towards `target` and arrives exactly when the next frame is due, so whatever is
 * driven by it (the camper) never runs ahead of the weather picture. Backwards or large jumps snap.
 */
export function useGlidedTime(target: number | null, glideMs: number): number | null {
  const [t, setT] = useState<number | null>(target);
  const cur = useRef<number | null>(target);
  const raf = useRef(0);

  useEffect(() => {
    cancelAnimationFrame(raf.current);
    const from = cur.current;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (target === null || from === null || target <= from || target - from > MAX_GLIDE_MS || reduce || glideMs <= 0) {
      cur.current = target;
      setT(target);
      return;
    }
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / glideMs);
      const v = from + (target - from) * k;
      cur.current = v;
      setT(v);
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, glideMs]);

  return t;
}
