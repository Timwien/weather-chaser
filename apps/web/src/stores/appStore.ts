import { create } from 'zustand';
import type { Route, WeatherPreset, ScoringWeights } from '@weatherchaser/core';

type AppMode = 'idle' | 'route-config' | 'loading' | 'results';
type LoadingStep = 'finding_towns' | 'fetching_weather' | 'optimizing_route' | null;

interface SearchArea {
  type: 'place' | 'polygon' | 'radius';
  name?: string;             // Display name (e.g. "Bavaria")
  bbox?: [number, number, number, number];  // [west, south, east, north]
  polygon?: number[][];      // [[lng,lat], ...]
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
  searchArea: SearchArea | null;
  tripConfig: TripConfig;
  route: Route | null;
  error: string | null;

  // Actions
  setMode: (mode: AppMode) => void;
  setLoadingStep: (step: LoadingStep) => void;
  setSearchArea: (area: SearchArea) => void;
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

export const useAppStore = create<AppState>((set) => ({
  mode: 'idle',
  loadingStep: null,
  searchArea: null,
  tripConfig: defaultTripConfig,
  route: null,
  error: null,

  setMode: (mode) => set({ mode }),
  setLoadingStep: (step) => set({ loadingStep: step }),
  setSearchArea: (area) => set({ searchArea: area }),
  setTripConfig: (config) =>
    set((state) => ({ tripConfig: { ...state.tripConfig, ...config } })),
  setRoute: (route) => set({ route }),
  setError: (error) => set({ error }),
  reset: () =>
    set({ mode: 'idle', loadingStep: null, route: null, error: null }),
}));
