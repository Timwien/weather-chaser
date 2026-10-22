import { useEffect, useMemo, useRef, useState } from 'react';
import { useMap } from '@vis.gl/react-maplibre';
import { LAYER_OPACITY } from '../../services/dwdLayers.ts';
import { useAppStore } from '../../stores/appStore.ts';
import { useThemeStore } from '../../stores/themeStore.ts';
import { useWeatherLayerStore } from '../../stores/weatherLayerStore.ts';
import {
  cloudForecastAxis, dayKeysForChips, playbackFrames, useWeatherTimeline,
} from '../../hooks/useWeatherTimeline.ts';
import { resolveFrame } from '../../services/dwdLayers.ts';
import { WmsOverlay } from './wmsOverlay.ts';
import type { CloudOverlay } from './CloudOverlay.ts'; // implementation is loaded lazily (keeps the entry chunk small)

const FRAME_MS = 650;
const LATEST_DWELL_MS = 900;
/** Forecast playback: one 3-h step per tick; clouds glide between the steps. */
const FORECAST_STEP_MS = 800;
const FORECAST_DWELL_MS = 700;
const CLOUD_GLIDE_MS = 500;
const REFRESH_MS = 10 * 60 * 1000;
/** Noon of the first trip day when it is still ahead, else now. */
function fallbackCloudTime(startDate: string | null): number {
  const noon = startDate ? new Date(`${startDate}T12:00:00`).getTime() : NaN;
  return Number.isFinite(noon) && noon >= Date.now() - 12 * 3_600_000 ? noon : Date.now();
}
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Renders the chosen DWD weather layer into the MapLibre style (imperatively,
 * double-buffered) and drives the radar animation. Renders nothing itself.
 */
