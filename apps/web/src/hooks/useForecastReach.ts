import { useEffect, useMemo } from 'react';
import { useWeatherLayerStore } from '../stores/weatherLayerStore.ts';
import { buildTimeline } from '../utils/weatherTimeline.ts';
import { tripStartsBeyondForecast, type RouteSchedule } from '../utils/routeSchedule.ts';
import { useRouteSchedule } from './useRouteVan.ts';

export interface ForecastReach {
  /** The trip starts after the last available forecast frame (nothing to show or play yet). */
  startsBeyond: boolean;
  /** Last forecast instant (ms), or null while the capabilities are unknown. */
  until: number | null;
}

/** Pure part: reach of the forecast frames relative to a trip schedule. Unknown frames never block. */
export function forecastReach(frames: number[], sch: RouteSchedule | null): ForecastReach {
  const until = frames.length > 0 ? frames[frames.length - 1] : null;
  return { startsBeyond: sch !== null && tripStartsBeyondForecast(frames, sch), until };
}

/** Does the weather forecast reach the start of the current trip? Loads the layer capabilities on demand (cached). */
export function useForecastReach(): ForecastReach {
  const schedule = useRouteSchedule();
  const axes = useWeatherLayerStore((s) => s.axes.weather ?? null);
  const cloudEnd = useWeatherLayerStore((s) => s.cloudHorizonMs);
  const ensureAxes = useWeatherLayerStore((s) => s.ensureAxes);
  useEffect(() => { if (!axes) void ensureAxes('weather'); }, [axes, ensureAxes]);
  return useMemo(() => {
    if (!axes) return { startsBeyond: false, until: null };
    return forecastReach(buildTimeline(axes, Date.now(), cloudEnd).frames, schedule);
  }, [axes, cloudEnd, schedule]);
}
