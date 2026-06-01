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
  useEffect(() => {
    if (!isMobile) return;
    if (showResults || showFinderPanel) {
      setSheetSnap(1);
    }
  }, [showResults, showFinderPanel, isMobile]);

  // Snap heights from Plan 01's canonical helper — single source of truth
  const sheetPx = getSheetHeights()[sheetSnap];

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
          onDrawComplete={!showResults ? (polygon) => addSearchArea({ type: 'polygon', id: DRAWN_AREA_ID, polygon }) : undefined}
          onDrawClear={!showResults ? () => removeSearchArea(DRAWN_AREA_ID) : undefined}
          finderResults={computedFinderResults.length > 0 ? computedFinderResults : undefined}
          selectedFinderIndex={selectedFinderIndex}
          onFinderClick={handleFinderClickFromMap}
          flyToCity={flyToCity}
          sheetBottomPadding={sheetPx}
        />
        <MobileSearchBar
          isExpanded={searchExpanded}
          onExpandedChange={setSearchExpanded}
          hidden={sheetSnap === 2}
        />
        <MobileBottomSheet
          snapIndex={sheetSnap}
          onSnapChange={setSheetSnap}
          summary={<PeekSummary />}
        >
          <div className="mobile-sheet-content">
            {showEntryPanel && <EntryPanel />}
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
          onDrawComplete={!showResults ? (polygon) => addSearchArea({ type: 'polygon', id: DRAWN_AREA_ID, polygon }) : undefined}
          onDrawClear={!showResults ? () => removeSearchArea(DRAWN_AREA_ID) : undefined}
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
