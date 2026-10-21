import { describe, it, expect } from 'vitest';
import type { Town } from '@weatherchaser/core';
import { minPopulation, normalizeBbox, withSparseFallback } from './places.ts';

const townsOf = (n: number): Town[] =>
  Array.from({ length: n }, (_, i) => ({ id: `t${i}`, name: `T${i}`, lat: 0, lng: 0 }));

describe('withSparseFallback', () => {
  it('steps auto thresholds down until enough towns are found', async () => {
    const asked: number[] = [];
    const towns = await withSparseFallback(100_000, 'auto', async (minPop) => {
      asked.push(minPop);
      return townsOf(minPop === 1_000 ? 39 : 1);
    });
    expect(asked).toEqual([100_000, 10_000, 1_000]);
    expect(towns).toHaveLength(39);
  });
  it('keeps explicit granularity and dense results as they are', async () => {
    const asked: number[] = [];
    await withSparseFallback(10_000, 'cities', async (p) => { asked.push(p); return townsOf(2); });
    await withSparseFallback(100_000, 'auto', async (p) => { asked.push(p); return townsOf(50); });
    expect(asked).toEqual([10_000, 100_000]);
  });
});

describe('minPopulation', () => {
  it('maps explicit granularity to thresholds', () => {
    expect(minPopulation(1e6, 'cities')).toBe(10_000);
    expect(minPopulation(1e6, 'all')).toBe(1_000);
  });
  it('adapts auto to the area size', () => {
    expect(minPopulation(1_000, 'auto')).toBe(1_000);
    expect(minPopulation(10_000, 'auto')).toBe(10_000);
    expect(minPopulation(200_000, 'auto')).toBe(100_000);
  });
});

describe('normalizeBbox', () => {
  it('rounds outward to 2 decimals', () => {
    expect(normalizeBbox({ south: 47.801, west: 7.612, north: 48.199, east: 8.101 })).toEqual({
      south: 47.8, west: 7.61, north: 48.2, east: 8.11,
    });
  });
  it('clamps oversized boxes to the server limits', () => {
    const b = normalizeBbox({ south: 20, west: -30, north: 70, east: 60 });
    expect(b.north - b.south).toBeLessThanOrEqual(25);
    expect(b.east - b.west).toBeLessThanOrEqual(40);
  });
  it('never exceeds the limits through floating-point drift', () => {
    for (let s = 30; s < 40; s += 0.37) {
      const b = normalizeBbox({ south: s, west: s - 50, north: s + 30, east: s });
      expect(b.north - b.south).toBeLessThanOrEqual(25);
      expect(b.east - b.west).toBeLessThanOrEqual(40);
    }
  });
});
