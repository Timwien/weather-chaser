import { LAYER_NAMES, WMS_PROTOCOL } from '../../services/dwdLayers.ts';
import { TileCache, wmsTileKey } from '../../services/wmsTileCache.ts';
import { satelliteToVeil } from '../../utils/satelliteVeil.ts';

// 1×1 fully transparent PNG (RGBA 0,0,0,0). The previous constant decoded to an opaque BLUE
// pixel, so every gap in a time series (missing model step) was painted as a blue-violet veil.
export const EMPTY_PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII='),
  (c) => c.charCodeAt(0),
).buffer;

let registration: Promise<void> | null = null;

/**
 * DWD's radar style paints the area outside radar coverage with a grey veil
 * (126,126,126 @ ~30% alpha) and outlines it in magenta. On our map that greys
 * out half of Europe, so both are made transparent; the time bar says that the
 * radar only covers Germany and its border regions instead.
 */
export function clearRadarMask(px: Uint8ClampedArray): void {
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], g = px[i + 1], b = px[i + 2], a = px[i + 3];
    if (a === 0) continue;
    const coverageVeil = r === 126 && g === 126 && b === 126 && a < 128;
    const outline = r > 180 && g < 90 && b > 180;
    if (coverageVeil || outline) px[i + 3] = 0;
  }
}

/** Pale blue replacing DWD's grey lightest rain class (kept in sync with the legend). */
export const DRIZZLE_RGBA = [150, 200, 240, 80] as const; // faint: 0.1 mm/3 h barely matters for trips

/**
 * DWD's LAWA precipitation scale draws its lightest class (0.1 mm and up) in
 * neutral grey (192,192,192) — on the map, especially over the cloud overlay
 * and in dark mode, that reads as cloud, not rain. Recolour it pale blue.
 */
export function recolorDrizzle(px: Uint8ClampedArray): void {
  for (let i = 0; i < px.length; i += 4) {
    if (px[i] === 192 && px[i + 1] === 192 && px[i + 2] === 192 && px[i + 3] > 0) {
      px[i] = DRIZZLE_RGBA[0];
      px[i + 1] = DRIZZLE_RGBA[1];
      px[i + 2] = DRIZZLE_RGBA[2];
      px[i + 3] = DRIZZLE_RGBA[3];
    }
  }
}

