import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore.ts';

interface SettingsTabProps {
  onClose: () => void;
}

export function SettingsTab({ onClose }: SettingsTabProps) {
  const { t, i18n } = useTranslation();
  const { user, session, signOut } = useAuthStore();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(t('account.settings_delete_confirm'));
    if (!confirmed) return;

    setDeleteError(null);
    setDeleteLoading(true);

    try {
      const token = session?.access_token;
      if (!token) throw new Error(t('account.settings_no_session'));

      const res = await fetch('/api/user/delete', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ??
            t('account.settings_delete_error', { status: res.status })
        );
      }

      await signOut();
      onClose();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t('account.error_fallback'));
    } finally {
      setDeleteLoading(false);
    }
  };

  const currentLang = i18n.language.startsWith('de') ? 'de' : 'en';

  return (
    <div className="settings-tab">
      {/* Language switcher — available to all users */}
      <section className="settings-tab-section">
        <h3 className="settings-tab-section-title">{t('account.settings_language_title')}</h3>
        <div className="settings-tab-lang-row">
          <button
            type="button"
            className={`settings-tab-lang-btn${currentLang === 'de' ? ' settings-tab-lang-btn--active' : ''}`}
            onClick={() => i18n.changeLanguage('de')}
          >
            Deutsch
          </button>
          <button
            type="button"
            className={`settings-tab-lang-btn${currentLang === 'en' ? ' settings-tab-lang-btn--active' : ''}`}
            onClick={() => i18n.changeLanguage('en')}
          >
            English
          </button>
        </div>
      </section>

      <div className="settings-tab-divider" />

      {/* Privacy & legal links */}
      <section className="settings-tab-section">
        <h3 className="settings-tab-section-title">{t('account.settings_privacy_title')}</h3>
        <div className="settings-tab-links">
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="settings-tab-link">
            {t('account.settings_privacy_link')}
          </a>
          <a href="/tos" target="_blank" rel="noopener noreferrer" className="settings-tab-link">
            {t('account.settings_tos_link')}
          </a>
        </div>
      </section>

      <div className="settings-tab-divider" />

      {/* Delete account */}
      <section className="settings-tab-section">
        {user ? (
          <>
            <h3 className="settings-tab-section-title settings-tab-section-title--danger">
              {t('account.settings_delete_title')}
            </h3>
            <p className="settings-tab-delete-description">
              {t('account.settings_delete_description')}
            </p>
            {deleteError && <p className="settings-tab-error">{deleteError}</p>}
            <button
              type="button"
              className="settings-tab-delete-btn"
              onClick={handleDeleteAccount}
              disabled={deleteLoading}
            >
              {deleteLoading ? t('account.settings_deleting') : t('account.settings_delete_btn')}
            </button>
          </>
        ) : (
          <p className="settings-tab-guest-note">{t('account.settings_guest_note')}</p>
        )}
      </section>
    </div>
  );
}
