import { useEffect, useRef, useState, useCallback } from 'react';
import { useMap } from '@vis.gl/react-maplibre';
import { useTranslation } from 'react-i18next';
import type { Map as MaplibreMap, GeoJSONSource, MapMouseEvent } from 'maplibre-gl';

const SOURCE_ID = 'draw-polygon';
const FILL_LAYER  = 'draw-polygon-fill';
const LINE_LAYER  = 'draw-polygon-outline';

interface DrawingControlsProps {
  onPolygonComplete: (polygon: [number, number][]) => void;
  onClear: () => void;
}

export function DrawingControls({ onPolygonComplete, onClear }: DrawingControlsProps) {
  const { t } = useTranslation('common');
  const { current: map } = useMap();
  const [hasPolygon, setHasPolygon] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const verticesRef = useRef<[number, number][]>([]);
  const onCompleteRef = useRef(onPolygonComplete);

  // Keep callback ref in sync
  useEffect(() => { onCompleteRef.current = onPolygonComplete; }, [onPolygonComplete]);

  // Add GeoJSON source + layers once map mounts; remove on unmount
  useEffect(() => {
    if (!map) return;
    const m = map.getMap();

    m.addSource(SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    m.addLayer({
      id: FILL_LAYER,
      type: 'fill',
      source: SOURCE_ID,
      paint: { 'fill-color': '#3f97e0', 'fill-opacity': 0.25 },
    });
    m.addLayer({
      id: LINE_LAYER,
      type: 'line',
      source: SOURCE_ID,
      paint: { 'line-color': '#3f97e0', 'line-width': 2, 'line-opacity': 1 },
    });

    return () => {
      if (m.getLayer(FILL_LAYER)) m.removeLayer(FILL_LAYER);
      if (m.getLayer(LINE_LAYER)) m.removeLayer(LINE_LAYER);
      if (m.getSource(SOURCE_ID)) m.removeSource(SOURCE_ID);
    };
  }, [map]);

  const updateSource = useCallback((m: MaplibreMap, verts: [number, number][]) => {
    const src = m.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (!src) return;
    if (verts.length < 2) {
      src.setData({ type: 'FeatureCollection', features: [] });
      return;
    }
    src.setData({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[...verts, verts[0]]] },
        properties: {},
      }],
    });
  }, []);

  // Attach / detach click handlers while drawing
  useEffect(() => {
    if (!map || !isDrawing) return;
    const m = map.getMap();

    const onClick = (e: MapMouseEvent) => {
      const pt: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      verticesRef.current = [...verticesRef.current, pt];
      updateSource(m, verticesRef.current);
    };

    const onDblClick = (e: MapMouseEvent) => {
      // MapLibre fires click then dblclick — drop the extra vertex from the second click
      const verts = verticesRef.current.slice(0, -1);
      if (verts.length < 3) return;

      m.off('click', onClick);
      m.off('dblclick', onDblClick);
      m.doubleClickZoom.enable();
      m.getCanvas().style.cursor = '';

      updateSource(m, verts);
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
  }, [map, isDrawing, updateSource]);

  const handleStartDrawing = useCallback(() => {
    if (!map) return;
    const m = map.getMap();
    verticesRef.current = [];
    updateSource(m, []);
    m.doubleClickZoom.disable();
    m.getCanvas().style.cursor = 'crosshair';
    setIsDrawing(true);
  }, [map, updateSource]);

  const handleCancelDrawing = useCallback(() => {
    if (!map) return;
    const m = map.getMap();
    verticesRef.current = [];
    updateSource(m, []);
    m.doubleClickZoom.enable();
    m.getCanvas().style.cursor = '';
    setIsDrawing(false);
  }, [map, updateSource]);

  const handleClear = useCallback(() => {
    if (!map) return;
    const m = map.getMap();
    verticesRef.current = [];
    updateSource(m, []);
    m.doubleClickZoom.enable();
    m.getCanvas().style.cursor = '';
    setIsDrawing(false);
    setHasPolygon(false);
    onClear();
  }, [map, updateSource, onClear]);

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
