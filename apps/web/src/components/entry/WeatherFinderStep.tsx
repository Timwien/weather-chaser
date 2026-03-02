import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore.ts';
import { useFinder } from '../../hooks/useFinder.ts';
import { searchPlace } from '../../services/nominatim.ts';
import './WeatherFinderStep.css';

export function WeatherFinderStep() {
  const { t } = useTranslation('common');
  const { finderConfig, finderLoading, setFinderConfig, setMode } = useAppStore();
  const { run } = useFinder();

  const [query, setQuery] = useState(finderConfig.startLocation);
  const [suggestions, setSuggestions] = useState<Array<{ name: string; lat: number; lng: number }>>([]);
  const [gpsLoading, setGpsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced Nominatim search — 300ms
  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 2) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchPlace(value);
        setSuggestions(results.slice(0, 5).map((r) => ({
          name: r.display_name.split(',')[0].trim(),
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
        })));
      } catch { /* ignore */ }
    }, 300);
  }

  function selectSuggestion(s: { name: string; lat: number; lng: number }) {
    setQuery(s.name);
    setSuggestions([]);
    setFinderConfig({ startLat: s.lat, startLng: s.lng, startLocation: s.name });
  }

  function handleGPS() {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        setQuery('Mein Standort');
        setFinderConfig({
          startLat: pos.coords.latitude,
          startLng: pos.coords.longitude,
          startLocation: 'Mein Standort',
        });
      },
      () => { setGpsLoading(false); },
      { timeout: 8000, maximumAge: 60000 },
    );
  }

  const canSearch = finderConfig.startLat !== null && !finderLoading;

  return (
    <div className="finder-step">
      <div className="finder-step-label">{t('finder.start_label', 'Startpunkt')}</div>
      <div className="finder-step-location-row">
        <div className="finder-step-input-wrap">
          <input
            className="finder-step-input"
            type="text"
            placeholder={t('finder.start_placeholder', 'Ort oder Stadt...')}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
          />
          {suggestions.length > 0 && (
            <ul className="finder-step-suggestions">
              {suggestions.map((s, i) => (
                <li key={i} onMouseDown={() => selectSuggestion(s)}>{s.name}</li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          className="finder-step-gps-btn"
          onClick={handleGPS}
          disabled={gpsLoading}
          title={t('finder.use_location', 'Mein Standort verwenden')}
        >
          {gpsLoading ? '...' : String.fromCodePoint(0x2316)}
        </button>
      </div>

      <button
        type="button"
        className={`finder-step-search-btn${!canSearch ? ' finder-step-search-btn--disabled' : ''}`}
        disabled={!canSearch}
        onClick={run}
      >
        {finderLoading
          ? t('finder.searching', 'Suche läuft...')
          : t('finder.search', 'Bestes Wetter suchen')}
      </button>

      {finderLoading && (
        <div className="finder-step-loading">
          <div className="entry-loading-spinner" />
        </div>
      )}

      <button
        type="button"
        className="finder-step-back-btn"
        onClick={() => setMode('idle')}
      >
        {t('itinerary.back', 'Zurück')}
      </button>
    </div>
  );
}
