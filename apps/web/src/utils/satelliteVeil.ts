// Satellite → cloud veil: turns a Meteosat RGB tile (DWD "day HRV + night IR108")
// into the same translucent veil the forecast overlay paints (cloudColors.ts).
// Clouds are bright and nearly colourless; land is dark/olive, sea dark blue.
// Night IR108 frames are grey-scale with clouds bright, so the same rule works.
// Known false positive: snow fields (bright, colourless) — accepted.

import { CLOUD_COLORS, ALPHA_MAX, ALPHA_MIN_COVER } from './cloudColors.ts';

/**
 * Luminance (0..255) where clouds start / are fully opaque. Day tiles (coloured ground) use the
 * strict range; grey-scale pixels (night IR108, where clouds are bright-grey, ground dark-grey)
 * use a lower one, blended by saturation.
 */
const LUM_LO_DAY = 105;
const LUM_HI_DAY = 205;
const LUM_LO_NIGHT = 92;
const LUM_HI_NIGHT = 172;
/** Saturation up to which a pixel counts as grey-scale (night) — full day range from here on. */
const NIGHT_SAT = 0.08;
/** Saturation (max-min)/max above which a pixel is rated as coloured ground, not cloud. */
const SAT_FREE = 0.12;
const SAT_ZERO = 0.42;

/** Cloudiness 0..100 for one RGB pixel (same unit as Open-Meteo "cloud cover %"). */
export function cloudinessFromRgb(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const sat = max === 0 ? 0 : (max - min) / max;
  const day = Math.min(1, sat / NIGHT_SAT);
  const lo = LUM_LO_NIGHT + (LUM_LO_DAY - LUM_LO_NIGHT) * day;
  const hi = LUM_HI_NIGHT + (LUM_HI_DAY - LUM_HI_NIGHT) * day;
  const bright = Math.min(1, Math.max(0, (lum - lo) / (hi - lo)));
  const colourless = Math.min(1, Math.max(0, 1 - (sat - SAT_FREE) / (SAT_ZERO - SAT_FREE)));
  return bright * colourless * 100;
}

/** Same ramp as the forecast overlay: 0 below ALPHA_MIN_COVER %, linear to ALPHA_MAX at 100 %. */
function veilAlpha(cover: number): number {
  if (cover <= ALPHA_MIN_COVER) return 0;
  return Math.min(1, (cover - ALPHA_MIN_COVER) / (100 - ALPHA_MIN_COVER)) * ALPHA_MAX;
}

/** In place: RGBA satellite pixels → straight-alpha cloud veil in the scheme's cloud colour. */
export function satelliteToVeil(px: Uint8ClampedArray, scheme: 'light' | 'dark'): void {
  const { r, g, b } = CLOUD_COLORS[scheme];
  for (let i = 0; i < px.length; i += 4) {
    const a = veilAlpha(cloudinessFromRgb(px[i], px[i + 1], px[i + 2]));
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = Math.round(a * 255);
  }
}
