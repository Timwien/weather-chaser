import { useState } from 'react';
import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from './__root.tsx';
import { useAppStore } from '../stores/appStore.ts';
import { MapContainer } from '../components/map/MapContainer.tsx';
import { EntryPanel } from '../components/entry/EntryPanel.tsx';
import { ItineraryPanel } from '../components/itinerary/ItineraryPanel.tsx';
import { LoadingOverlay } from '../components/loading/LoadingOverlay.tsx';
import { MobileTabBar } from '../components/common/MobileTabBar.tsx';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: IndexPage,
});

function IndexPage() {
  const { setSearchArea, mode } = useAppStore();
  const [selectedStopIndex, setSelectedStopIndex] = useState<number | null>(null);
  // Mobile: 'itinerary' is the default view; 'map' is second screen
  const [mobileView, setMobileView] = useState<'itinerary' | 'map'>('itinerary');

  const showResults = mode === 'results';

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
          onDrawComplete={(polygon) => setSearchArea({ type: 'polygon', polygon })}
          onDrawClear={() => setSearchArea(null)}
        />
      </div>

      {/*
        Itinerary / EntryPanel overlay:
        On mobile when showResults: itinerary is default screen (mobileView === 'itinerary').
        On mobile when not showResults: entry panel always shown (no tab bar needed until results).
        On desktop: always rendered as a fixed overlay panel.
      */}
      <div
        className="screen-panel"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        {!showResults && <EntryPanel />}
        {showResults && (
          <ItineraryPanel
            selectedStopIndex={selectedStopIndex}
            onStopSelect={setSelectedStopIndex}
          />
        )}
      </div>

      <LoadingOverlay />

      {/* Mobile tab bar: only visible on mobile (CSS hides on desktop) and only when results are shown */}
      {showResults && (
        <MobileTabBar activeView={mobileView} onSwitch={setMobileView} />
      )}
    </div>
  );
}
