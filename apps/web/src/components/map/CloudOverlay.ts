import type { CanvasSource, Map as MaplibreMap } from 'maplibre-gl'; // type-only: maplibre stays a lazy chunk
import {
  getCachedTile, loadTile, tilesAtStep, tilesForBounds, tilesHorizon, type Bounds, type CloudTile,
} from '../../services/cloudGrid.ts';
import { buildColorLut, renderCloudPixels } from '../../utils/cloudRender.ts';

const SRC = 'wx-clouds-src';
const LYR = 'wx-clouds-lyr';
/** Canvas covers the viewport plus 25 % on every side, so panning shows clouds until moveend re-renders. */
const MARGIN = 0.25;
/** Canvas pixels per viewport pixel (smooth interpolation hides the low resolution). */
const SCALE = 0.25;
/** Only the viewport (+5 %) triggers tile fetches — each tile costs 64 weighted Open-Meteo calls. The wider canvas margin uses whatever is cached. */
const FETCH_MARGIN = 0.05;
export const OPEN_METEO_ATTRIBUTION =
  '<a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Open-Meteo</a> (CC BY 4.0)';

export type CloudStatus = 'loading' | 'ready' | 'error';

/**
 * Cloud-cover forecast as a MapLibre canvas source: bilinear interpolation over
 * the lattice tiles from /api/cloudgrid, redrawn on time change (no refetch) and
 * on moveend (fetches missing tiles). Sits right below the DWD rain raster and
 * the base-map labels.
 */
export class CloudOverlay {
  private canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d');
  private image: ImageData | null = null;
  private pixels: Uint32Array | null = null;
  private timeMs: number | null = null;
  private lut = buildColorLut('light');
  private raf = 0;
  private glideRaf = 0;
  private destroyed = false;
  private coordsKey = '';
  private status: CloudStatus = 'loading';
  private visible = true;
  /** Wall time of the last draw (ms) — read by the perf check. */
  lastRenderMs = 0;

  constructor(private map: MaplibreMap, private onStatus?: (s: CloudStatus) => void, private onHorizon?: (t: number | null) => void) {
    this.onStatus?.('loading'); // a fresh overlay must not inherit a stale 'error' in the store
    this.canvas.width = 2;
    this.canvas.height = 2;
    map.on('moveend', this.schedule);
    map.on('styledata', this.ensure);
  }

  setScheme(scheme: 'light' | 'dark') {
    this.lut = buildColorLut(scheme);
    this.schedule();
  }

  /**
   * Observed (past) frames show the satellite veil instead; the overlay then keeps loading
   * its tiles but is not painted, so the first forecast frame is instant.
   */
  setVisible(visible: boolean) {
    if (visible === this.visible) return;
    this.visible = visible;
    this.applyVisibility();
  }

  private applyVisibility() {
    try {
      if (this.map.getLayer(LYR)) this.map.setPaintProperty(LYR, 'raster-opacity', this.visible ? 1 : 0);
    } catch { /* style mid-swap */ }
  }

  /** `glideMs` > 0 tweens from the current time (used while playing). */
  setTime(timeMs: number | null, glideMs = 0) {
    const from = this.timeMs;
    cancelAnimationFrame(this.glideRaf);
    if (glideMs > 0 && from !== null && timeMs !== null && from !== timeMs && Math.abs(timeMs - from) <= 6 * 3_600_000) {
      const started = performance.now();
      const step = (now: number) => {
        const k = Math.min(1, (now - started) / glideMs);
        this.timeMs = from + (timeMs - from) * k;
        this.draw();
        if (k < 1 && !this.destroyed) this.glideRaf = requestAnimationFrame(step);
      };
      this.glideRaf = requestAnimationFrame(step);
      return;
    }
    this.timeMs = timeMs;
    this.schedule();
  }

