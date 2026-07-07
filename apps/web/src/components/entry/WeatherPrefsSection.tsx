import { useTranslation } from 'react-i18next';
import type { WeatherPreset } from '@weatherchaser/core';
import { useAppStore } from '../../stores/appStore.ts';
import { BeachIcon, HikingIcon, SightseeingIcon } from '../finder/FinderIcons.tsx';
import { CustomWeights } from '../premium/CustomWeights.tsx';
import './WeatherPrefsSection.css';

const PRESETS: WeatherPreset[] = ['beach', 'hiking', 'sightseeing'];

const PRESET_ICONS: Record<WeatherPreset, React.ComponentType<{ size?: number }>> = {
  beach: BeachIcon,
  hiking: HikingIcon,
  sightseeing: SightseeingIcon,
};

const PRESET_DESC: Record<WeatherPreset, string> = {
  beach: 'preset.beach_desc',
  hiking: 'preset.hiking_desc',
  sightseeing: 'preset.sightseeing_desc',
};

/**
 * U2: single shared "weather preference" section used for BOTH scenarios
 * (best weather / best route). Big preset cards with a short explainer line
 * (addresses "hard to understand"), plus the premium custom-weights option.
 */
export function WeatherPrefsSection() {
  const { t } = useTranslation('common');
  const { weatherPrefs, setWeatherPrefs } = useAppStore();

  // A preset card is "active" only when no custom weights override it.
  const presetActive = weatherPrefs.customWeights === null;

  return (
    <div className="weather-prefs">
      <label className="input-label">{t('entry.weather_prefs')}</label>
      <div className="weather-prefs-grid">
        {PRESETS.map((preset) => {
          const Icon = PRESET_ICONS[preset];
          const active = presetActive && weatherPrefs.preset === preset;
          return (
            <button
              key={preset}
              type="button"
              className={`weather-pref-card${active ? ' weather-pref-card--active' : ''}`}
              onClick={() => setWeatherPrefs({ preset, customWeights: null })}
              aria-pressed={active}
            >
              <Icon size={22} />
              <span className="weather-pref-card-name">{t(`preset.${preset}`)}</span>
              <span className="weather-pref-card-desc">{t(PRESET_DESC[preset])}</span>
            </button>
          );
        })}
      </div>

      {/* Premium: custom scoring weights (free tier sees locked sliders + upgrade) */}
      <CustomWeights />
    </div>
  );
}
