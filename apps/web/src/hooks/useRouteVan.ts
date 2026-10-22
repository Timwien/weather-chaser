import { useMemo } from 'react';
import type { Route } from '@weatherchaser/core';
import { useAppStore } from '../stores/appStore.ts';
import { useWeatherLayerStore } from '../stores/weatherLayerStore.ts';
import { buildRouteSchedule, isWithinTrip, positionAt, type RouteSchedule, type VanPosition } from '../utils/routeSchedule.ts';

export function scheduleForRoute(route: Route | null): RouteSchedule | null {
  if (!route) return null;
  return buildRouteSchedule(route.stops.map((s) => ({
    lat: s.town.lat, lng: s.town.lng, arrivalDate: s.arrivalDate, nights: s.nights, distanceToNextKm: s.distanceToNextKm,
  })));
}

/** Schedule of the current route (stable while the route object is). */
export function useRouteSchedule(): RouteSchedule | null {
  const route = useAppStore((s) => s.route);
  return useMemo(() => scheduleForRoute(route), [route]);
}

export interface RouteVanState {
  schedule: RouteSchedule;
  /** Instant of the weather picture on the map. */
  shownMs: number;
  /** Where the camper is at `shownMs` (clamped to the first / last stop outside the trip). */
  pos: VanPosition;
  /** `shownMs` lies within the trip; outside, the camper only waits at the start / end stop (no highlight, no caption). */
  inTrip: boolean;
}

/** Camper state for the weather picture that is shown — null unless the weather layer is on in the route results. */
export function useRouteVan(): RouteVanState | null {
  const schedule = useRouteSchedule();
  const mode = useAppStore((s) => s.mode);
  const layer = useWeatherLayerStore((s) => s.layer);
  const shownMs = useWeatherLayerStore((s) => s.shownMs);
  return useMemo(() => {
    if (!schedule || mode !== 'results' || layer === 'off' || shownMs === null) return null;
    return { schedule, shownMs, pos: positionAt(schedule, shownMs), inTrip: isWithinTrip(schedule, shownMs) };
  }, [schedule, mode, layer, shownMs]);
}