  private schedule = () => {
    if (this.destroyed || this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.draw(); });
  };

  private setStatus(s: CloudStatus) {
    if (s !== this.status) { this.status = s; this.onStatus?.(s); }
  }

  private beforeId(): string | undefined {
    try {
      const layers = this.map.getStyle().layers;
      // below the DWD rain rasters (they sit below the first label layer)
      return layers.find((l) => l.id.startsWith('dwd-wx-'))?.id ?? layers.find((l) => l.type === 'symbol')?.id;
    } catch {
      return undefined;
    }
  }

  private viewBounds(margin = MARGIN): Bounds {
    const b = this.map.getBounds();
    const dLat = (b.getNorth() - b.getSouth()) * margin;
    const dLng = (b.getEast() - b.getWest()) * margin;
    return {
      south: Math.max(-84, b.getSouth() - dLat), north: Math.min(84, b.getNorth() + dLat),
      west: b.getWest() - dLng, east: b.getEast() + dLng,
    };
  }

  private ensureSource(view: Bounds): CanvasSource | null {
    const coordinates: [[number, number], [number, number], [number, number], [number, number]] = [
      [view.west, view.north], [view.east, view.north], [view.east, view.south], [view.west, view.south],
    ];
    try {
      let src = this.map.getSource(SRC) as CanvasSource | undefined;
      if (!src) {
        this.map.addSource(SRC, {
          type: 'canvas',
          // MapLibre's typings want an element id; the element itself is accepted at runtime.
          canvas: this.canvas as unknown as string,
          coordinates,
          animate: false,
        });
        src = this.map.getSource(SRC) as CanvasSource;
        // Image/canvas sources ignore the spec's `attribution`, but the attribution
        // control reads this property from every source that is in use.
        (src as unknown as { attribution: string }).attribution = OPEN_METEO_ATTRIBUTION;
        this.coordsKey = coordinates.join('|');
      } else if (this.coordsKey !== coordinates.join('|')) {
        src.setCoordinates(coordinates);
        this.coordsKey = coordinates.join('|');
      }
      if (!this.map.getLayer(LYR)) {
        this.map.addLayer(
          { id: LYR, type: 'raster', source: SRC, paint: { 'raster-fade-duration': 0, 'raster-resampling': 'linear', 'raster-opacity': this.visible ? 1 : 0 } },
          this.beforeId(),
        );
      }
      this.applyVisibility();
      return src;
    } catch {
      return null; // style not ready — styledata retries
    }
  }

  /** After a base-style swap (theme) the source is gone — add it again. */
  private ensure = () => {
    if (this.destroyed || this.timeMs === null) return;
    try {
      if (this.map.getLayer(LYR)) return;
    } catch { return; }
    this.schedule();
  };

  private draw() {
    if (this.destroyed || !this.ctx || this.timeMs === null) return;
    const t0 = performance.now();
    const container = this.map.getContainer();
    const width = Math.max(8, Math.min(640, Math.round(container.clientWidth * (1 + 2 * MARGIN) * SCALE)));
    const height = Math.max(8, Math.min(420, Math.round(container.clientHeight * (1 + 2 * MARGIN) * SCALE)));
    const view = this.viewBounds();
    const zoom = this.map.getZoom();
    const wanted = tilesForBounds(this.viewBounds(FETCH_MARGIN), zoom);
    const step = wanted.step; // the (possibly capped) lattice also drives the wider margin
    const drawRefs = tilesAtStep(view, step);
    const have: CloudTile[] = [];
    let missing = 0;
    for (const ref of wanted.tiles) {
      if (getCachedTile(ref)) continue;
      missing++;
      loadTile(ref).then(() => this.schedule(), () => this.setStatus('error'));
    }
    for (const ref of drawRefs) {
      const hit = getCachedTile(ref);
      if (hit) have.push(hit);
    }
    if (missing === 0 && wanted.tiles.length > 0) this.setStatus('ready');
    if (missing === 0) this.onHorizon?.(tilesHorizon(have));
    else if (missing > 0 && this.status !== 'error') this.setStatus('loading');

    if (this.canvas.width !== width || this.canvas.height !== height || !this.image || !this.pixels) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.image = this.ctx.createImageData(width, height);
      this.pixels = new Uint32Array(this.image.data.buffer);
    }
    renderCloudPixels(this.pixels, width, height, view, step, have, this.timeMs, this.lut);
    this.ctx.putImageData(this.image, 0, 0);

    const src = this.ensureSource(view);
    if (src) {
      // A non-animated canvas source only re-uploads while "playing" → run for exactly one frame.
      src.play();
      this.map.triggerRepaint();
      this.map.once('render', () => { if (!this.destroyed) src.pause(); });
    }
    this.lastRenderMs = performance.now() - t0;
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    cancelAnimationFrame(this.glideRaf);
    this.map.off('moveend', this.schedule);
    this.map.off('styledata', this.ensure);
    try {
      if (this.map.getLayer(LYR)) this.map.removeLayer(LYR);
      if (this.map.getSource(SRC)) this.map.removeSource(SRC);
    } catch { /* style mid-swap */ }
  }
}
