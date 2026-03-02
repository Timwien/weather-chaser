import { useCallback, useEffect, useRef } from 'react';
import { Map, useMap } from '@vis.gl/react-maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { useAppStore } from '../../stores/appStore.ts';
import { DrawingControls } from './DrawingControls.tsx';
import { RouteLayer } from './RouteLayer.tsx';
import { StopMarkers } from './StopMarkers.tsx';
import { FinderMarkers } from './FinderMarkers.tsx';
import type { FinderResultData } from '../finder/FinderResultRow.tsx';
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
  // Finder mode props
  finderResults?: FinderResultData[];
  selectedFinderIndex?: number | null;
  onFinderClick?: (index: number) => void;
  /** When set, the map flies to this city. Increment token to re-fly to same coords. */
  flyToCity?: { lat: number; lng: number; token: number } | null;
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

/**
 * Flies the map to rank #1 whenever the top-ranked city changes.
 * Fires on first results load (null → city) and on filter changes that change rank #1.
 */
function FlyToFinderRank1({ finderResults }: { finderResults: FinderResultData[] | undefined }) {
  const { current: map } = useMap();
  const prevRank1IdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!map || !finderResults || finderResults.length === 0) return;
    const rank1 = finderResults[0];
    if (rank1.townId === prevRank1IdRef.current) return;
    prevRank1IdRef.current = rank1.townId;

    map.getMap().flyTo({ center: [rank1.lng, rank1.lat], zoom: 7, duration: 800 });
  }, [map, finderResults]);

  return null;
}

/** Flies the map to an explicit target (e.g. user clicking a result row). */
function FlyToCity({ target }: { target?: { lat: number; lng: number; token: number } | null }) {
  const { current: map } = useMap();
  const prevTokenRef = useRef<number | null>(null);

  useEffect(() => {
    if (!map || !target) return;
    if (target.token === prevTokenRef.current) return;
    prevTokenRef.current = target.token;

    map.getMap().flyTo({ center: [target.lng, target.lat], zoom: 8, duration: 600 });
  }, [map, target]);

  return null;
}

export function MapContainer({
  selectedStopIndex,
  onStopClick,
  onDrawComplete,
  onDrawClear,
  finderResults,
  selectedFinderIndex,
  onFinderClick,
  flyToCity,
}: MapContainerProps) {
  const { route, mode } = useAppStore();

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
        {/* Always-present: map-positioning helpers */}
        <FitRouteOnSelection selectedStopIndex={selectedStopIndex} />
        <FlyToFinderRank1 finderResults={finderResults} />
        <FlyToCity target={flyToCity} />
        {/* DrawingControls must live inside <Map> so useMap() has a provider */}
        {onDrawComplete && onDrawClear && (
          <DrawingControls
            onPolygonComplete={onDrawComplete}
            onClear={onDrawClear}
          />
        )}

        {/* Route mode: StopMarkers + RouteLayer */}
        {route && mode !== 'weather-finder' && (
          <>
            <RouteLayer route={route} />
            <StopMarkers
              route={route}
              selectedStopIndex={selectedStopIndex}
              onStopClick={onStopClick}
            />
          </>
        )}

        {/* Finder mode: FinderMarkers */}
        {mode === 'weather-finder' && finderResults && finderResults.length > 0 && (
          <FinderMarkers
            results={finderResults}
            selectedIndex={selectedFinderIndex ?? null}
            onMarkerClick={onFinderClick ?? (() => {})}
          />
        )}
      </Map>
    </div>
  );
}
