import type { HourlyWeather, WeatherScore, ScoringWeights } from '../types/index.js';
import { sliceHoursByDays } from './sliceHoursByDays.js';

// Re-export so callers can import sliceHoursByDays from this module (test imports it from here)
export { sliceHoursByDays } from './sliceHoursByDays.js';

// ---------------------------------------------------------------------------
// normalize
// ---------------------------------------------------------------------------

/**
 * Linearly normalizes `v` to [0, 1] given [min, max], clamped at boundaries.
 */
export function normalize(v: number, min: number, max: number): number {
  const scaled = (v - min) / (max - min);
  return Math.min(1, Math.max(0, scaled));
}

// ---------------------------------------------------------------------------
// scoreLocation
// ---------------------------------------------------------------------------

/**
 * Scores a location for a given stay window using weighted normalization.
 *
 * Dimensions:
 *  - sunshine:      normalize(avgSunshineSecondsPerHour, 0, 3600) * 100  (higher = better)
 *  - precipitation: (1 - normalize(totalPrecipMm, 0, 20)) * 100           (lower = better)
 *  - temperature:   normalize(avgTempC, 5, 30) * 100                      (warmer = better)
 *  - wind:          (1 - normalize(avgWindKmh, 0, 50)) * 100              (calmer = better)
 *
 * Composite = sum of (dimensionScore * weight) for all four dimensions.
 */
export function scoreLocation(
  hourlyData: HourlyWeather,
  arrivalDate: Date,
  nightsStay: number,
  weights: ScoringWeights,
): WeatherScore {
  const sliced = sliceHoursByDays(hourlyData, arrivalDate, nightsStay);
  const n = sliced.time.length;

  if (n === 0) {
    // No data in window — return neutral score with zero breakdown
    return {
      composite: 0,
      breakdown: { sunshine: 0, precipitation: 0, temperature: 0, wind: 0 },
    };
  }

  // Compute averages / totals over the stay window
  const avgSunshine = sliced.sunshine_duration.reduce((s, v) => s + v, 0) / n;
  const totalPrecip = sliced.precipitation.reduce((s, v) => s + v, 0);
  const avgTemp = sliced.temperature_2m.reduce((s, v) => s + v, 0) / n;
  const avgWind = sliced.wind_speed_10m.reduce((s, v) => s + v, 0) / n;

  // Normalize each dimension to 0–100
  const sunshineScore = normalize(avgSunshine, 0, 3600) * 100;
  const precipScore = (1 - normalize(totalPrecip, 0, 20)) * 100;
  const tempScore = normalize(avgTemp, 5, 30) * 100;
  const windScore = (1 - normalize(avgWind, 0, 50)) * 100;

  // Weighted composite
  const composite =
    sunshineScore * weights.sunshine +
    precipScore * weights.precipitation +
    tempScore * weights.temperature +
    windScore * weights.wind;

  return {
    composite,
    breakdown: {
      sunshine: sunshineScore,
      precipitation: precipScore,
      temperature: tempScore,
      wind: windScore,
    },
  };
}
