import { describe, it, expect } from 'vitest';
import { buildTimeline, playbackRange } from './weatherTimeline.ts';
import { LAYER_NAMES } from '../services/dwdLayers.ts';

const H = 3_600_000;
const MIN = 60_000;
const NOW_REAL = Date.UTC(2026, 9, 22, 18, 40);
const RADAR_END = Date.UTC(2026, 9, 22, 18, 25);
const axes = {
  [LAYER_NAMES.radar]: { kind: 'range' as const, start: Date.UTC(2026, 9, 19), end: RADAR_END, stepMs: 5 * MIN },
  [LAYER_NAMES.pastEu]: { kind: 'range' as const, start: Date.UTC(2026, 9, 21, 7), end: Date.UTC(2026, 9, 25, 18), stepMs: H },
  [LAYER_NAMES.clouds]: { kind: 'range' as const, start: Date.UTC(2026, 9, 21, 9), end: Date.UTC(2026, 9, 22, 18), stepMs: 3 * H },
  [LAYER_NAMES.forecastEu]: { kind: 'range' as const, start: Date.UTC(2026, 9, 21, 9), end: Date.UTC(2026, 9, 27, 12), stepMs: 3 * H },
};

describe('buildTimeline', () => {
  const tl = buildTimeline(axes, NOW_REAL);
  it('snaps "now" to the latest radar instant and puts it at nowIdx', () => {
    expect(tl.nowMs).toBe(RADAR_END);
    expect(tl.frames[tl.nowIdx]).toBe(RADAR_END);
  });
  it('past part: hourly steps, −24 h … now', () => {
    const past = tl.frames.slice(0, tl.nowIdx);
    expect(past[0]).toBe(Date.UTC(2026, 9, 21, 19)); // first full hour after now − 24 h
    expect(past.at(-1)).toBe(Date.UTC(2026, 9, 22, 18));
    expect(past.every((t, i) => i === 0 || t - past[i - 1] === H)).toBe(true);
    expect(RADAR_END - past[0]).toBeLessThanOrEqual(24 * H);
  });
  it('future part: 3-hourly steps after now up to the 7-day cloud horizon', () => {
    const fut = tl.frames.slice(tl.nowIdx + 1);
    expect(fut[0]).toBeGreaterThan(RADAR_END);
    expect(fut.every((t, i) => i === 0 || t - fut[i - 1] === 3 * H)).toBe(true);
    expect(fut.at(-1)! - NOW_REAL).toBeGreaterThan(5.5 * 24 * H);
  });
  it('is strictly ascending', () => {
    expect(tl.frames.every((t, i) => i === 0 || t > tl.frames[i - 1])).toBe(true);
  });
  it('falls back to the wall clock without radar and to a clouds-only grid without rain axes', () => {
    const tl2 = buildTimeline({ [LAYER_NAMES.clouds]: axes[LAYER_NAMES.clouds] }, NOW_REAL);
    expect(tl2.nowMs).toBe(Math.floor(NOW_REAL / (5 * MIN)) * 5 * MIN);
    expect(tl2.frames.length - tl2.nowIdx - 1).toBeGreaterThan(40);
  });
});

describe('playbackRange', () => {
  const tl = buildTimeline(axes, NOW_REAL);
  it('past/now: the observed 24 h', () => {
    const r = playbackRange(tl, tl.frames[3], []);
    expect(r[0]).toBe(tl.frames[0]);
    expect(r.at(-1)).toBe(tl.nowMs);
    expect(r).toHaveLength(tl.nowIdx + 1);
  });
  it('inside the trip days: those days only', () => {
    const d1 = new Date(Date.UTC(2026, 9, 24, 12)).getTime();
    const r = playbackRange(tl, d1, ['2026-10-24', '2026-10-25']);
    expect(r.length).toBeGreaterThanOrEqual(16);
    expect(r.every((t) => t > tl.nowMs)).toBe(true);
  });
  it('future outside the trip days: the next 9 frames', () => {
    const t0 = tl.frames[tl.nowIdx + 4];
    const r = playbackRange(tl, t0, []);
    expect(r[0]).toBe(t0);
    expect(r).toHaveLength(9);
  });
});
