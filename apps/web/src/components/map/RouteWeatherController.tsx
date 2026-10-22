import { useEffect, useRef } from 'react';
import { useMap } from '@vis.gl/react-maplibre';
import { useAppStore } from '../../stores/appStore.ts';
import { useWeatherLayerStore } from '../../stores/weatherLayerStore.ts';
import { useRouteSchedule } from '../../hooks/useRouteVan.ts';
import { usePanelInset } from '../../hooks/usePanelInset.ts';
import { getSheetHeights } from '../mobile/MobileBottomSheet.tsx';
import { stayFocusMs } from '../../utils/routeSchedule.ts';

/** Room the floating weather time bar takes at the bottom of the visible map (px, desktop / phone). */
const BAR_RESERVE_DESKTOP = 150;
const BAR_RESERVE_PHONE = 150;

/**
 * Map-side half of the route/weather coupling: reacts to the one-shot requests in the weather store
 * (jump to a stop's weather; fit the route and start "play route"). Renders nothing.
 */
export function RouteWeatherController({ sheetBottomPadding = 0 }: { sheetBottomPadding?: number }) {
  const { current: map } = useMap();
  const inset = usePanelInset();
  const schedule = useRouteSchedule();
  const stopFocus = useWeatherLayerStore((s) => s.stopFocus);
  const playReq = useWeatherLayerStore((s) => s.routePlayReq);
  const setTimeMs = useWeatherLayerStore((s) => s.setTimeMs);
  const beginRoutePlay = useWeatherLayerStore((s) => s.beginRoutePlay);
  const seenFocus = useRef(stopFocus?.seq ?? 0);
  const seenPlay = useRef(playReq?.seq ?? 0);

  useEffect(() => {
    if (!map || !stopFocus || stopFocus.seq === seenFocus.current) return;
    seenFocus.current = stopFocus.seq;
    const route = useAppStore.getState().route;
    const stop = route?.stops[stopFocus.idx];
    if (!schedule || !stop) return;
    setTimeMs(stayFocusMs(schedule, stopFocus.idx));
    const native = map.getMap();
    native.flyTo({
      center: [stop.town.lng, stop.town.lat],
      zoom: Math.min(Math.max(native.getZoom(), 7), 9),
      duration: 700,
      padding: { top: 0, right: 0, left: inset, bottom: Math.min(sheetBottomPadding, getSheetHeights()[1]) },
    });
  }, [map, stopFocus, schedule, inset, sheetBottomPadding, setTimeMs]);

  useEffect(() => {
    if (!map || !playReq || playReq.seq === seenPlay.current) return;
    seenPlay.current = playReq.seq;
    const route = useAppStore.getState().route;
    if (!schedule || !route || route.stops.length === 0) return;
    const native = map.getMap();
    const lngs = route.stops.map((s) => s.town.lng);
    const lats = route.stops.map((s) => s.town.lat);
    const reserve = inset > 0 ? BAR_RESERVE_DESKTOP : BAR_RESERVE_PHONE;
    // stable view for the whole playback → the frames can be preloaded for exactly this viewport
    native.setPadding({ top: 0, right: 0, bottom: 0, left: 0 });
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      native.off('moveend', start);
      clearTimeout(fallback);
      beginRoutePlay(schedule.startMs);
    };
    const fallback = setTimeout(start, 1600);
    native.once('moveend', start);
    native.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: { top: 70, right: 60, left: 60 + inset, bottom: sheetBottomPadding + reserve }, maxZoom: 9, duration: 700 },
    );
  }, [map, playReq, schedule, inset, sheetBottomPadding, beginRoutePlay]);

  return null;
}
