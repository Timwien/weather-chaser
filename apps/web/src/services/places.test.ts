import { describe, it, expect } from 'vitest';
import { minPopulation, normalizeBbox } from './places.ts';

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
});
