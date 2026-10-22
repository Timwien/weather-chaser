import { describe, it, expect } from 'vitest';
import { composeFrame, frameKey, frameTileUrls } from './weatherFrames.ts';
import { LAYER_NAMES } from './dwdLayers.ts';
import { bboxOfTile, wmsTileKey } from './wmsTileCache.ts';

const H = 3_600_000;
const MIN = 60_000;
const NOW = Date.UTC(2026, 9, 22, 18, 25);
const axes = {
  [LAYER_NAMES.radar]: { kind: 'range' as const, start: Date.UTC(2026, 9, 19), end: NOW, stepMs: 5 * MIN },
  [LAYER_NAMES.pastEu]: { kind: 'range' as const, start: Date.UTC(2026, 9, 21, 7), end: Date.UTC(2026, 9, 25, 18), stepMs: H },
  [LAYER_NAMES.clouds]: { kind: 'range' as const, start: Date.UTC(2026, 9, 21, 9), end: Date.UTC(2026, 9, 22, 18), stepMs: 3 * H },
  [LAYER_NAMES.forecastEu]: { kind: 'range' as const, start: Date.UTC(2026, 9, 21, 9), end: Date.UTC(2026, 9, 27, 12), stepMs: 3 * H },
};

describe('composeFrame', () => {
  it('past hour: satellite ≤ t (3-hourly), ICON 1 h model rain under radar, no Open-Meteo canvas', () => {
    const t = Date.UTC(2026, 9, 22, 14);
    const f = composeFrame(t, NOW, axes, 'light');
    expect(f.source).toBe('observed');
    expect(f.sat).toMatchObject({ layer: LAYER_NAMES.clouds, time: '2026-10-22T12:00:00.000Z', format: 'image/jpeg', variant: 'light' });
    expect(f.model).toMatchObject({ layer: LAYER_NAMES.pastEu, time: '2026-10-22T14:00:00.000Z' });
    expect(f.radar).toMatchObject({ layer: LAYER_NAMES.radar, time: '2026-10-22T14:00:00.000Z' });
    expect(f.cloudMs).toBeNull();
  });
  it('now: latest satellite frame, radar at the exact now instant', () => {
    const f = composeFrame(NOW, NOW, axes, 'dark');
    expect(f.sat?.time).toBe('2026-10-22T18:00:00.000Z');
    expect(f.sat?.variant).toBe('dark');
    expect(f.radar?.time).toBe(new Date(NOW).toISOString());
    expect(f.model?.time).toBe('2026-10-22T18:00:00.000Z');
  });
  it('future: DWD forecast rain + Open-Meteo clouds for the same instant, no satellite/radar', () => {
    const t = NOW + 24 * H - 25 * MIN;
    const f = composeFrame(t, NOW, axes, 'light');
    expect(f.source).toBe('forecast');
    expect(f.sat).toBeNull();
    expect(f.radar).toBeNull();
    expect(f.model?.layer).toBe(LAYER_NAMES.forecastEu);
    expect(f.cloudMs).toBe(t);
  });
  it('model rain only where the hourly layer really has data; 3-hourly layer only if hourly capabilities are missing', () => {
    const trimmed = { ...axes, [LAYER_NAMES.pastEu]: { kind: 'list' as const, times: [Date.UTC(2026, 9, 22, 15), Date.UTC(2026, 9, 22, 16)] } };
    expect(composeFrame(Date.UTC(2026, 9, 22, 14), NOW, trimmed, 'light').model).toBeNull();
    expect(composeFrame(Date.UTC(2026, 9, 22, 16), NOW, trimmed, 'light').model?.layer).toBe(LAYER_NAMES.pastEu);
    const { [LAYER_NAMES.pastEu]: _omit, ...noHourly } = axes;
    expect(composeFrame(Date.UTC(2026, 9, 22, 14), NOW, noHourly, 'light').model?.layer).toBe(LAYER_NAMES.forecastEu);
  });
  it('before the satellite archive: no satellite frame', () => {
    expect(composeFrame(Date.UTC(2026, 9, 21, 8), NOW, axes, 'light').sat).toBeNull();
  });
  it('frameKey changes with the colour scheme (baked into the satellite tiles)', () => {
    const t = Date.UTC(2026, 9, 22, 14);
    expect(frameKey(composeFrame(t, NOW, axes, 'light'))).not.toBe(frameKey(composeFrame(t, NOW, axes, 'dark')));
  });
});

describe('frameTileUrls', () => {
  it('one URL per channel and tile; their cache keys match the key MapLibre\'s own requests produce', () => {
    const f = composeFrame(Date.UTC(2026, 9, 22, 14), NOW, axes, 'light');
    const tiles = [{ z: 7, x: 66, y: 42 }, { z: 7, x: 67, y: 42 }];
    const urls = frameTileUrls(f, tiles);
    expect(urls).toHaveLength(6);
    const bb = bboxOfTile(7, 66, 42);
    // MapLibre substitutes the bbox with its own number spelling
    const maplibreUrl = urls[0].replace(bb.join(','), bb.map((v) => String(v + 1e-7)).join(','));
    expect(wmsTileKey(maplibreUrl)).toBe(wmsTileKey(urls[0]));
    expect(new Set(urls.map(wmsTileKey)).size).toBe(6);
  });
});
