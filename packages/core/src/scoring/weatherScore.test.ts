import { describe, it, expect } from 'vitest';
import { normalize, sliceHoursByDays, scoreLocation } from './weatherScore.js';
import { PRESETS } from './presets.js';
import type { HourlyWeather, ScoringWeights } from '../types/index.js';

// ---------------------------------------------------------------------------
// Helpers: build synthetic HourlyWeather datasets
// ---------------------------------------------------------------------------

/**
 * Build n days of hourly data starting at the given startDate (ISO date string).
 * Each hour gets the same values for every metric.
 */
function buildHourlyData(
  startDateStr: string,
  days: number,
  values: { temp: number; precip: number; sunshine: number; wind: number },
): HourlyWeather {
  const time: string[] = [];
  const temperature_2m: number[] = [];
  const precipitation: number[] = [];
  const sunshine_duration: number[] = [];
  const wind_speed_10m: number[] = [];

  const startDate = new Date(`${startDateStr}T00:00:00Z`);
  for (let d = 0; d < days; d++) {
    for (let h = 0; h < 24; h++) {
      const ts = new Date(startDate.getTime() + (d * 24 + h) * 3_600_000);
      time.push(ts.toISOString());
      temperature_2m.push(values.temp);
      precipitation.push(values.precip);
      sunshine_duration.push(values.sunshine);
      wind_speed_10m.push(values.wind);
    }
  }
  return { time, temperature_2m, precipitation, sunshine_duration, wind_speed_10m };
}

// ---------------------------------------------------------------------------
// normalize()
// ---------------------------------------------------------------------------

describe('normalize', () => {
  it('returns 0 for v == min', () => {
    expect(normalize(0, 0, 100)).toBe(0);
  });

  it('returns 1 for v == max', () => {
    expect(normalize(100, 0, 100)).toBe(1);
  });

  it('clamps to 1 when v > max', () => {
    expect(normalize(150, 0, 100)).toBe(1);
  });

  it('clamps to 0 when v < min', () => {
    expect(normalize(-10, 0, 100)).toBe(0);
  });

  it('returns 0.5 for midpoint', () => {
    expect(normalize(50, 0, 100)).toBeCloseTo(0.5);
  });
});

// ---------------------------------------------------------------------------
// sliceHoursByDays()
// ---------------------------------------------------------------------------

