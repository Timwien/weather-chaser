import { describe, it, expect } from 'vitest';
import { cloudForecastAxis, cloudHorizon, playbackFrames } from './useWeatherTimeline.ts';
import { LAYER_NAMES } from '../services/dwdLayers.ts';
import { axisEnd, axisTimes } from '../utils/wmsTime.ts';

const H = 3_600_000;
const NOW = Date.UTC(2026, 9, 22, 13, 0); // 22.10.2026 13:00 UTC

describe('cloudForecastAxis', () => {
  it('extends the rain grid in 3-h steps up to the end of the cloud forecast', () => {
    const rainEnd = Date.UTC(2026, 9, 25, 12, 0);
    const axes = { [LAYER_NAMES.forecastEu]: { kind: 'range' as const, start: Date.UTC(2026, 9, 22, 3), end: rainEnd, stepMs: 3 * H } };
    const grid = cloudForecastAxis(axes, NOW)!;
    const times = axisTimes(grid);
    expect(axisEnd(grid)).toBeLessThanOrEqual(cloudHorizon(NOW));
    expect(axisEnd(grid)).toBeGreaterThan(rainEnd);
    expect(cloudHorizon(NOW) - axisEnd(grid)).toBeLessThan(3 * H);
    expect(times.every((t, i) => i === 0 || t - times[i - 1] === 3 * H)).toBe(true);
  });

  it('keeps the rain grid when it already reaches the cloud horizon', () => {
    const axes = { [LAYER_NAMES.forecastEu]: { kind: 'list' as const, times: [NOW, cloudHorizon(NOW)] } };
    expect(axisTimes(cloudForecastAxis(axes, NOW)!)).toHaveLength(2);
  });
});

describe('playbackFrames', () => {
  it('returns the grid instants of the trip days only', () => {
    const grid = { kind: 'range' as const, start: new Date(2026, 9, 23).getTime(), end: new Date(2026, 9, 28).getTime(), stepMs: 3 * H };
    const frames = playbackFrames(grid, ['2026-10-24', '2026-10-25']);
    expect(frames.length).toBeGreaterThanOrEqual(16); // 17 where the 25th has 25 h (DST)
    expect(frames.length).toBeLessThanOrEqual(17);
    expect(new Date(frames[0]).getDate()).toBe(24);
    expect(new Date(frames[frames.length - 1]).getDate()).toBe(25);
    expect(playbackFrames(grid, [])).toEqual([]);
  });
});
