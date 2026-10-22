import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWeatherLayerStore } from '../../stores/weatherLayerStore.ts';
import { useThemeStore } from '../../stores/themeStore.ts';
import {
  dayKeysForChips, forecastAxis, useWeatherTimeline,
} from '../../hooks/useWeatherTimeline.ts';
import { useAppStore } from '../../stores/appStore.ts';
import { useRouteVan } from '../../hooks/useRouteVan.ts';
import { captionAt } from '../../utils/routeSchedule.ts';
import { usePanelInset } from '../../hooks/usePanelInset.ts';
import { LAYER_NAMES } from '../../services/dwdLayers.ts';
import { axisEnd, localDayBounds, localDayKey } from '../../utils/wmsTime.ts';
import { formatClock, formatDateTime, formatWeekday } from '../../utils/dateFormat.ts';
import './WeatherControls.css';

// Colour classes of the DWD precipitation legends (sampled from GetLegendGraphic) — drawn
// locally so labels follow the UI language and stay legible on small screens.
/** Bottom edge (px) of the floating control column on phones (search pill + draw + weather button). */
const MOBILE_CONTROLS_BOTTOM = 164;

/** Room (px) the full bar needs at phone width (chips + slider row + notes; one more line with the route caption). */
const barNeed = (routeResults: boolean) => (routeResults ? 214 : 190);

/**
 * Height (px) the time bar covers above the sheet on a phone — lets the map fit the route into the
 * strip that stays visible. 0 when there is no room at all (the bar hides itself).
 */
export function phoneBarReserve(viewportH: number, sheetPx: number, routeResults: boolean): number {
  const free = viewportH - sheetPx - 8 - MOBILE_CONTROLS_BOTTOM;
  if (free < 64) return 0;
  return free < barNeed(routeResults) ? 64 : 205;
}

const RADAR_COLORS = ['#33ffff', '#1acc9a', '#019934', '#4db31b', '#99cc01', '#cce601', '#ffff01', '#ffc401', '#ff8901', '#ff4501', '#fe0000', '#e5004c', '#cc0098', '#6600cb', '#0000fe'];
// First class recoloured from DWD grey, see recolorDrizzle() in wmsProtocol.ts.
const FORECAST_COLORS = ['#96c8f0', '#fefec0', '#fefe5b', '#cff200', '#a0d625', '#36c969', '#00d7d7', '#00a6dd', '#0000fe', '#9730c2', '#d926c7', '#fe0000', '#a00000', '#606060'];

const HOUR = 3_600_000;

interface Props {
  /** Pixels of the viewport covered by the mobile bottom sheet (0 on desktop). */
  sheetBottomPadding?: number;
}

