import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWeatherLayerStore } from '../../stores/weatherLayerStore.ts';
import { cloudForecastAxis, dayKeysForChips, forecastAxis, useWeatherTimeline } from '../../hooks/useWeatherTimeline.ts';
import { useAppStore } from '../../stores/appStore.ts';
import { usePanelInset } from '../../hooks/usePanelInset.ts';
import { LAYER_NAMES } from '../../services/dwdLayers.ts';
import { axisEnd, localDayBounds, localDayKey, snapToAxis, timesOnLocalDay } from '../../utils/wmsTime.ts';
import { formatClock, formatDateTime, formatWeekday } from '../../utils/dateFormat.ts';
import './WeatherControls.css';

// Colour classes of the DWD precipitation legends (sampled from GetLegendGraphic) — drawn
// locally so labels follow the UI language and stay legible on small screens.
/** Bottom edge (px) of the floating control column on phones (search pill + draw + weather button). */
const MOBILE_CONTROLS_BOTTOM = 164;

const RADAR_COLORS = ['#33ffff', '#1acc9a', '#019934', '#4db31b', '#99cc01', '#cce601', '#ffff01', '#ffc401', '#ff8901', '#ff4501', '#fe0000', '#e5004c', '#cc0098', '#6600cb', '#0000fe'];
// First class recoloured from DWD grey, see recolorDrizzle() in wmsProtocol.ts.
const FORECAST_COLORS = ['#96c8f0', '#fefec0', '#fefe5b', '#cff200', '#a0d625', '#36c969', '#00d7d7', '#00a6dd', '#0000fe', '#9730c2', '#d926c7', '#fe0000', '#a00000', '#606060'];

interface Props {
  /** Pixels of the viewport covered by the mobile bottom sheet (0 on desktop). */
  sheetBottomPadding?: number;
}

