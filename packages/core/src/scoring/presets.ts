import type { ScoringWeights } from '../types/index.js';

/**
 * Named scoring presets for common travel activity types.
 * Weights must sum to 1.0.
 */
export const PRESETS: Record<string, ScoringWeights> = {
  beach: {
    sunshine: 0.4,
    precipitation: 0.3,
    temperature: 0.2,
    wind: 0.1,
  },
  hiking: {
    sunshine: 0.3,
    precipitation: 0.3,
    temperature: 0.2,
    wind: 0.2,
  },
  sightseeing: {
    sunshine: 0.3,
    precipitation: 0.4,
    temperature: 0.2,
    wind: 0.1,
  },
};
