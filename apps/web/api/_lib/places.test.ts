import { describe, it, expect } from 'vitest';
import realData from '../_data/places.json' with { type: 'json' };
import { parsePlacesQuery, queryPlaces, type PlaceTuple, type PlacesQuery } from './places.js';

const FIXTURE: PlaceTuple[] = [
  [1, 'Köln', 50.9333, 6.95, 1_000_000, 0, 'Cologne'],
  [2, 'Freiburg im Breisgau', 47.9959, 7.8522, 230_000, 0, 0],
  [3, 'Szczecin', 53.4289, 14.553, 395_000, 'Stettin', 0],
  [4, 'Emmendingen', 48.1218, 7.8498, 27_000, 0, 0],
  [5, 'Kirchzarten', 47.9667, 7.9667, 9_800, 0, 0],
  [6, 'Hinterzarten', 47.9, 8.1, 1_100, 0, 0],
];
const sorted = [...FIXTURE].sort((a, b) => b[4] - a[4]);

const q = (over: Partial<PlacesQuery>): PlacesQuery => ({ minPop: 0, limit: 100, lang: 'en', ...over });
const parse = (qs: string) => parsePlacesQuery(new URLSearchParams(qs));

describe('queryPlaces', () => {
  it('filters by bbox', () => {
    const r = queryPlaces(sorted, q({ bbox: [47.8, 7.6, 48.2, 8.2] }));
    expect(r.map((p) => p.name)).toEqual(['Freiburg im Breisgau', 'Emmendingen', 'Kirchzarten', 'Hinterzarten']);
  });

  it('applies minPop and keeps population-descending order', () => {
    const r = queryPlaces(sorted, q({ bbox: [47.8, 7.6, 48.2, 8.2], minPop: 10_000 }));
    expect(r.map((p) => p.name)).toEqual(['Freiburg im Breisgau', 'Emmendingen']);
  });

  it('filters by radius with true distance (bbox corner excluded)', () => {
    const near = queryPlaces(sorted, q({ center: { lat: 47.9959, lng: 7.8522, radiusKm: 10 } }));
    expect(near.map((p) => p.name)).toEqual(['Freiburg im Breisgau', 'Kirchzarten']);
    const wide = queryPlaces(sorted, q({ center: { lat: 47.9959, lng: 7.8522, radiusKm: 25 } }));
    expect(wide.map((p) => p.name)).toContain('Emmendingen');
    expect(wide.map((p) => p.name)).not.toContain('Köln');
  });

  it('respects limit', () => {
    expect(queryPlaces(sorted, q({ bbox: [40, 0, 60, 20], limit: 2 }))).toHaveLength(2);
  });

  it('localizes names with fallback to the base name', () => {
    const all = { bbox: [40, 0, 60, 20] as [number, number, number, number] };
    const de = queryPlaces(sorted, q({ ...all, lang: 'de' }));
    const en = queryPlaces(sorted, q({ ...all, lang: 'en' }));
    expect(de.find((p) => p.id === 'gn-3')?.name).toBe('Stettin');
    expect(en.find((p) => p.id === 'gn-3')?.name).toBe('Szczecin');
    expect(en.find((p) => p.id === 'gn-1')?.name).toBe('Cologne');
    expect(de.find((p) => p.id === 'gn-1')?.name).toBe('Köln');
    expect(de.find((p) => p.id === 'gn-2')?.name).toBe('Freiburg im Breisgau');
  });
});

describe('parsePlacesQuery', () => {
  it('parses bbox queries and caps limit', () => {
    const r = parse('bbox=47.8,7.6,48.2,8.1&minPop=1000&limit=99999&lang=de');
    expect(r.ok && r.query).toMatchObject({ bbox: [47.8, 7.6, 48.2, 8.1], minPop: 1000, limit: 1500, lang: 'de' });
  });

  it('parses radius queries', () => {
    const r = parse('lat=48&lng=7.8&radiusKm=50');
    expect(r.ok && r.query.center).toEqual({ lat: 48, lng: 7.8, radiusKm: 50 });
  });

  it.each([
    '',
    'bbox=1,2,3',
    'bbox=a,b,c,d',
    'bbox=48,8,47,7',
    'bbox=0,0,60,10',
    'bbox=0,0,10,60',
    'bbox=47,7,48,8&lat=1&lng=1&radiusKm=5',
    'lat=48&lng=7',
    'lat=95&lng=7&radiusKm=5',
    'lat=48&lng=7&radiusKm=0',
    'lat=48&lng=7&radiusKm=5000',
    'bbox=47,7,48,8&minPop=-1',
    'bbox=47,7,48,8&limit=0',
    'bbox=47,7,48,8&foo=1',
    'bbox=47,7,48,8&minPop=1e999',
  ])('rejects %s', (qs) => {
    expect(parse(qs).ok).toBe(false);
  });
});

describe('real dataset', () => {
  const data = realData as unknown as PlaceTuple[];

  it('finds Freiburg and localized Polish names', () => {
    expect(data.length).toBeGreaterThan(50_000);
    const fr = queryPlaces(data, q({ center: { lat: 47.9959, lng: 7.8522, radiusKm: 20 }, minPop: 1000 }));
    expect(fr.some((p) => p.name.startsWith('Freiburg'))).toBe(true);
    const poland = { bbox: [52, 14, 54, 17] as [number, number, number, number], minPop: 100_000 };
    expect(queryPlaces(data, q({ ...poland, lang: 'de' })).map((p) => p.name)).toEqual(
      expect.arrayContaining(['Stettin', 'Posen']),
    );
    expect(queryPlaces(data, q({ ...poland, lang: 'en' })).map((p) => p.name)).toEqual(
      expect.arrayContaining(['Szczecin', 'Poznań']),
    );
  });
});
