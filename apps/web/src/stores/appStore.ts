import { create } from 'zustand';
import type { Route, WeatherPreset, ScoringWeights, Town, HourlyWeather } from '@weatherchaser/core';
import type { SearchGranularity } from '../services/overpass.ts';

type AppMode = 'idle' | 'route-config' | 'weather-finder' | 'loading' | 'results';
type LoadingStep = 'finding_towns' | 'fetching_weather' | 'optimizing_route' | null;

/** A single named place with optional bbox and center coordinates. */
export interface PlaceArea {
  type: 'place';
  id: string;           // Unique id (nominatim place_id as string)
  name: string;         // Short display name (first segment, e.g. "Bavaria")
  fullName: string;     // Full Nominatim display_name
  bbox?: [number, number, number, number]; // [west, south, east, north]
  lat?: number;         // Center latitude (from Nominatim)
  lng?: number;         // Center longitude (from Nominatim)
}

/** A hand-drawn polygon area. */
export interface PolygonArea {
  type: 'polygon';
  id: string;
  polygon: number[][];  // [[lng,lat], ...]
}

/** A radius around a point. */
export interface RadiusArea {
  type: 'radius';
  id: string;
  name?: string;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
}

export type SearchAreaItem = PlaceArea | PolygonArea | RadiusArea;

/* ── R2: narrowing type guards — replace the scattered `'lat' in area` +
   `as` casts with one shared, correct definition. ─────────────────────── */
export const isPlaceArea = (a: SearchAreaItem): a is PlaceArea => a.type === 'place';
export const isPolygonArea = (a: SearchAreaItem): a is PolygonArea => a.type === 'polygon';
export const isRadiusArea = (a: SearchAreaItem): a is RadiusArea => a.type === 'radius';
/** Places with guaranteed coordinates (every selection now carries them). */
export const isLocatedPlace = (
  a: SearchAreaItem,
): a is PlaceArea & { lat: number; lng: number } =>
  isPlaceArea(a) && typeof a.lat === 'number' && typeof a.lng === 'number';

interface TripConfig {
  startDate: string | null;   // ISO date YYYY-MM-DD
  endDate: string | null;
  startLocation: string;
  startLat: number | null;
  startLng: number | null;
  totalDays: number;
  maxStay: number;
  /** B4: geocoded must-visit stops — single source (name travels with coords). */
  mustVisitCoords: Array<{ lat: number; lng: number; name: string }>;
}

/**
 * U2: single weather-preference slice shared by BOTH scenarios (route + finder).
 * Replaces the old tripConfig.preset / tripConfig.customWeights / tripConfig.criteria
 * and finderConfig.preset — those drifted and `criteria` was dead state.
 */
interface WeatherPrefs {
  preset: WeatherPreset;
  /** Premium: custom scoring weights override the preset when set (must sum to 1). */
  customWeights: ScoringWeights | null;
}

interface FinderConfig {
  startLat: number | null;
  startLng: number | null;
  startLocation: string;
  radiusKm: number;           // default 200
  timeOfDay: 'morning' | 'evening' | 'full';  // default 'full'
  sortBy: 'score' | 'sunshine' | 'temperature' | 'precipitation' | 'wind';
  selectedDay: 'all' | string;  // 'all' = average across range; ISO date = single day
}

export type FinderTimeOfDay = 'morning' | 'evening' | 'full';
export type FinderSortBy = 'score' | 'sunshine' | 'temperature' | 'precipitation' | 'wind';

const defaultFinderConfig: FinderConfig = {
  startLat: null,
  startLng: null,
  startLocation: '',
  radiusKm: 200,
  timeOfDay: 'full',
  sortBy: 'score',
  selectedDay: 'all',
};

const defaultWeatherPrefs: WeatherPrefs = {
  preset: 'sightseeing',
  customWeights: null,
};

interface AppState {
  mode: AppMode;
  loadingStep: LoadingStep;
  /** Multi-location search areas */
  searchAreas: SearchAreaItem[];
  /** Radius in km for single-place searches */
  searchRadiusKm: number;
  /** Place granularity for area searches: auto (size-adaptive) | cities | all */
  searchGranularity: SearchGranularity;
  tripConfig: TripConfig;
  /** U2: shared weather preference (preset + optional custom weights). */
  weatherPrefs: WeatherPrefs;
  route: Route | null;
  error: string | null;
  /** True while user is in "click to pick location" mode */
  pickingLocation: boolean;
  /** True while a polygon is actively being drawn — suppresses map tap-to-add (F3). */
  isDrawingArea: boolean;

  // Finder state slice
  finderConfig: FinderConfig;
  finderLoading: boolean;
  finderError: string | null;
  finderTowns: Town[] | null;
  finderHourlyCache: Record<string, HourlyWeather>;  // townId → hourly data
  // Finder actions
  setFinderConfig: (config: Partial<FinderConfig>) => void;
  setFinderLoading: (v: boolean) => void;
  setFinderError: (e: string | null) => void;
  setFinderData: (towns: Town[], hourly: Record<string, HourlyWeather>) => void;
  clearFinderData: () => void;

  setPickingLocation: (v: boolean) => void;
  setIsDrawingArea: (v: boolean) => void;

