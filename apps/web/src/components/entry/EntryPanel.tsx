import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore.ts';
import { useAuthStore } from '../../stores/authStore.ts';
import { runOptimizer } from '../../services/optimizerRunner.ts';
import { DateRangePicker } from './DateRangePicker.tsx';
import { LocationInput } from './LocationInput.tsx';
import { WeatherPrefsSection } from './WeatherPrefsSection.tsx';
import { RouteConfigStep } from './RouteConfigStep.tsx';
import { WeatherFinderStep } from './WeatherFinderStep.tsx';
import { AccountModal } from '../account/AccountModal.tsx';
import { saveSearch, buildSearchConfigFromStore } from '../../services/savedSearch.ts';
import { capture } from '../../lib/analytics.ts';
import { useFeedbackStore } from '../../stores/feedbackStore.ts';
import { supabaseConfigured } from '../../lib/supabase.ts';
import './EntryPanel.css';

// One-time guest hint — fires after first route generation, never again
const HINT_KEY = 'wc_first_route_hint_shown';
const hasShownHint = () => localStorage.getItem(HINT_KEY) === '1';
const markHintShown = () => localStorage.setItem(HINT_KEY, '1');

export function EntryPanel() {
  const { t, i18n } = useTranslation('common');
  const { mode, setMode, loadingStep, tripConfig, searchAreas, error, setError, route } = useAppStore();
  const user = useAuthStore((s) => s.user);

  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [showRouteHint, setShowRouteHint] = useState(false);
  const [searchSaved, setSearchSaved] = useState(false);

  // X2: save the current entry state as a search (guest → sign in first).
  async function handleSaveSearch() {
    if (!supabaseConfigured) return;
    if (!user) {
      setIsAccountModalOpen(true);
      return;
    }
    try {
      await saveSearch(buildSearchConfigFromStore(), i18n.language);
      capture('search_saved');
      setSearchSaved(true);
      setTimeout(() => setSearchSaved(false), 2000);
    } catch { /* non-critical */ }
  }

  // Fire once when: route just appeared + user is guest + hint never shown
  useEffect(() => {
    if (route && !user && !hasShownHint()) {
      setShowRouteHint(true);
      markHintShown();
    }
  }, [route, user]);

  // CTAs are always visible in idle mode — disabled (with feedback on click)
  // until dates + at least one location are set. Hiding them entirely was
  // confusing: users didn't know a search existed or what was missing.
  const hasDates = Boolean(tripConfig.startDate);
  const hasLocation = searchAreas.length > 0;
  const ctasReady = hasDates && hasLocation;
  const showCTAs = mode === 'idle';
  const [showMissingHint, setShowMissingHint] = useState(false);

  // Clear the hint as soon as the missing inputs are filled
  useEffect(() => {
    if (ctasReady) setShowMissingHint(false);
  }, [ctasReady]);

  const missingHintKey = !hasDates && !hasLocation
    ? 'entry.cta_missing_both'
    : !hasDates
      ? 'entry.cta_missing_dates'
      : 'entry.cta_missing_location';

  function handleCtaClick(nextMode: 'route-config' | 'weather-finder') {
    if (!ctasReady) {
      setShowMissingHint(true);
      return;
    }
    setMode(nextMode);
  }

  const isRouteConfig = mode === 'route-config';
  const isWeatherFinder = mode === 'weather-finder';

  // Avatar initial — first character of email or display name
  const avatarInitial = user
    ? (user.user_metadata?.full_name ?? user.email ?? 'U').charAt(0).toUpperCase()
    : null;

  return (
    <aside className="entry-panel" aria-label={t('a11y.trip_config')}>
      {/* Header */}
      <div className="entry-panel-header">
        <h1 className="entry-panel-title">{t('app.title')}</h1>
        <p className="entry-panel-tagline">{t('app.tagline')}</p>
      </div>

      {/* Input sections */}
      <div className="entry-panel-inputs">
        <DateRangePicker />
        <LocationInput />
        <WeatherPrefsSection />
      </div>

      {/* CTAs — always visible in idle; disabled with feedback until inputs are set */}
      {showCTAs && (
        <div className="entry-panel-ctas">
          <button
            type="button"
            className={`cta-btn cta-btn--primary${!ctasReady ? ' cta-btn--disabled' : ''}`}
            aria-disabled={!ctasReady}
            onClick={() => handleCtaClick('route-config')}
          >
            {t('entry.cta.findRoute')}
          </button>
          <button
            type="button"
            className={`cta-btn cta-btn--secondary${!ctasReady ? ' cta-btn--disabled' : ''}`}
            aria-disabled={!ctasReady}
            onClick={() => handleCtaClick('weather-finder')}
          >
            {t('entry.cta.findWeather')}
          </button>
          {showMissingHint && !ctasReady && (
            <p className="entry-cta-hint" role="status">{t(missingHintKey)}</p>
          )}
          {/* X2: save the current search (bookmark) — visible once inputs are set */}
          {ctasReady && supabaseConfigured && (
            <button
              type="button"
              className="entry-save-search-btn"
              onClick={handleSaveSearch}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 2h10a1 1 0 0 1 1 1v11l-6-3-6 3V3a1 1 0 0 1 1-1z"/>
              </svg>
              {searchSaved ? t('save.search_saved') : t('save.search')}
            </button>
          )}
        </div>
      )}

      {/* Route config second step — expands inline when mode is route-config.
          runOptimizer is a module singleton, so the worker survives any
          component unmount (loading state, results re-weighting). */}
      {isRouteConfig && <RouteConfigStep onGenerate={runOptimizer} onBack={() => setMode('idle')} />}

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

      {/* Error banner — shown after a failed route calculation.
          R5: `error` is now a typed AppErrorCode from the worker → one mapping. */}
      {mode === 'idle' && error && (
        <div className="entry-error-banner">
          <span className="entry-error-text">
            {t(`errors.${error}`, { defaultValue: t('errors.unknown') })}
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

      {/* One-time save hint — shown once for guests after first route generation */}
      {showRouteHint && (
        <div className="entry-route-hint">
          <span>{t('entry.route_hint_text')}</span>
          <button
            type="button"
            className="entry-route-hint-cta"
            onClick={() => {
              setShowRouteHint(false);
              setIsAccountModalOpen(true);
            }}
          >
            {t('entry.route_hint_signin')}
          </button>
          <button
            type="button"
            className="entry-route-hint-dismiss"
            onClick={() => setShowRouteHint(false)}
            aria-label={t('a11y.close')}
          >
            ×
          </button>
        </div>
      )}

      {/* Footer — account icon */}
      <div className="entry-panel-footer">
        <button
          type="button"
          className="entry-panel-account-btn"
          onClick={() => setIsAccountModalOpen(true)}
          aria-label={t('a11y.account')}
          title={t('a11y.account')}
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

        {/* Feedback — permanently reachable below the menu, with visible label */}
        <button
          type="button"
          className="entry-panel-account-btn entry-panel-feedback-btn"
          onClick={() => useFeedbackStore.getState().openModal('entry_footer')}
          aria-label={t('a11y.feedback')}
          title={t('a11y.feedback')}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 11.5a8.38 8.38 0 0 1-9 8.36 8.5 8.5 0 0 1-3.4-.7L3 21l1.84-4.6A8.38 8.38 0 0 1 3.5 11.5a8.5 8.5 0 1 1 17.5 0z" />
          </svg>
          <span>{t('feedback.title')}</span>
        </button>

        {/* F1: always-reachable reload — a lifeline when the installed PWA
            freezes (no browser reload chrome). Works independently of app state. */}
        <button
          type="button"
          className="entry-panel-account-btn entry-panel-reload-btn"
          onClick={() => window.location.reload()}
          aria-label={t('a11y.reload')}
          title={t('a11y.reload')}
        >
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
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
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
