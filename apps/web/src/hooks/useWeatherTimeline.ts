import { useMemo } from 'react';
import { useAppStore } from '../stores/appStore.ts';
import { useWeatherLayerStore } from '../stores/weatherLayerStore.ts';
import type { LayerAxes, WeatherLayerType } from '../services/dwdLayers.ts';
import { composeFrame, type ComposedFrame } from '../services/weatherFrames.ts';
import { buildTimeline, HOUR, type Timeline } from '../utils/weatherTimeline.ts';
import { timesOnLocalDay } from '../utils/wmsTime.ts';

export {
  cloudForecastAxis, cloudHorizon, forecastAxis, playbackFrames, playbackRange, type Timeline,
} from '../utils/weatherTimeline.ts';

const nearest = (frames: number[], t: number) =>
  frames.reduce((best, x) => (Math.abs(x - t) < Math.abs(best - t) ? x : best), frames[0]);

export interface WeatherTimeline {
  type: WeatherLayerType | null;
  axes: LayerAxes | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  timeline: Timeline | null;
  frames: number[];
  /** "Now" = latest available radar instant. */
  nowMs: number;
  /** The requested instant (slider position); null until capabilities are loaded. */
  time: number | null;
  /** The instant of the picture on the map (the label shows this). */
  shown: number | null;
  /** What is drawn for `time` (null until capabilities are loaded). */
  composed: ComposedFrame | null;
  now: number;
  /** Last instant the loaded cloud tiles cover (null = unknown). */
  cloudEnd: number | null;
  scheme: 'light' | 'dark';
}

/** Single source of truth for "which instant of the layer is requested / shown". */
export function useWeatherTimeline(scheme: 'light' | 'dark' = 'light'): WeatherTimeline {
  const layer = useWeatherLayerStore((s) => s.layer);
  const timeMs = useWeatherLayerStore((s) => s.timeMs);
  const shown = useWeatherLayerStore((s) => s.shownMs);
  const type = layer === 'off' ? null : layer;
  const axes = useWeatherLayerStore((s) => (type ? s.axes[type] ?? null : null));
  const status = useWeatherLayerStore((s) => (type ? s.status[type] : 'idle'));
  const startDate = useAppStore((s) => s.tripConfig.startDate);
  const cloudEnd = useWeatherLayerStore((s) => s.cloudHorizonMs);

  // "now" is pinned per capabilities load so frames stay stable between renders
  const now = useMemo(() => Date.now(), [axes]); // eslint-disable-line react-hooks/exhaustive-deps

  const timeline = useMemo(() => (axes ? buildTimeline(axes, now, cloudEnd) : null), [axes, now, cloudEnd]);
  // stable identity while the instants do not change (the cloud horizon refines after the tiles load)
  const frameKey = timeline ? `${timeline.frames.length}|${timeline.frames[0]}|${timeline.frames[timeline.frames.length - 1]}|${timeline.nowMs}` : '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stable = useMemo(() => timeline, [frameKey]);
  const frames = stable?.frames ?? [];
  const nowMs = stable?.nowMs ?? now;

  const time = useMemo(() => {
    if (!stable) return null;
    if (timeMs !== null) return nearest(stable.frames, timeMs);
    if (startDate) {
      const noon = new Date(`${startDate}T12:00:00`).getTime();
      if (Number.isFinite(noon) && noon >= now - 12 * HOUR) return nearest(stable.frames, noon);
    }
    return stable.nowMs;
  }, [stable, timeMs, startDate, now]);

  const composed = useMemo(
    () => (axes && stable && time !== null ? composeFrame(time, stable.nowMs, axes, scheme) : null),
    [axes, stable, time, scheme],
  );

  return { type, axes, status, timeline: stable, frames, nowMs, time, shown, composed, now, cloudEnd, scheme };
}

/** Days offered as chips: trip range (capped to 14) or today + next 5. */
export function dayKeysForChips(startDate: string | null, endDate: string | null, now: number): string[] {
  const keyOf = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const out: string[] = [];
  if (startDate) {
    const s = new Date(`${startDate}T00:00:00`);
    const e = new Date(`${endDate ?? startDate}T00:00:00`);
    if (Number.isFinite(s.getTime()) && Number.isFinite(e.getTime()) && e >= s) {
      for (let d = new Date(s); d <= e && out.length < 14; d.setDate(d.getDate() + 1)) out.push(keyOf(d));
      if (out.length) return out;
    }
  }
  const base = new Date(now);
  for (let i = 0; i < 6; i++) out.push(keyOf(new Date(base.getFullYear(), base.getMonth(), base.getDate() + i)));
  return out;
}

export { timesOnLocalDay };
