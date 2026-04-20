// Vite module worker — can import from packages/core and services
import { optimizeRoute, scoreDailyLocation, PRESETS } from '@weatherchaser/core';
import type { Town, OptimizerInput, WeatherScore, ScoringWeights } from '@weatherchaser/core';
import { fetchWeatherBatch } from '../services/weather.ts';
import { fetchDistanceMatrix } from '../services/osrm.ts';
import { fetchTownsInArea, fetchTownsInPolygon } from '../services/overpass.ts';
import type { BoundingBox } from '../services/nominatim.ts';

/** Maximum towns passed to the optimizer — keeps weather + matrix calls fast */
const MAX_TOWNS = 120;

export interface SearchAreaSpec {
  type: 'place' | 'polygon' | 'radius' | 'pinned';
  bbox?: [number, number, number, number]; // [west, south, east, north]
  polygon?: [number, number][];
  /** For pinned: exact city coordinates (skip Overpass, use only this town) */
  lat?: number;
  lng?: number;
  name?: string;
}

export interface OptimizerWorkerInput {
  type: 'run';
  searchAreas: SearchAreaSpec[];
  config: {
    startDate: string;
    endDate: string;
    totalDays: number;
    maxStay: number;
    preset: string;
    startLat: number | null;
    startLng: number | null;
    mustVisitCoords: Array<{ lat: number; lng: number; name: string }>;
  };
}

export type OptimizerWorkerOutput =
  | { type: 'progress'; step: 'finding_towns' | 'fetching_weather' | 'optimizing_route' }
  | { type: 'complete'; result: ReturnType<typeof optimizeRoute> }
  | { type: 'error'; message: string };

self.onmessage = async (event: MessageEvent<OptimizerWorkerInput>) => {
  if (event.data.type !== 'run') return;
  const { searchAreas, config } = event.data;

  try {
    // ── Step 1: Fetch towns from each area in parallel ──────────────────────
    self.postMessage({ type: 'progress', step: 'finding_towns' } satisfies OptimizerWorkerOutput);

    const townArrays = await Promise.all(
      searchAreas.map(async (area) => {
        if (area.type === 'pinned' && area.lat !== undefined && area.lng !== undefined && area.name) {
          // Exact city — skip Overpass, use the supplied coordinates directly
          return [{ id: `pinned-${area.name}`, name: area.name, lat: area.lat, lng: area.lng }] as Town[];
        }
        if (area.type === 'polygon' && area.polygon) {
          return fetchTownsInPolygon(area.polygon);
        }
        if (area.bbox) {
          const [west, south, east, north] = area.bbox;
          return fetchTownsInArea({ south, north, west, east } as BoundingBox);
        }
        return [] as Town[];
      }),
    );

    // Merge, deduplicate, sort by population, cap at MAX_TOWNS
    const seen = new Set<string>();
    const merged: Town[] = [];
    for (const arr of townArrays) {
      for (const town of arr) {
        if (!seen.has(town.id)) {
          seen.add(town.id);
          merged.push(town);
        }
      }
    }

    if (merged.length === 0) {
      self.postMessage({ type: 'error', message: 'no_towns' } satisfies OptimizerWorkerOutput);
      return;
    }

    // Prioritise by population, then cap
    merged.sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
    let towns = merged.slice(0, MAX_TOWNS);

    // Inject must-visit towns (add any not already in the list by name)
    const mustVisitTowns: Town[] = config.mustVisitCoords.map((c, i) => ({
      id: `must-visit-${i}`,
      name: c.name,
      lat: c.lat,
      lng: c.lng,
    }));
    for (const mv of mustVisitTowns) {
      const alreadyPresent = towns.some(
        (t) => t.name.toLowerCase() === mv.name.toLowerCase(),
      );
      if (!alreadyPresent) towns.push(mv);
    }

    // ── Step 2: Fetch weather ───────────────────────────────────────────────
    self.postMessage({ type: 'progress', step: 'fetching_weather' } satisfies OptimizerWorkerOutput);
    const weatherData = await fetchWeatherBatch(towns, config.startDate, config.endDate);

    const weights: ScoringWeights = {
      ...(PRESETS[config.preset as keyof typeof PRESETS] ?? PRESETS['sightseeing']),
    };

    const weatherScores: WeatherScore[] = towns.map((town) => {
      const data = weatherData.find((d) => d.townId === town.id);
      if (!data) {
        return { composite: 0, breakdown: { sunshine: 0, precipitation: 0, temperature: 0, wind: 0 } };
      }
      return scoreDailyLocation(data.daily, new Date(config.startDate), 1, weights);
    });

    // ── Step 3: Distance matrix + optimize ─────────────────────────────────
    self.postMessage({ type: 'progress', step: 'optimizing_route' } satisfies OptimizerWorkerOutput);

    const matrix = await fetchDistanceMatrix(towns);
    const distanceKm = matrix.distances.map((row) => row.map((d) => d / 1000));

    // Find closest town to requested start location
    let startIndex = 0;
    if (config.startLat !== null && config.startLng !== null) {
      const startLat = config.startLat;
      const startLng = config.startLng;
      let minDist = Infinity;
      towns.forEach((t, i) => {
        const d = Math.hypot(t.lat - startLat, t.lng - startLng);
        if (d < minDist) { minDist = d; startIndex = i; }
      });
    }

    const mustVisitIndices = mustVisitTowns
      .map((mv) => towns.findIndex((t) => t.name.toLowerCase() === mv.name.toLowerCase()))
      .filter((i) => i !== -1);

    const optimizerInput: OptimizerInput = {
      towns,
      distanceMatrix: distanceKm,
      durationMatrix: matrix.durations,
      weatherScores,
      config: {
        startIndex,
        totalDays: config.totalDays,
        maxStay: config.maxStay,
        mustVisitIndices,
        startDate: new Date(config.startDate),
        weights,
      },
    };

    const result = optimizeRoute(optimizerInput);

    // Attach real weather averages to each stop so the UI can show
    // actual values (°C, mm, km/h, hours) instead of 0–100 scores.
    const avg = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const stopsWithWeather = result.stops.map((stop) => {
      const wd = weatherData.find((d) => d.townId === stop.town.id);
      if (!wd || wd.daily.time.length === 0) return stop;
      const { daily } = wd;
      // Re-score at actual arrival date + nights (initial scores were all at startDate/1-night)
      const score = scoreDailyLocation(daily, stop.arrivalDate, stop.nights, weights);
      return {
        ...stop,
        score,
        weatherAvg: {
          sunshineHoursPerDay: avg(daily.sunshine_duration) / 3600,
          precipitationMmPerDay: avg(daily.precipitation_sum),
          tempMaxC: avg(daily.temperature_2m_max),
          windKmh: avg(daily.wind_speed_10m_max),
        },
      };
    });

    self.postMessage({
      type: 'complete',
      result: { ...result, stops: stopsWithWeather },
    } satisfies OptimizerWorkerOutput);
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : 'unknown_error',
    } satisfies OptimizerWorkerOutput);
  }
};
