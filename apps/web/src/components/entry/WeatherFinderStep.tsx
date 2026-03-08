import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore.ts';
import { useFinder } from '../../hooks/useFinder.ts';
import './WeatherFinderStep.css';

export function WeatherFinderStep() {
  const { t } = useTranslation('common');
  const { searchAreas, finderLoading, finderError, setMode } = useAppStore();
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
      <div className="entry-panel-loading">
        <div className="entry-loading-spinner" />
        <p className="entry-loading-text">
          {t('finder.loading', 'Orte werden analysiert\u2026')}
        </p>
        <button
          type="button"
          className="entry-loading-cancel"
          onClick={() => setMode('idle')}
        >
          {t('entry.cancel_draw', 'Abbrechen')}
        </button>
      </div>
    );
  }

  if (finderError) {
    return (
      <div className="finder-step">
        <div className="finder-step-error">
          {finderError === 'no_towns'
            ? t('errors.no_towns', 'Keine Orte gefunden. Bitte ein größeres Gebiet wählen.')
            : t('finder.error', 'Fehler beim Laden. Bitte erneut versuchen.')}
        </div>
        <button
          type="button"
          className="cta-btn cta-btn--primary"
          onClick={run}
        >
          {t('finder.retry', 'Erneut versuchen')}
        </button>
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

  // Results are in — WeatherFinderPanel takes over; nothing to show here
  return null;
}
