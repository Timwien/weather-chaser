import type { Town, HourlyWeather } from '@weatherchaser/core';

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

async function fetchHourlyBatch(
  towns: Town[],
  startDate: string,
  endDate: string,
): Promise<HourlyWeatherData[]> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', towns.map((t) => t.lat.toFixed(4)).join(','));
  url.searchParams.set('longitude', towns.map((t) => t.lng.toFixed(4)).join(','));
  url.searchParams.set(
    'hourly',
    'temperature_2m,precipitation,sunshine_duration,wind_speed_10m',
  );
  url.searchParams.set('start_date', startDate);
  url.searchParams.set('end_date', endDate);
  url.searchParams.set('timezone', 'auto');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);

  const raw: unknown = await res.json();
  const dataArray: Array<{ hourly?: HourlyWeather }> = Array.isArray(raw) ? raw : [raw];

  return towns.map((town, idx) => ({
    townId: town.id,
    hourly: dataArray[idx]?.hourly ?? EMPTY_HOURLY,
  }));
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
    results.push(...await fetchHourlyBatch(towns.slice(i, i + BATCH_SIZE), startDate, endDate));
  }
  return results;
}
