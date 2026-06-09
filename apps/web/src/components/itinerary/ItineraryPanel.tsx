import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore.ts';
import { useAuthStore } from '../../stores/authStore.ts';
import { supabaseConfigured } from '../../lib/supabase.ts';
import { saveRoute } from '../../services/userdata.ts';
import { SummaryBar } from './SummaryBar.tsx';
import { StopCard } from './StopCard.tsx';
import { ShareBar } from '../share/ShareBar.tsx';
import { InlineSignInPrompt } from '../auth/InlineSignInPrompt.tsx';
import { ErrorMessage } from '../common/ErrorMessage.tsx';
import './ItineraryPanel.css';

interface ItineraryPanelProps {
  selectedStopIndex: number | null;
  onStopSelect: (index: number) => void;
}

function BackArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <polyline points="9,2 4,7 9,12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
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

export function ItineraryPanel({ selectedStopIndex, onStopSelect }: ItineraryPanelProps) {
  const { t } = useTranslation('common');
  const { route, error, mode, reset, tripConfig } = useAppStore();
  const { user, pendingAction, setPendingAction } = useAuthStore();
  const stopRefs = useRef<Array<HTMLDivElement | null>>([]);

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showInlineSignIn, setShowInlineSignIn] = useState(false);

  // Scroll to the selected stop when selectedStopIndex changes
  if (selectedStopIndex !== null && stopRefs.current[selectedStopIndex]) {
    stopRefs.current[selectedStopIndex]!.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

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
      </div>

      <SummaryBar route={route} />

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
                onClick={() => onStopSelect(idx)}
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
