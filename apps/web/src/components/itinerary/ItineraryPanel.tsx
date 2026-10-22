import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { WeatherPreset } from '@weatherchaser/core';
import { useAppStore } from '../../stores/appStore.ts';
import { useAuthStore } from '../../stores/authStore.ts';
import { supabaseConfigured } from '../../lib/supabase.ts';
import { saveRoute } from '../../services/userdata.ts';
import { runOptimizer } from '../../services/optimizerRunner.ts';
import { useIsMobile } from '../../hooks/useIsMobile.ts';
import { capture } from '../../lib/analytics.ts';
import { SummaryBar } from './SummaryBar.tsx';
import { StopCard } from './StopCard.tsx';
import { ShareBar } from '../share/ShareBar.tsx';
import { InlineSignInPrompt } from '../auth/InlineSignInPrompt.tsx';
import { ErrorMessage } from '../common/ErrorMessage.tsx';
import { BeachIcon, HikingIcon, SightseeingIcon } from '../finder/FinderIcons.tsx';
import { useRouteVan } from '../../hooks/useRouteVan.ts';
import { useWeatherLayerStore } from '../../stores/weatherLayerStore.ts';
import { WeatherTimelineButton } from '../common/WeatherTimelineButton.tsx';
import { useForecastReach } from '../../hooks/useForecastReach.ts';
import { formatDateTime } from '../../utils/dateFormat.ts';
import { RoutePlayButton } from '../common/RoutePlayButton.tsx';
import './ItineraryPanel.css';

const REWEIGHT_PRESETS: WeatherPreset[] = ['beach', 'hiking', 'sightseeing'];

const REWEIGHT_ICONS: Record<WeatherPreset, React.ComponentType<{ size?: number }>> = {
  beach: BeachIcon,
  hiking: HikingIcon,
  sightseeing: SightseeingIcon,
};

interface ItineraryPanelProps {
  selectedStopIndex: number | null;
  onStopSelect: (index: number) => void;
  /** Mobile: open the bottom sheet fully (the share bar is below the fold at half height). */
  onExpandSheet?: () => void;
  /** After "Wetterverlauf" switched the map layer (mobile: sheet to half). */
  onShowTimeline?: () => void;
}

function BackArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <polyline points="9,2 4,7 9,12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="3.5" r="1.8"/>
      <circle cx="4" cy="8" r="1.8"/>
      <circle cx="12" cy="12.5" r="1.8"/>
      <path d="M5.6 7.1l4.8-2.7M5.6 8.9l4.8 2.7"/>
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 2h10a1 1 0 0 1 1 1v11l-6-3-6 3V3a1 1 0 0 1 1-1z"/>
    </svg>
  );
}

