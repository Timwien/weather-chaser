import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore.ts';
import { formatWeekday } from '../../utils/dateFormat.ts';
import {
  FullDayIcon, MorningIcon, EveningIcon,
  BeachIcon, HikingIcon, SightseeingIcon,
} from './FinderIcons.tsx';
import './FinderFilterBar.css';

const TIME_OPTIONS = [
  { value: 'full',    labelKey: 'finder.time.full',    default: 'Ganzer Tag', Icon: FullDayIcon },
  { value: 'morning', labelKey: 'finder.time.morning', default: 'Morgen',     Icon: MorningIcon },
  { value: 'evening', labelKey: 'finder.time.evening', default: 'Abend',      Icon: EveningIcon },
] as const;

const PRESET_OPTIONS = [
  { value: 'beach',       labelKey: 'preset.beach',       default: 'Strand',      Icon: BeachIcon },
  { value: 'hiking',      labelKey: 'preset.hiking',      default: 'Wandern',     Icon: HikingIcon },
  { value: 'sightseeing', labelKey: 'preset.sightseeing', default: 'Sightseeing', Icon: SightseeingIcon },
] as const;

/** Generate an array of ISO date strings between startDate and endDate (inclusive) */
function dateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate + 'T00:00:00Z');
  const end   = new Date(endDate   + 'T00:00:00Z');
  const cur   = new Date(start);
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

export function FinderFilterBar() {
  const { t, i18n } = useTranslation('common');
  const { finderConfig, setFinderConfig, weatherPrefs, setWeatherPrefs, tripConfig } = useAppStore();

  const days =
    tripConfig.startDate && tripConfig.endDate
      ? dateRange(tripConfig.startDate, tripConfig.endDate)
      : [];

  return (
    <div className="finder-filter-bar">
      {/* Day picker row */}
      {days.length > 0 && (
        <div className="finder-filter-group">
          <span className="finder-filter-label">{t('finder.day_label', 'Tag')}</span>
          <div className="finder-filter-toggle finder-filter-toggle--scroll">
            <button
              type="button"
              className={`finder-filter-toggle-btn${finderConfig.selectedDay === 'all' ? ' finder-filter-toggle-btn--active' : ''}`}
              onClick={() => setFinderConfig({ selectedDay: 'all' })}
            >
              {t('finder.day.all', '\u00d8 Alle Tage')}
            </button>
            {days.map((dateStr) => (
              <button
                key={dateStr}
                type="button"
                className={`finder-filter-toggle-btn${finderConfig.selectedDay === dateStr ? ' finder-filter-toggle-btn--active' : ''}`}
                onClick={() => setFinderConfig({ selectedDay: dateStr })}
              >
                {formatWeekday(dateStr, i18n.language)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Time-of-day toggle — pill chips with icon */}
      <div className="finder-filter-group">
        <span className="finder-filter-label">{t('finder.time_label', 'Tageszeit')}</span>
        <div className="finder-filter-toggle">
          {TIME_OPTIONS.map(({ value, labelKey, default: def, Icon }) => (
            <button
              key={value}
              type="button"
              className={`finder-filter-toggle-btn${finderConfig.timeOfDay === value ? ' finder-filter-toggle-btn--active' : ''}`}
              onClick={() => setFinderConfig({ timeOfDay: value })}
            >
              <Icon size={13} />
              {t(labelKey, def)}
            </button>
          ))}
        </div>
      </div>

      {/* Preset selector — card tiles with icon above label */}
      <div className="finder-filter-group">
        <span className="finder-filter-label">{t('preset.label', 'Wetterprofil')}</span>
        <div className="finder-preset-grid">
          {PRESET_OPTIONS.map(({ value, labelKey, default: def, Icon }) => (
            <button
              key={value}
              type="button"
              className={`finder-preset-card${weatherPrefs.customWeights === null && weatherPrefs.preset === value ? ' finder-preset-card--active' : ''}`}
              onClick={() => setWeatherPrefs({ preset: value, customWeights: null })}
            >
              <Icon size={22} />
              <span>{t(labelKey, def)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