/** Compact time control + legend for the weather layer. */
export function WeatherTimeBar({ sheetBottomPadding = 0 }: Props) {
  const { t, i18n } = useTranslation('common');
  const scheme = useThemeStore((s) => (s.resolved === 'dark' ? 'dark' : 'light'));
  const tl = useWeatherTimeline(scheme);
  const scrubTo = useWeatherLayerStore((s) => s.scrubTo);
  const playing = useWeatherLayerStore((s) => s.playing);
  const setPlaying = useWeatherLayerStore((s) => s.setPlaying);
  const playback = useWeatherLayerStore((s) => s.playback);
  const cloudStatus = useWeatherLayerStore((s) => s.cloudStatus);
  const startDate = useAppStore((s) => s.tripConfig.startDate);
  const endDate = useAppStore((s) => s.tripConfig.endDate);
  const inset = usePanelInset();
  const van = useRouteVan();
  const route = useAppStore((s) => s.route);
  const mode = useAppStore((s) => s.mode);
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

  const { type, status, axes, frames, time, shown, composed, nowMs, timeline } = tl;
  if (!type) return null;

  const free = viewportH - sheetBottomPadding - 8 - MOBILE_CONTROLS_BOTTOM;
  const phone = inset === 0 && sheetBottomPadding > 0;
  const style = {
    bottom: sheetBottomPadding > 0 ? sheetBottomPadding + 8 : undefined,
    left: inset > 0 ? `calc(50% + ${inset / 2}px)` : undefined,
    // never grow into the floating controls above; scroll inside the bar instead (legend open on a small phone)
    ...(phone ? { maxHeight: Math.max(0, free), overflowY: 'auto' as const } : {}),
  };

  if (status === 'error') {
    return (
      <div className="wx-bar wx-bar--note" style={style} role="status">{t('weather.unavailable')}</div>
    );
  }
  if (!axes || time === null || !timeline || !composed || frames.length === 0) {
    return <div className="wx-bar wx-bar--note" style={style} role="status">{t('weather.loading')}</div>;
  }

  const need = barNeed(van !== null || (mode === 'results' && route !== null)); // full bar (chips + slider row + two source/coverage notes) at phone width
  const compact = phone && free < need;
  if (compact && free < 64) return null; // no room at all (e.g. sheet fully open)

  // ── what the bar says refers to the picture that is displayed, not the requested instant ──
  const buffering = playing && playback.phase === 'buffering';
  const scrubbing = !playing && shown !== time; // slider moved, picture still loading
  const busy = buffering || scrubbing;
  const label = shown;
  const isObserved = label !== null ? label <= nowMs : composed.source === 'observed';
  const isNow = label !== null && label === nowMs;
  const hoursAgo = label !== null ? Math.max(1, Math.round((nowMs - label) / HOUR)) : 0;
  const idx = Math.max(0, frames.indexOf(time));
  const nowFraction = frames.length > 1 ? timeline.nowIdx / (frames.length - 1) : 0;

  // ── coverage / horizon notes ─────────────────────────────────────────────
  const rain = forecastAxis(axes);
  const end = frames[frames.length - 1];
  const rainEnd = rain ? axisEnd(rain) : null;
  const days = dayKeysForChips(startDate, endDate, tl.now);
  const beyond = days.filter((k) => localDayBounds(k)[0] > end);
  const beyondNote = beyond.length > 0
    ? t('weather.beyond', { count: beyond.length, date: formatWeekday(beyond[0], lang), until: formatDateTime(end, lang) })
    : null;
  const rainShort = rainEnd !== null && days.some((k) => localDayBounds(k)[1] > rainEnd + 3 * HOUR && localDayBounds(k)[0] <= end);
  const rainNote = rainShort && rainEnd !== null ? t('weather.rain_until', { until: formatDateTime(rainEnd, lang) }) : null;
  const dayOf = label !== null ? localDayKey(label) : localDayKey(time);
  const hasFrameOn = (k: string) => frames.some((f) => f > nowMs && f >= localDayBounds(k)[0] && f < localDayBounds(k)[1]);

  const chips = compact ? null : (
    <div className="wx-chips" role="group" aria-label={t('weather.day')}>
      <button
        type="button"
        className={`wx-chip${isNow ? ' wx-chip--on' : ''}`}
        aria-pressed={isNow}
        onClick={() => { setPlaying(false); scrubTo(nowMs); }}
      >
        {t('weather.now')}
      </button>
      {days.map((k) => {
        const ok = hasFrameOn(k);
        const on = !isObserved && k === dayOf;
        return (
          <button
            key={k}
            type="button"
            className={`wx-chip${on ? ' wx-chip--on' : ''}${ok ? '' : ' wx-chip--off'}`}
            aria-pressed={on}
            aria-disabled={!ok}
            onClick={() => {
              if (!ok) return;
              setPlaying(false);
              const noon = localDayBounds(k)[0] + 12 * HOUR;
              scrubTo(frames.filter((f) => f > nowMs).reduce((b, f) => (Math.abs(f - noon) < Math.abs(b - noon) ? f : b), noon));
            }}
          >
            {formatWeekday(k, lang)}
          </button>
        );
      })}
    </div>
  );

  const timeLabel = label !== null ? formatDateTime(label, lang) : t('weather.shown_none');
  const secondLine = buffering && compact
    ? `${playback.ready}/${playback.total}` // compact bars have no note line for the progress text
    : label === null ? ''
    : isNow ? t('weather.now')
    : isObserved ? t('weather.ago', { hours: hoursAgo })
    : formatWeekday(localDayKey(label), lang);

  // "Nacht 1 in Colmar" / "Unterwegs nach Colmar": where the camper is at the shown instant (route results only)
  const cap = van && label !== null ? captionAt(van.schedule, label) : null; // null outside the trip
  const capTown = cap ? route?.stops[cap.stopIndex]?.town.name ?? '' : '';
  const routeCaption = cap
    ? t(cap.kind === 'to' ? 'route.driving_to' : cap.kind === 'night' ? 'route.night_at' : 'route.at', { town: capTown, night: cap.night })
    : null;

  // legend follows the rain product on screen (radar over model in the past)
  const rainLayer = composed.radar?.layer ?? composed.model?.layer ?? LAYER_NAMES.forecastEu;
  const rangeKey = rainLayer === LAYER_NAMES.radar ? 'weather.legend_range_radar'
    : rainLayer === LAYER_NAMES.pastEu ? 'weather.legend_range_1h'
    : rainLayer === LAYER_NAMES.forecastEu ? 'weather.legend_range_3h' : 'weather.legend_range_6h';
  const legendColors = rainLayer === LAYER_NAMES.radar ? RADAR_COLORS : FORECAST_COLORS;
  const forecastKey = rainLayer === LAYER_NAMES.forecastGlobal ? 'weather.forecast_combo_6h' : 'weather.forecast_combo_3h';

  return (
    <div className="wx-bar" style={style} role="group" aria-label={t('weather.toggle')} data-shown={label ?? ''} data-phase={playing ? playback.phase : 'idle'}>
      {chips}
      <div className="wx-row">
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
        <div className="wx-slider-wrap" style={{ ['--wx-now' as string]: nowFraction }}>
          <input
            type="range"
            className="wx-slider"
            min={0}
            max={frames.length - 1}
            step={1}
            value={idx}
            aria-label={t('weather.time_slider')}
            aria-valuetext={timeLabel}
            onChange={(e) => { setPlaying(false); scrubTo(frames[Number(e.target.value)]); }}
          />
          <span className="wx-now-tick" aria-hidden="true"><span>{t('weather.now_marker')}</span></span>
        </div>
        <div className="wx-time" aria-live="polite">
          <strong>
            {busy && <span className="wx-spinner" role="status" aria-label={t('weather.loading_frame')} />}
            {label !== null ? formatClock(label, lang) : t('weather.shown_none')}
          </strong>
          <span>{secondLine}</span>
        </div>
        {!compact && (
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
      {!compact && routeCaption && <div className="wx-note wx-route-caption" data-route-caption="">{routeCaption}</div>}
      {!compact && buffering && (
        <div className="wx-note wx-note--busy" role="status">
          <span className="wx-spinner" aria-hidden="true" />
          {t('weather.loading_animation', { ready: playback.ready, total: playback.total })}
        </div>
      )}
      {!compact && playing && playback.incomplete > 0 && (
        <div className="wx-note wx-note--warn" role="status" data-wx-incomplete="">{t('weather.frames_incomplete')}</div>
      )}
      {!compact && !buffering && (
        <div className="wx-note">
          <span className={`wx-badge wx-badge--${isObserved ? 'obs' : 'fc'}`}>{t(isObserved ? 'weather.observed' : 'weather.forecast')}</span>
          {t(isObserved ? 'weather.src_observed' : 'weather.src_forecast')}
        </div>
      )}
      {!compact && isObserved && <div className="wx-note">{t('weather.radar_coverage_note')}</div>}
      {!compact && !isObserved && <div className="wx-note">{t(forecastKey)}</div>}
      {!compact && !isObserved && rainNote && <div className="wx-note wx-note--warn" role="status">{rainNote}</div>}
      {!compact && cloudStatus === 'error' && !isObserved && (
        <div className="wx-note wx-note--warn" role="status">{t('weather.clouds_unavailable')}</div>
      )}
      {!compact && beyondNote && <div className="wx-note wx-note--warn" role="status">{beyondNote}</div>}
      {!compact && legendOpen && (
        <div className="wx-legend" role="img" aria-label={t('weather.legend_alt')}>
          <div className="wx-legend-title">{t('weather.legend_clouds')}</div>
          <div className="wx-legend-strip wx-legend-strip--clouds" />
          <div className="wx-legend-labels">
            <span>{t('weather.legend_clouds_none')}</span>
            <span>0 – 100 %</span>
            <span>{t('weather.legend_clouds_full')}</span>
          </div>
          <div className="wx-legend-title">{t('weather.legend_rain')}</div>
          <div className="wx-legend-strip">
            {legendColors.map((c) => (
              <span key={c} style={{ background: c }} />
            ))}
          </div>
          <div className="wx-legend-labels">
            <span>{t('weather.legend_light')}</span>
            <span>{t(rangeKey)}</span>
            <span>{t('weather.legend_heavy')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
