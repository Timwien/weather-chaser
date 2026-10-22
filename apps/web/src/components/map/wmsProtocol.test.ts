import { describe, it, expect } from 'vitest';
import { clearRadarMask, recolorDrizzle, DRIZZLE_RGBA } from './wmsProtocol.ts';

const px = (...rgba: number[][]) => new Uint8ClampedArray(rgba.flat());

describe('clearRadarMask', () => {
  it('removes the coverage veil and the magenta outline', () => {
    const data = px([126, 126, 126, 77], [255, 0, 255, 255], [230, 40, 230, 200]);
    clearRadarMask(data);
    expect([data[3], data[7], data[11]]).toEqual([0, 0, 0]);
  });

  it('keeps precipitation colours and transparent pixels', () => {
    const data = px([51, 255, 255, 255], [1, 153, 52, 255], [204, 230, 1, 255], [255, 255, 255, 0]);
    const before = Array.from(data);
    clearRadarMask(data);
    expect(Array.from(data)).toEqual(before);
  });
});

describe('recolorDrizzle', () => {
  it('turns the grey lightest rain class pale blue and leaves other classes alone', () => {
    const data = px([192, 192, 192, 255], [254, 254, 192, 255], [96, 96, 96, 255], [255, 255, 255, 0]);
    recolorDrizzle(data);
    expect(Array.from(data.slice(0, 4))).toEqual([...DRIZZLE_RGBA]);
    expect(Array.from(data.slice(4))).toEqual([254, 254, 192, 255, 96, 96, 96, 255, 255, 255, 255, 0]);
  });
});
