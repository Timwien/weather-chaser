export interface Town {
  id: string;
  name: string;
  lat: number;
  lng: number;
  population?: number;
}

export interface HourlyWeather {
  time: string[];                // ISO timestamps
  temperature_2m: number[];      // °C
  precipitation: number[];       // mm
  sunshine_duration: number[];   // seconds
  wind_speed_10m: number[];      // km/h
}

export interface DailyWeather {
  time: string[];                // YYYY-MM-DD date strings
  temperature_2m_max: number[];  // °C
  temperature_2m_min: number[];  // °C
  precipitation_sum: number[];   // mm total per day
  sunshine_duration: number[];   // seconds per day
  wind_speed_10m_max: number[];  // km/h
}

export interface WeatherScore {
  composite: number;             // 0–100
  breakdown: {
    sunshine: number;
    precipitation: number;
    temperature: number;
    wind: number;
  };
}

export interface ScoringWeights {
  sunshine: number;
  precipitation: number;
  temperature: number;
  wind: number;
}

export type WeatherPreset = 'beach' | 'hiking' | 'sightseeing';

export interface Stop {
  town: Town;
  arrivalDate: Date;
  nights: number;
  score: WeatherScore;
  distanceToNextKm?: number;
}

export interface Route {
  stops: Stop[];
  totalDistanceKm: number;
  totalDays: number;
  avgScore: number;
}

export interface OptimizerConfig {
  startIndex: number;
  totalDays: number;
  maxStay: number;
  mustVisitIndices: number[];
  startDate: Date;
  weights: ScoringWeights;
}

export interface OptimizerInput {
  towns: Town[];
  distanceMatrix: number[][];    // km distances NxN
  durationMatrix: number[][];    // seconds NxN
  weatherScores: WeatherScore[];
  config: OptimizerConfig;
}