export function WeatherLayer() {
  const { current: map } = useMap();
  const tl = useWeatherTimeline();
  const ensureAxes = useWeatherLayerStore((s) => s.ensureAxes);
  const playing = useWeatherLayerStore((s) => s.playing);
  const setPlaying = useWeatherLayerStore((s) => s.setPlaying);
  const setTimeMs = useWeatherLayerStore((s) => s.setTimeMs);
  const setCloudStatus = useWeatherLayerStore((s) => s.setCloudStatus);
  const setCloudHorizon = useWeatherLayerStore((s) => s.setCloudHorizon);
  const playSeq = useWeatherLayerStore((s) => s.playSeq);
  const scheme = useThemeStore((s) => s.resolved);
  const [overlay, setOverlay] = useState<WmsOverlay | null>(null);
  const [cloud, setCloud] = useState<CloudOverlay | null>(null);
  const tlRef = useRef(tl);
  tlRef.current = tl;
  const type = tl.type;

  // Capabilities: load on activation, refresh every 10 min while visible.
  useEffect(() => {
    if (!type) return;
    void ensureAxes(type);
    const id = setInterval(() => { if (!document.hidden) void ensureAxes(type, true); }, REFRESH_MS);
    return () => clearInterval(id);
  }, [type, ensureAxes]);

  // Overlay lifecycle: exists only while a layer is active.
  useEffect(() => {
    if (!map || !type) { setOverlay(null); return; }
    const native = map.getMap();
    const ov = new WmsOverlay(native);
    setOverlay(ov);
    const onStyle = () => ov.ensure();
    // Tile errors from DWD (rate limit, gaps in the time series) must not spam the console.
    const onError = (e: { sourceId?: string; error?: unknown }) => {
      if (e.sourceId?.startsWith('dwd-wx') || String(e.error).includes('dwd-wx')) return;
      console.error(e.error ?? e);
    };
    native.on('styledata', onStyle);
    native.on('error', onError);
    return () => {
      native.off('styledata', onStyle);
      native.off('error', onError);
      ov.destroy();
    };
  }, [map, type]);

  // Cloud forecast overlay: only for the combined clouds + rain layer.
  useEffect(() => {
    if (!map || type !== 'forecast') { setCloud(null); return; }
    let co: CloudOverlay | null = null;
    let cancelled = false;
    void import('./CloudOverlay.ts').then(({ CloudOverlay: Impl }) => {
      if (cancelled) return;
      co = new Impl(map.getMap(), setCloudStatus, setCloudHorizon);
      // dev-only handle for the performance check (lastRenderMs)
      if (import.meta.env.DEV) (window as unknown as { __wxCloud?: CloudOverlay }).__wxCloud = co;
      setCloud(co);
    });
    return () => { cancelled = true; co?.destroy(); setCloud(null); };
  }, [map, type, setCloudStatus, setCloudHorizon]);
  useEffect(() => { cloud?.setScheme(scheme === 'dark' ? 'dark' : 'light'); }, [cloud, scheme]);
  // Clouds do not depend on the DWD capabilities: until the rain time axis is known
  // (slow GetCapabilities / probing), show the clouds for the chosen or default instant.
  const storedTime = useWeatherLayerStore((s) => s.timeMs);
  const tripStart = useAppStore((s) => s.tripConfig.startDate);
  const fallbackTime = useMemo(() => fallbackCloudTime(tripStart), [tripStart]);
  const cloudTime = tl.time ?? storedTime ?? fallbackTime;
  useEffect(() => {
    cloud?.setTime(cloudTime, playing ? CLOUD_GLIDE_MS : 0);
  }, [cloud, cloudTime, playing]);

  // Show the current frame (debounced so slider scrubbing doesn't thrash tile loads).
  const frameKey = tl.frame ? `${tl.frame.layer}|${tl.frame.time}` : '';
  useEffect(() => {
    if (!overlay || !type) return;
    if (!tl.frame) { if (tl.time !== null) overlay.hide(); return; } // e.g. clouds-only hours beyond the rain forecast
    if (playing && type === 'forecast') return; // the playback loop owns the raster (preloads the next frame)
    const frame = tl.frame;
    const id = setTimeout(() => { void overlay.show(frame, LAYER_OPACITY[type]); }, playing ? 0 : 120);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlay, frameKey, type, playing]);

  // Radar animation: advance only after the next frame has loaded; pause when the tab is hidden.
  useEffect(() => {
    if (!playing || !overlay || type !== 'radar') return;
    let cancelled = false;
    const onVis = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener('visibilitychange', onVis);
    void (async () => {
      const { frames, axes, time } = tlRef.current;
      if (!axes || frames.length < 2) { setPlaying(false); return; }
      let i = Math.max(0, frames.findIndex((f) => f === time));
      while (!cancelled) {
        i = (i + 1) % frames.length;
        const frame = resolveFrame('radar', frames[i], axes);
        if (!frame) break;
        const started = Date.now();
        const before = useWeatherLayerStore.getState().timeMs;
        await overlay.show(frame, LAYER_OPACITY.radar);
        // The frame is on the map even if pause/hidden-tab hit meanwhile → keep the label in sync,
        // but not when the user picked another time in the meantime (slider/chip).
        const st = useWeatherLayerStore.getState();
        if (st.layer === 'radar' && (!cancelled || st.timeMs === before)) setTimeMs(frames[i]);
        if (cancelled) break;
        const dwell = i === frames.length - 1 ? LATEST_DWELL_MS : 0;
        await sleep(Math.max(0, FRAME_MS - (Date.now() - started)) + dwell);
      }
    })();
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [playing, overlay, type, tl.axes, setPlaying, setTimeMs]);

  // Forecast playback over the trip days (3-h steps): show frame i, preload i+1, loop.
  useEffect(() => {
    if (!playing || !overlay || type !== 'forecast' || !tl.axes) return;
    let cancelled = false;
    const onVis = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener('visibilitychange', onVis);
    void (async () => {
      const { axes, time, now } = tlRef.current;
      const grid = axes ? cloudForecastAxis(axes, now) : null;
      const { startDate, endDate } = useAppStore.getState().tripConfig;
      const frames = grid ? playbackFrames(grid, dayKeysForChips(startDate, endDate, now)) : [];
      if (!axes || frames.length < 2) { setPlaying(false); return; }
      const opacity = LAYER_OPACITY.forecast;
      let i = Math.max(0, frames.findIndex((f) => time !== null && f >= time));
      while (!cancelled) {
        const started = Date.now();
        const frame = resolveFrame('forecast', frames[i], axes);
        const before = useWeatherLayerStore.getState().timeMs;
        if (frame) await overlay.show(frame, opacity); else overlay.hide();
        // The frame is on the map even if pause hit meanwhile → keep the label in sync,
        // but not when the user picked another time in the meantime (slider/chip).
        const st = useWeatherLayerStore.getState();
        if (st.layer === 'forecast' && (!cancelled || st.timeMs === before)) setTimeMs(frames[i]);
        if (cancelled) break;
        const next = (i + 1) % frames.length;
        const nextFrame = resolveFrame('forecast', frames[next], axes);
        if (nextFrame) void overlay.show(nextFrame, opacity, true);
        await sleep(Math.max(0, FORECAST_STEP_MS - (Date.now() - started)) + (next === 0 ? FORECAST_DWELL_MS : 0));
        i = next;
      }
    })();
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [playing, overlay, type, tl.axes, playSeq, setPlaying, setTimeMs]);

  return null;
}
