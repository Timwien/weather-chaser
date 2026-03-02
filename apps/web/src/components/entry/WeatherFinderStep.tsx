import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore.ts';
import { useFinder } from '../../hooks/useFinder.ts';
import './WeatherFinderStep.css';

export function WeatherFinderStep() {
  const { t } = useTranslation('common');
  const { searchAreas, finderLoading, setMode } = useAppStore();
  const { run } = useFinder();

  const hasAreas = searchAreas.length > 0;

  // Auto-trigger search on mount — no need for a second "search" button
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (hasAreas) run(); }, []);

  if (!hasAreas) {
    return (
      <div className="finder-step">
        <div className="finder-step-no-location">
          {t('finder.no_location', 'Bitte zuerst einen Ort in \u201eWo?\u201c eingeben')}
        </div>
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

  if (finderLoading) {
    return (
      <div className="finder-step">
        <div className="finder-step-loading">
          <div className="entry-loading-spinner" />
        </div>
      </div>
    );
  }

  // Results are in — WeatherFinderPanel takes over; nothing to show here
  return null;
}
