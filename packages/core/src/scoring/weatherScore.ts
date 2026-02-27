import type { HourlyWeather, WeatherScore, ScoringWeights } from '../types/index.js';

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
// sliceHoursByDays
// ---------------------------------------------------------------------------

/**
 * Returns a subset of `hourlyData` containing only the hours that fall within
 * the calendar days of the stay window.
 *
 * Stay window: [arrivalDate, arrivalDate + nightsStay) exclusive of checkout day.
 * E.g. arrivalDate = 2024-07-10, nightsStay = 2 → include July 10 and July 11 only.
 *
 * Matching is done by ISO date prefix (first 10 chars: YYYY-MM-DD).
 */
export function sliceHoursByDays(
  hourlyData: HourlyWeather,
  arrivalDate: Date,
  nightsStay: number,
): HourlyWeather {
  // Build the set of date strings that fall within the stay
  const dates = new Set<string>();
  for (let i = 0; i < nightsStay; i++) {
    const d = new Date(arrivalDate.getTime() + i * 86_400_000);
    // Always format as UTC date to match ISO timestamps
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    dates.add(`${yyyy}-${mm}-${dd}`);
  }

  const indices: number[] = [];
  for (let i = 0; i < hourlyData.time.length; i++) {
    // First 10 chars of ISO timestamp = YYYY-MM-DD
    if (dates.has(hourlyData.time[i].slice(0, 10))) {
      indices.push(i);
    }
  }

  return {
    time: indices.map(i => hourlyData.time[i]),
    temperature_2m: indices.map(i => hourlyData.temperature_2m[i]),
    precipitation: indices.map(i => hourlyData.precipitation[i]),
    sunshine_duration: indices.map(i => hourlyData.sunshine_duration[i]),
    wind_speed_10m: indices.map(i => hourlyData.wind_speed_10m[i]),
  };
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
