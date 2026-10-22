import { create } from 'zustand';
import { loadAxes, type LayerAxes, type WeatherLayerType } from '../services/dwdLayers.ts';

export type WeatherLayerChoice = 'off' | WeatherLayerType;
export type AxesStatus = 'idle' | 'loading' | 'ready' | 'error';

const STORAGE_KEY = 'wc-weather-layer';
const VALID: WeatherLayerChoice[] = ['off', 'radar', 'forecast', 'clouds'];

function readStored(): WeatherLayerChoice {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return VALID.includes(v as WeatherLayerChoice) ? (v as WeatherLayerChoice) : 'off';
  } catch {
    return 'off';
  }
}

function writeStored(v: WeatherLayerChoice) {
  try { localStorage.setItem(STORAGE_KEY, v); } catch { /* storage blocked — choice just isn't remembered */ }
}

interface WeatherLayerState {
  layer: WeatherLayerChoice;
  /** Selected instant (ms) or null = type-specific default (radar: now, forecast: first trip day, clouds: latest). */
  timeMs: number | null;
  playing: boolean;
  /** State of the cloud-forecast tiles (layer 'forecast' only). */
  cloudStatus: 'loading' | 'ready' | 'error';
  /** Last instant the loaded cloud tiles actually cover (null = unknown, assume the 7-day default). */
  cloudHorizonMs: number | null;
  /** Bumped by openTimeline so a running forecast playback restarts at the new time. */
  playSeq: number;
  /** Capabilities per UI layer type (stable object identities — safe as selectors). */
  axes: Partial<Record<WeatherLayerType, LayerAxes>>;
  status: Record<WeatherLayerType, AxesStatus>;

  setLayer: (l: WeatherLayerChoice) => void;
  setTimeMs: (t: number | null) => void;
  setPlaying: (p: boolean) => void;
  setCloudStatus: (s: 'loading' | 'ready' | 'error') => void;
  setCloudHorizon: (t: number | null) => void;
  /** Switches to the combined clouds + rain forecast at `timeMs` and starts the playback. */
  openTimeline: (timeMs: number | null) => void;
  /** Fetch (cached 10 min in the service) the time axes for a layer type. */
  ensureAxes: (type: WeatherLayerType, force?: boolean) => Promise<void>;
}

export const useWeatherLayerStore = create<WeatherLayerState>((set, get) => ({
  layer: readStored(),
  timeMs: null,
  playing: false,
  cloudStatus: 'loading',
  cloudHorizonMs: null,
  playSeq: 0,
  axes: {},
  status: { radar: 'idle', forecast: 'idle', clouds: 'idle' },

  setLayer: (l) => {
    writeStored(l);
    set({ layer: l, timeMs: null, playing: false });
  },
  setTimeMs: (t) => set({ timeMs: t }),
  setPlaying: (p) => set({ playing: p }),
  setCloudStatus: (cloudStatus) => set({ cloudStatus }),
  setCloudHorizon: (cloudHorizonMs) => set({ cloudHorizonMs }),
  openTimeline: (t) => {
    writeStored('forecast');
    set((s) => ({ layer: 'forecast', timeMs: t, playing: true, playSeq: s.playSeq + 1 }));
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
