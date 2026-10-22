import type { Map as MaplibreMap } from 'maplibre-gl';
import { DWD_ATTRIBUTION, tileUrl, WMS_MAX_ZOOM, WMS_TILE_SIZE, type WmsFrame } from '../../services/dwdLayers.ts';
import { registerWmsProtocol } from './wmsProtocol.ts';

/** Upper bound for one raster buffer to load; cold DWD radar tiles take 0.3-0.5 s each, so a full frame can need several seconds. */
const LOAD_TIMEOUT_MS = 12000;

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
  /** First/any addSlot failed (style not ready) — the next styledata event retries. */
  private needsRetry = false;
  private held = false;
  private heldSlot = 0;
  private heldLoaded = false;
  private retries = 0;

  /**
   * `prefix` names this channel's sources/layers (must start with "dwd-wx-"); `abovePrefixes`
   * are the channels stacked on top of it, so a re-added slot keeps its place in the stack.
   */
  constructor(private map: MaplibreMap, private prefix = 'dwd-wx-rain', private abovePrefixes: string[] = []) {
    void registerWmsProtocol();
  }

  private src(i: number) { return `${this.prefix}-src-${i}`; }
  private lyr(i: number) { return `${this.prefix}-lyr-${i}`; }

  /** Insert below the channels above us, else below the base style's labels so place names stay readable. */
  private beforeId(): string | undefined {
    try {
      const layers = this.map.getStyle().layers;
      return layers.find((l) => this.abovePrefixes.some((p) => l.id.startsWith(p)))?.id
        ?? layers.find((l) => l.type === 'symbol')?.id;
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
          tileSize: WMS_TILE_SIZE,
          maxzoom: WMS_MAX_ZOOM,
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

  /** Makes the loaded hidden slot visible and hides the previous one. */
  private swapIn(slot: number, opacity: number) {
    try {
      if (!this.map.getLayer(this.lyr(slot))) return; // replaced meanwhile (theme swap)
      this.map.setPaintProperty(this.lyr(slot), 'raster-opacity', opacity);
      if (this.front >= 0 && this.map.getLayer(this.lyr(this.front))) {
        this.map.setPaintProperty(this.lyr(this.front), 'raster-opacity', 0);
      }
      const old = this.front;
      this.front = slot;
      // Only if no newer show() started meanwhile — it may be reusing this very slot.
      const swapToken = this.token;
      if (old >= 0) {
        setTimeout(() => {
          if (!this.destroyed && this.token === swapToken && this.front !== old) this.clearSlot(old);
        }, 250);
      }
    } catch { /* style swapped meanwhile — ensure() re-adds */ }
  }

  /**
   * Shows a frame; resolves once it is visible (or given up). Same frame twice is a no-op.
   * With `hold` the frame is only loaded into the hidden slot (preload for animations);
   * a later show() of the same frame swaps it in without another load.
   */
  show(frame: WmsFrame, opacity: number, hold = false): Promise<void> {
    const key = `${frame.layer}|${frame.time}|${frame.format}|${frame.variant ?? ''}|${opacity}`;
    if (key === this.lastKey) {
      if (hold) return this.pending;
      if (!this.held) return this.pending;
      // preloaded earlier → swap it in as soon as its load finished
      this.held = false;
      const slot = this.heldSlot;
      const mine = this.token;
      this.pending = this.pending.then(() => {
        if (mine === this.token && !this.destroyed && this.heldLoaded) this.swapIn(slot, opacity);
      });
      return this.pending;
    }
    this.lastKey = key;
    this.spec = { frame, opacity };
    const mine = ++this.token;
    const slot = this.front === 0 ? 1 : 0;
    this.held = hold;
    this.heldSlot = slot;
    this.heldLoaded = false;

    this.pending = (async () => {
      if (!(await this.addSlot(slot, frame))) {
        if (mine === this.token && !this.destroyed) { this.lastKey = ''; this.needsRetry = true; this.held = false; }
        return;
      }
      await this.waitLoaded(slot);
      if (mine !== this.token || this.destroyed) return; // superseded by a newer frame
      this.heldLoaded = true;
      if (this.held) return; // preload only
      this.swapIn(slot, opacity);
    })();
    return this.pending;
  }

  /** Hides the raster (time outside the layer's range); the next show() brings it back. */
  hide() {
    this.token++;
    this.spec = null; // a style swap must not bring the hidden frame back
    this.lastKey = '';
    this.held = false;
    try {
      if (this.front >= 0 && this.map.getLayer(this.lyr(this.front))) {
        this.map.setPaintProperty(this.lyr(this.front), 'raster-opacity', 0);
      }
    } catch { /* style swapped meanwhile */ }
  }

  /** After a base-style swap (theme) the raster sources are gone — add them again. */
  ensure() {
    if (this.destroyed || !this.spec) return;
    if (this.needsRetry) {
      // styledata also fires for our own addLayer → bounded, one retry per event
      if (this.retries++ >= 6) { this.needsRetry = false; return; }
      this.needsRetry = false;
      const { frame, opacity } = this.spec;
      void this.show(frame, opacity);
      return;
    }
    if (this.front < 0) return;
    try {
      if (this.map.getLayer(this.lyr(this.front))) return;
    } catch { return; }
    const { frame, opacity } = this.spec;
    this.lastKey = '';
    this.front = -1;
    this.retries = 0;
    void this.show(frame, opacity);
  }

  destroy() {
    this.destroyed = true;
    this.token++;
    this.clearSlot(0);
    this.clearSlot(1);
  }
}
