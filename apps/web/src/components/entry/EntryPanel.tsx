import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore.ts';
import { useAuthStore } from '../../stores/authStore.ts';
import { useOptimizer } from '../../hooks/useOptimizer.ts';
import { DateRangePicker } from './DateRangePicker.tsx';
import { LocationInput } from './LocationInput.tsx';
import { CriteriaSelector } from './CriteriaSelector.tsx';
import { RouteConfigStep } from './RouteConfigStep.tsx';
import { WeatherFinderStep } from './WeatherFinderStep.tsx';
import { AccountModal } from '../account/AccountModal.tsx';
import './EntryPanel.css';

export function EntryPanel() {
  const { t } = useTranslation('common');
  const { mode, setMode, loadingStep, tripConfig, searchAreas, error, setError } = useAppStore();
  const user = useAuthStore((s) => s.user);
  // Hoisted here so the worker ref survives when RouteConfigStep unmounts during loading
  const optimizer = useOptimizer();

  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  // Show CTAs only in idle mode — once user picks a mode the step expands instead
  const showCTAs = Boolean(tripConfig.startDate && searchAreas.length > 0 && mode === 'idle');

  const isRouteConfig = mode === 'route-config';
  const isWeatherFinder = mode === 'weather-finder';

  // Avatar initial — first character of email or display name
  const avatarInitial = user
    ? (user.user_metadata?.full_name ?? user.email ?? 'U').charAt(0).toUpperCase()
    : null;

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

      {/* Footer — account icon */}
      <div className="entry-panel-footer">
        <button
          type="button"
          className="entry-panel-account-btn"
          onClick={() => setIsAccountModalOpen(true)}
          aria-label="Konto"
          title="Konto"
        >
          {avatarInitial ? (
            <span className="entry-panel-avatar">{avatarInitial}</span>
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.582-7 8-7s8 3 8 7" />
            </svg>
          )}
        </button>
      </div>

      {/* Account modal */}
      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
      />
    </aside>
  );
}
