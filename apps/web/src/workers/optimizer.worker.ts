// Vite module worker — can import from packages/core and services
import { optimizeRoute, scoreDailyLocation, PRESETS } from '@weatherchaser/core';
import type { Town, OptimizerInput, WeatherScore, ScoringWeights } from '@weatherchaser/core';
import { fetchWeatherBatch } from '../services/weather.ts';
import { fetchDistanceMatrix } from '../services/osrm.ts';
import { fetchTownsInArea, fetchTownsInPolygon } from '../services/overpass.ts';
import type { SearchGranularity } from '../services/overpass.ts';
import type { BoundingBox } from '../services/nominatim.ts';
import { dedupeByWeatherCell } from '../utils/spatialDedupe.ts';
import { classifyError, type AppErrorCode } from '../services/errorCodes.ts';

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
    /** Premium: overrides the preset weights when set (validated server-side) */
    customWeights?: ScoringWeights | null;
    /** Place granularity for Overpass queries (default 'auto') */
    granularity?: SearchGranularity;
    /** F4: UI language for localized OSM place names (default 'en') */
    lang?: string;
  };
}

export type OptimizerWorkerOutput =
  | { type: 'progress'; step: 'finding_towns' | 'fetching_weather' | 'optimizing_route' }
  | { type: 'complete'; result: ReturnType<typeof optimizeRoute> }
  | { type: 'error'; code: AppErrorCode };

self.onmessage = async (event: MessageEvent<OptimizerWorkerInput>) => {
  if (event.data.type !== 'run') return;
  const { searchAreas, config } = event.data;

  try {
    // ── Step 1: Fetch towns from each area in parallel ──────────────────────
    self.postMessage({ type: 'progress', step: 'finding_towns' } satisfies OptimizerWorkerOutput);

    const granularity = config.granularity ?? 'auto';
    const lang = config.lang ?? 'en';
    const townArrays = await Promise.all(
      searchAreas.map(async (area) => {
        if (area.type === 'pinned' && area.lat !== undefined && area.lng !== undefined && area.name) {
          // Exact city — skip Overpass, use the supplied coordinates directly
          return [{ id: `pinned-${area.name}`, name: area.name, lat: area.lat, lng: area.lng }] as Town[];
        }
        if (area.type === 'polygon' && area.polygon) {
          return fetchTownsInPolygon(area.polygon, granularity, lang);
        }
        if (area.bbox) {
          const [west, south, east, north] = area.bbox;
          return fetchTownsInArea({ south, north, west, east } as BoundingBox, granularity, lang);
        }
        return [] as Town[];
      }),
    );

    // Merge + deduplicate by id; keep user-pinned cities separate — they must
    // never be dropped by the spatial dedup below
    const seen = new Set<string>();
    const pinned: Town[] = [];
    const fetched: Town[] = [];
    for (const arr of townArrays) {
      for (const town of arr) {
        if (seen.has(town.id)) continue;
        seen.add(town.id);
        (town.id.startsWith('pinned-') ? pinned : fetched).push(town);
      }
    }

    if (pinned.length === 0 && fetched.length === 0) {
      self.postMessage({ type: 'error', code: 'no_towns' } satisfies OptimizerWorkerOutput);
      return;
    }

    // Spatial dedup: Open-Meteo's model grid is ~11 km — keep only the most
    // populous place per ~12 km cell. Cuts weather calls + matrix size sharply
    // for drawn areas without losing any weather information.
    const thinned = dedupeByWeatherCell(fetched);

    // Prioritise by population, cap, then re-attach pinned cities
    thinned.sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
    let towns = [...pinned, ...thinned.slice(0, Math.max(0, MAX_TOWNS - pinned.length))];

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

    const weights: ScoringWeights = config.customWeights
      ? { ...config.customWeights }
      : { ...(PRESETS[config.preset as keyof typeof PRESETS] ?? PRESETS['sightseeing']) };

    const weatherScores: WeatherScore[] = towns.map((town) => {
      const data = weatherData.find((d) => d.townId === town.id);
      if (!data) {
        return { composite: 0, breakdown: { sunshine: 0, precipitation: 0, temperature: 0, wind: 0 } };
      }
      return scoreDailyLocation(data.daily, new Date(config.startDate), 1, weights);
    });

    // Per-town per-day score matrix — lets the optimizer time arrivals to each
    // town's best weather days instead of scoring everything at startDate
    const startDateObj = new Date(config.startDate);
    const dayScores: number[][] = towns.map((town) => {
      const data = weatherData.find((d) => d.townId === town.id);
      const row = new Array<number>(config.totalDays).fill(0);
      if (!data) return row;
      for (let d = 0; d < config.totalDays; d++) {
        const day = new Date(startDateObj.getTime() + d * 86_400_000);
        row[d] = scoreDailyLocation(data.daily, day, 1, weights).composite;
      }
      return row;
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
      dayScores,
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

    // Recompute avgScore from the re-scored stops (day-weighted) — the core
    // aggregate would otherwise reflect the pre-rescore composites
    const totalNights = stopsWithWeather.reduce((s, st) => s + st.nights, 0);
    const avgScore = totalNights > 0
      ? stopsWithWeather.reduce((s, st) => s + st.score.composite * st.nights, 0) / totalNights
      : 0;

    self.postMessage({
      type: 'complete',
      result: { ...result, stops: stopsWithWeather, avgScore },
    } satisfies OptimizerWorkerOutput);
  } catch (err) {
    self.postMessage({
      type: 'error',
      code: classifyError(err),
    } satisfies OptimizerWorkerOutput);
  }
};
