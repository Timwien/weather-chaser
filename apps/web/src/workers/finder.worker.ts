// Vite module worker — fetches towns + hourly weather for the finder mode
import type { Town } from '@weatherchaser/core';
import { fetchHourlyWeatherBatch } from '../services/weatherHourly.ts';
import { fetchTownsInRadius, fetchTownsInPolygon } from '../services/overpass.ts';
import type { SearchGranularity } from '../services/overpass.ts';
import type { HourlyWeatherData } from '../services/weatherHourly.ts';
import { dedupeByWeatherCell } from '../utils/spatialDedupe.ts';
import { classifyError, type AppErrorCode } from '../services/errorCodes.ts';

const MAX_TOWNS = 120;

export interface FinderWorkerInput {
  type: 'run';
  config: {
    mode: 'around' | 'polygon' | 'multi-place';
    // 'around' mode fields
    startLat?: number;
    startLng?: number;
    radiusKm?: number;
    // 'polygon' mode fields
    polygon?: [number, number][];
    // 'multi-place' mode fields — towns passed directly, Overpass skipped
    towns?: Town[];
    startDate: string;   // ISO YYYY-MM-DD
    endDate: string;     // ISO YYYY-MM-DD
    /** Place granularity for Overpass queries (default 'auto') */
    granularity?: SearchGranularity;
    /** F4: UI language for localized OSM place names (default 'en') */
    lang?: string;
  };
}

export type FinderWorkerOutput =
  | { type: 'progress'; step: 'finding_towns' | 'fetching_weather' }
  | { type: 'complete'; towns: Town[]; hourlyData: HourlyWeatherData[] }
  | { type: 'error'; code: AppErrorCode };

self.onmessage = async (event: MessageEvent<FinderWorkerInput>) => {
  if (event.data.type !== 'run') return;
  const { config } = event.data;

  try {
    // Step 1: resolve town list based on mode
    self.postMessage({ type: 'progress', step: 'finding_towns' } satisfies FinderWorkerOutput);

    let towns: Town[];

    if (config.mode === 'multi-place') {
      // Use the exact places the user entered — no Overpass call
      towns = config.towns ?? [];
    } else if (config.mode === 'polygon') {
      if (!config.polygon || config.polygon.length === 0) {
        self.postMessage({ type: 'error', code: 'missing_polygon' } satisfies FinderWorkerOutput);
        return;
      }
      const allTowns = await fetchTownsInPolygon(config.polygon, config.granularity ?? 'auto', config.lang ?? 'en');
      towns = deduplicateAndCap(allTowns);
    } else {
      // 'around' mode
      if (config.startLat === undefined || config.startLng === undefined || config.radiusKm === undefined) {
        self.postMessage({ type: 'error', code: 'missing_coords' } satisfies FinderWorkerOutput);
        return;
      }
      const allTowns = await fetchTownsInRadius(
        config.startLat, config.startLng, config.radiusKm, config.granularity ?? 'auto', config.lang ?? 'en',
      );
      towns = deduplicateAndCap(allTowns);
    }

    if (towns.length === 0) {
      self.postMessage({ type: 'error', code: 'no_towns' } satisfies FinderWorkerOutput);
      return;
    }

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
      code: classifyError(err),
    } satisfies FinderWorkerOutput);
  }
};

function deduplicateAndCap(allTowns: Town[]): Town[] {
  const seen = new Set<string>();
  const unique: Town[] = [];
  for (const town of allTowns) {
    if (!seen.has(town.id)) {
      seen.add(town.id);
      unique.push(town);
    }
  }
  // One place per ~12 km weather-model cell (Open-Meteo grid ~11 km) —
  // adjacent villages have identical forecasts, so keep the biggest only
  const thinned = dedupeByWeatherCell(unique);
  thinned.sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
  return thinned.slice(0, MAX_TOWNS);
}
