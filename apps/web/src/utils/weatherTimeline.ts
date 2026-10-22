// Pure time-axis logic of the unified "Wolken & Regen" layer (−24 h … +7 days).
// Past: hourly steps up to "now" (= latest available radar instant);
// future: 3-hourly steps up to the cloud/rain forecast horizon.

import { LAYER_NAMES, type LayerAxes } from '../services/dwdLayers.ts';
import {
  axisEnd, axisStart, axisTimes, floorOnAxis, localDayBounds, mergeAxes, type TimeAxis,
} from './wmsTime.ts';

const MIN = 60_000;
export const HOUR = 3_600_000;
const THREE_H = 3 * HOUR;
const CLOUD_DAYS = 7;
export const PAST_SPAN_MS = 24 * HOUR;

/** Forecast rain grid as one axis (EU high-res first, global fills the tail). */
export function forecastAxis(axes: LayerAxes): TimeAxis | null {
  const eu = axes[LAYER_NAMES.forecastEu];
  const gl = axes[LAYER_NAMES.forecastGlobal];
  if (eu && gl) return mergeAxes(eu, gl);
  return eu ?? gl ?? null;
}

/** Last hour for which /api/cloudgrid has data: the forecast starts at 00:00 GMT today and spans 7 days. */
export function cloudHorizon(now: number, observed: number | null = null): number {
  const d = new Date(now);
  const assumed = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) + CLOUD_DAYS * 24 * HOUR - HOUR;
  // Loaded tiles may start earlier (CDN / long-open tab) → their real end wins.
  return observed !== null && observed < assumed ? observed : assumed;
}

/**
 * Forecast time grid: the DWD rain grid, extended in 3-h steps to the end of the
 * cloud forecast (Open-Meteo, 7 days) so clouds can be shown where rain is not available.
 */
export function cloudForecastAxis(axes: LayerAxes, now: number, observedHorizon: number | null = null): TimeAxis | null {
  const rain = forecastAxis(axes);
  if (!rain) return null;
  const end = axisEnd(rain);
  const horizon = cloudHorizon(now, observedHorizon);
  if (horizon <= end + THREE_H) return rain;
  const extra: number[] = [];
  for (let t = end + THREE_H; t <= horizon; t += THREE_H) extra.push(t);
  return { kind: 'list', times: [...axisTimes(rain), ...extra] };
}

export interface Timeline {
  /** Selectable instants, ascending: observed hours, "now", forecast steps. */
  frames: number[];
  /** "Now": the latest available radar instant (or the wall clock when radar is unavailable). */
  nowMs: number;
  /** Index of the "now" frame in `frames`. */
  nowIdx: number;
}

/** Past axes only (what a frame at time t < now can draw from). */
function pastStart(axes: LayerAxes): number | null {
  const starts = [LAYER_NAMES.clouds, LAYER_NAMES.pastEu, LAYER_NAMES.radar, LAYER_NAMES.forecastEu]
    .map((n) => axes[n]).filter(Boolean).map((a) => axisStart(a));
  return starts.length ? Math.min(...starts) : null;
}

export function buildTimeline(axes: LayerAxes, realNow: number, cloudEnd: number | null = null): Timeline {
  const radar = axes[LAYER_NAMES.radar];
  const nowMs = radar ? floorOnAxis(radar, realNow) : Math.floor(realNow / (5 * MIN)) * 5 * MIN;

  const earliest = pastStart(axes);
  const from = Math.max(nowMs - PAST_SPAN_MS, earliest ?? 0);
  const frames: number[] = [];
  // full hours; the one within 10 min of "now" is replaced by the exact "now" frame
  for (let t = Math.ceil(from / HOUR) * HOUR; t <= nowMs - 10 * MIN; t += HOUR) frames.push(t);
  const nowIdx = frames.length;
  frames.push(nowMs);

  const rain = forecastAxis(axes);
  let future: number[];
  if (rain) {
    future = axisTimes(cloudForecastAxis(axes, realNow, cloudEnd)!);
  } else {
    // rain capabilities unavailable: clouds-only 3-h grid on UTC multiples
    future = [];
    for (let t = Math.ceil(nowMs / THREE_H) * THREE_H; t <= cloudHorizon(realNow, cloudEnd); t += THREE_H) future.push(t);
  }
  for (const t of future) if (t > nowMs + 30 * MIN) frames.push(t);
  return { frames, nowMs, nowIdx };
}

/**
 * Instants the Play button loops over, given the visible instant.
 * Past/now → the observed 24 h; inside the trip days → those days (future part only); else → the next 24 h.
 */
export function playbackRange(tl: Timeline, time: number, tripDays: string[]): number[] {
  if (time <= tl.nowMs) return tl.frames.slice(0, tl.nowIdx + 1);
  const future = tl.frames.slice(tl.nowIdx + 1);
  if (tripDays.length > 0) {
    const from = localDayBounds(tripDays[0])[0];
    const to = localDayBounds(tripDays[tripDays.length - 1])[1];
    const trip = future.filter((t) => t >= from && t < to);
    if (trip.length >= 2 && time >= trip[0] && time <= trip[trip.length - 1]) return trip;
  }
  const i = Math.max(0, future.findIndex((t) => t >= time));
  return future.slice(i, i + 9);
}

/** Frames of the "Wetterverlauf" loop: grid instants on the given days, in order. */
export function playbackFrames(grid: TimeAxis, days: string[]): number[] {
  if (days.length === 0) return [];
  const from = localDayBounds(days[0])[0];
  const to = localDayBounds(days[days.length - 1])[1];
  return axisTimes(grid).filter((t) => t >= from && t < to);
}
