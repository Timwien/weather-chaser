import maplibregl from 'maplibre-gl';
import { WMS_PROTOCOL } from '../../services/dwdLayers.ts';

// 1×1 fully transparent PNG
const EMPTY_PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
).buffer;

let registered = false;

/**
 * DWD GeoServer answers gaps in a time series (missing model step, rate limit,
 * outage) with HTTP 200 + an XML ServiceException — MapLibre would log a decode
 * error per tile. This protocol fetches the tile itself and substitutes a
 * transparent tile for anything that is not an image, so a gap is just an
 * empty spot instead of console spam.
 */
export function registerWmsProtocol() {
  if (registered) return;
  registered = true;
  maplibregl.addProtocol(WMS_PROTOCOL, async (params, abortController) => {
    const url = params.url.replace(`${WMS_PROTOCOL}:`, 'https:');
    try {
      const res = await fetch(url, { signal: abortController.signal });
      const type = res.headers.get('content-type') ?? '';
      if (!res.ok || !type.startsWith('image/')) return { data: EMPTY_PNG.slice(0) };
      return { data: await res.arrayBuffer() };
    } catch (e) {
      if (abortController.signal.aborted) throw e; // cancelled tile — MapLibre ignores this
      return { data: EMPTY_PNG.slice(0) };
    }
  });
}
