import type { Town, DailyWeather } from '@weatherchaser/core';
import { fetchJsonWithRetry } from './fetchRetry.ts';
import { fetchInBatches } from './batchFetch.ts';

export interface WeatherData {
  townId: string;
  daily: DailyWeather;
}

const EMPTY_DAILY: DailyWeather = {
  time: [],
  temperature_2m_max: [],
  temperature_2m_min: [],
  precipitation_sum: [],
  sunshine_duration: [],
  wind_speed_10m_max: [],
};

// Always through /api/proxy/weather — Vercel serverless in production, the
// Vite dev API plugin (same function file) in dev.
const WEATHER_PROXY = '/api/proxy/weather';

/**
 * Fetch daily weather aggregates for a list of towns from Open-Meteo.
 * Batches of 50, max 3 in flight, one overall time budget (see batchFetch.ts).
 * Towns whose batch failed are missing from the result; throws only if no
 * batch succeeded.
 */
export async function fetchWeatherBatch(
  towns: Town[],
  startDate: string,
  endDate: string,
): Promise<WeatherData[]> {
  return fetchInBatches(towns, (batch, deadline) => fetchBatch(batch, startDate, endDate, deadline));
}

async function fetchBatch(
  towns: Town[],
  startDate: string,
  endDate: string,
  deadline: number,
): Promise<WeatherData[]> {
  const url = new URL(WEATHER_PROXY, self.location.origin);
  url.searchParams.set('latitude', towns.map((t) => t.lat.toFixed(4)).join(','));
  url.searchParams.set('longitude', towns.map((t) => t.lng.toFixed(4)).join(','));
  url.searchParams.set(
    'daily',
    'temperature_2m_max,temperature_2m_min,precipitation_sum,sunshine_duration,wind_speed_10m_max',
  );
  url.searchParams.set('start_date', startDate);
  url.searchParams.set('end_date', endDate);
  url.searchParams.set('timezone', 'auto');

  // Single location → object; multiple → array
  const raw = await fetchJsonWithRetry(url.toString(), { deadline });
  const dataArray: Array<{ daily?: DailyWeather }> = Array.isArray(raw) ? raw : [raw];

  return towns.map((town, idx) => ({
    townId: town.id,
    daily: dataArray[idx]?.daily ?? EMPTY_DAILY,
  }));
}
