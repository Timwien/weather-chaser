// Look of the cloud veil, shared by the Open-Meteo forecast overlay (cloudRender.ts)
// and the satellite → veil transform in the tile protocol (satelliteVeil.ts).
// Kept free of other imports so the protocol code stays small.

export interface ColorScheme { r: number; g: number; b: number }
/** Light basemap: soft blue-grey; dark basemap: soft white. */
export const CLOUD_COLORS: Record<'light' | 'dark', ColorScheme> = {
  light: { r: 0x7a, g: 0x8e, b: 0xa3 },
  dark: { r: 0xe6, g: 0xec, b: 0xf5 },
};
export const ALPHA_MIN_COVER = 15; // % below which clouds are invisible
export const ALPHA_MAX = 0.55; // at 100 %
