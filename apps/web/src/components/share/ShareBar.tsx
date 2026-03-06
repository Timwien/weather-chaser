import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore.ts';
import { useAuthStore } from '../../stores/authStore.ts';
import { supabaseConfigured } from '../../lib/supabase.ts';
import { saveRoute } from '../../services/userdata.ts';
import { buildGoogleMapsUrl, buildAppleMapsUrl } from '../../utils/exportMaps.ts';
import { buildShareUrl } from '../../utils/shareUrl.ts';
import { InlineSignInPrompt } from '../auth/InlineSignInPrompt.tsx';
import './ShareBar.css';

function SaveCloudIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 2h10a1 1 0 0 1 1 1v11l-6-3-6 3V3a1 1 0 0 1 1-1z"/>
    </svg>
  );
}

export function ShareBar() {
  const { t } = useTranslation('common');
  const { route, tripConfig, searchArea } = useAppStore();
  const { user, pendingAction, setPendingAction } = useAuthStore();
  const [copied, setCopied] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showInlineSignIn, setShowInlineSignIn] = useState(false);

  if (!route) return null;

  const { url: googleUrl, truncated } = buildGoogleMapsUrl(route.stops);
  const appleUrl = buildAppleMapsUrl(route.stops);

  const handleCopyLink = async () => {
    const shareUrl = buildShareUrl(
      {
        startDate: tripConfig.startDate ?? '',
        endDate: tripConfig.endDate ?? '',
        totalDays: tripConfig.totalDays,
        maxStay: tripConfig.maxStay,
        preset: tripConfig.preset,
        regionName: searchArea?.name,
      },
      route,
    );
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Auto-complete pending save_route action after sign-in
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (user && pendingAction?.type === 'save_route' && route && supabaseConfigured) {
      setPendingAction(null);
      setShowInlineSignIn(false);
      executeSave();
    }
    // Only run when user transitions to non-null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function executeSave() {
    if (!route) return;
    setSaveState('saving');
    try {
      await saveRoute(route, tripConfig.startDate, tripConfig.endDate);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch {
      setSaveState('error');
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

  const saveLabel = saveState === 'saved'
    ? 'Gespeichert ✓'
    : saveState === 'saving'
    ? 'Speichern...'
    : 'Speichern';

  return (
    <div className="share-bar">
      {truncated && (
        <div className="share-truncation-notice">{t('share.google_limit')}</div>
      )}
      <div className="share-buttons">
        <a
          href={googleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="share-btn share-btn-secondary"
        >
          {t('share.export_google')}
        </a>
        <a
          href={appleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="share-btn share-btn-secondary"
        >
          {t('share.export_apple')}
        </a>
        <button onClick={handleCopyLink} className="share-btn share-btn-primary">
          {copied ? t('share.link_copied') : t('share.copy_link')}
        </button>

        {supabaseConfigured && (
          <button
            type="button"
            onClick={handleSaveClick}
            disabled={saveState === 'saving' || saveState === 'saved'}
            className={`share-btn share-btn-save${!user ? ' share-btn-save--guest' : ''}${saveState === 'saved' ? ' share-btn-save--saved' : ''}`}
            title={!user ? 'Anmelden zum Speichern' : undefined}
          >
            <SaveCloudIcon />
            {saveLabel}
          </button>
        )}
      </div>

      {showInlineSignIn && !user && (
        <InlineSignInPrompt onClose={() => { setShowInlineSignIn(false); setPendingAction(null); }} />
      )}
    </div>
  );
}
