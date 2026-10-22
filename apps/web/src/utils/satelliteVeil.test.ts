import { describe, it, expect } from 'vitest';
import { cloudinessFromRgb, satelliteToVeil } from './satelliteVeil.ts';
import { ALPHA_MAX, CLOUD_COLORS } from './cloudColors.ts';

describe('cloudinessFromRgb', () => {
  it('rates bright colourless pixels as cloud', () => {
    expect(cloudinessFromRgb(240, 240, 235)).toBeGreaterThan(90);
    expect(cloudinessFromRgb(200, 200, 195)).toBeGreaterThan(60);
  });
  it('rates dark or coloured ground and sea as clear', () => {
    expect(cloudinessFromRgb(90, 100, 60)).toBe(0); // olive land
    expect(cloudinessFromRgb(20, 35, 70)).toBe(0); // sea
    expect(cloudinessFromRgb(0, 0, 0)).toBe(0); // no data
    expect(cloudinessFromRgb(180, 150, 40)).toBeLessThan(10); // bright but saturated (desert / lights)
  });
  it('night IR (grey-scale): bright grey is cloud, dark grey is ground', () => {
    expect(cloudinessFromRgb(165, 165, 165)).toBeGreaterThan(60);
    expect(cloudinessFromRgb(70, 70, 70)).toBe(0);
  });
});

describe('satelliteToVeil', () => {
  it('writes the shared cloud colour with the forecast overlay\'s alpha ramp', () => {
    const px = new Uint8ClampedArray([250, 250, 250, 255, 30, 40, 30, 255]);
    satelliteToVeil(px, 'light');
    const { r, g, b } = CLOUD_COLORS.light;
    expect(Array.from(px.slice(0, 3))).toEqual([r, g, b]);
    expect(px[3]).toBeGreaterThan(Math.round(ALPHA_MAX * 255) - 8);
    expect(px[3]).toBeLessThanOrEqual(Math.round(ALPHA_MAX * 255));
    expect(px[7]).toBe(0);
  });
  it('uses the dark-theme colour for the dark scheme', () => {
    const px = new Uint8ClampedArray([250, 250, 250, 255]);
    satelliteToVeil(px, 'dark');
    expect(Array.from(px.slice(0, 3))).toEqual([CLOUD_COLORS.dark.r, CLOUD_COLORS.dark.g, CLOUD_COLORS.dark.b]);
  });
});
