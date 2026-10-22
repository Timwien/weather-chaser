import { useEffect, useRef, useState } from 'react';
import { useMap } from '@vis.gl/react-maplibre';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { useAppStore } from '../../stores/appStore.ts';
import { useThemeStore } from '../../stores/themeStore.ts';
import { useWeatherLayerStore } from '../../stores/weatherLayerStore.ts';
import { dayKeysForChips, playbackRange, useWeatherTimeline } from '../../hooks/useWeatherTimeline.ts';
import { composeFrame, frameTileUrls, type ComposedFrame } from '../../services/weatherFrames.ts';
import { FramePreloader } from '../../services/framePreloader.ts';
import { CADENCE_MS, PlaybackEngine } from '../../services/playbackEngine.ts';
import { scheduleForRoute } from '../../hooks/useRouteVan.ts';
import { routePlayFrames } from '../../utils/routeSchedule.ts';
import { tilesForViewport, wmsTileKey, wmsTileZoom } from '../../services/wmsTileCache.ts';
import { FrameCompositor } from './frameCompositor.ts';
import { hasWmsTile, hasWmsTileKey, loadWmsTile } from './wmsProtocol.ts';
import type { CloudOverlay } from './CloudOverlay.ts'; // implementation is loaded lazily (keeps the entry chunk small)

const REFRESH_MS = 10 * 60 * 1000;
/** Throttle for "a tile arrived" notifications (progress text, buffer check). */
const NOTIFY_MS = 80;
/** Tiles of one frame for the current viewport (zoom as MapLibre requests it). */
function viewportTiles(map: MaplibreMap) {
  const b = map.getBounds();
  return tilesForViewport(
    { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() },
    wmsTileZoom(map.getZoom()),
  );
}

/** Dev-only measurement hooks (perf/verification scripts); stripped from production builds. */
interface WxDebug {
  map?: MaplibreMap;
  store?: typeof useWeatherLayerStore;
  intervals: Array<{ ms: number; wrapped: boolean }>;
  tileMisses: number;
}
const debug = (): WxDebug | null => {
  if (!import.meta.env.DEV) return null;
  const w = window as unknown as { __wx?: WxDebug };
  return (w.__wx ??= { intervals: [], tileMisses: 0 });
};

/**
 * Renders the unified "Wolken & Regen" layer into the MapLibre style (imperatively,
 * double-buffered) and drives the buffered playback. Renders nothing itself.
 */
