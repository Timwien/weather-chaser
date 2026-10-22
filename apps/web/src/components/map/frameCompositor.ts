import type { Map as MaplibreMap } from 'maplibre-gl';
import { RAIN_OPACITY, SAT_OPACITY, type WmsFrame } from '../../services/dwdLayers.ts';
import type { ComposedFrame } from '../../services/weatherFrames.ts';
import { WmsOverlay } from './wmsOverlay.ts';

/**
 * The three DWD raster channels of one weather frame, stacked bottom to top:
 * satellite cloud veil, ICON modelled rain, radar. Each channel is a double-buffered
 * WmsOverlay, so a frame change is a swap of already-loaded rasters.
 */
export class FrameCompositor {
  private sat: WmsOverlay;
  private model: WmsOverlay;
  private radar: WmsOverlay;

  constructor(map: MaplibreMap) {
    this.radar = new WmsOverlay(map, 'dwd-wx-radar');
    this.model = new WmsOverlay(map, 'dwd-wx-model', ['dwd-wx-radar']);
    this.sat = new WmsOverlay(map, 'dwd-wx-sat', ['dwd-wx-model', 'dwd-wx-radar']);
  }

  private channel(ov: WmsOverlay, frame: WmsFrame | null, opacity: number, hold: boolean): Promise<void> {
    if (frame) return ov.show(frame, opacity, hold);
    if (!hold) ov.hide(); // a held (preloaded) frame must not hide what is visible now
    return Promise.resolve();
  }

  /**
   * Shows a frame; resolves once all channels are visible (or given up).
   * `hold` only preloads it into the hidden buffers.
   */
  async show(f: ComposedFrame, hold = false): Promise<void> {
    await Promise.all([
      this.channel(this.sat, f.sat, SAT_OPACITY, hold),
      this.channel(this.model, f.model, RAIN_OPACITY, hold),
      this.channel(this.radar, f.radar, RAIN_OPACITY, hold),
    ]);
  }

  ensure() {
    this.sat.ensure();
    this.model.ensure();
    this.radar.ensure();
  }

  destroy() {
    this.sat.destroy();
    this.model.destroy();
    this.radar.destroy();
  }
}
