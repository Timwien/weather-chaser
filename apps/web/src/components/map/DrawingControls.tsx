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

  /** Disable map interactions so drawing clicks/touches don't pan the map */
  const disableMapInteraction = useCallback(() => {
    if (!map) return;
    map.dragPan.disable();
    map.scrollZoom.disable();
    map.touchZoomRotate.disable();
    map.touchPitch?.disable();
    map.boxZoom.disable();
    map.doubleClickZoom.disable();
  }, [map]);

  /** Re-enable normal map interaction */
  const enableMapInteraction = useCallback(() => {
    if (!map) return;
    map.dragPan.enable();
    map.scrollZoom.enable();
    map.touchZoomRotate.enable();
    map.touchPitch?.enable();
    map.boxZoom.enable();
    map.doubleClickZoom.enable();
  }, [map]);

  useEffect(() => {
    if (!map) return;

    // Hide the built-in terradraw toolbar (we use our own buttons)
    const hideNativeUI = () => {
      const toolbar = map.getContainer().querySelector('.maplibre-terradraw-control') as HTMLElement | null;
      if (toolbar) toolbar.style.display = 'none';
    };

    const control = new MaplibreTerradrawControl({
      modes: ['polygon'],
      open: false,
    });
    controlRef.current = control;
    map.addControl(control, 'top-right');
    setTimeout(hideNativeUI, 100);

    // Start TerraDraw immediately so the instance is ready to use
    const draw = control.getTerraDrawInstance();
    if (draw) {
      try { draw.start(); } catch { /* already started */ }

      draw.on('finish', (_id, context) => {
        if (context?.action !== 'draw') return;
        const features = draw.getSnapshot();
        const polygon = features.find(
          (f) => f.geometry.type === 'Polygon',
        );
        if (polygon?.geometry.type === 'Polygon') {
          const coords = polygon.geometry.coordinates[0] as [number, number][];
          setIsDrawing(false);
          setHasPolygon(true);
          enableMapInteraction();
          onPolygonComplete(coords);
        }
      });

      // Re-enable map interaction if user cancels drawing (switches back to static mode)
      draw.on('change', (_ids, type) => {
        if (type === 'delete') {
          setHasPolygon(false);
        }
      });
    }

    return () => {
      enableMapInteraction();
      try { map.removeControl(control); } catch { /* already removed */ }
      controlRef.current = null;
    };
  }, [map, onPolygonComplete, enableMapInteraction]);

  const handleStartDrawing = () => {
    const draw = controlRef.current?.getTerraDrawInstance();
    if (!draw) return;
    try { draw.start(); } catch { /* already started */ }
    draw.setMode('polygon');
    disableMapInteraction();
    setIsDrawing(true);
  };

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
