import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useMap } from '@vis.gl/react-maplibre';
import { useAppStore, isPolygonArea } from '../../stores/appStore.ts';

/**
 * X1: single source of truth for drawn-area RENDERING = the store.
 *
 * Previously the polygon lived only on DrawingControls' local canvas, so leaving
 * the results view unmounted DrawingControls and the polygon vanished while the
 * store still held it. This layer is always mounted inside <Map>, reads every
 * polygon `searchArea` from the store, and paints them on a Canvas2D overlay —
 * the same pattern RouteLayer uses to avoid MapLibre's Vite-broken GeoJSON
 * worker. DrawingControls now only renders the in-progress drawing.
 */
function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function SearchAreasLayer() {
  const { current: map } = useMap();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Select the stable array reference, derive in useMemo. A `filter().map()`
  // INSIDE the selector returned a fresh array on every snapshot read, which
  // zustand v5 (Object.is equality) treats as a change → infinite re-render
  // loop (React error #185, caught by the AppErrorBoundary in prod).
  const searchAreas = useAppStore((s) => s.searchAreas);
  const polygons = useMemo(
    () => searchAreas.filter(isPolygonArea).map((a) => a.polygon),
    [searchAreas],
  );
  const polygonsRef = useRef(polygons);
  polygonsRef.current = polygons;

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !map) return;
    const m = map.getMap();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const container = m.getContainer();
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    const gradStart = cssVar('--color-primary', '#0d8f9f');
    const gradEnd = cssVar('--color-tertiary', '#0d619f');

    for (const polygon of polygonsRef.current) {
      if (polygon.length < 3) continue;
      const pts = polygon.map(([lng, lat]) => {
        const p = m.project([lng, lat] as [number, number]);
        return { x: p.x, y: p.y };
      });

      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const grad = ctx.createLinearGradient(
        Math.min(...xs), Math.min(...ys),
        Math.max(...xs) || 1, Math.max(...ys) || 1,
      );
      grad.addColorStop(0, hexToRgba(gradStart, 0.2));
      grad.addColorStop(1, hexToRgba(gradEnd, 0.2));

      const strokeGrad = ctx.createLinearGradient(
        Math.min(...xs), Math.min(...ys),
        Math.max(...xs) || 1, Math.max(...ys) || 1,
      );
      strokeGrad.addColorStop(0, gradStart);
      strokeGrad.addColorStop(1, gradEnd);

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = strokeGrad;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }, [map]);

  // Redraw on store change (new/removed polygon) and on map move/resize.
  useEffect(() => { redraw(); }, [redraw, polygons]);

  useEffect(() => {
    if (!map) return;
    const m = map.getMap();
    m.on('move', redraw);
    m.on('resize', redraw);
    redraw();
    return () => {
      m.off('move', redraw);
      m.off('resize', redraw);
    };
  }, [map, redraw]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}
    />
  );
}