export function WeatherLayer() {
  const { current: map } = useMap();
  const scheme = useThemeStore((s) => (s.resolved === 'dark' ? 'dark' : 'light'));
  const tl = useWeatherTimeline(scheme);
  const ensureAxes = useWeatherLayerStore((s) => s.ensureAxes);
  const playing = useWeatherLayerStore((s) => s.playing);
  const playSeq = useWeatherLayerStore((s) => s.playSeq);
  const setPlaying = useWeatherLayerStore((s) => s.setPlaying);
  const setShown = useWeatherLayerStore((s) => s.setShown);
  const setPlayback = useWeatherLayerStore((s) => s.setPlayback);
  const setCloudStatus = useWeatherLayerStore((s) => s.setCloudStatus);
  const setCloudHorizon = useWeatherLayerStore((s) => s.setCloudHorizon);
  const [comp, setComp] = useState<FrameCompositor | null>(null);
  const [cloud, setCloud] = useState<CloudOverlay | null>(null);
  const tlRef = useRef(tl);
  tlRef.current = tl;
  const cloudRef = useRef<CloudOverlay | null>(null);
  cloudRef.current = cloud;
  const type = tl.type;

  // Capabilities: load on activation, refresh every 10 min while visible.
  useEffect(() => {
    if (!type) return;
    void ensureAxes(type);
    const id = setInterval(() => { if (!document.hidden) void ensureAxes(type, true); }, REFRESH_MS);
    return () => clearInterval(id);
  }, [type, ensureAxes]);

  // Raster channels: exist only while the layer is active.
  useEffect(() => {
    if (!map || !type) { setComp(null); return; }
    const native = map.getMap();
    const c = new FrameCompositor(native);
    setComp(c);
    const onStyle = () => c.ensure();
    // Tile errors from DWD (rate limit, gaps in the time series) must not spam the console.
    const onError = (e: { sourceId?: string; error?: unknown }) => {
      if (e.sourceId?.startsWith('dwd-wx') || String(e.error).includes('dwd-wx')) return;
      console.error(e.error ?? e);
    };
    native.on('styledata', onStyle);
    native.on('error', onError);
    const dbg = debug();
    if (dbg) { dbg.map = native; dbg.store = useWeatherLayerStore; }
    return () => {
      native.off('styledata', onStyle);
      native.off('error', onError);
      c.destroy();
      setComp(null);
      setShown(null);
    };
  }, [map, type, setShown]);

  // Open-Meteo cloud forecast canvas (future frames); its tiles load in the background while observed frames show.
  useEffect(() => {
    if (!map || !type) { setCloud(null); return; }
    let co: CloudOverlay | null = null;
    let cancelled = false;
    void import('./CloudOverlay.ts').then(({ CloudOverlay: Impl }) => {
      if (cancelled) return;
      co = new Impl(map.getMap(), setCloudStatus, setCloudHorizon);
      setCloud(co);
    });
    return () => { cancelled = true; co?.destroy(); setCloud(null); };
  }, [map, type, setCloudStatus, setCloudHorizon]);
  useEffect(() => { cloud?.setScheme(scheme); }, [cloud, scheme]);

  /** Cloud canvas follows the frame that was just swapped in (same moment as the label). */
  const applyCloud = (f: ComposedFrame, glideMs: number) => {
    const co = cloudRef.current;
    if (!co) return;
    co.setVisible(f.cloudMs !== null);
    if (f.cloudMs !== null) co.setTime(f.cloudMs, glideMs);
  };

  // Until the capabilities are known, keep the clouds loading for the default instant.
  const composed = tl.composed;
  useEffect(() => {
    if (!cloud) return;
    if (!composed) { cloud.setVisible(false); cloud.setTime(tl.now + 3 * 3_600_000); }
  }, [cloud, composed, tl.now]);

  // Scrubbing / jumps: show the requested frame as soon as it is loaded, then (and only then) report it as shown.
  const reqSeq = useRef(0);
  const composedKey = composed
    ? `${composed.time}|${composed.sat?.time}${composed.sat?.variant}|${composed.model?.layer}${composed.model?.time}|${composed.radar?.time}`
    : '';
  useEffect(() => {
    const seq = ++reqSeq.current; // also invalidates a pending scrub when playback starts
    if (!comp || !composed || playing) return;
    const cached = (() => {
      try {
        return map ? frameTileUrls(composed, viewportTiles(map.getMap())).every((u) => hasWmsTile(u)) : false;
      } catch { return false; }
    })();
    const id = setTimeout(() => {
      void comp.show(composed).then(() => {
        if (seq !== reqSeq.current) return; // a newer request superseded this one — it was never displayed
        applyCloud(composed, 0);
        setShown(composed.time);
      });
    }, cached ? 0 : 100);
    return () => { clearTimeout(id); reqSeq.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comp, composedKey, playing]);
  // Clouds may attach after the first frame was shown (lazy chunk) → bring them in line once.
  useEffect(() => {
    if (cloud && composed && !playing) applyCloud(composed, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloud]);

  // Buffered playback: preload → (spinner) → play; underrun → buffer again, the clock stops.
  // (`hasTimeline`: "Wetterverlauf" may switch the layer on and start playing before the capabilities arrived.)
  const hasTimeline = tl.timeline !== null;
  useEffect(() => {
    if (!playing || !comp || !map || !hasTimeline) return;
    const { timeline, axes, time } = tlRef.current;
    if (!timeline || !axes || time === null) return;
    const native = map.getMap();
    const { startDate, endDate } = useAppStore.getState().tripConfig;
    // "Play route": once through the trip schedule (trip start → end) instead of looping the trip days
    const app = useAppStore.getState();
    const sch = useWeatherLayerStore.getState().routePlay && app.mode === 'results' ? scheduleForRoute(app.route) : null;
    const range = sch
      ? routePlayFrames(timeline.frames, sch)
      : playbackRange(timeline, time, dayKeysForChips(startDate, endDate, tlRef.current.now));
    if (range.length < 2) { setPlaying(false); return; }
    const specs = range.map((t) => composeFrame(t, timeline.nowMs, axes, scheme));
    const found = range.findIndex((t) => t >= time);
    // route playback restarts from the beginning when the trip start was requested or the end was reached
    const startIdx = sch && (found < 0 || found >= range.length - 1 || time <= sch.startMs + 1.5 * 3_600_000) ? 0 : Math.max(0, found);
    const store = useWeatherLayerStore;
    const dbg = debug();
    if (dbg) { dbg.intervals = []; dbg.tileMisses = 0; }

    let disposed = false;
    let engine: PlaybackEngine;
    let notifyTimer: ReturnType<typeof setTimeout> | null = null;
    const notify = () => {
      if (notifyTimer) return;
      notifyTimer = setTimeout(() => { notifyTimer = null; engine.notify(); }, NOTIFY_MS);
    };
    const preloader = new FramePreloader({
      load: (url, signal) => loadWmsTile(url, signal),
      keyOf: wmsTileKey,
      has: hasWmsTileKey,
      onChange: notify,
    });
    const orderFrom = (from: number) => range.map((_, k) => (from + k) % range.length);
    const startPreload = (from: number) => {
      const tiles = viewportTiles(native);
      preloader.start(specs.map((f, id) => ({ id, urls: frameTileUrls(f, tiles) })), orderFrom(from));
    };
    const cloudOk = (f: ComposedFrame) => f.cloudMs === null || store.getState().cloudStatus !== 'loading';

    let lastReported = '';
    engine = new PlaybackEngine({
      count: () => range.length,
      loop: !sch,
      onEnd: () => store.getState().endRoutePlay(), // route played to the end: stay on the last frame, camper at the last stop
      isReady: (i) => preloader.isReady(i) && cloudOk(specs[i]),
      pump: () => { void preloader.pump(orderFrom(engine.index)); },
      show: async (i) => {
        const f = specs[i];
        await comp.show(f);
        if (disposed) return; // paused / layer off mid-swap: the picture is no longer ours
        applyCloud(f, CADENCE_MS);
        setShown(f.time, true); // label + slider move in the same tick as the swap
        // load the following frame into the hidden buffers while this one is on screen
        void comp.show(specs[(i + 1) % specs.length], true);
      },
      onState: (s) => {
        const key = `${s.phase}|${s.ready}|${s.total}`;
        if (key === lastReported) return;
        lastReported = key;
        setPlayback(s);
      },
      onInterval: (ms, wrapped) => { dbg?.intervals.push({ ms: Math.round(ms), wrapped }); },
    });

    const onMoveEnd = () => { startPreload(engine.index); engine.notify(); };
    const onVis = () => { if (document.hidden) setPlaying(false); };
    const unsubCloud = store.subscribe((s, prev) => { if (s.cloudStatus !== prev.cloudStatus) notify(); });
    document.addEventListener('visibilitychange', onVis);
    native.on('moveend', onMoveEnd);

    // current frame on screen already? (the scrub path shows it) → otherwise play() shows it first
    const showFirst = store.getState().shownMs !== range[startIdx];
    startPreload(startIdx);
    engine.play(startIdx, showFirst);

    return () => {
      disposed = true;
      engine.pause();
      preloader.stop();
      if (notifyTimer) clearTimeout(notifyTimer);
      unsubCloud();
      document.removeEventListener('visibilitychange', onVis);
      native.off('moveend', onMoveEnd);
      setPlayback({ phase: 'idle', ready: 0, total: 0 });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, comp, map, playSeq, scheme, hasTimeline]);

  return null;
}
