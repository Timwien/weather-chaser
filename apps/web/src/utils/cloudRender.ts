// Pure pixel renderer for the cloud overlay: bilinear interpolation over the
// cloud-cover lattice (time-interpolated between hours), Mercator-correct.
// No DOM access, so it is unit-testable and cheap to benchmark.

import { GRID_N, type Bounds, type CloudTile, type Step } from '../services/cloudGrid.ts';

const HOUR = 3_600_000;
const MISSING = -1;

export interface ColorScheme { r: number; g: number; b: number }
/** Light basemap: soft blue-grey; dark basemap: soft white. */
export const CLOUD_COLORS: Record<'light' | 'dark', ColorScheme> = {
  light: { r: 0x7a, g: 0x8e, b: 0xa3 },
  dark: { r: 0xe6, g: 0xec, b: 0xf5 },
};
export const ALPHA_MIN_COVER = 15; // % below which clouds are invisible
export const ALPHA_MAX = 0.55; // at 100 %

/** Alpha 0..1 for a cloud cover in %: 0 below 15 %, linear to 0.55 at 100 %. */
export function cloudAlpha(cover: number): number {
  if (cover <= ALPHA_MIN_COVER) return 0;
  return Math.min(1, (cover - ALPHA_MIN_COVER) / (100 - ALPHA_MIN_COVER)) * ALPHA_MAX;
}

/** 0..100 (1 % steps) → little-endian ABGR pixel (straight alpha). */
export function buildColorLut(scheme: 'light' | 'dark'): Uint32Array {
  const { r, g, b } = CLOUD_COLORS[scheme];
  const lut = new Uint32Array(101);
  for (let i = 0; i <= 100; i++) {
    const a = Math.round(cloudAlpha(i) * 255);
    lut[i] = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }
  return lut;
}

const mercY = (latDeg: number) => {
  const s = Math.sin((Math.max(-85, Math.min(85, latDeg)) * Math.PI) / 180);
  return 0.5 * Math.log((1 + s) / (1 - s));
};
const latOfMercY = (y: number) => (Math.atan(Math.sinh(y)) * 180) / Math.PI;

/** Latitude of pixel row centres for a canvas spanning [south, north] (Mercator-uniform). */
export function rowLatitudes(south: number, north: number, height: number): Float64Array {
  const yS = mercY(south);
  const yN = mercY(north);
  const out = new Float64Array(height);
  for (let y = 0; y < height; y++) out[y] = latOfMercY(yN - ((y + 0.5) / height) * (yN - yS));
  return out;
}

/** Cloud cover (0..100) at integer lattice cells of a region, linear in time; MISSING outside the data. */
function buildRegion(
  step: Step, tiles: CloudTile[], timeMs: number,
  iLat0: number, rows: number, iLng0: number, cols: number,
): Float32Array {
  const region = new Float32Array(rows * cols).fill(MISSING);
  for (const t of tiles) {
    if (t.step !== step) continue;
    const h = (timeMs - t.startMs) / HOUR;
    if (h < -0.01 || h > t.hours - 1 + 0.01) continue;
    const h0 = Math.min(t.hours - 1, Math.max(0, Math.floor(h)));
    const h1 = Math.min(t.hours - 1, h0 + 1);
    const w = Math.min(1, Math.max(0, h - h0));
    const tLat = Math.round(t.lat0 / step);
    const tLng = Math.round(t.lng0 / step);
    for (let r = 0; r < GRID_N; r++) {
      const rr = tLat + r - iLat0;
      if (rr < 0 || rr >= rows) continue;
      for (let c = 0; c < GRID_N; c++) {
        const cc = tLng + c - iLng0;
        if (cc < 0 || cc >= cols) continue;
        const a = t.data[h0 * 64 + r * GRID_N + c];
        const b = t.data[h1 * 64 + r * GRID_N + c];
        region[rr * cols + cc] = a + (b - a) * w;
      }
    }
  }
  return region;
}

/**
 * Fills `out` (width × height ABGR pixels, row 0 = north) with the cloud layer.
 * Pixels whose four surrounding lattice points are not all available stay transparent.
 * Returns the number of painted pixels (0 → nothing visible).
 */
export function renderCloudPixels(
  out: Uint32Array, width: number, height: number, view: Bounds,
  step: Step, tiles: CloudTile[], timeMs: number, lut: Uint32Array,
): number {
  out.fill(0);
  const iLat0 = Math.floor(view.south / step) - 1;
  const iLat1 = Math.ceil(view.north / step) + 1;
  const iLng0 = Math.floor(view.west / step) - 1;
  const iLng1 = Math.ceil(view.east / step) + 1;
  const rows = iLat1 - iLat0 + 1;
  const cols = iLng1 - iLng0 + 1;
  if (rows * cols > 200_000) return 0;
  const region = buildRegion(step, tiles, timeMs, iLat0, rows, iLng0, cols);

  // separable: column → (cell, fraction), row → (cell, fraction)
  const cx = new Int32Array(width);
  const fx = new Float32Array(width);
  for (let x = 0; x < width; x++) {
    const g = (view.west + ((x + 0.5) / width) * (view.east - view.west)) / step - iLng0;
    cx[x] = Math.floor(g);
    fx[x] = g - cx[x];
  }
  const lats = rowLatitudes(view.south, view.north, height);
  let painted = 0;
  for (let y = 0; y < height; y++) {
    const g = lats[y] / step - iLat0;
    const ry = Math.floor(g);
    const fy = g - ry;
    if (ry < 0 || ry >= rows - 1) continue;
    const base0 = ry * cols;
    const base1 = base0 + cols;
    const rowOff = y * width;
    for (let x = 0; x < width; x++) {
      const c = cx[x];
      if (c < 0 || c >= cols - 1) continue;
      const v00 = region[base0 + c];
      const v01 = region[base0 + c + 1];
      const v10 = region[base1 + c];
      const v11 = region[base1 + c + 1];
      if (v00 < 0 || v01 < 0 || v10 < 0 || v11 < 0) continue;
      const f = fx[x];
      const v = (v00 + (v01 - v00) * f) * (1 - fy) + (v10 + (v11 - v10) * f) * fy;
      const px = lut[(v + 0.5) | 0];
      if (px !== 0 && px >>> 24 !== 0) { out[rowOff + x] = px; painted++; }
    }
  }
  return painted;
}