export function ItineraryPanel({ selectedStopIndex, onStopSelect, onExpandSheet, onShowTimeline }: ItineraryPanelProps) {
  const { t, i18n } = useTranslation('common');
  const { route, error, mode, reset, tripConfig, weatherPrefs, setWeatherPrefs, lastRoutePrefs } = useAppStore();
  const { user, pendingAction, setPendingAction } = useAuthStore();
  const isMobile = useIsMobile();
  const van = useRouteVan();
  const activeIdx = van?.inTrip ? van.pos.focusStopIndex : null; // no highlight / auto-scroll outside the trip
  const focusStop = useWeatherLayerStore((st) => st.focusStop);
  const reach = useForecastReach();
  const beyondHint = reach.startsBeyond && reach.until !== null ? t('route.beyond_horizon', { until: formatDateTime(reach.until, i18n.language) }) : null;
  const stopRefs = useRef<Array<HTMLDivElement | null>>([]);

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showInlineSignIn, setShowInlineSignIn] = useState(false);

  // Scroll to the selected stop when selectedStopIndex changes
  if (selectedStopIndex !== null && stopRefs.current[selectedStopIndex]) {
    stopRefs.current[selectedStopIndex]!.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // The list follows the camper while it travels
  useEffect(() => {
    if (activeIdx !== null) stopRefs.current[activeIdx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeIdx]);

  // Auto-complete pending save_route action after sign-in
  useEffect(() => {
    if (user && pendingAction?.type === 'save_route' && route && supabaseConfigured) {
      setPendingAction(null);
      setShowInlineSignIn(false);
      executeSave();
    }
    // We intentionally only run when user becomes non-null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function executeSave() {
    if (!route) return;
    setSaveState('saving');
    setSaveError(null);
    try {
      await saveRoute(route, tripConfig.startDate, tripConfig.endDate);
      capture('route_saved', { stops_count: route.stops.length });
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch (err) {
      setSaveState('error');
      setSaveError(err instanceof Error ? err.message : t('save.error_generic'));
      setTimeout(() => setSaveState('idle'), 3000);
    }
  }

  function handleSaveClick() {
    if (!supabaseConfigured) return;
    if (user) {
      executeSave();
    } else {
      setPendingAction({ type: 'save_route', payload: { route } });
      setShowInlineSignIn(true);
    }
  }

  // The share actions sit below the stop list — on a phone the sheet hides them, so jump there.
  function jumpToShare() {
    onExpandSheet?.();
    // Wait for the sheet's snap transition, then bring the share bar into view.
    window.setTimeout(() => {
      const bar = document.getElementById('itinerary-share');
      if (!bar) return;
      bar.scrollIntoView({ behavior: 'smooth', block: 'end' });
      bar.querySelector<HTMLElement>('.share-btn-primary')?.focus({ preventScroll: true });
    }, 350);
  }

  if (mode === 'idle' || mode === 'route-config') return null;

  if (error) {
    return (
      <div className="itinerary-panel">
        <button className="itinerary-back-btn" onClick={reset}>
          <BackArrowIcon /> {t('itinerary.back')}
        </button>
        <ErrorMessage error={error} />
      </div>
    );
  }

  if (!route) return null;

  let cumulativeDay = 1;

  const saveLabel = saveState === 'saved'
    ? t('save.saved')
    : saveState === 'saving'
    ? t('save.saving')
    : t('save.route');

  return (
    <div className="itinerary-panel">
      {/* Header row: back button + title */}
      <div className="itinerary-header">
        <button className="itinerary-back-btn" onClick={reset}>
          <BackArrowIcon /> {t('itinerary.back')}
        </button>
        <h2 className="itinerary-title">{t('itinerary.title')}</h2>
        {isMobile && (
          <button
            type="button"
            className="itinerary-share-jump"
            onClick={jumpToShare}
            aria-label={t('share.jump_to')}
          >
            <ShareIcon />
          </button>
        )}
      </div>

      <SummaryBar route={route} />
      <div className="itinerary-wx-actions">
        <RoutePlayButton onShown={onShowTimeline} />
        <WeatherTimelineButton onShown={onShowTimeline} />
      </div>

      {/* Post-hoc re-weighting: pick a different weather profile and recompute
          the route on explicit confirmation (recomputing takes time, so a mere
          chip tap must never trigger it). Only offered when the route came from
          a run this session (lastRoutePrefs set) — saved routes have no search
          inputs in the store to recompute from. */}
      {lastRoutePrefs && (
        <div className="itinerary-reweight">
          <span className="itinerary-reweight-label">{t('itinerary.reweight_label')}</span>
          <div className="itinerary-reweight-chips" role="radiogroup" aria-label={t('itinerary.reweight_label')}>
            {REWEIGHT_PRESETS.map((preset) => {
              const Icon = REWEIGHT_ICONS[preset];
              const active = weatherPrefs.customWeights === null && weatherPrefs.preset === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`itinerary-reweight-chip${active ? ' itinerary-reweight-chip--active' : ''}`}
                  onClick={() => setWeatherPrefs({ preset, customWeights: null })}
                >
                  <Icon size={14} />
                  {t(`preset.${preset}`)}
                </button>
              );
            })}
          </div>
          {JSON.stringify(weatherPrefs) !== JSON.stringify(lastRoutePrefs) && (
            <div className="itinerary-reweight-confirm-row">
              <span className="itinerary-reweight-hint">{t('itinerary.reweight_hint')}</span>
              <button
                type="button"
                className="itinerary-reweight-confirm"
                onClick={() => {
                  capture('reweight_confirmed', { preset: weatherPrefs.preset });
                  runOptimizer();
                }}
              >
                {t('itinerary.reweight_confirm')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Save button — always visible; guest sees it dimmed */}
      <div className="itinerary-save-area">
          <button
            type="button"
            className={`itinerary-save-btn${!user ? ' itinerary-save-btn--guest' : ''}${saveState === 'saved' ? ' itinerary-save-btn--saved' : ''}`}
            onClick={handleSaveClick}
            disabled={saveState === 'saving' || saveState === 'saved'}
            title={!user ? t('save.sign_in') : undefined}
          >
            <SaveIcon />
            {saveLabel}
          </button>
          {saveState === 'error' && saveError && (
            <p className="itinerary-save-error">{saveError}</p>
          )}
          {showInlineSignIn && !user && (
            <InlineSignInPrompt onClose={() => { setShowInlineSignIn(false); setPendingAction(null); }} />
          )}
        </div>

      <div className="itinerary-list">
        {route.stops.map((stop, idx) => {
          const stopDay = cumulativeDay;
          cumulativeDay += stop.nights;
          return (
            <div key={stop.town.id} ref={(el) => { stopRefs.current[idx] = el; }}>
              <StopCard
                stop={stop}
                stopNumber={stopDay}
                isSelected={selectedStopIndex === idx}
                onClick={() => { onStopSelect(idx); focusStop(idx); }}
                isActive={activeIdx === idx}
                weatherHereDisabledHint={beyondHint}
                onWeatherHere={() => { onStopSelect(idx); focusStop(idx, true); onShowTimeline?.(); }}
                index={idx}
              />
              {idx < route.stops.length - 1 && stop.distanceToNextKm !== undefined && (
                <div className="itinerary-distance-connector">
                  <span className="itinerary-distance-pill">
                    {Math.round(stop.distanceToNextKm)} km
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ShareBar />
    </div>
  );
}
