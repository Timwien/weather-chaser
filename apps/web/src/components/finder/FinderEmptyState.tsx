import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore.ts';
import { getFinderMode } from '../../utils/finderMode.ts';
import { useExpandRadius } from '../../hooks/useExpandRadius.ts';

interface FinderEmptyStateProps {
  reason?: 'no_towns' | 'no_results';
}

export function FinderEmptyState({ reason = 'no_results' }: FinderEmptyStateProps) {
  const { t } = useTranslation('common');
  const { searchAreas } = useAppStore();
  const mode = getFinderMode(searchAreas);
  const { nextKm, expand } = useExpandRadius();

  return (
    <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
      <p style={{ marginBottom: 'var(--space-3)' }}>
        {reason === 'no_towns'
          ? t('finder.empty_no_towns', 'Keine Orte gefunden.')
          : t('finder.empty_no_results', 'Keine Ergebnisse für diesen Filter.')}
      </p>
      {mode !== 'multi-place' && (
        <p style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-4)' }}>
          {mode === 'polygon'
            ? t('finder.empty_hint_polygon')
            : t('finder.empty_hint', 'Versuche, den Radius zu vergrößern.')}
        </p>
      )}
      {mode === 'around' && nextKm !== null && (
        <button
          type="button"
          onClick={expand}
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
          {t('finder.expand_radius', 'Radius auf {{km}} km erweitern', { km: nextKm })}
        </button>
      )}
    </div>
  );
}
