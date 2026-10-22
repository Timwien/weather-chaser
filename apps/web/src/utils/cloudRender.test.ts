import { describe, it, expect } from 'vitest';
import type { CloudTile } from '../services/cloudGrid.ts';
import { buildColorLut, cloudAlpha, renderCloudPixels, rowLatitudes } from './cloudRender.ts';

const H = 3_600_000;
function tile(lat0: number, lng0: number, valueOf: (h: number, r: number, c: number) => number, hours = 3): CloudTile {
  const data = new Uint8Array(hours * 64);
  for (let h = 0; h < hours; h++) for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) data[h * 64 + r * 8 + c] = valueOf(h, r, c);
  return { step: 1, lat0, lng0, startMs: 0, hours, data };
}
const alphaOf = (px: number) => px >>> 24;

describe('cloudAlpha', () => {
  it('ramps from 0 at 15 % to 0.55 at 100 %', () => {
    expect(cloudAlpha(0)).toBe(0);
    expect(cloudAlpha(15)).toBe(0);
    expect(cloudAlpha(100)).toBeCloseTo(0.55);
    expect(cloudAlpha(57.5)).toBeCloseTo(0.275);
  });
});

describe('rowLatitudes', () => {
  it('is Mercator-uniform: the middle row is NOT the arithmetic mean latitude', () => {
    const lats = rowLatitudes(40, 60, 3);
    expect(lats[0]).toBeGreaterThan(lats[1]);
    expect(lats[1]).toBeGreaterThan(50); // mercator midpoint lies north of 50
  });
});

describe('renderCloudPixels', () => {
  const lut = buildColorLut('light');
  const view = { south: 40.5, north: 43.5, west: 0.5, east: 3.5 };

  it('interpolates in time between hours', () => {
    const t = tile(40, 0, (h) => (h === 0 ? 0 : 100));
    const px = new Uint32Array(30 * 30);
    renderCloudPixels(px, 30, 30, view, 1, [t], 0.5 * H, lut);
    const mid = alphaOf(px[15 * 30 + 15]);
    expect(mid).toBeGreaterThan(Math.round(0.2 * 255));
    expect(mid).toBeLessThan(Math.round(0.35 * 255));
    renderCloudPixels(px, 30, 30, view, 1, [t], 1 * H, lut);
    expect(alphaOf(px[15 * 30 + 15])).toBe(Math.round(0.55 * 255));
  });

  it('interpolates smoothly in space and leaves uncovered pixels transparent', () => {
    const t = tile(40, 0, (_h, _r, c) => c * 14); // 0..98 west→east
    const px = new Uint32Array(30 * 30);
    const painted = renderCloudPixels(px, 30, 30, view, 1, [t], 0, lut);
    expect(painted).toBeGreaterThan(0);
    const row = Array.from({ length: 30 }, (_, x) => alphaOf(px[15 * 30 + x]));
    for (let x = 1; x < 30; x++) expect(row[x]).toBeGreaterThanOrEqual(row[x - 1]);
    const empty = new Uint32Array(30 * 30);
    expect(renderCloudPixels(empty, 30, 30, view, 1, [], 0, lut)).toBe(0);
    // time outside the data → nothing
    expect(renderCloudPixels(empty, 30, 30, view, 1, [t], 10 * H, lut)).toBe(0);
  });

  it('renders a 1440x900-viewport canvas (1/4 scale, 8 tiles) well under 30 ms', () => {
    const tiles = [];
    for (let lat0 = 32; lat0 < 64; lat0 += 8) for (let lng0 = -8; lng0 < 24; lng0 += 8) tiles.push(tile(lat0, lng0, (h, r, c) => (r * 9 + c * 7 + h * 5) % 101, 168));
    const w = 480;
    const h = 300;
    const px = new Uint32Array(w * h);
    const v = { south: 40, north: 56, west: -4, east: 20 };
    renderCloudPixels(px, w, h, v, 1, tiles, 5.3 * H, lut); // warm up
    const t0 = performance.now();
    const runs = 10;
    for (let i = 0; i < runs; i++) renderCloudPixels(px, w, h, v, 1, tiles, (5 + i * 0.1) * H, lut);
    const ms = (performance.now() - t0) / runs;
    console.log(`cloud render ${w}x${h}: ${ms.toFixed(2)} ms`);
    expect(ms).toBeLessThan(30);
  });
});
