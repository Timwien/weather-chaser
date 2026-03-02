import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore.ts';

interface FinderEmptyStateProps {
  reason?: 'no_towns' | 'no_results';
}

export function FinderEmptyState({ reason = 'no_results' }: FinderEmptyStateProps) {
  const { t } = useTranslation('common');
  const { finderConfig, setFinderConfig } = useAppStore();

  function expandRadius() {
    const next = Math.min(finderConfig.radiusKm + 100, 500);
    setFinderConfig({ radiusKm: next });
  }

  return (
    <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
      <p style={{ marginBottom: 'var(--space-3)' }}>
        {reason === 'no_towns'
          ? t('finder.empty_no_towns', 'Keine Orte gefunden.')
          : t('finder.empty_no_results', 'Keine Ergebnisse für diesen Filter.')}
      </p>
      <p style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-4)' }}>
        {t('finder.empty_hint', 'Versuche, den Radius zu vergrößern.')}
      </p>
      {finderConfig.radiusKm < 500 && (
        <button
          type="button"
          onClick={expandRadius}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            background: 'var(--color-accent)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          {t('finder.expand_radius', 'Radius auf {{km}} km erweitern', { km: Math.min(finderConfig.radiusKm + 100, 500) })}
        </button>
      )}
    </div>
  );
}
