import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore.ts';
import { useFinder } from '../../hooks/useFinder.ts';
import './WeatherFinderStep.css';

export function WeatherFinderStep() {
  const { t } = useTranslation('common');
  const { searchAreas, finderLoading, setMode } = useAppStore();
  const { run } = useFinder();

  // Derive origin location from the first named place in searchAreas (same as "Wo?" input)
  const firstPlace = searchAreas.find(
    (a): a is Extract<typeof searchAreas[number], { type: 'place' }> => a.type === 'place',
  );
  const hasLocation = firstPlace !== undefined && typeof (firstPlace as { lat?: number }).lat === 'number';
  const locationName = firstPlace?.name ?? null;

  const canSearch = hasLocation && !finderLoading;

  return (
    <div className="finder-step">
      {/* Show which location will be used — derived from "Wo?" at the top */}
      <div className="finder-step-label">{t('finder.start_label', 'Startpunkt')}</div>
      {hasLocation ? (
        <div className="finder-step-location-display">
          {locationName}
        </div>
      ) : (
        <div className="finder-step-no-location">
          {t('finder.no_location', 'Bitte zuerst einen Ort in \u201eWo?\u201c eingeben')}
        </div>
      )}

      <button
        type="button"
        className={`finder-step-search-btn${!canSearch ? ' finder-step-search-btn--disabled' : ''}`}
        disabled={!canSearch}
        onClick={run}
      >
        {finderLoading
          ? t('finder.searching', 'Suche l\u00e4uft...')
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
        {t('itinerary.back', 'Zur\u00fcck')}
      </button>
    </div>
  );
}
