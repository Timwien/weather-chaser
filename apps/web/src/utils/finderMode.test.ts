import { describe, it, expect } from 'vitest';
import { getFinderMode } from './finderMode.ts';
import type { SearchAreaItem } from '../stores/appStore.ts';

const place = (id: string): SearchAreaItem => ({ type: 'place', id, name: id, fullName: id, lat: 48, lng: 8 });
const polygon: SearchAreaItem = { type: 'polygon', id: 'p', polygon: [[8, 48], [9, 48], [9, 49]] };
const radius: SearchAreaItem = { type: 'radius', id: 'r', centerLat: 48, centerLng: 8, radiusKm: 50 };

describe('getFinderMode', () => {
  it('polygon alone and polygon + place are polygon mode', () => {
    expect(getFinderMode([polygon])).toBe('polygon');
    expect(getFinderMode([place('a'), polygon])).toBe('polygon');
    expect(getFinderMode([place('a'), place('b'), polygon])).toBe('polygon');
  });
  it('two or more places without polygon are multi-place', () => {
    expect(getFinderMode([place('a'), place('b')])).toBe('multi-place');
  });
  it('single place or radius is around', () => {
    expect(getFinderMode([place('a')])).toBe('around');
    expect(getFinderMode([radius])).toBe('around');
  });
});