async function transformPixels(
  data: ArrayBuffer,
  transform: (px: Uint8ClampedArray) => void,
  type = 'image/png',
): Promise<ArrayBuffer> {
  if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') return data;
  try {
    const bitmap = await createImageBitmap(new Blob([data], { type }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return data;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    transform(img.data);
    ctx.putImageData(img, 0, 0);
    return await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer();
  } catch {
    return data; // unmodified tile is still correct, just in DWD's styling
  }
}

// ── tile cache ──────────────────────────────────────────────────────────────
/** Processed tiles (mask stripped, recoloured, veil) — a frame whose tiles are here displays instantly. */
const CACHE_TTL_MS = 15 * 60 * 1000;
/** Gaps / transient errors are remembered only briefly so a retry can succeed. */
const GAP_TTL_MS = 60 * 1000;
export const tileCache = new TileCache();

/** True when the processed tile for this (https) tile URL is cached. */
export const hasWmsTile = (url: string) => tileCache.has(wmsTileKey(url));
export const hasWmsTileKey = (key: string) => tileCache.has(key);

interface Inflight { promise: Promise<ArrayBuffer>; ctrl: AbortController; waiters: number }
const inflight = new Map<string, Inflight>();

/** Number of DWD GetMap requests started (diagnostics for the perf check). */
let fetchCount = 0;
export const wmsFetchCount = () => fetchCount;

async function fetchProcessed(url: string, key: string, signal: AbortSignal): Promise<ArrayBuffer> {
  fetchCount++;
  try {
    const res = await fetch(url, { signal });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !type.startsWith('image/')) {
      // 200 + ServiceException = gap in the series; 4xx is deterministic too; 5xx/429 may heal
      tileCache.set(key, EMPTY_PNG.slice(0), res.status >= 500 || res.status === 429 ? GAP_TTL_MS : CACHE_TTL_MS);
      return EMPTY_PNG.slice(0);
    }
    const data = await res.arrayBuffer();
    const isLayer = (name: string) => url.includes(`layers=${name}&`);
    let out = data;
    if (isLayer(LAYER_NAMES.radar)) out = await transformPixels(data, clearRadarMask, type);
    else if (isLayer(LAYER_NAMES.forecastEu) || isLayer(LAYER_NAMES.forecastGlobal) || isLayer(LAYER_NAMES.pastEu)) {
      out = await transformPixels(data, recolorDrizzle, type);
    } else if (isLayer(LAYER_NAMES.clouds)) {
      const scheme = key.split('|')[2] === 'dark' ? 'dark' : 'light';
      out = await transformPixels(data, (px) => satelliteToVeil(px, scheme), type);
      if (out === data) out = EMPTY_PNG.slice(0); // no canvas / decode error: a raw JPEG would cover the whole map
    }
    tileCache.set(key, out, CACHE_TTL_MS);
    return out;
  } catch (e) {
    if (signal.aborted) throw e;
    tileCache.set(key, EMPTY_PNG.slice(0), GAP_TTL_MS);
    return EMPTY_PNG.slice(0);
  }
}

/**
 * The one code path for DWD tiles — used by MapLibre (protocol handler) and by the frame
 * preloader. Cached → instant; concurrent requests for the same tile share one fetch, which is
 * aborted only when every waiter has aborted. `url` uses the https scheme.
 * Always resolves with a copy (MapLibre may transfer it); an empty tile stands in for gaps.
 */
export async function loadWmsTile(url: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  const key = wmsTileKey(url);
  const hit = tileCache.get(key);
  if (hit) return hit.slice(0);
  let entry = inflight.get(key);
  if (!entry) {
    const ctrl = new AbortController();
    const created: Inflight = { promise: Promise.resolve(EMPTY_PNG), ctrl, waiters: 0 };
    created.promise = fetchProcessed(url, key, ctrl.signal).finally(() => {
      if (inflight.get(key) === created) inflight.delete(key);
    });
    entry = created;
    inflight.set(key, entry);
  }
  const e = entry;
  e.waiters++;
  let onAbort: (() => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => {
      if (--e.waiters === 0) {
        e.ctrl.abort();
        if (inflight.get(key) === e) inflight.delete(key); // a dead entry must not be joined by new callers
      }
      reject(new DOMException('aborted', 'AbortError'));
    };
    if (signal?.aborted) onAbort(); else signal?.addEventListener('abort', onAbort, { once: true });
  });
  aborted.catch(() => {}); // avoid an unhandled rejection when the fetch wins the race
  try {
    return (await Promise.race([e.promise, aborted])).slice(0);
  } finally {
    if (onAbort) signal?.removeEventListener('abort', onAbort);
  }
}

/**
 * DWD GeoServer answers gaps in a time series (missing model step, rate limit,
 * outage) with HTTP 200 + an XML ServiceException — MapLibre would log a decode
 * error per tile. This protocol fetches the tile itself and substitutes a
 * transparent tile for anything that is not an image, so a gap is just an
 * empty spot instead of console spam.
 *
 * maplibre-gl is imported dynamically: a static import here would pull the
 * whole library (~1 MB) into the entry chunk; the map loads it lazily anyway.
 */
export function registerWmsProtocol(): Promise<void> {
  registration ??= import('maplibre-gl').then(({ default: maplibregl }) => {
    maplibregl.addProtocol(WMS_PROTOCOL, async (params, abortController) => {
      const url = params.url.replace(`${WMS_PROTOCOL}:`, 'https:');
      if (import.meta.env.DEV && !hasWmsTile(url)) {
        // dev-only perf check: tiles MapLibre needed that the preloader had not cached
        const w = window as unknown as { __wxMapMisses?: number };
        w.__wxMapMisses = (w.__wxMapMisses ?? 0) + 1;
      }
      return { data: await loadWmsTile(url, abortController.signal) };
    });
  });
  return registration;
}
