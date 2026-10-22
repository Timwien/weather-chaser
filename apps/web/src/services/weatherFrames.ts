// What is drawn for one instant of the unified weather layer, and which tiles that needs.

import {
  LAYER_NAMES, resolveForecastFrame, tileUrl, type LayerAxes, type WmsFrame,
} from './dwdLayers.ts';
import { bboxOfTile, type TileCoord } from './wmsTileCache.ts';
import { axisContains, axisStart, floorOnAxis } from '../utils/wmsTime.ts';

/**
 * Raster channels, bottom to top: satellite cloud veil, model rain (ICON), radar.
 * `cloudMs` is the instant of the Open-Meteo cloud canvas (future only).
 */
export interface ComposedFrame {
  time: number;
  source: 'observed' | 'forecast';
  sat: WmsFrame | null;
  model: WmsFrame | null;
  radar: WmsFrame | null;
  cloudMs: number | null;
}

const iso = (t: number) => new Date(t).toISOString();

export function composeFrame(
  time: number, nowMs: number, axes: LayerAxes, scheme: 'light' | 'dark',
): ComposedFrame {
  if (time > nowMs) {
    return { time, source: 'forecast', sat: null, model: resolveForecastFrame(time, axes), radar: null, cloudMs: time };
  }
  // Observed: satellite = latest 3-hourly frame at or before t; radar (Germany) over ICON modelled rain.
  const satAxis = axes[LAYER_NAMES.clouds];
  const sat: WmsFrame | null = satAxis && time >= axisStart(satAxis)
    ? { layer: LAYER_NAMES.clouds, time: iso(floorOnAxis(satAxis, time)), format: 'image/jpeg', variant: scheme }
    : null;
  const radarAxis = axes[LAYER_NAMES.radar];
  const radar: WmsFrame | null = radarAxis && axisContains(radarAxis, time)
    ? { layer: LAYER_NAMES.radar, time: iso(floorOnAxis(radarAxis, time)), format: 'image/png' }
    : null;
  // Modelled rain (outside the radar): hourly ICON-EU only where it really has data; the 3-hourly
  // layer stands in only when the hourly capabilities are missing altogether.
  const modelLayer = axes[LAYER_NAMES.pastEu]
    ? (axisContains(axes[LAYER_NAMES.pastEu], time) ? LAYER_NAMES.pastEu : undefined)
    : (axes[LAYER_NAMES.forecastEu] && axisContains(axes[LAYER_NAMES.forecastEu], time) ? LAYER_NAMES.forecastEu : undefined);
  const model: WmsFrame | null = modelLayer
    ? { layer: modelLayer, time: iso(floorOnAxis(axes[modelLayer], time)), format: 'image/png' }
    : null;
  return { time, source: 'observed', sat, model, radar, cloudMs: null };
}

/** Same frame content → same key (used to skip no-op swaps). */
export function frameKey(f: ComposedFrame): string {
  const k = (w: WmsFrame | null) => (w ? `${w.layer}@${w.time}${w.variant ?? ''}` : '-');
  return `${k(f.sat)}|${k(f.model)}|${k(f.radar)}|${f.cloudMs ?? '-'}`;
}

export function frameChannels(f: ComposedFrame): WmsFrame[] {
  return [f.sat, f.model, f.radar].filter((w): w is WmsFrame => w !== null);
}

/** https tile URLs (the cache's spelling) of all raster tiles a frame needs for a viewport. */
export function frameTileUrls(f: ComposedFrame, tiles: TileCoord[]): string[] {
  const out: string[] = [];
  for (const ch of frameChannels(f)) {
    for (const t of tiles) out.push(tileUrl(ch, bboxOfTile(t.z, t.x, t.y).join(','), 'https'));
  }
  return out;
}
