import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore.ts';
import { getSupabase, supabaseConfigured } from '../../lib/supabase.ts';
import './UpgradeModal.css';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Premium upsell modal (Phase 4). Signed-in users are sent to Stripe Checkout
 * via /api/stripe/checkout; guests are asked to sign in first (account is
 * free — only premium features carry the paywall, per PREM-04).
 */
export function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
  const { t } = useTranslation('common');
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleUpgrade() {
    if (!user || !supabaseConfigured) return;
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await getSupabase().auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('no_session');

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 503) {
        setError(t('premium.not_available'));
        return;
      }
      if (!res.ok) throw new Error(`checkout_${res.status}`);
      const { url } = (await res.json()) as { url?: string };
      if (url) window.location.href = url;
    } catch {
      setError(t('premium.checkout_error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="upgrade-modal-backdrop" onClick={onClose}>
      <div
        className="upgrade-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t('premium.modal_title')}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="upgrade-modal-title">{t('premium.modal_title')}</h2>
        <p className="upgrade-modal-text">{t('premium.modal_text')}</p>

        <ul className="upgrade-modal-benefits">
          <li>{t('premium.benefit_weights')}</li>
          <li>{t('premium.benefit_priority')}</li>
          <li>{t('premium.benefit_support')}</li>
        </ul>

        {user ? (
          <button
            type="button"
            className="upgrade-modal-cta"
            onClick={handleUpgrade}
            disabled={loading}
          >
            {loading ? t('premium.redirecting') : t('premium.upgrade_cta')}
          </button>
        ) : (
          <p className="upgrade-modal-note">{t('premium.sign_in_first')}</p>
        )}

        {error && <p className="upgrade-modal-error">{error}</p>}

        <button type="button" className="upgrade-modal-close" onClick={onClose}>
          {t('account.close')}
        </button>
      </div>
    </div>
  );
}
