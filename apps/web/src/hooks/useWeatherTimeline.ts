import { useMemo } from 'react';
import { useAppStore } from '../stores/appStore.ts';
import { useWeatherLayerStore } from '../stores/weatherLayerStore.ts';
import {
  LAYER_NAMES, resolveFrame, type LayerAxes, type WeatherLayerType, type WmsFrame,
} from '../services/dwdLayers.ts';
import {
  axisEnd, axisTimes, mergeAxes, radarFrames, snapToAxis, timesOnLocalDay, type TimeAxis,
} from '../utils/wmsTime.ts';

const HOUR = 3_600_000;

/** Forecast grid as one axis (EU high-res first, global fills the tail). */
export function forecastAxis(axes: LayerAxes): TimeAxis | null {
  const eu = axes[LAYER_NAMES.forecastEu];
  const gl = axes[LAYER_NAMES.forecastGlobal];
  if (eu && gl) return mergeAxes(eu, gl);
  return eu ?? gl ?? null;
}

/** Instants selectable for a layer type (radar: last 2 h; clouds: last ~24 h; forecast: full range). */
export function framesFor(type: WeatherLayerType, axes: LayerAxes, now: number): number[] {
  if (type === 'radar') {
    const a = axes[LAYER_NAMES.radar];
    return a ? radarFrames(a, now) : [];
  }
  if (type === 'clouds') {
    const a = axes[LAYER_NAMES.clouds];
    if (!a) return [];
    const end = axisEnd(a);
    return axisTimes(a).filter((t) => t >= end - 24 * HOUR);
  }
  const a = forecastAxis(axes);
  return a ? axisTimes(a) : [];
}

export interface WeatherTimeline {
  type: WeatherLayerType | null;
  axes: LayerAxes | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  frames: number[];
  /** The instant being shown (null until capabilities are loaded). */
  time: number | null;
  frame: WmsFrame | null;
  now: number;
}

/** Single source of truth for "which instant of which layer is visible". */
export function useWeatherTimeline(): WeatherTimeline {
  const layer = useWeatherLayerStore((s) => s.layer);
  const timeMs = useWeatherLayerStore((s) => s.timeMs);
  const type = layer === 'off' ? null : layer;
  const axes = useWeatherLayerStore((s) => (type ? s.axes[type] ?? null : null));
  const status = useWeatherLayerStore((s) => (type ? s.status[type] : 'idle'));
  const startDate = useAppStore((s) => s.tripConfig.startDate);

  // "now" is pinned per capabilities load so frames stay stable between renders
  const now = useMemo(() => Date.now(), [axes]); // eslint-disable-line react-hooks/exhaustive-deps

  const frames = useMemo(() => (type && axes ? framesFor(type, axes, now) : []), [type, axes, now]);

  const time = useMemo(() => {
    if (!type || !axes || frames.length === 0) return null;
    if (type === 'forecast') {
      const grid = forecastAxis(axes)!;
      if (timeMs !== null) return snapToAxis(grid, timeMs);
      if (startDate) {
        const noon = new Date(`${startDate}T12:00:00`).getTime();
        if (Number.isFinite(noon) && noon >= now - 12 * HOUR) return snapToAxis(grid, noon);
      }
      return snapToAxis(grid, now);
    }
    if (timeMs !== null && frames.includes(timeMs)) return timeMs;
    return frames[frames.length - 1];
  }, [type, axes, frames, timeMs, startDate, now]);

  const frame = useMemo(
    () => (type && axes && time !== null ? resolveFrame(type, time, axes) : null),
    [type, axes, time],
  );

  return { type, axes, status, frames, time, frame, now };
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
