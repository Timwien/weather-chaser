// Vite module worker — fetches towns + hourly weather for the finder mode
import type { Town } from '@weatherchaser/core';
import { fetchHourlyWeatherBatch } from '../services/weatherHourly.ts';
import { fetchTownsInRadius } from '../services/overpass.ts';
import type { HourlyWeatherData } from '../services/weatherHourly.ts';

const MAX_TOWNS = 120;

export interface FinderWorkerInput {
  type: 'run';
  config: {
    startLat: number;
    startLng: number;
    radiusKm: number;
    startDate: string;   // ISO YYYY-MM-DD
    endDate: string;     // ISO YYYY-MM-DD
  };
}

export type FinderWorkerOutput =
  | { type: 'progress'; step: 'finding_towns' | 'fetching_weather' }
  | { type: 'complete'; towns: Town[]; hourlyData: HourlyWeatherData[] }
  | { type: 'error'; message: string };

self.onmessage = async (event: MessageEvent<FinderWorkerInput>) => {
  if (event.data.type !== 'run') return;
  const { config } = event.data;

  try {
    // Step 1: fetch all towns within radius
    self.postMessage({ type: 'progress', step: 'finding_towns' } satisfies FinderWorkerOutput);

    const allTowns = await fetchTownsInRadius(
      config.startLat,
      config.startLng,
      config.radiusKm,
    );

    if (allTowns.length === 0) {
      self.postMessage({ type: 'error', message: 'no_towns' } satisfies FinderWorkerOutput);
      return;
    }

    // Deduplicate by id, sort by population desc, cap at MAX_TOWNS
    const seen = new Set<string>();
    const unique: Town[] = [];
    for (const town of allTowns) {
      if (!seen.has(town.id)) {
        seen.add(town.id);
        unique.push(town);
      }
    }
    unique.sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
    const towns = unique.slice(0, MAX_TOWNS);

    // Step 2: fetch hourly weather for all towns
    self.postMessage({ type: 'progress', step: 'fetching_weather' } satisfies FinderWorkerOutput);

    const hourlyData = await fetchHourlyWeatherBatch(
      towns,
      config.startDate,
      config.endDate,
    );

    // Post raw data — scoring happens in the main thread
    self.postMessage({
      type: 'complete',
      towns,
      hourlyData,
    } satisfies FinderWorkerOutput);

  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : 'unknown_error',
    } satisfies FinderWorkerOutput);
  }
};
