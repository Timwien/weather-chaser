import type { Town, HourlyWeather } from '@weatherchaser/core';
import { fetchJsonWithRetry } from './fetchRetry.ts';

export type { HourlyWeather };

export interface HourlyWeatherData {
  townId: string;
  hourly: HourlyWeather;
}

const EMPTY_HOURLY: HourlyWeather = {
  time: [],
  temperature_2m: [],
  precipitation: [],
  sunshine_duration: [],
  wind_speed_10m: [],
};

// In production: route through /api/proxy/weather (Vercel serverless)
// In dev: call Open-Meteo directly (no Vercel CLI required for local dev)
const WEATHER_PROXY = '/api/proxy/weather';
const WEATHER_DIRECT = 'https://api.open-meteo.com/v1/forecast';

async function fetchHourlyBatch(
  towns: Town[],
  startDate: string,
  endDate: string,
): Promise<HourlyWeatherData[]> {
  const base = import.meta.env.PROD ? WEATHER_PROXY : WEATHER_DIRECT;
  const url = new URL(base, self.location.origin);
  url.searchParams.set('latitude', towns.map((t) => t.lat.toFixed(4)).join(','));
  url.searchParams.set('longitude', towns.map((t) => t.lng.toFixed(4)).join(','));
  url.searchParams.set(
    'hourly',
    'temperature_2m,precipitation,sunshine_duration,wind_speed_10m',
  );
  url.searchParams.set('start_date', startDate);
  url.searchParams.set('end_date', endDate);
  url.searchParams.set('timezone', 'auto');

  const raw = await fetchJsonWithRetry(url.toString());
  const dataArray: Array<{ hourly?: HourlyWeather }> = Array.isArray(raw) ? raw : [raw];

  return towns.map((town, idx) => ({
    townId: town.id,
    hourly: dataArray[idx]?.hourly ?? EMPTY_HOURLY,
  }));
}

/** Split-on-failure wrapper — see weather.ts fetchBatchResilient for rationale. */
async function fetchHourlyBatchResilient(
  towns: Town[],
  startDate: string,
  endDate: string,
): Promise<HourlyWeatherData[]> {
  try {
    return await fetchHourlyBatch(towns, startDate, endDate);
  } catch (err) {
    if (towns.length <= 8) throw err;
    const mid = Math.ceil(towns.length / 2);
    const [a, b] = await Promise.all([
      fetchHourlyBatchResilient(towns.slice(0, mid), startDate, endDate),
      fetchHourlyBatchResilient(towns.slice(mid), startDate, endDate),
    ]);
    return [...a, ...b];
  }
}

/** Fetch hourly weather for up to 120 towns, batching at 50 per request (Open-Meteo limit). */
export async function fetchHourlyWeatherBatch(
  towns: Town[],
  startDate: string,
  endDate: string,
): Promise<HourlyWeatherData[]> {
  if (towns.length === 0) return [];
  const BATCH_SIZE = 50;
  const results: HourlyWeatherData[] = [];
  for (let i = 0; i < towns.length; i += BATCH_SIZE) {
    results.push(...await fetchHourlyBatchResilient(towns.slice(i, i + BATCH_SIZE), startDate, endDate));
  }
  return results;
}
