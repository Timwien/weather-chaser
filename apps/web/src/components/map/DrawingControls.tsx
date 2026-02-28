import { useEffect, useRef, useState, useCallback } from 'react';
import { useMap } from '@vis.gl/react-maplibre';
import { useTranslation } from 'react-i18next';
import { MaplibreTerradrawControl } from '@watergis/maplibre-gl-terradraw';
import '@watergis/maplibre-gl-terradraw/dist/maplibre-gl-terradraw.css';

interface DrawingControlsProps {
  onPolygonComplete: (polygon: [number, number][]) => void;
  onClear: () => void;
}

export function DrawingControls({ onPolygonComplete, onClear }: DrawingControlsProps) {
  const { t } = useTranslation('common');
  const { current: map } = useMap();
  const controlRef = useRef<MaplibreTerradrawControl | null>(null);
  const [hasPolygon, setHasPolygon] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  const disableMapInteraction = useCallback(() => {
    if (!map) return;
    const m = map.getMap();
    m.dragPan.disable();
    m.scrollZoom.disable();
    m.touchZoomRotate.disable();
    m.touchPitch?.disable();
    m.boxZoom.disable();
    m.doubleClickZoom.disable();
  }, [map]);

  const enableMapInteraction = useCallback(() => {
    if (!map) return;
    const m = map.getMap();
    m.dragPan.enable();
    m.scrollZoom.enable();
    m.touchZoomRotate.enable();
    m.touchPitch?.enable();
    m.boxZoom.enable();
    m.doubleClickZoom.enable();
  }, [map]);

  // Cleanup only — TerraDraw is never initialized on mount
  useEffect(() => {
    return () => {
      enableMapInteraction();
      if (controlRef.current && map) {
        try { map.removeControl(controlRef.current); } catch { /* already removed */ }
        controlRef.current = null;
      }
    };
  }, [map, enableMapInteraction]);

  const handleStartDrawing = useCallback(() => {
    if (!map) return;

    // Lazy-initialize TerraDraw only when the user actually wants to draw.
    // Initializing on mount registers event listeners that block all map clicks.
    if (!controlRef.current) {
      const control = new MaplibreTerradrawControl({ modes: ['polygon'], open: false });
      controlRef.current = control;
      map.addControl(control, 'top-right');

      // Hide the built-in toolbar — we use our own buttons
      setTimeout(() => {
        const toolbar = map.getContainer().querySelector('.maplibre-terradraw-control') as HTMLElement | null;
        if (toolbar) toolbar.style.display = 'none';
      }, 100);

      const draw = control.getTerraDrawInstance();
      if (draw) {
        try { draw.start(); } catch { /* already started */ }

        draw.on('finish', (_id, context) => {
          if (context?.action !== 'draw') return;
          const features = draw.getSnapshot();
          const polygon = features.find((f) => f.geometry.type === 'Polygon');
          if (polygon?.geometry.type === 'Polygon') {
            const coords = polygon.geometry.coordinates[0] as [number, number][];
            setIsDrawing(false);
            setHasPolygon(true);
            enableMapInteraction();
            onPolygonComplete(coords);
          }
        });

        draw.on('change', (_ids, type) => {
          if (type === 'delete') setHasPolygon(false);
        });
      }
    }

    const draw = controlRef.current.getTerraDrawInstance();
    if (!draw) return;
    try { draw.start(); } catch { /* already started */ }
    try {
      draw.setMode('polygon');
    } catch (err) {
      console.error('[DrawingControls] setMode polygon failed:', err);
      return;
    }
    disableMapInteraction();
    setIsDrawing(true);
  }, [map, disableMapInteraction, enableMapInteraction, onPolygonComplete]);

  const handleCancelDrawing = () => {
    const draw = controlRef.current?.getTerraDrawInstance();
    if (draw) {
      try { draw.setMode('static'); } catch { /* ignore */ }
    }
    enableMapInteraction();
    setIsDrawing(false);
  };

  const handleClear = () => {
    const draw = controlRef.current?.getTerraDrawInstance();
    if (draw) {
      try { draw.setMode('static'); } catch { /* ignore */ }
      const features = draw.getSnapshot();
      const ids = features.map((f) => f.id).filter((id): id is string | number => id !== undefined);
      if (ids.length > 0) draw.removeFeatures(ids);
    }
    enableMapInteraction();
    setIsDrawing(false);
    setHasPolygon(false);
    onClear();
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 'var(--space-4)',
        right: 'var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        zIndex: 10,
        pointerEvents: 'all',
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
  );
}
