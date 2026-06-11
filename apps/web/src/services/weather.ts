import type { Town, DailyWeather } from '@weatherchaser/core';
import { fetchJsonWithRetry } from './fetchRetry.ts';

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

// In production: route through /api/proxy/weather (Vercel serverless)
// In dev: call Open-Meteo directly (no Vercel CLI required for local dev)
const WEATHER_PROXY = '/api/proxy/weather';
const WEATHER_DIRECT = 'https://api.open-meteo.com/v1/forecast';

/**
 * Fetch daily weather aggregates for a list of towns from Open-Meteo.
 * Batches requests in groups of 50 (API practical limit). Each batch is
 * retried on transient failures and recursively split in half when a whole
 * batch keeps failing — large multi-location requests are the first to die
 * when Open-Meteo is degraded.
 */
export async function fetchWeatherBatch(
  towns: Town[],
  startDate: string,
  endDate: string,
): Promise<WeatherData[]> {
  if (towns.length === 0) return [];

  const BATCH_SIZE = 50;
  const results: WeatherData[] = [];

  for (let i = 0; i < towns.length; i += BATCH_SIZE) {
    const batch = towns.slice(i, i + BATCH_SIZE);
    const batchResults = await fetchBatchResilient(batch, startDate, endDate);
    results.push(...batchResults);
  }

  return results;
}

async function fetchBatchResilient(
  towns: Town[],
  startDate: string,
  endDate: string,
): Promise<WeatherData[]> {
  try {
    return await fetchBatch(towns, startDate, endDate);
  } catch (err) {
    // Split-on-failure: halve the batch until single-digit sizes, then give up
    if (towns.length <= 8) throw err;
    const mid = Math.ceil(towns.length / 2);
    const [a, b] = await Promise.all([
      fetchBatchResilient(towns.slice(0, mid), startDate, endDate),
      fetchBatchResilient(towns.slice(mid), startDate, endDate),
    ]);
    return [...a, ...b];
  }
}

async function fetchBatch(
  towns: Town[],
  startDate: string,
  endDate: string,
): Promise<WeatherData[]> {
  const base = import.meta.env.PROD ? WEATHER_PROXY : WEATHER_DIRECT;
  const url = new URL(base, self.location.origin);
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
  const raw = await fetchJsonWithRetry(url.toString());
  const dataArray: Array<{ daily?: DailyWeather }> = Array.isArray(raw) ? raw : [raw];

  return towns.map((town, idx) => ({
    townId: town.id,
    daily: dataArray[idx]?.daily ?? EMPTY_DAILY,
  }));
}
