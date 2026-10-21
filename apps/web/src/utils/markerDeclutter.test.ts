import { describe, it, expect } from 'vitest';
import { computeDotIndices, type DeclutterItem } from './markerDeclutter.ts';

const m = (x: number, y: number, rank: number, selected = false, size = 34): DeclutterItem => ({ x, y, size, rank, selected });

describe('computeDotIndices', () => {
  it('keeps the better-ranked of two overlapping markers', () => {
    expect(computeDotIndices([m(0, 0, 2), m(10, 0, 1)])).toEqual(new Set([0]));
  });

  it('keeps well separated markers full size', () => {
    expect(computeDotIndices([m(0, 0, 1), m(100, 0, 2)]).size).toBe(0);
  });

  it('the selected marker always stays full and displaces better-ranked neighbours', () => {
    expect(computeDotIndices([m(0, 0, 1), m(10, 0, 5, true)])).toEqual(new Set([0]));
  });

  it('a dot does not hide markers behind it (only full markers block)', () => {
    // 1 and 2 overlap -> 2 is a dot; 3 overlaps only 2, so it stays full
    const dots = computeDotIndices([m(0, 0, 1), m(20, 0, 2), m(45, 0, 3)]);
    expect(dots).toEqual(new Set([1]));
  });

  it('result has no two overlapping full markers', () => {
    const items = Array.from({ length: 30 }, (_, i) => m((i * 37) % 120, (i * 53) % 90, i + 1));
    const dots = computeDotIndices(items);
    const full = items.filter((_, i) => !dots.has(i));
    for (const a of full) for (const b of full) {
      if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual((a.size + b.size) / 2);
    }
  });
});
