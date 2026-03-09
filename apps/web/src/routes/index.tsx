import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from './__root.tsx';
import { useAppStore } from '../stores/appStore.ts';
import { MapContainer } from '../components/map/MapContainer.tsx';
import { EntryPanel } from '../components/entry/EntryPanel.tsx';
import { ItineraryPanel } from '../components/itinerary/ItineraryPanel.tsx';
import { LoadingOverlay } from '../components/loading/LoadingOverlay.tsx';
import { MobileTabBar } from '../components/common/MobileTabBar.tsx';
import { WeatherFinderPanel } from '../components/finder/WeatherFinderPanel.tsx';
import type { FinderResultData } from '../components/finder/FinderResultRow.tsx';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: IndexPage,
});

const DRAWN_AREA_ID = 'drawn-polygon';

function IndexPage() {
  const { t } = useTranslation('common');
  const { addSearchArea, removeSearchArea, mode, finderTowns, reset } = useAppStore();
  const [selectedStopIndex, setSelectedStopIndex] = useState<number | null>(null);
  const [selectedFinderIndex, setSelectedFinderIndex] = useState<number | null>(null);
  const [computedFinderResults, setComputedFinderResults] = useState<FinderResultData[]>([]);
  const [flyToCity, setFlyToCity] = useState<{ lat: number; lng: number; token: number } | null>(null);
  // Mobile: 'itinerary' is the default view; 'map' is second screen
  const [mobileView, setMobileView] = useState<'itinerary' | 'map'>('itinerary');

  // Reset selection when a new search loads
  useEffect(() => {
    setSelectedFinderIndex(null);
  }, [finderTowns]);

  const showResults     = mode === 'results';
  const showFinderPanel = mode === 'weather-finder' && finderTowns !== null;
  const showEntryPanel  = !showResults && !showFinderPanel;

  return (
    <div
      data-mobile-view={mobileView}
      style={{ position: 'relative', width: '100%', height: '100%' }}
    >
      {/*
        Map: always mounted (never unmounted — keeps MapLibre state).
        On mobile: hidden with visibility:hidden when itinerary is the active view.
        CSS class controls visibility; desktop: always visible.
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
        On mobile when showResults: itinerary is default screen (mobileView === 'itinerary').
        On mobile when not showResults: entry panel always shown (no tab bar needed until results).
        On desktop: always rendered as a fixed overlay panel.
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

      {/* Mobile tab bar: always visible on mobile (CSS class hides on desktop) */}
      <MobileTabBar
        activeView={mobileView}
        onSwitch={setMobileView}
        panelLabel={showResults ? undefined : t('nav.search', 'Search')}
      />
    </div>
  );
}
