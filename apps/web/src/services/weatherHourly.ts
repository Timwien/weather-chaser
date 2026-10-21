import type { Town, HourlyWeather } from '@weatherchaser/core';
import { fetchJsonWithRetry } from './fetchRetry.ts';
import { fetchInBatches } from './batchFetch.ts';

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

// Always through /api/proxy/weather — Vercel serverless in production, the
// Vite dev API plugin (same function file) in dev.
const WEATHER_PROXY = '/api/proxy/weather';

async function fetchHourlyBatch(
  towns: Town[],
  startDate: string,
  endDate: string,
  deadline: number,
): Promise<HourlyWeatherData[]> {
  const url = new URL(WEATHER_PROXY, self.location.origin);
  url.searchParams.set('latitude', towns.map((t) => t.lat.toFixed(4)).join(','));
  url.searchParams.set('longitude', towns.map((t) => t.lng.toFixed(4)).join(','));
  url.searchParams.set(
    'hourly',
    'temperature_2m,precipitation,sunshine_duration,wind_speed_10m',
  );
  url.searchParams.set('start_date', startDate);
  url.searchParams.set('end_date', endDate);
  url.searchParams.set('timezone', 'auto');

  const raw = await fetchJsonWithRetry(url.toString(), { deadline });
  const dataArray: Array<{ hourly?: HourlyWeather }> = Array.isArray(raw) ? raw : [raw];

  return towns.map((town, idx) => ({
    townId: town.id,
    hourly: dataArray[idx]?.hourly ?? EMPTY_HOURLY,
  }));
}

/**
 * Fetch hourly weather for up to 120 towns: batches of 50 (Open-Meteo limit),
 * max 3 in flight, one overall time budget. Towns whose batch failed are simply
 * missing from the result; throws only if nothing succeeded.
 */
export async function fetchHourlyWeatherBatch(
  towns: Town[],
  startDate: string,
  endDate: string,
): Promise<HourlyWeatherData[]> {
  return fetchInBatches(towns, (batch, deadline) => fetchHourlyBatch(batch, startDate, endDate, deadline));
}
