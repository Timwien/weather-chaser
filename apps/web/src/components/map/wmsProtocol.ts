import { LAYER_NAMES, WMS_PROTOCOL } from '../../services/dwdLayers.ts';

// 1×1 fully transparent PNG
const EMPTY_PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
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

async function stripRadarMask(data: ArrayBuffer): Promise<ArrayBuffer> {
  if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') return data;
  try {
    const bitmap = await createImageBitmap(new Blob([data], { type: 'image/png' }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return data;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    clearRadarMask(img.data);
    ctx.putImageData(img, 0, 0);
    return await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer();
  } catch {
    return data; // unmodified tile is still correct, just with DWD's mask
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
      try {
        const res = await fetch(url, { signal: abortController.signal });
        const type = res.headers.get('content-type') ?? '';
        if (!res.ok || !type.startsWith('image/')) return { data: EMPTY_PNG.slice(0) };
        const data = await res.arrayBuffer();
        const isRadar = url.includes(`layers=${LAYER_NAMES.radar}&`);
        return { data: isRadar ? await stripRadarMask(data) : data };
      } catch (e) {
        if (abortController.signal.aborted) throw e; // cancelled tile — MapLibre ignores this
        return { data: EMPTY_PNG.slice(0) };
      }
    });
  });
  return registration;
}
