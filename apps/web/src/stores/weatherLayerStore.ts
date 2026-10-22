import { create } from 'zustand';
import { loadAxes, type LayerAxes, type WeatherLayerType } from '../services/dwdLayers.ts';

export type WeatherLayerChoice = 'off' | WeatherLayerType;
export type AxesStatus = 'idle' | 'loading' | 'ready' | 'error';

const STORAGE_KEY = 'wc-weather-layer';

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
  /** Buffered playback: phase + frames cached (for the "Lade Animation 7/24" indicator). */
  playback: { phase: 'idle' | 'buffering' | 'playing'; ready: number; total: number };
  /** State of the cloud-forecast tiles (layer 'forecast' only). */
  cloudStatus: 'loading' | 'ready' | 'error';
  /** Last instant the loaded cloud tiles actually cover (null = unknown, assume the 7-day default). */
  cloudHorizonMs: number | null;
  /** Bumped by openTimeline so a running playback restarts at the new time. */
  playSeq: number;
  /** Capabilities per UI layer type (stable object identities — safe as selectors). */
  axes: Partial<Record<WeatherLayerType, LayerAxes>>;
  status: Record<WeatherLayerType, AxesStatus>;

  setLayer: (l: WeatherLayerChoice) => void;
  setTimeMs: (t: number | null) => void;
  /** The engine reports the frame it has put on screen (also keeps the slider in step). */
  setShown: (t: number | null, followSlider?: boolean) => void;
  setPlayback: (p: WeatherLayerState['playback']) => void;
  setPlaying: (p: boolean) => void;
  setCloudStatus: (s: 'loading' | 'ready' | 'error') => void;
  setCloudHorizon: (t: number | null) => void;
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
  playback: { phase: 'idle', ready: 0, total: 0 },
  cloudStatus: 'loading',
  cloudHorizonMs: null,
  playSeq: 0,
  axes: {},
  status: { weather: 'idle' },

  setLayer: (l) => {
    writeStored(l);
    // cloud state belongs to the overlay that is about to be (re)created → drop stale error/horizon now
    set({
      layer: l, timeMs: null, shownMs: null, playing: false, playback: { phase: 'idle', ready: 0, total: 0 },
      cloudStatus: 'loading', cloudHorizonMs: null,
    });
  },
  setTimeMs: (t) => set({ timeMs: t }),
  setShown: (t, followSlider = false) => set(followSlider ? { shownMs: t, timeMs: t } : { shownMs: t }),
  setPlayback: (playback) => set({ playback }),
  setPlaying: (p) => set({ playing: p }),
  setCloudStatus: (cloudStatus) => set({ cloudStatus }),
  setCloudHorizon: (cloudHorizonMs) => set({ cloudHorizonMs }),
  openTimeline: (t) => {
    writeStored('weather');
    set((s) => ({ layer: 'weather', timeMs: t, playing: true, playSeq: s.playSeq + 1 }));
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
