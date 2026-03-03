import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore.ts';
import { useOptimizer } from '../../hooks/useOptimizer.ts';
import { DateRangePicker } from './DateRangePicker.tsx';
import { LocationInput } from './LocationInput.tsx';
import { CriteriaSelector } from './CriteriaSelector.tsx';
import { RouteConfigStep } from './RouteConfigStep.tsx';
import { WeatherFinderStep } from './WeatherFinderStep.tsx';
import './EntryPanel.css';

export function EntryPanel() {
  const { t } = useTranslation('common');
  const { mode, setMode, loadingStep, tripConfig, searchAreas, error, setError } = useAppStore();
  // Hoisted here so the worker ref survives when RouteConfigStep unmounts during loading
  const optimizer = useOptimizer();

  // Show CTAs only in idle mode — once user picks a mode the step expands instead
  const showCTAs = Boolean(tripConfig.startDate && searchAreas.length > 0 && mode === 'idle');

  const isRouteConfig = mode === 'route-config';
  const isWeatherFinder = mode === 'weather-finder';

  return (
    <aside className="entry-panel" aria-label="Trip configuration">
      {/* Header */}
      <div className="entry-panel-header">
        <h1 className="entry-panel-title">{t('app.title')}</h1>
        <p className="entry-panel-tagline">{t('app.tagline')}</p>
      </div>

      {/* Input sections */}
      <div className="entry-panel-inputs">
        <DateRangePicker />
        <LocationInput />
        <CriteriaSelector />
      </div>

      {/* CTAs — shown when dates + at least one location filled */}
      {showCTAs && (
        <div className="entry-panel-ctas">
          <button
            type="button"
            className="cta-btn cta-btn--primary"
            onClick={() => setMode('route-config')}
          >
            {t('entry.cta.findRoute')}
          </button>
          <button
            type="button"
            className="cta-btn cta-btn--secondary"
            onClick={() => setMode('weather-finder')}
          >
            {t('entry.cta.findWeather')}
          </button>
        </div>
      )}

      {/* Route config second step — expands inline when mode is route-config */}
      {isRouteConfig && <RouteConfigStep onGenerate={optimizer.run} onBack={() => setMode('idle')} />}

      {/* Loading state */}
      {mode === 'loading' && (
        <div className="entry-panel-loading">
          <div className="entry-loading-spinner" />
          <p className="entry-loading-text">
            {t(`loading.${loadingStep ?? 'optimizing_route'}`)}
          </p>
          <button
            type="button"
            className="entry-loading-cancel"
            onClick={() => setMode('route-config')}
          >
            {t('entry.cancel_draw', 'Abbrechen')}
          </button>
        </div>
      )}

      {/* Weather finder — Phase 2 */}
      {isWeatherFinder && <WeatherFinderStep />}

      {/* Error banner — shown after a failed route calculation */}
      {mode === 'idle' && error && (
        <div className="entry-error-banner">
          <span className="entry-error-text">
            {error === 'no_towns'
              ? t('errors.no_towns', 'Keine Orte gefunden. Bitte ein größeres Gebiet zeichnen.')
              : error.startsWith('Overpass')
                ? t('errors.overpass', 'Wetterdaten konnten nicht geladen werden (Overpass API). Bitte erneut versuchen.')
                : error}
          </span>
          <button
            type="button"
            className="entry-error-dismiss"
            onClick={() => setError(null)}
          >
            ✕
          </button>
        </div>
      )}
    </aside>
  );
}
