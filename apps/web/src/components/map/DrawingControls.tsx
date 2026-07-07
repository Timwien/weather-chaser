import { useEffect, useRef, useState, useCallback } from 'react';
import { useMap } from '@vis.gl/react-maplibre';
import { useTranslation } from 'react-i18next';
import type { MapMouseEvent } from 'maplibre-gl';
import { useAppStore } from '../../stores/appStore.ts';
import './DrawingControls.css';

interface DrawingControlsProps {
  onPolygonComplete: (polygon: [number, number][]) => void;
  onClear: () => void;
}

type Verts = [number, number][];

const CLOSE_RADIUS_PX = 18; // tap/click tolerance around the first vertex
const MIN_VERTICES = 3;

/** Resolves a CSS custom property to its computed value (canvas can't use var()). */
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

export function DrawingControls({ onPolygonComplete, onClear }: DrawingControlsProps) {
  const { t } = useTranslation('common');
  const { current: map } = useMap();
  // X1: polygon existence is derived from the store (single source of truth),
  // so the "Clear area" affordance survives DrawingControls remounts.
  const hasPolygon = useAppStore((s) => s.searchAreas.some((a) => a.type === 'polygon'));
  const mode = useAppStore((s) => s.mode);
  const setIsDrawingArea = useAppStore((s) => s.setIsDrawingArea);
  const [isDrawing, setIsDrawing] = useState(false);
  // Drives the progressive hint + the "Done" button — mirrors verticesRef.length
  const [vertexCount, setVertexCount] = useState(0);

  const verticesRef = useRef<Verts>([]);
  const isDrawingRef = useRef(false);  // stays in sync — set below before hooks read it
  const cursorPxRef = useRef<{ x: number; y: number } | null>(null); // rubber band target
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onCompleteRef = useRef(onPolygonComplete);

  useEffect(() => { onCompleteRef.current = onPolygonComplete; }, [onPolygonComplete]);

  // Keep the ref in sync so redraw() (a stable callback) can read the latest value
  isDrawingRef.current = isDrawing;

  // ── Canvas drawing ──────────────────────────────────────────────────────────
  // Renders the polygon directly on a 2D canvas overlaid on the map.
  // A 2D canvas (unlike MapLibre fill layers) supports real linear gradients,
  // so the area uses the brand gradient — colors resolved from tokens at draw
  // time so dark mode automatically gets the neon variants.
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !map) return;
    const m = map.getMap();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas to match the map container (also clears it)
    const container = m.getContainer();
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    const verts = verticesRef.current;
    if (verts.length === 0) return;

    const gradStart = cssVar('--color-primary', '#0d8f9f');
    const gradEnd = cssVar('--color-tertiary', '#0d619f');

    const pts = verts.map(([lng, lat]) => {
      const p = m.project([lng, lat] as [number, number]);
      return { x: p.x, y: p.y };
    });

    const drawing = isDrawingRef.current;
    const closed = !drawing && verts.length >= MIN_VERTICES;

    // Brand gradient across the polygon's bounding box
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const grad = ctx.createLinearGradient(
      Math.min(...xs), Math.min(...ys),
      Math.max(...xs) || 1, Math.max(...ys) || 1,
    );
    grad.addColorStop(0, hexToRgba(gradStart, closed ? 0.28 : 0.18));
    grad.addColorStop(1, hexToRgba(gradEnd, closed ? 0.28 : 0.18));

    const strokeGrad = ctx.createLinearGradient(
      Math.min(...xs), Math.min(...ys),
      Math.max(...xs) || 1, Math.max(...ys) || 1,
    );
    strokeGrad.addColorStop(0, gradStart);
    strokeGrad.addColorStop(1, gradEnd);

    // Fill + outline
    if (pts.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      if (closed) ctx.closePath();
      if (pts.length >= MIN_VERTICES) {
        ctx.fillStyle = grad;
        ctx.fill();
      }
      ctx.strokeStyle = strokeGrad;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Rubber band: dashed preview from the last vertex to the cursor (desktop)
    const cursor = cursorPxRef.current;
    if (drawing && cursor && pts.length >= 1) {
      const last = pts[pts.length - 1];
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = hexToRgba(gradEnd, 0.7);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(cursor.x, cursor.y);
      // Faint closing edge back to the first point once the shape can close
      if (pts.length >= MIN_VERTICES - 1) {
        ctx.lineTo(pts[0].x, pts[0].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Vertex dots — white ring + brand fill
    for (let i = 0; i < pts.length; i++) {
      const pt = pts[i];
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, i === 0 ? 6 : 4.5, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? gradStart : gradEnd;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }

    // Closable affordance: halo around the first vertex ("tap here to finish")
    if (drawing && pts.length >= MIN_VERTICES) {
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, 12, 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba(gradStart, 0.5);
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }, [map]);

  // Redraw whenever isDrawing changes (open → closed polygon appearance)
  useEffect(() => { redraw(); }, [isDrawing, redraw]);

  // ── Keep canvas in sync with map pan / zoom / resize ────────────────────────
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

  // ── Cancel (declared before the drawing effect — Esc handler closes over the ref) ──
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const handleCancelDrawing = useCallback(() => {
    if (!map) return;
    verticesRef.current = [];
    setVertexCount(0);
    cursorPxRef.current = null;
    clearCanvas();
    map.getMap().doubleClickZoom.enable();
    map.getMap().getCanvas().style.cursor = '';
    setIsDrawing(false);
    setIsDrawingArea(false);
  }, [map, clearCanvas, setIsDrawingArea]);

  const handleCancelDrawingRef = useRef(handleCancelDrawing);
  useEffect(() => { handleCancelDrawingRef.current = handleCancelDrawing; }, [handleCancelDrawing]);

  // ── Click / move handlers while drawing ──────────────────────────────────────
  useEffect(() => {
    if (!map || !isDrawing) return;
    const m = map.getMap();

    function completePolygon(verts: Verts) {
      m.doubleClickZoom.enable();
      m.getCanvas().style.cursor = '';
      cursorPxRef.current = null;
      setIsDrawing(false);
      setIsDrawingArea(false);
      onCompleteRef.current([...verts, verts[0]]);
      // The persistent SearchAreasLayer now owns rendering — clear our canvas
      // so the polygon isn't painted twice.
      verticesRef.current = [];
      setVertexCount(0);
      redraw();
    }

    const distToFirstPx = (x: number, y: number): number => {
      const verts = verticesRef.current;
      if (verts.length === 0) return Infinity;
      const firstPx = m.project([verts[0][0], verts[0][1]] as [number, number]);
      return Math.hypot(x - firstPx.x, y - firstPx.y);
    };

    const onClick = (e: MapMouseEvent) => {
      const verts = verticesRef.current;

      // Close polygon when user clicks near the first vertex (≥3 points set)
      if (verts.length >= MIN_VERTICES && distToFirstPx(e.point.x, e.point.y) < CLOSE_RADIUS_PX) {
        completePolygon(verts);
        return;
      }

      verticesRef.current = [...verts, [e.lngLat.lng, e.lngLat.lat]];
      setVertexCount(verticesRef.current.length);
      redraw();
    };

    const onDblClick = () => {
      // MapLibre fires click then dblclick — strip the extra vertex from the second click
      const verts = verticesRef.current.slice(0, -1);
      if (verts.length < MIN_VERTICES) return;
      setVertexCount(verts.length);
      completePolygon(verts);
    };

    // Rubber-band preview + pointer cursor near the closable first vertex
    const onMouseMove = (e: MapMouseEvent) => {
      cursorPxRef.current = { x: e.point.x, y: e.point.y };
      const closable =
        verticesRef.current.length >= MIN_VERTICES &&
        distToFirstPx(e.point.x, e.point.y) < CLOSE_RADIUS_PX;
      m.getCanvas().style.cursor = closable ? 'pointer' : 'crosshair';
      redraw();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCancelDrawingRef.current();
    };

    m.on('click', onClick);
    m.on('dblclick', onDblClick);
    m.on('mousemove', onMouseMove);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      m.off('click', onClick);
      m.off('dblclick', onDblClick);
      m.off('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [map, isDrawing, redraw]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleStartDrawing = useCallback(() => {
    if (!map) return;
    verticesRef.current = [];
    setVertexCount(0);
    clearCanvas();
    map.getMap().doubleClickZoom.disable();
    map.getMap().getCanvas().style.cursor = 'crosshair';
    setIsDrawing(true);
    setIsDrawingArea(true);
  }, [map, clearCanvas, setIsDrawingArea]);

  /** Explicit finish — the touch-friendly alternative to tapping the first point. */
  const handleFinishDrawing = useCallback(() => {
    if (!map) return;
    const verts = verticesRef.current;
    if (verts.length < MIN_VERTICES) return;
    const m = map.getMap();
    m.doubleClickZoom.enable();
    m.getCanvas().style.cursor = '';
    cursorPxRef.current = null;
    setIsDrawing(false);
    setIsDrawingArea(false);
    onCompleteRef.current([...verts, verts[0]]);
    // Persisted layer owns rendering now → clear our canvas.
    verticesRef.current = [];
    setVertexCount(0);
    clearCanvas();
  }, [map, clearCanvas, setIsDrawingArea]);

  const handleClear = useCallback(() => {
    if (!map) return;
    verticesRef.current = [];
    setVertexCount(0);
    clearCanvas();
    map.getMap().doubleClickZoom.enable();
    map.getMap().getCanvas().style.cursor = '';
    setIsDrawing(false);
    setIsDrawingArea(false);
    onClear();
  }, [map, clearCanvas, onClear, setIsDrawingArea]);

  // Progressive hint: what to do next, not a manual
  const hint =
    vertexCount === 0
      ? t('entry.draw_hint_start')
      : vertexCount < MIN_VERTICES
        ? t('entry.draw_hint_more', { count: MIN_VERTICES - vertexCount })
        : t('entry.draw_hint_close');

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Canvas overlay — pointer-events: none so map pan/zoom still works */}
      <canvas ref={canvasRef} className="draw-canvas" />

      {/* Hint pill — centered at top (desktop), below the search pill (mobile) */}
      {isDrawing && <div className="draw-hint" role="status">{hint}</div>}

      {/* Control buttons — hidden in results mode (drawing is locked there; the
          persisted polygon stays visible via SearchAreasLayer). */}
      <div
        className={`draw-controls${isDrawing ? ' draw-controls--drawing' : ''}`}
        style={mode === 'results' ? { display: 'none' } : undefined}
      >
        {!isDrawing && !hasPolygon && (
          <button type="button" className="draw-btn" onClick={handleStartDrawing}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 9.5 L5 3 L9.5 5.5 L12 2" strokeDasharray="2.5 2" />
              <circle cx="2" cy="9.5" r="1.4" fill="currentColor" stroke="none" />
              <circle cx="12" cy="2" r="1.4" fill="currentColor" stroke="none" />
            </svg>
            {t('entry.draw_area')}
          </button>
        )}
        {isDrawing && (
          <>
            {vertexCount >= MIN_VERTICES && (
              <button type="button" className="draw-btn draw-btn--finish" onClick={handleFinishDrawing}>
                {t('entry.draw_finish')}
              </button>
            )}
            <button type="button" className="draw-btn" onClick={handleCancelDrawing}>
              {t('entry.cancel_draw')}
            </button>
          </>
        )}
        {hasPolygon && (
          <button type="button" className="draw-btn draw-btn--danger" onClick={handleClear}>
            {t('entry.clear_area')}
          </button>
        )}
      </div>
    </>
  );
}