/** Compact time control + legend for the active weather layer. */
export function WeatherTimeBar({ sheetBottomPadding = 0 }: Props) {
  const { t, i18n } = useTranslation('common');
  const tl = useWeatherTimeline();
  const setTimeMs = useWeatherLayerStore((s) => s.setTimeMs);
  const playing = useWeatherLayerStore((s) => s.playing);
  const setPlaying = useWeatherLayerStore((s) => s.setPlaying);
  const cloudStatus = useWeatherLayerStore((s) => s.cloudStatus);
  const startDate = useAppStore((s) => s.tripConfig.startDate);
  const endDate = useAppStore((s) => s.tripConfig.endDate);
  const inset = usePanelInset();
  const [legendOpen, setLegendOpen] = useState(false);
  const lang = i18n.language;
  // Phone with the bottom sheet raised: the free strip between the floating controls and
  // the sheet can be shorter than the full bar → fall back to a single-row variant.
  const [viewportH, setViewportH] = useState(() => window.innerHeight);
  useEffect(() => {
    const onResize = () => setViewportH(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const { type, status, axes, frames, time, frame } = tl;
  if (!type) return null;

  const style = {
    bottom: sheetBottomPadding > 0 ? sheetBottomPadding + 8 : undefined,
    left: inset > 0 ? `calc(50% + ${inset / 2}px)` : undefined,
  };

  if (status === 'error') {
    return (
      <div className="wx-bar wx-bar--note" style={style} role="status">{t('weather.unavailable')}</div>
    );
  }
  if (!axes || time === null || frames.length === 0) {
    return <div className="wx-bar wx-bar--note" style={style} role="status">{t('weather.loading')}</div>;
  }

  const free = viewportH - sheetBottomPadding - 8 - MOBILE_CONTROLS_BOTTOM;
  const need = (type === 'forecast' ? 150 : type === 'clouds' ? 95 : 70) + (legendOpen ? 44 : 0);
  const compact = inset === 0 && sheetBottomPadding > 0 && free < need;
  if (compact && free < 64) return null; // no room at all (e.g. sheet fully open)

  const isLatest = type !== 'forecast' && time === frames[frames.length - 1];
  const timeLabel = formatDateTime(time, lang);

  // ── forecast: day chips + 3-h slider ────────────────────────────────────
  let chips: React.ReactNode = null;
  let slider: React.ReactNode;
  let beyondNote: string | null = null;
  let rainNote: string | null = null;

  if (type === 'forecast') {
    const grid = cloudForecastAxis(axes, tl.now)!; // rain grid + clouds-only tail (Open-Meteo, 7 days)
    const end = axisEnd(grid);
    const rainEnd = axisEnd(forecastAxis(axes)!);
    const days = dayKeysForChips(startDate, endDate, tl.now);
    const dayOf = localDayKey(time);
    const inRange = (k: string) => timesOnLocalDay(grid, k).length > 0;
    const beyond = days.filter((k) => localDayBounds(k)[0] > end);
    if (beyond.length > 0) {
      beyondNote = t('weather.beyond', {
        count: beyond.length,
        date: formatWeekday(beyond[0], lang),
        until: formatDateTime(end, lang),
      });
    }
    const rainShort = days.some((k) => localDayBounds(k)[1] > rainEnd + 3 * 3_600_000 && localDayBounds(k)[0] <= end);
    if (rainShort) rainNote = t('weather.rain_until', { until: formatDateTime(rainEnd, lang) });
    chips = compact ? null : (
      <div className="wx-chips" role="group" aria-label={t('weather.day')}>
        {days.map((k) => {
          const ok = inRange(k);
          return (
            <button
              key={k}
              type="button"
              className={`wx-chip${k === dayOf ? ' wx-chip--on' : ''}${ok ? '' : ' wx-chip--off'}`}
              aria-pressed={k === dayOf}
              aria-disabled={!ok}
              onClick={() => {
                if (!ok) return;
                setPlaying(false);
                const [from] = localDayBounds(k);
                setTimeMs(snapToAxis(grid, from + 12 * 3_600_000));
              }}
            >
              {formatWeekday(k, lang)}
            </button>
          );
        })}
      </div>
    );
    // compact: the slider spans the whole forecast instead of one day (chips are hidden)
    const dayTimes = compact ? frames : timesOnLocalDay(grid, dayOf);
    const idx = Math.max(0, dayTimes.indexOf(time));
    slider = (
      <input
        type="range"
        className="wx-slider"
        min={0}
        max={Math.max(0, dayTimes.length - 1)}
        step={1}
        value={idx}
        aria-label={t('weather.time_slider')}
        aria-valuetext={timeLabel}
        onChange={(e) => { setPlaying(false); setTimeMs(dayTimes[Number(e.target.value)]); }}
      />
    );
  } else {
    const idx = Math.max(0, frames.indexOf(time));
    slider = (
      <input
        type="range"
        className="wx-slider"
        min={0}
        max={frames.length - 1}
        step={1}
        value={idx}
        aria-label={t('weather.time_slider')}
        aria-valuetext={timeLabel}
        onChange={(e) => { setPlaying(false); setTimeMs(frames[Number(e.target.value)]); }}
      />
    );
  }

  const legendLayer = frame?.layer ?? (type === 'radar' ? LAYER_NAMES.radar : LAYER_NAMES.forecastEu);
  const hasLegend = type !== 'clouds';

  return (
    <div className="wx-bar" style={style} role="group" aria-label={t('weather.toggle')}>
      {chips}
      <div className="wx-row">
        {(type === 'radar' || type === 'forecast') && (
          <button
            type="button"
            className="wx-play"
            aria-label={playing ? t('weather.pause') : t('weather.play')}
            onClick={() => setPlaying(!playing)}
          >
            {playing ? (
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="2.5" y="2" width="3" height="10" rx="1" fill="currentColor" /><rect x="8.5" y="2" width="3" height="10" rx="1" fill="currentColor" /></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3.5 1.8v10.4L12 7z" fill="currentColor" /></svg>
            )}
          </button>
        )}
        {slider}
        <div className="wx-time" aria-live="polite">
          {type === 'radar' ? (
            <>
              <strong>{isLatest ? t('weather.now') : formatClock(time, lang)}</strong>
              <span>{isLatest ? formatClock(time, lang) : t('weather.radar_ago', { min: Math.round((frames[frames.length - 1] - time) / 60000) })}</span>
            </>
          ) : (
            <>
              <strong>{formatClock(time, lang)}</strong>
              <span>{formatWeekday(localDayKey(time), lang)}</span>
            </>
          )}
        </div>
        {hasLegend && !compact && (
          <button
            type="button"
            className="wx-legend-btn"
            aria-expanded={legendOpen}
            onClick={() => setLegendOpen((v) => !v)}
          >
            {t('weather.legend')}
          </button>
        )}
      </div>
      {!compact && type === 'radar' && <div className="wx-note">{t('weather.radar_coverage_note')}</div>}
      {!compact && type === 'clouds' && <div className="wx-note">{t('weather.clouds_note')}</div>}
      {!compact && type === 'forecast' && <div className="wx-note">{t(legendLayer === LAYER_NAMES.forecastEu ? 'weather.forecast_combo_3h' : 'weather.forecast_combo_6h')}</div>}
      {!compact && rainNote && <div className="wx-note wx-note--warn" role="status">{rainNote}</div>}
      {!compact && type === 'forecast' && cloudStatus === 'error' && (
        <div className="wx-note wx-note--warn" role="status">{t('weather.clouds_unavailable')}</div>
      )}
      {!compact && beyondNote && <div className="wx-note wx-note--warn" role="status">{beyondNote}</div>}
      {hasLegend && !compact && legendOpen && (
        <div className="wx-legend" role="img" aria-label={t('weather.legend_alt')}>
          {type === 'forecast' && (
            <>
              <div className="wx-legend-title">{t('weather.legend_clouds')}</div>
              <div className="wx-legend-strip wx-legend-strip--clouds" />
              <div className="wx-legend-labels">
                <span>{t('weather.legend_clouds_none')}</span>
                <span>0 – 100 %</span>
                <span>{t('weather.legend_clouds_full')}</span>
              </div>
              <div className="wx-legend-title">{t('weather.legend_rain')}</div>
            </>
          )}
          <div className="wx-legend-strip">
            {(type === 'radar' ? RADAR_COLORS : FORECAST_COLORS).map((c) => (
              <span key={c} style={{ background: c }} />
            ))}
          </div>
          <div className="wx-legend-labels">
            <span>{t('weather.legend_light')}</span>
            <span>{t(legendLayer === LAYER_NAMES.radar ? 'weather.legend_range_radar' : legendLayer === LAYER_NAMES.forecastEu ? 'weather.legend_range_3h' : 'weather.legend_range_6h')}</span>
            <span>{t('weather.legend_heavy')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
