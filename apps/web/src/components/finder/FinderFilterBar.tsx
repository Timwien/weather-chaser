import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore.ts';
import './FinderFilterBar.css';

const TIME_OPTIONS = [
  { value: 'morning',   labelKey: 'finder.time_morning',   default: 'Morgen' },
  { value: 'full',      labelKey: 'finder.time_full',       default: 'Ganzer Tag' },
  { value: 'afternoon', labelKey: 'finder.time_afternoon',  default: 'Nachmittag' },
] as const;

const PRESET_OPTIONS = [
  { value: 'beach',       labelKey: 'preset.beach',       default: 'Strand' },
  { value: 'hiking',      labelKey: 'preset.hiking',      default: 'Wandern' },
  { value: 'sightseeing', labelKey: 'preset.sightseeing', default: 'Sightseeing' },
] as const;

export function FinderFilterBar() {
  const { t } = useTranslation('common');
  const { finderConfig, setFinderConfig } = useAppStore();

  return (
    <div className="finder-filter-bar">
      {/* Time-of-day toggle */}
      <div className="finder-filter-group">
        <span className="finder-filter-label">{t('finder.time_label', 'Tageszeit')}</span>
        <div className="finder-filter-toggle">
          {TIME_OPTIONS.map(({ value, labelKey, default: def }) => (
            <button
              key={value}
              type="button"
              className={`finder-filter-toggle-btn${finderConfig.timeOfDay === value ? ' finder-filter-toggle-btn--active' : ''}`}
              onClick={() => setFinderConfig({ timeOfDay: value })}
            >
              {t(labelKey, def)}
            </button>
          ))}
        </div>
      </div>

      {/* Preset selector */}
      <div className="finder-filter-group">
        <span className="finder-filter-label">{t('preset.label', 'Profil')}</span>
        <div className="finder-filter-toggle">
          {PRESET_OPTIONS.map(({ value, labelKey, default: def }) => (
            <button
              key={value}
              type="button"
              className={`finder-filter-toggle-btn${finderConfig.preset === value ? ' finder-filter-toggle-btn--active' : ''}`}
              onClick={() => setFinderConfig({ preset: value })}
            >
              {t(labelKey, def)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
