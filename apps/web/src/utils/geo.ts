// R7: shared geo helpers. Previously duplicated across fallbackPlaces.ts,
// overpass.ts and WeatherFinderPanel.tsx (haversine ×2, point-in-polygon ×1,
// deg→km area approximations ×3). One definition, reused by B6, F2, F3.

import type { BoundingBox } from '../services/nominatim.ts';

/** Great-circle distance in km between two lat/lng points. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/** Ray-casting point-in-polygon; polygon vertices are [lng, lat]. */
export function pointInPolygon(lat: number, lng: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]; // lng, lat
    const [xj, yj] = polygon[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Approximate polygon area in km² (shoelace + spherical latitude correction). */
export function polygonAreaKm2(polygon: [number, number][]): number {
  if (polygon.length < 3) return 0;
  let areaDeg2 = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const [lng1, lat1] = polygon[i];
    const [lng2, lat2] = polygon[(i + 1) % n];
    areaDeg2 += lng1 * lat2 - lng2 * lat1;
  }
  areaDeg2 = Math.abs(areaDeg2) / 2;
  const avgLat = polygon.reduce((s, [, lat]) => s + lat, 0) / polygon.length;
  return areaDeg2 * 111 * (111 * Math.cos((avgLat * Math.PI) / 180));
}

/** Bounding box of a polygon (vertices [lng, lat]). */
export function bboxOfPolygon(polygon: [number, number][]): BoundingBox {
  let south = Infinity, north = -Infinity, west = Infinity, east = -Infinity;
  for (const [lng, lat] of polygon) {
    if (lat < south) south = lat;
    if (lat > north) north = lat;
    if (lng < west) west = lng;
    if (lng > east) east = lng;
  }
  return { south, north, west, east };
}

/** Square-ish bbox of ±radiusKm around a point (latitude-corrected). */
export function bboxAroundPoint(lat: number, lng: number, radiusKm: number): BoundingBox {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return { south: lat - dLat, north: lat + dLat, west: lng - dLng, east: lng + dLng };
}
