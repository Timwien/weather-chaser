import {
  axisContains, axisEnd, axisTimes, extractTimeDimension, type TimeAxis,
} from '../utils/wmsTime.ts';

/** Weather map layers offered in the app. All from the DWD GeoServer (CC BY 4.0). */
export type WeatherLayerType = 'radar' | 'forecast' | 'clouds';

export const DWD_WMS = 'https://maps.dwd.de/geoserver/dwd/wms';
export const DWD_ATTRIBUTION =
  '<a href="https://www.dwd.de" target="_blank" rel="noopener noreferrer">Deutscher Wetterdienst</a> (CC BY 4.0)';

export const LAYER_NAMES = {
  radar: 'Niederschlagsradar',
  forecastEu: 'Icon-eu_reg00625_fd_sl_TOTPREC03H',
  forecastGlobal: 'Icon_reg025_fd_sl_TOTPREC06H',
  clouds: 'Satellite_meteosat_1km_euat_rgb_day_hrv_and_night_ir108_3h',
} as const;

/** Which DWD layers (and therefore capabilities documents) each UI layer needs. */
export const LAYERS_FOR_TYPE: Record<WeatherLayerType, string[]> = {
  radar: [LAYER_NAMES.radar],
  forecast: [LAYER_NAMES.forecastEu, LAYER_NAMES.forecastGlobal],
  clouds: [LAYER_NAMES.clouds],
};

export const LAYER_OPACITY: Record<WeatherLayerType, number> = { radar: 0.7, forecast: 0.7, clouds: 0.6 };

/** layer name → axis (a forecast type has two entries) */
export type LayerAxes = Record<string, TimeAxis>;

export interface WmsFrame {
  layer: string;
  /** ISO instant as sent in the WMS `time` parameter */
  time: string;
  format: 'image/png' | 'image/jpeg';
}

/** Scheme handled by components/map/wmsProtocol.ts (tolerant tile loader). */
export const WMS_PROTOCOL = 'dwdwms';

export function tileUrl(frame: WmsFrame): string {
  const transparent = frame.format === 'image/png';
  return (
    `${DWD_WMS.replace('https:', `${WMS_PROTOCOL}:`)}?service=WMS&version=1.3.0&request=GetMap&layers=${frame.layer}&styles=` +
    `&format=${frame.format}&transparent=${transparent}&crs=EPSG:3857&bbox={bbox-epsg-3857}` +
    `&width=256&height=256&time=${encodeURIComponent(frame.time)}`
  );
}

/** Layer + frame description for an instant, or null when no layer covers it. */
export function resolveFrame(type: WeatherLayerType, timeMs: number, axes: LayerAxes): WmsFrame | null {
  const time = new Date(timeMs).toISOString();
  if (type === 'radar') {
    return axes[LAYER_NAMES.radar] ? { layer: LAYER_NAMES.radar, time, format: 'image/png' } : null;
  }
  if (type === 'clouds') {
    return axes[LAYER_NAMES.clouds] ? { layer: LAYER_NAMES.clouds, time, format: 'image/jpeg' } : null;
  }
  const eu = axes[LAYER_NAMES.forecastEu];
  const global = axes[LAYER_NAMES.forecastGlobal];
  if (eu && axisContains(eu, timeMs)) return { layer: LAYER_NAMES.forecastEu, time, format: 'image/png' };
  if (global && axisContains(global, timeMs)) return { layer: LAYER_NAMES.forecastGlobal, time, format: 'image/png' };
  return null;
}

/** Last instant for which the forecast type has data (max of both products). */
export function forecastEnd(axes: LayerAxes): number | null {
  const ends = [LAYER_NAMES.forecastEu, LAYER_NAMES.forecastGlobal]
    .map((n) => axes[n]).filter(Boolean).map((a) => axisEnd(a));
  return ends.length ? Math.max(...ends) : null;
}

// ── capabilities fetch + in-memory cache (refresh after 10 min) ─────────────
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; axis: TimeAxis }>();
const inflight = new Map<string, Promise<TimeAxis>>();

function capabilitiesUrl(layer: string): string {
  return `https://maps.dwd.de/geoserver/dwd/${layer}/ows?service=WMS&version=1.3.0&request=GetCapabilities`;
}

const SIX_H = 6 * 3_600_000;

/** Tiny GetMap over Germany — true when the layer really has an image for that instant. */
async function hasImage(layer: string, timeMs: number, signal: AbortSignal): Promise<boolean> {
  const url =
    `${DWD_WMS}?service=WMS&version=1.3.0&request=GetMap&layers=${layer}&styles=&format=image/png` +
    `&transparent=true&crs=EPSG:3857&bbox=1000000,6000000,1300000,6300000&width=32&height=32` +
    `&time=${encodeURIComponent(new Date(timeMs).toISOString())}`;
  try {
    const res = await fetch(url, { signal });
    return res.ok && (res.headers.get('content-type') ?? '').startsWith('image/');
  } catch {
    return false;
  }
}

/**
 * The global ICON product (TOTPREC06H) advertises a 3-hourly extent up to its
 * model horizon, but only has data at 6-hourly steps and — depending on the
 * model run — often much less than advertised (verified 22.10.2026: extent to
 * +7 d, real data to +5 d). Keep the 6-hourly instants and binary-search the
 * last one that renders.
 */
async function usableSixHourly(axis: TimeAxis, layer: string, signal: AbortSignal): Promise<TimeAxis> {
  const cands = axisTimes(axis).filter((t) => t % SIX_H === 0);
  let lo = -1;
  let hi = cands.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (await hasImage(layer, cands[mid], signal)) lo = mid; else hi = mid - 1;
  }
  if (lo < 0) throw new Error('no usable instants');
  return { kind: 'list', times: cands.slice(0, lo + 1) };
}

async function fetchAxis(layer: string): Promise<TimeAxis> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(capabilitiesUrl(layer), { signal: ctrl.signal });
    if (!res.ok) throw new Error(`capabilities ${res.status}`);
    const axis = extractTimeDimension(await res.text(), layer);
    if (!axis) throw new Error('no time dimension');
    return layer === LAYER_NAMES.forecastGlobal ? await usableSixHourly(axis, layer, ctrl.signal) : axis;
  } finally {
    clearTimeout(timer);
  }
}

export function getLayerAxis(layer: string, force = false): Promise<TimeAxis> {
  const hit = cache.get(layer);
  if (!force && hit && Date.now() - hit.at < CACHE_MS) return Promise.resolve(hit.axis);
  const pending = inflight.get(layer);
  if (pending) return pending;
  const p = fetchAxis(layer)
    .then((axis) => { cache.set(layer, { at: Date.now(), axis }); return axis; })
    .finally(() => inflight.delete(layer));
  inflight.set(layer, p);
  return p;
}

/** Axes for a UI layer type. The forecast type survives losing its global fallback. */
export async function loadAxes(type: WeatherLayerType, force = false): Promise<LayerAxes> {
  const names = LAYERS_FOR_TYPE[type];
  const settled = await Promise.allSettled(names.map((n) => getLayerAxis(n, force)));
  const out: LayerAxes = {};
  settled.forEach((r, i) => { if (r.status === 'fulfilled') out[names[i]] = r.value; });
  if (Object.keys(out).length === 0) throw new Error('capabilities unavailable');
  return out;
}
