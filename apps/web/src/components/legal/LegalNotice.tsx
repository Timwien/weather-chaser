import { useEffect, useState } from 'react';
import { Trans } from 'react-i18next';
import { loadLegalNamespace } from '../../i18n/index.ts';
import './LegalNotice.css';

interface LegalNoticeProps {
  /** signup: terms + privacy (sign-in / registration); feedback: privacy only. */
  variant: 'signup' | 'feedback';
}

const linkProps = { target: '_blank', rel: 'noopener noreferrer', className: 'legal-notice-link' } as const;

/**
 * One-line legal note at the points of collection (registration/sign-in and
 * the feedback form), linking to the terms and the privacy policy. The `legal`
 * namespace loads on demand, so the line appears once it is there.
 */
export function LegalNotice({ variant }: LegalNoticeProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    loadLegalNamespace()
      .then(() => { if (alive) setReady(true); })
      .catch(() => { /* offline: the links stay reachable via Settings */ });
    return () => { alive = false; };
  }, []);

  if (!ready) return null;

  return (
    <p className="legal-notice">
      <Trans
        ns="legal"
        i18nKey={variant === 'signup' ? 'ui.signup_notice' : 'ui.feedback_notice'}
        components={{
          tos: <a href="/tos" {...linkProps} />,
          privacy: <a href="/privacy" {...linkProps} />,
        }}
      />
    </p>
  );
}
