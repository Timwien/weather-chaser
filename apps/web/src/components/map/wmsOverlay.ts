import type { Map as MaplibreMap } from 'maplibre-gl';
import { DWD_ATTRIBUTION, tileUrl, type WmsFrame } from '../../services/dwdLayers.ts';
import { registerWmsProtocol } from './wmsProtocol.ts';

const PREFIX = 'dwd-wx';
const LOAD_TIMEOUT_MS = 3000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Double-buffered WMS raster overlay. Two slots: the visible one keeps showing
 * until the hidden one has finished loading its tiles, then opacities are
 * swapped — frame changes (slider, radar animation) never flicker or flash
 * empty. Only ever two sources exist, which keeps mobile cost bounded.
 */
export class WmsOverlay {
  private front = -1;
  private token = 0;
  private lastKey = '';
  private pending: Promise<void> = Promise.resolve();
  private spec: { frame: WmsFrame; opacity: number } | null = null;
  private destroyed = false;

  constructor(private map: MaplibreMap) {
    void registerWmsProtocol();
  }

  private src(i: number) { return `${PREFIX}-src-${i}`; }
  private lyr(i: number) { return `${PREFIX}-lyr-${i}`; }

  /** Insert below the base style's labels so place names stay readable on top. */
  private beforeId(): string | undefined {
    try {
      return this.map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
    } catch {
      return undefined;
    }
  }

  private clearSlot(i: number) {
    try {
      if (this.map.getLayer(this.lyr(i))) this.map.removeLayer(this.lyr(i));
      if (this.map.getSource(this.src(i))) this.map.removeSource(this.src(i));
    } catch { /* style mid-swap */ }
  }

  private async addSlot(i: number, frame: WmsFrame): Promise<boolean> {
    await registerWmsProtocol(); // tiles use the custom protocol — must exist first
    for (let attempt = 0; attempt < 8; attempt++) {
      if (this.destroyed) return false;
      try {
        this.clearSlot(i);
        this.map.addSource(this.src(i), {
          type: 'raster',
          tiles: [tileUrl(frame)],
          tileSize: 256,
          maxzoom: 10,
          attribution: DWD_ATTRIBUTION,
        });
        this.map.addLayer(
          {
            id: this.lyr(i),
            type: 'raster',
            source: this.src(i),
            paint: { 'raster-opacity': 0, 'raster-fade-duration': 0, 'raster-resampling': 'linear' },
          },
          this.beforeId(),
        );
        return true;
      } catch {
        await sleep(150); // style not ready yet (initial load / theme swap)
      }
    }
    return false;
  }

  private waitLoaded(i: number): Promise<void> {
    return new Promise((resolve) => {
      const id = this.src(i);
      const done = () => {
        this.map.off('sourcedata', onData);
        this.map.off('error', onErr);
        clearTimeout(timer);
        resolve();
      };
      const onData = (e: { sourceId?: string; isSourceLoaded?: boolean }) => {
        if (e.sourceId === id && e.isSourceLoaded) done();
      };
      const onErr = (e: { sourceId?: string }) => { if (e.sourceId === id) done(); };
      const timer = setTimeout(done, LOAD_TIMEOUT_MS);
      this.map.on('sourcedata', onData);
      this.map.on('error', onErr);
    });
  }

  /** Shows a frame; resolves once it is visible (or given up). Same frame twice is a no-op. */
  show(frame: WmsFrame, opacity: number): Promise<void> {
    const key = `${frame.layer}|${frame.time}|${frame.format}|${opacity}`;
    if (key === this.lastKey) return this.pending;
    this.lastKey = key;
    this.spec = { frame, opacity };
    const mine = ++this.token;
    const slot = this.front === 0 ? 1 : 0;

    this.pending = (async () => {
      if (!(await this.addSlot(slot, frame))) return;
      await this.waitLoaded(slot);
      if (mine !== this.token || this.destroyed) return; // superseded by a newer frame
      try {
        if (!this.map.getLayer(this.lyr(slot))) return; // replaced meanwhile (theme swap)
        this.map.setPaintProperty(this.lyr(slot), 'raster-opacity', opacity);
        if (this.front >= 0 && this.map.getLayer(this.lyr(this.front))) {
          this.map.setPaintProperty(this.lyr(this.front), 'raster-opacity', 0);
        }
        const old = this.front;
        this.front = slot;
        if (old >= 0) setTimeout(() => { if (!this.destroyed && this.front !== old) this.clearSlot(old); }, 250);
      } catch { /* style swapped meanwhile — ensure() re-adds */ }
    })();
    return this.pending;
  }

  /** After a base-style swap (theme) the raster sources are gone — add them again. */
  ensure() {
    if (this.destroyed || !this.spec || this.front < 0) return;
    try {
      if (this.map.getLayer(this.lyr(this.front))) return;
    } catch { return; }
    const { frame, opacity } = this.spec;
    this.lastKey = '';
    this.front = -1;
    void this.show(frame, opacity);
  }

  destroy() {
    this.destroyed = true;
    this.token++;
    this.clearSlot(0);
    this.clearSlot(1);
  }
}
