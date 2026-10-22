import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore.ts';
import { useWeatherLayerStore } from '../../stores/weatherLayerStore.ts';
import { dayKeysForChips } from '../../hooks/useWeatherTimeline.ts';
import { localDayBounds } from '../../utils/wmsTime.ts';
import '../map/WeatherControls.css';

const MORNING_MS = 9 * 3_600_000;

interface Props {
  /** ISO day (YYYY-MM-DD) to start on, e.g. the finder's selected day; defaults to the trip start. */
  day?: string | null;
  /** Called after the layer was switched (mobile: raise the sheet to half so the map is visible). */
  onShown?: () => void;
}

/** "Wetterverlauf": switches the map to Clouds & rain and plays it over the trip days. */
export function WeatherTimelineButton({ day, onShown }: Props) {
  const { t } = useTranslation('common');
  const startDate = useAppStore((s) => s.tripConfig.startDate);
  const endDate = useAppStore((s) => s.tripConfig.endDate);
  const openTimeline = useWeatherLayerStore((s) => s.openTimeline);

  function show() {
    const days = dayKeysForChips(startDate, endDate, Date.now());
    const key = day && days.includes(day) ? day : days[0];
    openTimeline(localDayBounds(key)[0] + MORNING_MS);
    onShown?.();
  }

  return (
    <button type="button" className="wx-timeline-btn" title={t('weather.timeline_title')} onClick={show}>
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor"
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4.5 10.5a2.5 2.5 0 0 1 .3-4.98A3.5 3.5 0 0 1 11.5 6a2.25 2.25 0 0 1 0 4.5z" />
        <path d="M6.5 13.2l4-2.2-4-2.2z" fill="currentColor" stroke="none" />
      </svg>
      {t('weather.timeline')}
    </button>
  );
}
