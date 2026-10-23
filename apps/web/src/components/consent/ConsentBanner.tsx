import { useTranslation } from 'react-i18next';
import { useConsentStore } from '../../lib/consent.ts';
import './ConsentBanner.css';

/**
 * Opt-in banner for analytics. Non-blocking (the app stays usable behind it),
 * two equal-weight buttons, no pre-selection. Esc while focus is inside the
 * banner is equivalent to "Decline".
 */
export function ConsentBanner() {
  const { t } = useTranslation();
  const open = useConsentStore((s) => s.bannerOpen);
  const accept = useConsentStore((s) => s.accept);
  const decline = useConsentStore((s) => s.decline);

  if (!open) return null;

  return (
    // `ph-no-capture`: PostHog never records clicks on the consent decision
    // itself (and blocks the banner in replays) — the "Decline" click must not
    // become the last tracked event.
    <section
      className="consent-banner ph-no-capture"
      role="region"
      aria-labelledby="consent-title"
      aria-describedby="consent-text"
      onKeyDown={(e) => {
        if (e.key === 'Escape') decline();
      }}
    >
      <h2 id="consent-title" className="consent-banner-title">{t('consent.title')}</h2>
      <p id="consent-text" className="consent-banner-text">
        {t('consent.text')}{' '}
        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="consent-banner-link">
          {t('consent.privacy_link')}
        </a>
      </p>
      <div className="consent-banner-actions">
        <button type="button" className="consent-banner-btn" onClick={decline}>
          {t('consent.decline')}
        </button>
        <button type="button" className="consent-banner-btn" onClick={accept}>
          {t('consent.accept')}
        </button>
      </div>
    </section>
  );
}
