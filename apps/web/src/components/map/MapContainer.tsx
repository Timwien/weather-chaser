import { useCallback, useEffect, useRef, useState } from 'react';
import { Map, useMap, Popup } from '@vis.gl/react-maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Map as MaplibreMap, MapMouseEvent } from 'maplibre-gl';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore.ts';
import { useThemeStore } from '../../stores/themeStore.ts';
import { reverseGeocode, settlementName } from '../../services/nominatim.ts';
import { DrawingControls } from './DrawingControls.tsx';
import { SearchAreasLayer } from './SearchAreasLayer.tsx';
import { PlaceMarkers } from './PlaceMarkers.tsx';
import { RouteLayer } from './RouteLayer.tsx';
import { StopMarkers } from './StopMarkers.tsx';
import { FinderMarkers } from './FinderMarkers.tsx';
import type { FinderResultData } from '../finder/FinderResultRow.tsx';
import './MapContainer.css';

// CartoDB GL styles — free, no API key required.
// Positron (light) / Dark Matter (dark) — the map follows the app theme so
// dark-mode glass panels never float over a glaring light map (mobile
// readability issue: blur over light map turns dark glass into muddy gray).
const MAP_STYLE_LIGHT = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const MAP_STYLE_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

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

/** F4: switch all symbol layers to prefer the UI language (name:<lang> → name). */
function applyMapLanguage(map: MaplibreMap, lang: string) {
  const code = (lang || 'en').slice(0, 2).toLowerCase();
  // Runs again after every style swap (light↔dark) and on language change;
  // guarded because styledata can fire while the new style is still loading.
  try {
    const style = map.getStyle();
    if (!style?.layers) return;
    for (const layer of style.layers) {
      if (layer.type !== 'symbol') continue;
      const field = map.getLayoutProperty(layer.id, 'text-field');
      if (!field) continue;
      map.setLayoutProperty(layer.id, 'text-field', [
        'coalesce',
        ['get', `name:${code}`],
        ['get', 'name'],
      ]);
    }
  } catch {
    /* style mid-load — the next styledata event retries */
  }
}

