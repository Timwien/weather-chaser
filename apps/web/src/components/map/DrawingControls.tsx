import { useEffect, useRef, useState, useCallback } from 'react';
import { useMap, Source, Layer } from '@vis.gl/react-maplibre';
import { useTranslation } from 'react-i18next';
import type { MapMouseEvent } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';

interface DrawingControlsProps {
  onPolygonComplete: (polygon: [number, number][]) => void;
  onClear: () => void;
}

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] };

function buildFC(verts: [number, number][]): FeatureCollection {
  if (verts.length < 2) return EMPTY_FC;
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[...verts, verts[0]]] },
      properties: {},
    }],
  };
}

export function DrawingControls({ onPolygonComplete, onClear }: DrawingControlsProps) {
  const { t } = useTranslation('common');
  const { current: map } = useMap();
  const [hasPolygon, setHasPolygon] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [geojson, setGeojson] = useState<FeatureCollection>(EMPTY_FC);
  const verticesRef = useRef<[number, number][]>([]);
  const onCompleteRef = useRef(onPolygonComplete);

  // Keep callback ref in sync
  useEffect(() => { onCompleteRef.current = onPolygonComplete; }, [onPolygonComplete]);

  // Attach / detach click handlers while drawing
  useEffect(() => {
    if (!map || !isDrawing) return;
    const m = map.getMap();

    const onClick = (e: MapMouseEvent) => {
      const pt: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      const newVerts = [...verticesRef.current, pt];
      verticesRef.current = newVerts;
      setGeojson(buildFC(newVerts));
    };

    const onDblClick = () => {
      // MapLibre fires click then dblclick — drop the extra vertex added by the second click
      const verts = verticesRef.current.slice(0, -1);
      if (verts.length < 3) return;

      m.off('click', onClick);
      m.off('dblclick', onDblClick);
      m.doubleClickZoom.enable();
      m.getCanvas().style.cursor = '';

      setGeojson(buildFC(verts));
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
  }, [map, isDrawing]);

  const handleStartDrawing = useCallback(() => {
    if (!map) return;
    const m = map.getMap();
    verticesRef.current = [];
    setGeojson(EMPTY_FC);
    m.doubleClickZoom.disable();
    m.getCanvas().style.cursor = 'crosshair';
    setIsDrawing(true);
  }, [map]);

  const handleCancelDrawing = useCallback(() => {
    if (!map) return;
    const m = map.getMap();
    verticesRef.current = [];
    setGeojson(EMPTY_FC);
    m.doubleClickZoom.enable();
    m.getCanvas().style.cursor = '';
    setIsDrawing(false);
  }, [map]);

  const handleClear = useCallback(() => {
    if (!map) return;
    const m = map.getMap();
    verticesRef.current = [];
    setGeojson(EMPTY_FC);
    m.doubleClickZoom.enable();
    m.getCanvas().style.cursor = '';
    setIsDrawing(false);
    setHasPolygon(false);
    onClear();
  }, [map, onClear]);

  return (
    <>
      {/* Source + Layers rendered declaratively — react-maplibre handles styledata timing */}
      <Source id="draw-polygon" type="geojson" data={geojson}>
        <Layer
          id="draw-polygon-fill"
          type="fill"
          paint={{ 'fill-color': '#3f97e0', 'fill-opacity': 0.25 }}
        />
        <Layer
          id="draw-polygon-outline"
          type="line"
          paint={{ 'line-color': '#3f97e0', 'line-width': 2, 'line-opacity': 1 }}
        />
      </Source>

      {/* Floating UI controls */}
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
    </>
  );
}
