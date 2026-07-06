import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from './__root.tsx';
import { useAppStore } from '../stores/appStore.ts';
import { useIsMobile } from '../hooks/useIsMobile.ts';
import { MapContainer } from '../components/map/MapContainer.tsx';
import { EntryPanel } from '../components/entry/EntryPanel.tsx';
import { ItineraryPanel } from '../components/itinerary/ItineraryPanel.tsx';
import { LoadingOverlay } from '../components/loading/LoadingOverlay.tsx';
import { WeatherFinderPanel } from '../components/finder/WeatherFinderPanel.tsx';
import { MobileBottomSheet, getSheetHeights } from '../components/mobile/MobileBottomSheet.tsx';
import { MobileSearchBar } from '../components/mobile/MobileSearchBar.tsx';
import type { FinderResultData } from '../components/finder/FinderResultRow.tsx';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: IndexPage,
});

const DRAWN_AREA_ID = 'drawn-polygon';

function IndexPage() {
  const { t } = useTranslation('common');
  const { addSearchArea, removeSearchArea, mode, finderTowns, reset, route } = useAppStore();
  const isMobile = useIsMobile();
  const [selectedStopIndex, setSelectedStopIndex] = useState<number | null>(null);
  const [selectedFinderIndex, setSelectedFinderIndex] = useState<number | null>(null);
  const [computedFinderResults, setComputedFinderResults] = useState<FinderResultData[]>([]);
  const [flyToCity, setFlyToCity] = useState<{ lat: number; lng: number; token: number } | null>(null);
  // Mobile sheet state — 0=peek, 1=half, 2=full
  const [sheetSnap, setSheetSnap] = useState<0 | 1 | 2>(0);
  // Mobile search bar expand state
  const [searchExpanded, setSearchExpanded] = useState(false);

  // Reset selection when a new search loads
  useEffect(() => {
    setSelectedFinderIndex(null);
  }, [finderTowns]);

  const showResults     = mode === 'results';
  const showFinderPanel = mode === 'weather-finder' && finderTowns !== null;
  const showEntryPanel  = !showResults && !showFinderPanel;

  // Pinned auto-snap: when search results arrive → auto-rise to HALF (1)
  // and collapse the expanded search surface so results are not hidden behind it
  useEffect(() => {
    if (!isMobile) return;
    if (showResults || showFinderPanel) {
      setSheetSnap(1);
      setSearchExpanded(false);
    }
  }, [showResults, showFinderPanel, isMobile]);

  // Snap heights from Plan 01's canonical helper — single source of truth.
  // The sheet now renders ONLY when there are results; in entry mode it is unmounted,
  // so the map must not be padded for a non-existent sheet → 0 padding in entry mode.
  const sheetExists = showResults || showFinderPanel;
  const sheetPx = sheetExists ? getSheetHeights()[sheetSnap] : 0;

  // B1: reset stale snap state when the sheet unmounts (e.g. "Back" → reset()).
  // Without this, a snap of 2 (set on list-item tap) would keep the search pill
  // hidden forever, because `hidden` used to also test `sheetSnap === 2`.
  useEffect(() => {
    if (!sheetExists) setSheetSnap(0);
  }, [sheetExists]);

  // ── Panel callbacks (list-item tap → FULL snap on mobile) ──────────────────

  function handleStopSelectFromPanel(idx: number) {
    setSelectedStopIndex(idx);
    if (isMobile) setSheetSnap(2);
  }

  function handleFinderSelectFromPanel(idx: number) {
    setSelectedFinderIndex(idx);
    const r = computedFinderResults[idx];
    if (r) setFlyToCity(prev => ({ lat: r.lat, lng: r.lng, token: (prev?.token ?? 0) + 1 }));
    if (isMobile) setSheetSnap(2);
  }

  // ── Map marker callbacks (popup + fly only — NO setSheetSnap, marker-tap decoupled) ──

  function handleStopClickFromMap(idx: number) {
    setSelectedStopIndex(idx);
    // No setSheetSnap: marker tap drives popup (internal to StopMarkers) + existing fly,
    // but must NOT change the sheet snap on mobile (decoupling per plan spec).
  }

  function handleFinderClickFromMap(idx: number) {
    setSelectedFinderIndex(idx);
    const r = computedFinderResults[idx];
    if (r) setFlyToCity(prev => ({ lat: r.lat, lng: r.lng, token: (prev?.token ?? 0) + 1 }));
    // No setSheetSnap: marker tap is decoupled from sheet snap.
  }

  // ── Peek summary (localized) ──────────────────────────────────────────────

  function PeekSummary() {
    if (showFinderPanel) {
      return <span>{t('mobile.sheet_summary_finder', { count: computedFinderResults.length })}</span>;
    }
    if (showResults && route) {
      return (
        <span>
          {t('mobile.sheet_summary_route', {
            stops: route.stops.length,
            km: Math.round(route.totalDistanceKm),
          })}
        </span>
      );
    }
    return <span>{t('mobile.sheet_summary_empty')}</span>;
  }

  // ── Mobile branch ─────────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <MapContainer
          selectedStopIndex={selectedStopIndex}
          onStopClick={handleStopClickFromMap}
          onDrawComplete={(polygon) => addSearchArea({ type: 'polygon', id: DRAWN_AREA_ID, polygon })}
          onDrawClear={() => removeSearchArea(DRAWN_AREA_ID)}
          finderResults={computedFinderResults.length > 0 ? computedFinderResults : undefined}
          selectedFinderIndex={selectedFinderIndex}
          onFinderClick={handleFinderClickFromMap}
          flyToCity={flyToCity}
          sheetBottomPadding={sheetPx}
        />
        {/* Pill hidden while results are showing — the sheet's Back button returns to search.
            Without this, tapping the pill in results mode expands an empty surface
            (EntryPanel only renders when showEntryPanel). */}
        <MobileSearchBar
          isExpanded={searchExpanded}
          onExpandedChange={setSearchExpanded}
          hidden={sheetExists}
        >
          {/* The expanded search pill is now the SINGLE, complete search surface:
              EntryPanel owns the mode CTAs, RouteConfigStep/WeatherFinderStep and the
              hoisted useOptimizer launch. There is exactly ONE EntryPanel on mobile (here),
              and ZERO EntryPanel in the bottom sheet. */}
          {showEntryPanel && <EntryPanel />}
        </MobileSearchBar>
        {/* Bottom sheet appears ONLY when there are RESULTS (route or finder).
            In entry/idle/route-config/weather-finder-input states the sheet is not rendered;
            the user interacts with the map + the search pill only. */}
        {(showResults || showFinderPanel) && (
          <MobileBottomSheet
            snapIndex={sheetSnap}
            onSnapChange={setSheetSnap}
            summary={<PeekSummary />}
          >
            <div className="mobile-sheet-content">
              {showResults && (
                <ItineraryPanel
                  selectedStopIndex={selectedStopIndex}
                  onStopSelect={handleStopSelectFromPanel}
                />
              )}
              {showFinderPanel && (
                <WeatherFinderPanel
                  selectedFinderIndex={selectedFinderIndex}
                  onResultSelect={handleFinderSelectFromPanel}
                  onBack={() => reset()}
                  onResultsComputed={setComputedFinderResults}
                />
              )}
            </div>
          </MobileBottomSheet>
        )}
        <LoadingOverlay />
      </div>
    );
  }

  // ── Desktop branch (unchanged screen-map + screen-panel structure, tab bar removed) ──

  return (
    <div
      style={{ position: 'relative', width: '100%', height: '100%' }}
    >
      {/*
        Map: always mounted (never unmounted — keeps MapLibre state).
        Desktop: always visible.
      */}
      <div
        className="screen-map"
        style={{
          position: 'absolute',
          inset: 0,
        }}
      >
        <MapContainer
          selectedStopIndex={selectedStopIndex}
          onStopClick={setSelectedStopIndex}
          onDrawComplete={(polygon) => addSearchArea({ type: 'polygon', id: DRAWN_AREA_ID, polygon })}
          onDrawClear={() => removeSearchArea(DRAWN_AREA_ID)}
          finderResults={computedFinderResults.length > 0 ? computedFinderResults : undefined}
          selectedFinderIndex={selectedFinderIndex}
          onFinderClick={(idx) => {
            setSelectedFinderIndex(idx);
            const r = computedFinderResults[idx];
            if (r) setFlyToCity(prev => ({ lat: r.lat, lng: r.lng, token: (prev?.token ?? 0) + 1 }));
          }}
          flyToCity={flyToCity}
        />
      </div>

      {/*
        Itinerary / EntryPanel / WeatherFinderPanel overlay:
        Desktop: always rendered as a fixed overlay panel.
      */}
      <div
        className="screen-panel"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        {/* Entry panel: shown during idle/config/finder-config */}
        {showEntryPanel && <EntryPanel />}

        {/* Route planner results */}
        {showResults && (
          <ItineraryPanel
            selectedStopIndex={selectedStopIndex}
            onStopSelect={setSelectedStopIndex}
          />
        )}

        {/* Finder results panel */}
        {showFinderPanel && (
          <WeatherFinderPanel
            selectedFinderIndex={selectedFinderIndex}
            onResultSelect={(idx) => {
              setSelectedFinderIndex(idx);
              const r = computedFinderResults[idx];
              if (r) setFlyToCity(prev => ({ lat: r.lat, lng: r.lng, token: (prev?.token ?? 0) + 1 }));
            }}
            onBack={() => reset()}
            onResultsComputed={setComputedFinderResults}
          />
        )}
      </div>

      <LoadingOverlay />
    </div>
  );
}