/** Re-applies the label language when the UI language changes. */
function MapLanguage() {
  const { current: map } = useMap();
  const { i18n } = useTranslation();
  useEffect(() => {
    if (!map) return;
    applyMapLanguage(map.getMap(), i18n.language);
  }, [map, i18n.language]);
  return null;
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

/**
 * F3: tap the map to add a place — with a confirmation popup so a pan/mis-tap
 * never silently adds a location. Always available in entry modes (idle /
 * route-config / weather-finder), suppressed while drawing a polygon.
 */
const TAP_ADD_MODES = new Set(['idle', 'route-config', 'weather-finder']);

function TapToAddLocation() {
  const { t, i18n } = useTranslation('common');
  const { current: map } = useMap();
  const mode = useAppStore((s) => s.mode);
  const isDrawingArea = useAppStore((s) => s.isDrawingArea);
  const pickingLocation = useAppStore((s) => s.pickingLocation);
  const setPickingLocation = useAppStore((s) => s.setPickingLocation);
  const addSearchArea = useAppStore((s) => s.addSearchArea);
  const hasAreas = useAppStore((s) => s.searchAreas.length > 0);

  const [pending, setPending] = useState<{ lat: number; lng: number; name: string; fullName: string } | null>(null);
  const lastMoveEndRef = useRef(0);

  const active = TAP_ADD_MODES.has(mode) && !isDrawingArea;

  useEffect(() => {
    if (!map || !active) return;
    const nativeMap = map.getMap();

    const onMoveEnd = () => { lastMoveEndRef.current = Date.now(); };

    async function handleClick(e: MapMouseEvent) {
      // Debounce: ignore taps that land right after a pan/zoom settle (mis-taps
      // while the map is stopping).
      if (Date.now() - lastMoveEndRef.current < 300) return;
      const { lat, lng } = e.lngLat;
      // Optimistic placeholder while reverse-geocoding.
      setPending({ lat, lng, name: `${lat.toFixed(3)}, ${lng.toFixed(3)}`, fullName: '' });
      const result = await reverseGeocode(lat, lng, i18n.language);
      const name = (result && settlementName(result)) || `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
      setPending({ lat, lng, name, fullName: result?.display_name ?? name });
    }

    nativeMap.on('click', handleClick);
    nativeMap.on('moveend', onMoveEnd);
    return () => {
      nativeMap.off('click', handleClick);
      nativeMap.off('moveend', onMoveEnd);
    };
  }, [map, active]);

  // Leaving an eligible mode dismisses any open popup + the hint.
  useEffect(() => {
    if (!active) { setPending(null); }
  }, [active]);

  function confirmAdd() {
    if (!pending) return;
    addSearchArea({
      type: 'place',
      id: `picked-${Date.now()}`,
      name: pending.name,
      fullName: pending.fullName || pending.name,
      lat: pending.lat,
      lng: pending.lng,
    });
    setPending(null);
    setPickingLocation(false);
  }

  return (
    <>
      {/* Discoverability: show the hint whenever no place is chosen yet (the
          moment guidance helps), and when the pin button was pressed. It
          disappears as soon as the first place is added. */}
      {active && !pending && !isDrawingArea && (pickingLocation || !hasAreas) && (
        <div className="map-tap-hint" role="status">{t('map.tap_hint')}</div>
      )}

      {pending && (
        <Popup
          longitude={pending.lng}
          latitude={pending.lat}
          anchor="bottom"
          closeButton={false}
          closeOnClick={false}
          onClose={() => setPending(null)}
          offset={12}
        >
          <div className="map-tap-popup">
            <div className="map-tap-popup-title">{t('map.tap_add_title')}</div>
            <div className="map-tap-popup-name">{pending.name}</div>
            <div className="map-tap-popup-actions">
              <button type="button" className="map-tap-popup-add" onClick={confirmAdd}>
                {t('map.tap_add_confirm')}
              </button>
              <button
                type="button"
                className="map-tap-popup-close"
                onClick={() => setPending(null)}
                aria-label={t('a11y.close')}
              >
                ×
              </button>
            </div>
          </div>
        </Popup>
      )}
    </>
  );
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
  const { i18n } = useTranslation();
  const resolvedTheme = useThemeStore((s) => s.resolved);
  // Read the current language inside the (stable) map event handlers.
  const langRef = useRef(i18n.language);
  langRef.current = i18n.language;

  const handleLoad = useCallback((event: { target: MaplibreMap }) => {
    applyMapLanguage(event.target, langRef.current);
  }, []);

  // styledata fires after setStyle (theme switch) — re-apply labels, which reset
  // with the new style. Idempotent, so repeated events are fine.
  const handleStyleData = useCallback((event: { target: MaplibreMap }) => {
    applyMapLanguage(event.target, langRef.current);
  }, []);

  return (
    <div className="map-root">
      <Map
        initialViewState={{
          longitude: 10.4515,
          latitude: 51.1657,
          zoom: 5.5,
        }}
        mapStyle={resolvedTheme === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT}
        style={{ width: '100%', height: '100%' }}
        onLoad={handleLoad}
        onStyleData={handleStyleData}
      >
        {/* Always-present: map-positioning helpers */}
        <FitRouteOnSelection selectedStopIndex={selectedStopIndex} sheetBottomPadding={sheetBottomPadding} />
        <FlyToFinderRank1 finderResults={finderResults} sheetBottomPadding={sheetBottomPadding} />
        <FlyToCity target={flyToCity} />
        <TapToAddLocation />
        <MapLanguage />
        {/* X1: drawn areas persist here (store-backed), independent of DrawingControls' mount */}
        <SearchAreasLayer />
        {/* Pins for added places — entry modes only; results have their own markers */}
        {(mode === 'idle' || mode === 'route-config' || (mode === 'weather-finder' && !finderResults)) && (
          <PlaceMarkers />
        )}
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
