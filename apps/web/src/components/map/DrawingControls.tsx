import { useEffect, useRef, useState, useCallback } from 'react';
import { useMap } from '@vis.gl/react-maplibre';
import { useTranslation } from 'react-i18next';
import type { MapMouseEvent } from 'maplibre-gl';

interface DrawingControlsProps {
  onPolygonComplete: (polygon: [number, number][]) => void;
  onClear: () => void;
}

type Verts = [number, number][];

export function DrawingControls({ onPolygonComplete, onClear }: DrawingControlsProps) {
  const { t } = useTranslation('common');
  const { current: map } = useMap();
  const [hasPolygon, setHasPolygon] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  const verticesRef = useRef<Verts>([]);
  const isDrawingRef = useRef(false);  // stays in sync — set below before hooks read it
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onCompleteRef = useRef(onPolygonComplete);

  useEffect(() => { onCompleteRef.current = onPolygonComplete; }, [onPolygonComplete]);

  // Keep the ref in sync so redraw() (a stable callback) can read the latest value
  isDrawingRef.current = isDrawing;

  // ── Canvas drawing ──────────────────────────────────────────────────────────
  // Renders the polygon directly on a 2D canvas overlaid on the map.
  // Avoids MapLibre's GeoJSON worker entirely (no __publicField issues).
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
    if (verts.length < 2) return;

    const pts = verts.map(([lng, lat]) => {
      const p = m.project([lng, lat] as [number, number]);
      return { x: p.x, y: p.y };
    });

    const closed = !isDrawingRef.current && verts.length >= 3;

    // Fill
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    if (closed) ctx.closePath();
    ctx.fillStyle = 'rgba(63, 151, 224, 0.25)';
    ctx.fill();

    // Outline
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    if (closed) ctx.closePath();
    ctx.strokeStyle = '#3f97e0';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Vertex dots
    for (const pt of pts) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#3f97e0';
      ctx.fill();
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

  // ── Click handlers while drawing ───────────────────────────────────────────
  useEffect(() => {
    if (!map || !isDrawing) return;
    const m = map.getMap();

    const onClick = (e: MapMouseEvent) => {
      verticesRef.current = [...verticesRef.current, [e.lngLat.lng, e.lngLat.lat]];
      redraw();
    };

    const onDblClick = () => {
      // MapLibre fires click then dblclick — strip the extra vertex from the second click
      const verts = verticesRef.current.slice(0, -1);
      if (verts.length < 3) return;

      m.off('click', onClick);
      m.off('dblclick', onDblClick);
      m.doubleClickZoom.enable();
      m.getCanvas().style.cursor = '';

      verticesRef.current = verts;
      setIsDrawing(false);
      setHasPolygon(true);
      onCompleteRef.current([...verts, verts[0]]);
    };

    m.on('click', onClick);
    m.on('dblclick', onDblClick);
    return () => {
      m.off('click', onClick);
      m.off('dblclick', onDblClick);
    };
  }, [map, isDrawing, redraw]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const handleStartDrawing = useCallback(() => {
    if (!map) return;
    verticesRef.current = [];
    clearCanvas();
    map.getMap().doubleClickZoom.disable();
    map.getMap().getCanvas().style.cursor = 'crosshair';
    setIsDrawing(true);
  }, [map, clearCanvas]);

  const handleCancelDrawing = useCallback(() => {
    if (!map) return;
    verticesRef.current = [];
    clearCanvas();
    map.getMap().doubleClickZoom.enable();
    map.getMap().getCanvas().style.cursor = '';
    setIsDrawing(false);
  }, [map, clearCanvas]);

  const handleClear = useCallback(() => {
    if (!map) return;
    verticesRef.current = [];
    clearCanvas();
    map.getMap().doubleClickZoom.enable();
    map.getMap().getCanvas().style.cursor = '';
    setIsDrawing(false);
    setHasPolygon(false);
    onClear();
  }, [map, clearCanvas, onClear]);

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Canvas overlay — pointer-events: none so map pan/zoom still works */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 5,
        }}
      />

      {/* Control buttons */}
      <div
        style={{
          position: 'absolute',
          top: 'var(--space-4)',
          right: 'var(--space-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          zIndex: 10,
          pointerEvents: 'auto',
        }}
      >
        {!isDrawing && !hasPolygon && (
          <button
            onClick={handleStartDrawing}
            style={{
              background: 'var(--glass-bg)',
              backdropFilter: 'var(--glass-blur)',
              border: 'var(--glass-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-2) var(--space-4)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-primary)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            {t('entry.draw_area', 'Gebiet zeichnen')}
          </button>
        )}
        {isDrawing && (
          <>
            <div style={{
              background: 'var(--color-primary)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-2) var(--space-4)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              color: '#fff',
              boxShadow: 'var(--shadow-md)',
              textAlign: 'center',
            }}>
              {t('entry.draw_hint', 'Klicken um Punkte zu setzen, doppelklicken zum Abschließen')}
            </div>
            <button
              onClick={handleCancelDrawing}
              style={{
                background: 'var(--glass-bg)',
                backdropFilter: 'var(--glass-blur)',
                border: 'var(--glass-border)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-2) var(--space-4)',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {t('entry.cancel_draw', 'Abbrechen')}
            </button>
          </>
        )}
        {hasPolygon && (
          <button
            onClick={handleClear}
            style={{
              background: 'var(--glass-bg)',
              backdropFilter: 'var(--glass-blur)',
              border: 'var(--glass-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-2) var(--space-4)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-error)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {t('entry.clear_area', 'Gebiet löschen')}
          </button>
        )}
      </div>
    </>
  );
}