describe('sliceHoursByDays', () => {
  it('returns exactly 24 hours when arrival=day2, nights=1 from a 3-day dataset', () => {
    // 3-day dataset starting 2024-07-10
    const data = buildHourlyData('2024-07-10', 3, { temp: 20, precip: 0, sunshine: 1800, wind: 10 });
    // Arrive on day 2 = 2024-07-11, stay 1 night
    const sliced = sliceHoursByDays(data, new Date('2024-07-11T00:00:00Z'), 1);
    expect(sliced.time).toHaveLength(24);
    // All timestamps should belong to July 11
    sliced.time.forEach(t => expect(t.startsWith('2024-07-11')).toBe(true));
  });

  it('returns exactly 48 hours when arrival=day1, nights=2 from a 3-day dataset', () => {
    const data = buildHourlyData('2024-07-10', 3, { temp: 20, precip: 0, sunshine: 1800, wind: 10 });
    // Arrive on day 1 = 2024-07-10, stay 2 nights → July 10 + July 11
    const sliced = sliceHoursByDays(data, new Date('2024-07-10T00:00:00Z'), 2);
    expect(sliced.time).toHaveLength(48);
    sliced.time.slice(0, 24).forEach(t => expect(t.startsWith('2024-07-10')).toBe(true));
    sliced.time.slice(24).forEach(t => expect(t.startsWith('2024-07-11')).toBe(true));
  });

  it('returns 0 hours when arrival date is outside the dataset', () => {
    const data = buildHourlyData('2024-07-10', 3, { temp: 20, precip: 0, sunshine: 1800, wind: 10 });
    const sliced = sliceHoursByDays(data, new Date('2024-08-01T00:00:00Z'), 1);
    expect(sliced.time).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// scoreLocation()
// ---------------------------------------------------------------------------

describe('scoreLocation', () => {
  const equalWeights: ScoringWeights = {
    sunshine: 0.25,
    precipitation: 0.25,
    temperature: 0.25,
    wind: 0.25,
  };

  it('returns composite ≈ 100 for perfect weather with equal weights', () => {
    // max sunshine (3600 s/h), 0 precip, 30°C, 0 wind
    const data = buildHourlyData('2024-07-10', 1, { temp: 30, precip: 0, sunshine: 3600, wind: 0 });
    const result = scoreLocation(data, new Date('2024-07-10T00:00:00Z'), 1, equalWeights);
    expect(result.composite).toBeCloseTo(100, 0);
  });

  it('returns composite ≈ 0 for bad weather with equal weights', () => {
    // 0 sunshine, 20mm precip (max), 5°C (min), 50 km/h wind (max)
    const data = buildHourlyData('2024-07-10', 1, { temp: 5, precip: 20, sunshine: 0, wind: 50 });
    const result = scoreLocation(data, new Date('2024-07-10T00:00:00Z'), 1, equalWeights);
    expect(result.composite).toBeCloseTo(0, 0);
  });

  it('returns breakdown with all four dimensions', () => {
    const data = buildHourlyData('2024-07-10', 1, { temp: 20, precip: 5, sunshine: 1800, wind: 15 });
    const result = scoreLocation(data, new Date('2024-07-10T00:00:00Z'), 1, equalWeights);
    expect(result.breakdown).toHaveProperty('sunshine');
    expect(result.breakdown).toHaveProperty('precipitation');
    expect(result.breakdown).toHaveProperty('temperature');
    expect(result.breakdown).toHaveProperty('wind');
  });

  it('only uses hours within the stay window (temporal slicing)', () => {
    // 3-day dataset: day 1 = bad weather, day 2 = perfect weather
    const data: HourlyWeather = {
      time: [],
      temperature_2m: [],
      precipitation: [],
      sunshine_duration: [],
      wind_speed_10m: [],
    };
    // Day 1: bad weather
    for (let h = 0; h < 24; h++) {
      const ts = new Date(new Date('2024-07-10T00:00:00Z').getTime() + h * 3_600_000);
      data.time.push(ts.toISOString());
      data.temperature_2m.push(5);
      data.precipitation.push(20);
      data.sunshine_duration.push(0);
      data.wind_speed_10m.push(50);
    }
    // Day 2: perfect weather
    for (let h = 0; h < 24; h++) {
      const ts = new Date(new Date('2024-07-11T00:00:00Z').getTime() + h * 3_600_000);
      data.time.push(ts.toISOString());
      data.temperature_2m.push(30);
      data.precipitation.push(0);
      data.sunshine_duration.push(3600);
      data.wind_speed_10m.push(0);
    }
    // Score for day 2 only → should be ≈ 100
    const resultDay2 = scoreLocation(data, new Date('2024-07-11T00:00:00Z'), 1, equalWeights);
    expect(resultDay2.composite).toBeCloseTo(100, 0);

    // Score for day 1 only → should be ≈ 0
    const resultDay1 = scoreLocation(data, new Date('2024-07-10T00:00:00Z'), 1, equalWeights);
    expect(resultDay1.composite).toBeCloseTo(0, 0);
  });

  it('beach and sightseeing presets produce different composites for identical weather data', () => {
    // Some rainy, calm, warm data where precipitation weighting matters
    const data = buildHourlyData('2024-07-10', 2, { temp: 25, precip: 10, sunshine: 1800, wind: 5 });
    const arrival = new Date('2024-07-10T00:00:00Z');
    const beachScore = scoreLocation(data, arrival, 2, PRESETS.beach);
    const sightScore = scoreLocation(data, arrival, 2, PRESETS.sightseeing);
    // Sightseeing weights precipitation more (0.4 vs 0.3), so higher precip hurts sightseeing more
    expect(beachScore.composite).not.toBeCloseTo(sightScore.composite, 0);
  });

  it('all three presets produce different composites for identical weather data', () => {
    const data = buildHourlyData('2024-07-10', 2, { temp: 25, precip: 10, sunshine: 1800, wind: 5 });
    const arrival = new Date('2024-07-10T00:00:00Z');
    const beach = scoreLocation(data, arrival, 2, PRESETS.beach);
    const hiking = scoreLocation(data, arrival, 2, PRESETS.hiking);
    const sightseeing = scoreLocation(data, arrival, 2, PRESETS.sightseeing);
    const composites = [beach.composite, hiking.composite, sightseeing.composite];
    // At least two should differ (given weights differ)
    const allSame = composites.every(c => Math.abs(c - composites[0]) < 0.01);
    expect(allSame).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PRESETS
// ---------------------------------------------------------------------------

describe('PRESETS', () => {
  it('has beach, hiking, sightseeing keys', () => {
    expect(PRESETS).toHaveProperty('beach');
    expect(PRESETS).toHaveProperty('hiking');
    expect(PRESETS).toHaveProperty('sightseeing');
  });

  it('all preset weights sum to 1', () => {
    for (const [name, weights] of Object.entries(PRESETS)) {
      const sum = weights.sunshine + weights.precipitation + weights.temperature + weights.wind;
      expect(sum).toBeCloseTo(1.0, 5);
    }
  });

  it('presets have different weight distributions', () => {
    expect(PRESETS.beach.precipitation).not.toBe(PRESETS.sightseeing.precipitation);
  });
});
