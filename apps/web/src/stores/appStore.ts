import { create } from 'zustand';
import type { Route, WeatherPreset, ScoringWeights } from '@weatherchaser/core';

type AppMode = 'idle' | 'route-config' | 'weather-finder' | 'loading' | 'results';
type LoadingStep = 'finding_towns' | 'fetching_weather' | 'optimizing_route' | null;

/** A single named place with optional bbox. */
interface PlaceArea {
  type: 'place';
  id: string;           // Unique id (nominatim place_id as string)
  name: string;         // Short display name (first segment, e.g. "Bavaria")
  fullName: string;     // Full Nominatim display_name
  bbox?: [number, number, number, number]; // [west, south, east, north]
}

/** A hand-drawn polygon area. */
interface PolygonArea {
  type: 'polygon';
  id: string;
  polygon: number[][];  // [[lng,lat], ...]
}

/** A radius around a point. */
interface RadiusArea {
  type: 'radius';
  id: string;
  name?: string;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
}

export type SearchAreaItem = PlaceArea | PolygonArea | RadiusArea;

/** Legacy flat shape kept for backward compat within this phase */
interface SearchArea {
  type: 'place' | 'polygon' | 'radius';
  name?: string;
  bbox?: [number, number, number, number];
  polygon?: number[][];
  centerLat?: number;
  centerLng?: number;
  radiusKm?: number;
}

interface TripConfig {
  startDate: string | null;   // ISO date YYYY-MM-DD
  endDate: string | null;
  criteria: Array<'sunshine' | 'precipitation' | 'temperature' | 'wind'>;
  preset: WeatherPreset;
  startLocation: string;
  startLat: number | null;
  startLng: number | null;
  totalDays: number;
  maxStay: number;
  mustVisitNames: string[];   // Display names
  mustVisitCoords: Array<{ lat: number; lng: number; name: string }>;
}

interface AppState {
  mode: AppMode;
  loadingStep: LoadingStep;
  /** Multi-location search areas */
  searchAreas: SearchAreaItem[];
  /** Radius in km for single-place searches */
  searchRadiusKm: number;
  /** Legacy single search area — kept for route index compatibility */
  searchArea: SearchArea | null;
  tripConfig: TripConfig;
  route: Route | null;
  error: string | null;

  // Actions
  setMode: (mode: AppMode) => void;
  setLoadingStep: (step: LoadingStep) => void;
  /** Legacy single-area setter used by draw callbacks in routes/index.tsx */
  setSearchArea: (area: SearchArea | null) => void;
  /** Add a named place to the multi-area list */
  addSearchArea: (area: SearchAreaItem) => void;
  /** Remove an area by id */
  removeSearchArea: (id: string) => void;
  /** Clear all search areas */
  clearSearchAreas: () => void;
  /** Set radius (applies when exactly one place is in searchAreas) */
  setSearchRadiusKm: (km: number) => void;
  setTripConfig: (config: Partial<TripConfig>) => void;
  setRoute: (route: Route | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const defaultTripConfig: TripConfig = {
  startDate: null,
  endDate: null,
  criteria: ['sunshine', 'precipitation'],
  preset: 'sightseeing',
  startLocation: '',
  startLat: null,
  startLng: null,
  totalDays: 7,
  maxStay: 2,
  mustVisitNames: [],
  mustVisitCoords: [],
};

// ── DEV DEFAULTS — remove before shipping ─────────────────────────────────
// Pre-fill search areas so you don't have to type them during every test session.
const DEV_SEARCH_AREAS: SearchAreaItem[] = import.meta.env.DEV
  ? [
      { type: 'place', id: 'dev-berchtesgaden', name: 'Berchtesgaden', fullName: 'Berchtesgaden, Bayern, Deutschland', bbox: [12.89, 47.59, 13.12, 47.78] },
      { type: 'place', id: 'dev-chiemsee',      name: 'Chiemsee',      fullName: 'Chiemsee, Bayern, Deutschland',      bbox: [12.28, 47.82, 12.62, 47.99] },
      { type: 'place', id: 'dev-muenchen',       name: 'München',       fullName: 'München, Bayern, Deutschland',       bbox: [11.36, 48.06, 11.72, 48.25] },
      { type: 'place', id: 'dev-fuessen',        name: 'Füssen',        fullName: 'Füssen, Bayern, Deutschland',        bbox: [10.60, 47.54, 10.84, 47.69] },
      { type: 'place', id: 'dev-wien',           name: 'Wien',          fullName: 'Wien, Österreich',                  bbox: [16.18, 48.11, 16.58, 48.32] },
      { type: 'place', id: 'dev-zuerich',        name: 'Zürich',        fullName: 'Zürich, Schweiz',                   bbox: [8.45,  47.32, 8.62,  47.43] },
    ]
  : [];
// ─────────────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>((set) => ({
  mode: 'idle',
  loadingStep: null,
  searchAreas: DEV_SEARCH_AREAS,
  searchRadiusKm: 50,
  searchArea: null,
  tripConfig: defaultTripConfig,
  route: null,
  error: null,

  setMode: (mode) => set({ mode }),
  setLoadingStep: (step) => set({ loadingStep: step }),
  setSearchArea: (area) => set({ searchArea: area ?? null }),
  addSearchArea: (area) =>
    set((state) => ({
      searchAreas: [...state.searchAreas.filter((a) => a.id !== area.id), area],
    })),
  removeSearchArea: (id) =>
    set((state) => ({ searchAreas: state.searchAreas.filter((a) => a.id !== id) })),
  clearSearchAreas: () => set({ searchAreas: [] }),
  setSearchRadiusKm: (km) => set({ searchRadiusKm: km }),
  setTripConfig: (config) =>
    set((state) => ({ tripConfig: { ...state.tripConfig, ...config } })),
  setRoute: (route) => set({ route }),
  setError: (error) => set({ error }),
  reset: () =>
    set({ mode: 'idle', loadingStep: null, route: null, error: null }),
}));
