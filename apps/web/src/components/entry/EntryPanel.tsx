import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore.ts';
import { useOptimizer } from '../../hooks/useOptimizer.ts';
import { DateRangePicker } from './DateRangePicker.tsx';
import { LocationInput } from './LocationInput.tsx';
import { CriteriaSelector } from './CriteriaSelector.tsx';
import { RouteConfigStep } from './RouteConfigStep.tsx';
import './EntryPanel.css';

export function EntryPanel() {
  const { t } = useTranslation('common');
  const { mode, setMode, loadingStep, tripConfig, searchAreas } = useAppStore();
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
      {isRouteConfig && <RouteConfigStep onGenerate={optimizer.run} />}

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

      {/* Weather finder placeholder — Phase 2 */}
      {isWeatherFinder && (
        <div className="entry-panel-coming-soon">
          {t('route_config.coming_soon')}
        </div>
      )}
    </aside>
  );
}
