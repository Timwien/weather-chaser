import { useEffect, useMemo, useState } from 'react';
import { parseShareUrl } from '../utils/shareUrl.ts';
import { useAppStore } from '../stores/appStore.ts';
import { MapContainer } from '../components/map/MapContainer.tsx';
import { StatusPage } from '../components/common/StatusPage.tsx';
import { ItineraryPanel } from '../components/itinerary/ItineraryPanel.tsx';

export function TripPage() {
  const [selectedStopIndex, setSelectedStopIndex] = useState<number | null>(null);
  const { setRoute, setTripConfig, setWeatherPrefs, setMode } = useAppStore();

  // Parsed once; null = missing/damaged link → notice instead of an empty map.
  const parsed = useMemo(() => parseShareUrl(window.location.search), []);

  useEffect(() => {
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
  }, [parsed, setRoute, setTripConfig, setWeatherPrefs, setMode]);

  if (!parsed) {
    return <StatusPage titleKey="errors.trip_invalid_title" textKey="errors.trip_invalid_text" />;
  }

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
