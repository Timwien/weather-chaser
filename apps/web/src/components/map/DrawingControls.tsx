import { useEffect, useRef, useState } from 'react';
import { useMap } from '@vis.gl/react-maplibre';
import { useTranslation } from 'react-i18next';
import { MaplibreTerradrawControl } from '@watergis/maplibre-gl-terradraw';
import '@watergis/maplibre-gl-terradraw/dist/maplibre-gl-terradraw.css';

// Note: plan referenced MaplibreGlTerradraw (fictional) — actual export is MaplibreTerradrawControl (IControl).
// Drawing is activated programmatically via getTerraDrawInstance().setMode('polygon').
// TerraDraw 'finish' event fires when polygon is completed.

interface DrawingControlsProps {
  onPolygonComplete: (polygon: [number, number][]) => void;
  onClear: () => void;
}

export function DrawingControls({ onPolygonComplete, onClear }: DrawingControlsProps) {
  const { t } = useTranslation('common');
  const { current: map } = useMap();
  const controlRef = useRef<MaplibreTerradrawControl | null>(null);
  const [hasPolygon, setHasPolygon] = useState(false);

  useEffect(() => {
    if (!map) return;

    // Initialize control with polygon mode only
    const control = new MaplibreTerradrawControl({
      modes: ['polygon'],
      open: false,
    });
    controlRef.current = control;

    // Add control to the map (renders built-in terradraw toolbar; we also provide our own buttons)
    map.addControl(control, 'top-right');

    // Wait for control to be fully added before accessing TerraDraw instance
    const onLoad = () => {
      const draw = control.getTerraDrawInstance();
      if (!draw) return;

      // Listen for polygon completion
      draw.on('finish', (id, context) => {
        if (context.action !== 'draw') return;
        const features = draw.getSnapshot();
        const polygon = features.find(
          (f) => f.id === id && f.geometry.type === 'Polygon',
        );
        if (polygon && polygon.geometry.type === 'Polygon') {
          const coords = polygon.geometry.coordinates[0] as [number, number][];
          setHasPolygon(true);
          onPolygonComplete(coords);
        }
      });
    };

    // The control's TerraDraw instance is available after onAdd() completes (synchronous)
    onLoad();

    return () => {
      if (map && control) {
        try {
          map.removeControl(control);
        } catch {
          // Control may already be removed
        }
      }
      controlRef.current = null;
    };
  }, [map, onPolygonComplete]);

  const handleStartDrawing = () => {
    const draw = controlRef.current?.getTerraDrawInstance();
    if (!draw) return;
    // Ensure drawing is started before switching mode
    if (!draw.enabled) {
      draw.start();
    }
    draw.setMode('polygon');
  };

  const handleClear = () => {
    const draw = controlRef.current?.getTerraDrawInstance();
    if (draw) {
      const features = draw.getSnapshot();
      const ids = features
        .map((f) => f.id)
        .filter((id): id is string | number => id !== undefined);
      if (ids.length > 0) {
        draw.removeFeatures(ids);
      }
    }
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
      }}
    >
      {!hasPolygon && (
        <button
          onClick={handleStartDrawing}
          style={{
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-2) var(--space-3)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text)',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {t('entry.draw_area', 'Draw area')}
        </button>
      )}
      {hasPolygon && (
        <button
          onClick={handleClear}
          style={{
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-2) var(--space-3)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text)',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {t('entry.clear_area', 'Clear area')}
        </button>
      )}
    </div>
  );
}
