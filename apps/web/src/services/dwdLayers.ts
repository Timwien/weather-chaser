import {
  axisContains, axisTimes, extractTimeDimension, type TimeAxis,
} from '../utils/wmsTime.ts';

/** Weather map layers offered in the app: one unified "clouds & rain" layer (−24 h … +7 days). All DWD (CC BY 4.0) + Open-Meteo clouds. */
export type WeatherLayerType = 'weather';

export const DWD_WMS = 'https://maps.dwd.de/geoserver/dwd/wms';
export const DWD_ATTRIBUTION =
  '<a href="https://www.dwd.de" target="_blank" rel="noopener noreferrer">Deutscher Wetterdienst</a> (CC BY 4.0)';

export const LAYER_NAMES = {
  /** Radar Germany, 5 min, ~3 days back + ~2 h */
  radar: 'Niederschlagsradar',
  /** ICON-EU precipitation: 3-hourly (forecast) … */
  forecastEu: 'Icon-eu_reg00625_fd_sl_TOTPREC03H',
  /** … and hourly (used for the observed past of Europe outside the radar) */
  pastEu: 'Icon-eu_reg00625_fd_sl_TOTPREC01H',
  forecastGlobal: 'Icon_reg025_fd_sl_TOTPREC06H',
  /** Meteosat Europe, 3-hourly, last ~33 h */
  clouds: 'Satellite_meteosat_1km_euat_rgb_day_hrv_and_night_ir108_3h',
} as const;

/** Which DWD layers (and therefore capabilities documents) each UI layer needs. */
export const LAYERS_FOR_TYPE: Record<WeatherLayerType, string[]> = {
  weather: [LAYER_NAMES.radar, LAYER_NAMES.pastEu, LAYER_NAMES.forecastEu, LAYER_NAMES.forecastGlobal, LAYER_NAMES.clouds],
};

/** Opacity of the rain rasters. The satellite veil carries its alpha in the pixels (full layer opacity). */
export const RAIN_OPACITY = 0.6; // 0.7 hid the clouds and the map on rainy days
export const SAT_OPACITY = 1;

/** layer name → axis (the forecast part has two entries) */
export type LayerAxes = Record<string, TimeAxis>;

export interface WmsFrame {
  layer: string;
  /** ISO instant as sent in the WMS `time` parameter */
  time: string;
  format: 'image/png' | 'image/jpeg';
  /** Colour scheme the tile is baked for (satellite veil); part of the cache key. */
  variant?: 'light' | 'dark';
}

/** Scheme handled by components/map/wmsProtocol.ts (tolerant tile loader). */
export const WMS_PROTOCOL = 'dwdwms';

/** 512-px tiles: a quarter of the requests of 256-px tiles at the same sharpness (DWD's per-request latency dominates). */
export const WMS_TILE_SIZE = 512;
export const WMS_MAX_ZOOM = 9;

/** URL template (MapLibre fills {bbox-epsg-3857}); `bbox` replaces it for a concrete tile. */
export function tileUrl(frame: WmsFrame, bbox = '{bbox-epsg-3857}', protocol: string = WMS_PROTOCOL): string {
  const transparent = frame.format === 'image/png';
  return (
    `${DWD_WMS.replace('https:', `${protocol}:`)}?service=WMS&version=1.3.0&request=GetMap&layers=${frame.layer}&styles=` +
    `&format=${frame.format}&transparent=${transparent}&crs=EPSG:3857&bbox=${bbox}` +
    `&width=512&height=512&time=${encodeURIComponent(frame.time)}${frame.variant ? `#${frame.variant}` : ''}`
  );
}

/** DWD forecast rain frame (ICON-EU, else global) for an instant, or null when no product covers it. */
export function resolveForecastFrame(timeMs: number, axes: LayerAxes): WmsFrame | null {
  const time = new Date(timeMs).toISOString();
  const eu = axes[LAYER_NAMES.forecastEu];
  const global = axes[LAYER_NAMES.forecastGlobal];
  if (eu && axisContains(eu, timeMs)) return { layer: LAYER_NAMES.forecastEu, time, format: 'image/png' };
  if (global && axisContains(global, timeMs)) return { layer: LAYER_NAMES.forecastGlobal, time, format: 'image/png' };
  return null;
}

// ── capabilities fetch + in-memory cache (refresh after 10 min) ─────────────
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; axis: TimeAxis }>();
const inflight = new Map<string, Promise<TimeAxis>>();

function capabilitiesUrl(layer: string): string {
  return `https://maps.dwd.de/geoserver/dwd/${layer}/ows?service=WMS&version=1.3.0&request=GetCapabilities`;
}

const SIX_H = 6 * 3_600_000;

/**
 * Tiny GetMap over Germany — true when the layer really has an image for that instant.
 * DWD answers "no data" with HTTP 200 + XML; everything else (abort/timeout, network error,
 * 429, 5xx) is NOT "no data" and throws, so a probe failure can never move the boundary.
 */
export async function hasImage(layer: string, timeMs: number, signal: AbortSignal): Promise<boolean> {
  const url =
    `${DWD_WMS}?service=WMS&version=1.3.0&request=GetMap&layers=${layer}&styles=&format=image/png` +
    `&transparent=true&crs=EPSG:3857&bbox=1000000,6000000,1300000,6300000&width=32&height=32` +
    `&time=${encodeURIComponent(new Date(timeMs).toISOString())}`;
  const res = await fetch(url, { signal });
  if (res.status !== 200) throw new Error(`probe ${res.status}`);
  return (res.headers.get('content-type') ?? '').startsWith('image/');
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

/**
 * The ICON-EU hourly layer advertises instants from ~33 h ago, but the GeoServer only holds
 * the newest model run: older instants answer with an XML exception (verified 22.10.2026:
 * capabilities from 21.10. 07:00, real data from 22.10. 15:00). Binary-search the first
 * instant that renders (data is contiguous from there to the horizon).
 */
async function usableFromFirst(axis: TimeAxis, layer: string, signal: AbortSignal): Promise<TimeAxis> {
  const cands = axisTimes(axis);
  let lo = 0;
  let hi = cands.length - 1;
  if (hi < 0 || !(await hasImage(layer, cands[hi], signal))) throw new Error('no usable instants');
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (await hasImage(layer, cands[mid], signal)) hi = mid; else lo = mid + 1;
  }
  return { kind: 'list', times: cands.slice(lo) };
}

async function fetchAxis(layer: string): Promise<TimeAxis> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(capabilitiesUrl(layer), { signal: ctrl.signal });
    if (!res.ok) throw new Error(`capabilities ${res.status}`);
    const axis = extractTimeDimension(await res.text(), layer);
    if (!axis) throw new Error('no time dimension');
    if (layer === LAYER_NAMES.forecastGlobal) return await usableSixHourly(axis, layer, ctrl.signal);
    if (layer === LAYER_NAMES.pastEu) return await usableFromFirst(axis, layer, ctrl.signal);
    return axis;
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
    // probing failed (timeout, 429, 5xx, offline): keep the previous axis instead of a wrong boundary
    .catch((err) => { if (hit) return hit.axis; throw err; })
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
