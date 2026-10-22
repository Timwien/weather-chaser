import { create } from 'zustand';
import { loadAxes, type LayerAxes, type WeatherLayerType } from '../services/dwdLayers.ts';
import type { PlaybackState } from '../services/playbackEngine.ts';

export type WeatherLayerChoice = 'off' | WeatherLayerType;
export type AxesStatus = 'idle' | 'loading' | 'ready' | 'error';

const STORAGE_KEY = 'wc-weather-layer';
export const IDLE_PLAYBACK: PlaybackState = { phase: 'idle', ready: 0, total: 0, incomplete: 0 };

/** Persisted choice; the former "radar" / "forecast" / "clouds" options migrate to the unified layer. */
export function parseStoredLayer(v: string | null): WeatherLayerChoice {
  if (v === 'off' || v === null) return 'off';
  return v === 'weather' || v === 'radar' || v === 'forecast' || v === 'clouds' ? 'weather' : 'off';
}

function readStored(): WeatherLayerChoice {
  try {
    return parseStoredLayer(localStorage.getItem(STORAGE_KEY));
  } catch {
    return 'off';
  }
}

function writeStored(v: WeatherLayerChoice) {
  try { localStorage.setItem(STORAGE_KEY, v); } catch { /* storage blocked — choice just isn't remembered */ }
}

interface WeatherLayerState {
  layer: WeatherLayerChoice;
  /** Requested instant (ms; slider position) or null = default (first trip day if ahead, else now). */
  timeMs: number | null;
  /** Instant of the picture that is actually on the map — the time label shows this, never `timeMs`. */
  shownMs: number | null;
  playing: boolean;
  /** Buffered playback: phase + frames cached (for the "Lade Animation 7/24" indicator) + frames played incomplete. */
  playback: PlaybackState;
  /** State of the cloud-forecast tiles (layer 'forecast' only). */
  cloudStatus: 'loading' | 'ready' | 'error';
  /** Last instant the loaded cloud tiles actually cover (null = unknown, assume the 7-day default). */
  cloudHorizonMs: number | null;
  /** "Play route" mode: the playback range is the trip schedule (once, no loop) instead of the day loop. */
  routePlay: boolean;
  /** One-shot request to centre the map on a stop and show the weather of its stay (seq makes repeats distinct). */
  stopFocus: { idx: number; seq: number } | null;
  /** One-shot request: fit the whole route, then start the route playback. */
  routePlayReq: { seq: number } | null;
  /** Bumped by openTimeline so a running playback restarts at the new time. */
  playSeq: number;
  /** Capabilities per UI layer type (stable object identities — safe as selectors). */
  axes: Partial<Record<WeatherLayerType, LayerAxes>>;
  status: Record<WeatherLayerType, AxesStatus>;

  setLayer: (l: WeatherLayerChoice) => void;
  setTimeMs: (t: number | null) => void;
  /** The user moved the time (slider, day chip, "Jetzt"): leaves route-play mode so Play runs the normal loop. */
  scrubTo: (t: number | null) => void;
  /** Route playback reached its end: back to the normal loop mode. */
  endRoutePlay: () => void;
  /** The engine reports the frame it has put on screen (also keeps the slider in step). */
  setShown: (t: number | null, followSlider?: boolean) => void;
  setPlayback: (p: WeatherLayerState['playback']) => void;
  setPlaying: (p: boolean) => void;
  setCloudStatus: (s: 'loading' | 'ready' | 'error') => void;
  setCloudHorizon: (t: number | null) => void;
  /** Centre on a stop + jump to its stay's weather. Without `force` only when the weather layer is on. */
  focusStop: (idx: number, force?: boolean) => void;
  /** "Play route": enables the layer and asks the map controller to fit the route and start playing. */
  requestRoutePlay: () => void;
  /** Starts the scheduled route playback at `timeMs` (called by the map controller once the view is stable). */
  beginRoutePlay: (timeMs: number) => void;
  /** Switches to the unified layer at `timeMs` and starts the playback. */
  openTimeline: (timeMs: number | null) => void;
  /** Fetch (cached 10 min in the service) the time axes for a layer type. */
  ensureAxes: (type: WeatherLayerType, force?: boolean) => Promise<void>;
}

export const useWeatherLayerStore = create<WeatherLayerState>((set, get) => ({
  layer: readStored(),
  timeMs: null,
  shownMs: null,
  playing: false,
  playback: IDLE_PLAYBACK,
  cloudStatus: 'loading',
  cloudHorizonMs: null,
  routePlay: false,
  stopFocus: null,
  routePlayReq: null,
  playSeq: 0,
  axes: {},
  status: { weather: 'idle' },

  setLayer: (l) => {
    // re-picking the active layer keeps its overlay — resetting cloudStatus to 'loading' then would
    // never be answered (the overlay only reports changes) and every forecast frame would wait
    if (l === get().layer) return;
    writeStored(l);
    // cloud state belongs to the overlay that is about to be (re)created → drop stale error/horizon now
    set({
      layer: l, routePlay: false, timeMs: null, shownMs: null, playing: false, playback: IDLE_PLAYBACK,
      cloudStatus: 'loading', cloudHorizonMs: null,
    });
  },
  setTimeMs: (t) => set({ timeMs: t }),
  scrubTo: (t) => set({ timeMs: t, routePlay: false }),
  endRoutePlay: () => set({ playing: false, routePlay: false }),
  setShown: (t, followSlider = false) => set(followSlider ? { shownMs: t, timeMs: t } : { shownMs: t }),
  setPlayback: (playback) => set({ playback }),
  setPlaying: (p) => set({ playing: p }),
  setCloudStatus: (cloudStatus) => set({ cloudStatus }),
  setCloudHorizon: (cloudHorizonMs) => set({ cloudHorizonMs }),
  openTimeline: (t) => {
    writeStored('weather');
    set((s) => ({ layer: 'weather', routePlay: false, timeMs: t, playing: true, playSeq: s.playSeq + 1 }));
  },
  focusStop: (idx, force = false) => {
    if (!force && get().layer === 'off') return;
    if (get().layer === 'off') { writeStored('weather'); set({ layer: 'weather', timeMs: null, shownMs: null, routePlay: false }); }
    set((s) => ({ playing: false, routePlay: false, stopFocus: { idx, seq: (s.stopFocus?.seq ?? 0) + 1 } }));
  },
  requestRoutePlay: () => {
    if (get().layer === 'off') { writeStored('weather'); set({ layer: 'weather', timeMs: null, shownMs: null }); }
    set((s) => ({ playing: false, routePlayReq: { seq: (s.routePlayReq?.seq ?? 0) + 1 } }));
  },
  beginRoutePlay: (t) => {
    set((s) => ({ routePlay: true, timeMs: t, playing: true, playSeq: s.playSeq + 1 }));
  },
  ensureAxes: async (type, force = false) => {
    const st = get().status[type];
    if (st === 'loading') return;
    if (!get().axes[type]) set((s) => ({ status: { ...s.status, [type]: 'loading' } }));
    try {
      const axes = await loadAxes(type, force);
      set((s) => ({ axes: { ...s.axes, [type]: axes }, status: { ...s.status, [type]: 'ready' } }));
    } catch {
      // keep stale axes on a failed refresh; only flag an error when we have nothing
      set((s) => ({ status: { ...s.status, [type]: s.axes[type] ? 'ready' : 'error' } }));
    }
  },
}));
