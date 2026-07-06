import { createRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Route as rootRoute } from './__root.tsx';
import { parseShareUrl } from '../utils/shareUrl.ts';
import { useAppStore } from '../stores/appStore.ts';
import { MapContainer } from '../components/map/MapContainer.tsx';
import { ItineraryPanel } from '../components/itinerary/ItineraryPanel.tsx';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/trip',
  component: TripPage,
});

function TripPage() {
  const [selectedStopIndex, setSelectedStopIndex] = useState<number | null>(null);
  const { setRoute, setTripConfig, setWeatherPrefs, setMode } = useAppStore();

  useEffect(() => {
    const parsed = parseShareUrl(window.location.search);
    if (parsed) {
      setTripConfig({
        startDate: parsed.config.startDate,
        endDate: parsed.config.endDate,
        totalDays: parsed.config.totalDays,
        maxStay: parsed.config.maxStay,
      });
      // U2: preset lives in the shared weatherPrefs slice now.
      setWeatherPrefs({ preset: parsed.config.preset as 'beach' | 'hiking' | 'sightseeing' });
      setRoute(parsed.route);
      setMode('results');
    }
  }, [setRoute, setTripConfig, setWeatherPrefs, setMode]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <MapContainer
        selectedStopIndex={selectedStopIndex}
        onStopClick={setSelectedStopIndex}
      />
      <ItineraryPanel
        selectedStopIndex={selectedStopIndex}
        onStopSelect={setSelectedStopIndex}
      />
    </div>
  );
}
