import { useTranslation } from 'react-i18next';
import { useWeatherLayerStore } from '../../stores/weatherLayerStore.ts';
import '../map/WeatherControls.css';

interface Props {
  /** Called after the request was sent (mobile: raise the sheet to half so the map is visible). */
  onShown?: () => void;
}

/** "Route abspielen": fits the whole route, then drives the camper along it while the weather changes. */
export function RoutePlayButton({ onShown }: Props) {
  const { t } = useTranslation('common');
  const requestRoutePlay = useWeatherLayerStore((s) => s.requestRoutePlay);
  return (
    <button
      type="button"
      className="wx-timeline-btn wx-route-play-btn"
      title={t('route.play_title')}
      onClick={() => { requestRoutePlay(); onShown?.(); }}
    >
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor"
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 11.5c2-5 4.5-1 6-4.5s3.5-2 6-3.5" />
        <path d="M6.5 13.2l4-2.2-4-2.2z" fill="currentColor" stroke="none" />
      </svg>
      {t('route.play')}
    </button>
  );
}
