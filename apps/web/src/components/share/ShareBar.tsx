import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore.ts';
import { buildGoogleMapsUrl, buildAppleMapsUrl } from '../../utils/exportMaps.ts';
import { buildShareUrl } from '../../utils/shareUrl.ts';
import './ShareBar.css';

export function ShareBar() {
  const { t } = useTranslation('common');
  const { route, tripConfig, weatherPrefs, searchAreas } = useAppStore();
  const [copied, setCopied] = useState(false);

  if (!route) return null;

  const { url: googleUrl, truncated } = buildGoogleMapsUrl(route.stops);
  const appleUrl = buildAppleMapsUrl(route.stops);

  const handleCopyLink = async () => {
    // Region label for the share URL: derive from the first named search area.
    const firstNamed = searchAreas.find((a) => a.type === 'place' || (a.type === 'radius' && a.name));
    const regionName = firstNamed && 'name' in firstNamed ? firstNamed.name : undefined;
    const shareUrl = buildShareUrl(
      {
        startDate: tripConfig.startDate ?? '',
        endDate: tripConfig.endDate ?? '',
        totalDays: tripConfig.totalDays,
        maxStay: tripConfig.maxStay,
        preset: weatherPrefs.preset,
        regionName,
      },
      route,
    );
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="share-bar" id="itinerary-share">
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
      </div>
    </div>
  );
}
