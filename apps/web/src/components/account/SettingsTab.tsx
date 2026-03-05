import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore.ts';

interface SettingsTabProps {
  onClose: () => void;
}

export function SettingsTab({ onClose }: SettingsTabProps) {
  const { user, session, signOut } = useAuthStore();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'Bist du sicher? Dein Konto und alle gespeicherten Daten werden dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.'
    );
    if (!confirmed) return;

    setDeleteError(null);
    setDeleteLoading(true);

    try {
      const token = session?.access_token;
      if (!token) throw new Error('Keine Sitzung gefunden. Bitte erneut anmelden.');

      const res = await fetch('/api/user/delete', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `Fehler ${res.status}: Konto konnte nicht gelöscht werden.`
        );
      }

      await signOut();
      onClose();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten.');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="settings-tab">
      {/* Privacy & legal links */}
      <section className="settings-tab-section">
        <h3 className="settings-tab-section-title">Datenschutz</h3>
        <div className="settings-tab-links">
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="settings-tab-link"
          >
            Datenschutzerklärung
          </a>
          <a
            href="/tos"
            target="_blank"
            rel="noopener noreferrer"
            className="settings-tab-link"
          >
            Nutzungsbedingungen
          </a>
        </div>
      </section>

      <div className="settings-tab-divider" />

      {/* Delete account */}
      <section className="settings-tab-section">
        {user ? (
          <>
            <h3 className="settings-tab-section-title settings-tab-section-title--danger">
              Konto löschen
            </h3>
            <p className="settings-tab-delete-description">
              Dein Konto und alle gespeicherten Daten werden dauerhaft gelöscht.
            </p>
            {deleteError && (
              <p className="settings-tab-error">{deleteError}</p>
            )}
            <button
              type="button"
              className="settings-tab-delete-btn"
              onClick={handleDeleteAccount}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Wird gelöscht…' : 'Konto löschen'}
            </button>
          </>
        ) : (
          <p className="settings-tab-guest-note">
            Anmelden, um Einstellungen zu verwalten.
          </p>
        )}
      </section>
    </div>
  );
}
