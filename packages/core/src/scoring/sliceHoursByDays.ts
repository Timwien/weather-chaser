import type { HourlyWeather } from '../types/index.js';

/**
 * Returns a subset of `hourlyData` containing only the hours that fall within
 * the calendar days of the stay window.
 *
 * Stay window: [arrivalDate, arrivalDate + nightsStay) exclusive of checkout day.
 * E.g. arrivalDate = 2024-07-10, nightsStay = 2 → include July 10 and July 11 only.
 *
 * Matching is done by ISO date prefix (first 10 chars: YYYY-MM-DD) in UTC.
 */
export function sliceHoursByDays(
  hourlyData: HourlyWeather,
  arrivalDate: Date,
  nightsStay: number,
): HourlyWeather {
  // Build the set of UTC date strings that fall within the stay
  const dates = new Set<string>();
  for (let i = 0; i < nightsStay; i++) {
    const d = new Date(arrivalDate.getTime() + i * 86_400_000);
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
