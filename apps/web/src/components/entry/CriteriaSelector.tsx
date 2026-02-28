import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore.ts';

type Criterion = 'sunshine' | 'precipitation' | 'temperature' | 'wind';

const CRITERIA: Criterion[] = ['sunshine', 'precipitation', 'temperature', 'wind'];

// Minimal inline SVG icons — no emoji, per design decision
function SunshineIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="3" fill="currentColor" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x1 = 8 + 4.5 * Math.cos(rad);
        const y1 = 8 + 4.5 * Math.sin(rad);
        const x2 = 8 + 6.5 * Math.cos(rad);
        const y2 = 8 + 6.5 * Math.sin(rad);
        return (
          <line
            key={deg}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

function PrecipitationIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      {/* Three raindrops as downward circles */}
      <circle cx="5" cy="6" r="1.5" fill="currentColor" />
      <circle cx="8" cy="9" r="1.5" fill="currentColor" />
      <circle cx="11" cy="6" r="1.5" fill="currentColor" />
    </svg>
  );
}

function TemperatureIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      {/* Thermometer: vertical rectangle + circle at bottom */}
      <rect x="7" y="2" width="2" height="9" rx="1" fill="currentColor" />
      <circle cx="8" cy="12" r="2.5" fill="currentColor" />
    </svg>
  );
}

function WindIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      {/* Three wavy horizontal lines */}
      <path d="M2 5 Q5 3 8 5 Q11 7 14 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M2 8 Q5 6 8 8 Q11 10 14 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M2 11 Q5 9 8 11 Q11 13 13 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

const ICONS: Record<Criterion, React.ReactElement> = {
  sunshine: <SunshineIcon />,
  precipitation: <PrecipitationIcon />,
  temperature: <TemperatureIcon />,
  wind: <WindIcon />,
};

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
              <span className="criteria-chip-icon">{ICONS[criterion]}</span>
              <span>{t(`entry.criteria_options.${criterion}`)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
