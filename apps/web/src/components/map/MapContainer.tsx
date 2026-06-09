import { useCallback, useEffect, useRef } from 'react';
import { Map, useMap } from '@vis.gl/react-maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Map as MaplibreMap, MapMouseEvent } from 'maplibre-gl';
import { useAppStore } from '../../stores/appStore.ts';
import { reverseGeocode } from '../../services/nominatim.ts';
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
  /**
   * Pixels of viewport currently covered by the bottom sheet (0 on desktop).
   * Passed to FitRouteOnSelection and FlyToFinderRank1 so map content sits
   * above the sheet instead of behind it. Imported from getSheetHeights() in
   * the parent — do NOT recompute here.
   */
  sheetBottomPadding?: number;
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

/** Fits the map to the full route bounding box when a new route loads or a stop is selected. */
function FitRouteOnSelection({
  selectedStopIndex,
  sheetBottomPadding,
}: {
  selectedStopIndex: number | null;
  sheetBottomPadding?: number;
}) {
  const { current: map } = useMap();
  const { route } = useAppStore();
  const prevIndexRef = useRef<number | null>(null);
  const prevRouteRef = useRef<typeof route>(null);
  const prevBpRef = useRef<number | null>(null);

  useEffect(() => {
    if (!map || !route || route.stops.length === 0) return;
    const bp = sheetBottomPadding ?? 0;
    const isNewRoute = prevRouteRef.current !== route;
    const isNewSelection = selectedStopIndex !== null && prevIndexRef.current !== selectedStopIndex;
    // Sheet snap changed (peek↔half↔full) — refit so the route stays in the visible area
    const isNewPadding = prevBpRef.current !== null && prevBpRef.current !== bp;
    if (!isNewRoute && !isNewSelection && !isNewPadding) return;
    prevRouteRef.current = route;
    prevIndexRef.current = selectedStopIndex;
    prevBpRef.current = bp;

    const lngs = route.stops.map((s) => s.town.lng);
    const lats = route.stops.map((s) => s.town.lat);
    // Reset any accumulated padding before fitting (MapLibre issue #4095 —
    // accumulated padding offsets add up across repeated fitBounds calls)
    map.getMap().setPadding({ top: 0, right: 0, bottom: 0, left: 0 });
    map.getMap().fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: { top: 60, right: 60, left: 60, bottom: bp + 60 }, maxZoom: 9, duration: 600 },
    );
  }, [map, route, selectedStopIndex, sheetBottomPadding]);

  return null;
}

/**
 * Flies the map to rank #1 whenever the top-ranked city changes.
 * Fires on first results load (null → city) and on filter changes that change rank #1.
 * sheetBottomPadding is applied so rank-1 is centered in the VISIBLE area above the
 * sheet, not hidden behind it. On desktop (bp = 0) this is identical to a plain flyTo.
 *
 * Marker-tap decoupling: StopMarkers/FinderMarkers own their internal popupIndex and
 * show the mini card on click without touching the sheet snap. The parent (index.tsx)
 * is responsible for wiring onStopClick/onFinderClick (map marker callbacks) WITHOUT
 * calling setSheetSnap — sheet-snap changes are only triggered by the panel list-item
 * handlers, keeping marker tap and sheet snap fully decoupled.
 */
function FlyToFinderRank1({
  finderResults,
  sheetBottomPadding,
}: {
  finderResults: FinderResultData[] | undefined;
  sheetBottomPadding?: number;
}) {
  const { current: map } = useMap();
  const prevRank1IdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!map || !finderResults || finderResults.length === 0) return;
    const rank1 = finderResults[0];
    if (rank1.townId === prevRank1IdRef.current) return;
    prevRank1IdRef.current = rank1.townId;

    const bp = sheetBottomPadding ?? 0;
    map.getMap().flyTo({
      center: [rank1.lng, rank1.lat],
      zoom: 7,
      duration: 800,
      padding: { top: 0, right: 0, left: 0, bottom: bp },
    });
  }, [map, finderResults, sheetBottomPadding]);

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

/** Handles click-to-pick-location mode. */
function PickLocationOnClick() {
  const { current: map } = useMap();
  const { pickingLocation, setPickingLocation, addSearchArea } = useAppStore();

  useEffect(() => {
    if (!map || !pickingLocation) return;
    const nativeMap = map.getMap();
    nativeMap.getCanvas().style.cursor = 'crosshair';

    async function handleClick(e: MapMouseEvent) {
      const { lat, lng } = e.lngLat;
      setPickingLocation(false);
      nativeMap.getCanvas().style.cursor = '';
      const result = await reverseGeocode(lat, lng);
      const name = result
        ? result.display_name.split(',')[0].trim()
        : `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
      addSearchArea({
        type: 'place',
        id: `picked-${Date.now()}`,
        name,
        fullName: result?.display_name ?? name,
        lat,
        lng,
      });
    }

    nativeMap.once('click', handleClick);
    return () => {
      nativeMap.off('click', handleClick);
      nativeMap.getCanvas().style.cursor = '';
    };
  }, [map, pickingLocation, setPickingLocation, addSearchArea]);

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
  sheetBottomPadding,
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
        <FitRouteOnSelection selectedStopIndex={selectedStopIndex} sheetBottomPadding={sheetBottomPadding} />
        <FlyToFinderRank1 finderResults={finderResults} sheetBottomPadding={sheetBottomPadding} />
        <FlyToCity target={flyToCity} />
        <PickLocationOnClick />
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
