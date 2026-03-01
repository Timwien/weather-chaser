import { useCallback, useEffect, useRef } from 'react';
import { Map, useMap } from '@vis.gl/react-maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { useAppStore } from '../../stores/appStore.ts';
import { DrawingControls } from './DrawingControls.tsx';
import { RouteLayer } from './RouteLayer.tsx';
import { StopMarkers } from './StopMarkers.tsx';
import './MapContainer.css';

// CartoDB Positron GL — clean Google Maps-like style, free, no API key required
// Light grey roads, white background, subtle labels — professional look
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

interface MapContainerProps {
  selectedStopIndex: number | null;
  onStopClick: (index: number) => void;
  // Draw props added in Plan 06 — retained here
  onDrawComplete?: (polygon: [number, number][]) => void;
  onDrawClear?: () => void;
}

/** Switch all symbol layers to prefer German names (name:de → name fallback) */
function switchLabelsToGerman(map: MaplibreMap) {
  const style = map.getStyle();
  if (!style) return;
  for (const layer of style.layers) {
    if (layer.type !== 'symbol') continue;
    const field = map.getLayoutProperty(layer.id, 'text-field');
    if (!field) continue;
    map.setLayoutProperty(layer.id, 'text-field', [
      'coalesce',
      ['get', 'name:de'],
      ['get', 'name'],
    ]);
  }
}

/** Fits the map to the full route bounding box when a stop is selected. */
function FitRouteOnSelection({ selectedStopIndex }: { selectedStopIndex: number | null }) {
  const { current: map } = useMap();
  const { route } = useAppStore();
  const prevIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (!map || !route || selectedStopIndex === null) return;
    if (prevIndexRef.current === selectedStopIndex) return;
    prevIndexRef.current = selectedStopIndex;

    if (route.stops.length === 0) return;
    const lngs = route.stops.map((s) => s.town.lng);
    const lats = route.stops.map((s) => s.town.lat);
    map.getMap().fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: 60, maxZoom: 9, duration: 600 },
    );
  }, [map, route, selectedStopIndex]);

  return null;
}

export function MapContainer({ selectedStopIndex, onStopClick, onDrawComplete, onDrawClear }: MapContainerProps) {
  const { route } = useAppStore();

  const handleLoad = useCallback((event: { target: MaplibreMap }) => {
    switchLabelsToGerman(event.target);
  }, []);

  return (
    <div className="map-root">
      <Map
        initialViewState={{
          longitude: 10.4515,
          latitude: 51.1657,
          zoom: 5.5,
        }}
        mapStyle={MAP_STYLE}
        style={{ width: '100%', height: '100%' }}
        onLoad={handleLoad}
      >
        {/* FitRouteOnSelection must live inside <Map> so useMap() has a provider */}
        <FitRouteOnSelection selectedStopIndex={selectedStopIndex} />
        {/* DrawingControls must live inside <Map> so useMap() has a provider */}
        {onDrawComplete && onDrawClear && (
          <DrawingControls
            onPolygonComplete={onDrawComplete}
            onClear={onDrawClear}
          />
        )}
        {route && (
          <>
            <RouteLayer route={route} />
            <StopMarkers
              route={route}
              selectedStopIndex={selectedStopIndex}
              onStopClick={onStopClick}
            />
          </>
        )}
      </Map>
    </div>
  );
}
