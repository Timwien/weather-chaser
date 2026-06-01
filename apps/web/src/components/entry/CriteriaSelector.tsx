import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore.ts';
import { CRITERION_ICONS } from './criterionIcons.tsx';
import type { Criterion } from './criterionIcons.tsx';

const CRITERIA: Criterion[] = ['sunshine', 'precipitation', 'temperature', 'wind'];

export function CriteriaSelector() {
  const { t } = useTranslation('common');
  const { tripConfig, setTripConfig } = useAppStore();

  function toggleCriterion(criterion: Criterion) {
    const current = tripConfig.criteria;
    const isSelected = current.includes(criterion);

    // Prevent deselecting the last criterion
    if (isSelected && current.length === 1) return;

    const updated = isSelected
      ? current.filter((c) => c !== criterion)
      : [...current, criterion];

    setTripConfig({ criteria: updated });
  }

  return (
    <div className="criteria-selector">
      <label className="input-label">{t('entry.criteria')}</label>
      <div className="criteria-chips">
        {CRITERIA.map((criterion) => {
          const selected = tripConfig.criteria.includes(criterion);
          return (
            <button
              key={criterion}
              type="button"
              className={`criteria-chip${selected ? ' criteria-chip--selected' : ''}`}
              onClick={() => toggleCriterion(criterion)}
              aria-pressed={selected}
            >
              <span className="criteria-chip-icon">{CRITERION_ICONS[criterion]}</span>
              <span>{t(`entry.criteria_options.${criterion}`)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