  // Actions
  setMode: (mode: AppMode) => void;
  setLoadingStep: (step: LoadingStep) => void;
  /** Add a named place to the multi-area list */
  addSearchArea: (area: SearchAreaItem) => void;
  /** Remove an area by id */
  removeSearchArea: (id: string) => void;
  /** Clear all search areas */
  clearSearchAreas: () => void;
  /** Set radius (applies when exactly one place is in searchAreas) */
  setSearchRadiusKm: (km: number) => void;
  setSearchGranularity: (g: SearchGranularity) => void;
  setTripConfig: (config: Partial<TripConfig>) => void;
  setWeatherPrefs: (prefs: Partial<WeatherPrefs>) => void;
  setRoute: (route: Route | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const defaultTripConfig: TripConfig = {
  startDate: null,
  endDate: null,
  startLocation: '',
  startLat: null,
  startLng: null,
  totalDays: 7,
  maxStay: 2,
  mustVisitCoords: [],
};

// ── DEV DEFAULTS — opt-in only ────────────────────────────────────────────
// R2: previously auto-enabled in every dev build (would have shipped if DEV
// slipped through). Now gated behind VITE_DEV_FIXTURES=true so the default
// dev + prod experience starts from an empty search.
const DEV_SEARCH_AREAS: SearchAreaItem[] = import.meta.env.VITE_DEV_FIXTURES === 'true'
  ? [
      { type: 'place', id: 'dev-berchtesgaden', name: 'Berchtesgaden', fullName: 'Berchtesgaden, Bayern, Deutschland', bbox: [12.89, 47.59, 13.12, 47.78], lat: 47.685, lng: 13.005 },
      { type: 'place', id: 'dev-chiemsee',      name: 'Chiemsee',      fullName: 'Chiemsee, Bayern, Deutschland',      bbox: [12.28, 47.82, 12.62, 47.99], lat: 47.905, lng: 12.450 },
      { type: 'place', id: 'dev-muenchen',       name: 'München',       fullName: 'München, Bayern, Deutschland',       bbox: [11.36, 48.06, 11.72, 48.25], lat: 48.155, lng: 11.540 },
      { type: 'place', id: 'dev-fuessen',        name: 'Füssen',        fullName: 'Füssen, Bayern, Deutschland',        bbox: [10.60, 47.54, 10.84, 47.69], lat: 47.615, lng: 10.720 },
      { type: 'place', id: 'dev-wien',           name: 'Wien',          fullName: 'Wien, Österreich',                  bbox: [16.18, 48.11, 16.58, 48.32], lat: 48.215, lng: 16.380 },
      { type: 'place', id: 'dev-zuerich',        name: 'Zürich',        fullName: 'Zürich, Schweiz',                   bbox: [8.45,  47.32, 8.62,  47.43], lat: 47.375, lng: 8.535  },
    ]
  : [];
// ─────────────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>((set) => ({
  mode: 'idle',
  loadingStep: null,
  searchAreas: DEV_SEARCH_AREAS,
  searchRadiusKm: 50,
  searchGranularity: 'auto',
  tripConfig: defaultTripConfig,
  weatherPrefs: defaultWeatherPrefs,
  route: null,
  error: null,
  pickingLocation: false,
  isDrawingArea: false,
  finderConfig: defaultFinderConfig,
  finderLoading: false,
  finderError: null,
  finderTowns: null,
  finderHourlyCache: {},

  setPickingLocation: (v) => set({ pickingLocation: v }),
  setIsDrawingArea: (v) => set({ isDrawingArea: v }),
  setMode: (mode) => set({ mode }),
  setLoadingStep: (step) => set({ loadingStep: step }),
  addSearchArea: (area) =>
    set((state) => ({
      searchAreas: [...state.searchAreas.filter((a) => a.id !== area.id), area],
    })),
  removeSearchArea: (id) =>
    set((state) => ({ searchAreas: state.searchAreas.filter((a) => a.id !== id) })),
  clearSearchAreas: () => set({ searchAreas: [] }),
  setSearchRadiusKm: (km) => set({ searchRadiusKm: km }),
  setSearchGranularity: (g) => set({ searchGranularity: g }),
  setTripConfig: (config) =>
    set((state) => ({ tripConfig: { ...state.tripConfig, ...config } })),
  setWeatherPrefs: (prefs) =>
    set((state) => ({ weatherPrefs: { ...state.weatherPrefs, ...prefs } })),
  setRoute: (route) => set({ route }),
  setError: (error) => set({ error }),
  setFinderConfig: (config) =>
    set((state) => ({ finderConfig: { ...state.finderConfig, ...config } })),
  setFinderLoading: (v) => set({ finderLoading: v }),
  setFinderError: (e) => set({ finderError: e }),
  setFinderData: (towns, hourly) =>
    set({ finderTowns: towns, finderHourlyCache: hourly, finderLoading: false, finderError: null }),
  clearFinderData: () =>
    set({ finderTowns: null, finderHourlyCache: {}, finderLoading: false, finderError: null }),
  reset: () =>
    set({ mode: 'idle', loadingStep: null, route: null, error: null,
          finderTowns: null, finderHourlyCache: {}, finderLoading: false, finderError: null }),
}));
