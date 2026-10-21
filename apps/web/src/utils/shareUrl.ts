import type { Route } from '@weatherchaser/core';

interface SharePayload {
  v: 1;                        // version for future compatibility
  startDate: string;
  endDate: string;
  totalDays: number;
  maxStay: number;
  preset: string;
  regionName?: string;
  route: {
    stops: Array<{
      name: string;
      lat: number;
      lng: number;
      arrivalDate: string;     // ISO string
      nights: number;
      composite: number;
      breakdown: { sunshine: number; precipitation: number; temperature: number; wind: number };
      distanceToNextKm?: number;
    }>;
    totalDistanceKm: number;
    totalDays: number;
    avgScore: number;
  };
}

export function buildShareUrl(
  config: {
    startDate: string;
    endDate: string;
    totalDays: number;
    maxStay: number;
    preset: string;
    regionName?: string;
  },
  route: Route,
): string {
  const payload: SharePayload = {
    v: 1,
    ...config,
    route: {
      stops: route.stops.map((s) => ({
        name: s.town.name,
        lat: s.town.lat,
        lng: s.town.lng,
        arrivalDate: s.arrivalDate.toISOString(),
        nights: s.nights,
        composite: Math.round(s.score.composite),
        breakdown: {
          sunshine: Math.round(s.score.breakdown.sunshine),
          precipitation: Math.round(s.score.breakdown.precipitation),
          temperature: Math.round(s.score.breakdown.temperature),
          wind: Math.round(s.score.breakdown.wind),
        },
        distanceToNextKm:
          s.distanceToNextKm !== undefined ? Math.round(s.distanceToNextKm) : undefined,
      })),
      totalDistanceKm: Math.round(route.totalDistanceKm),
      totalDays: route.totalDays,
      avgScore: Math.round(route.avgScore),
    },
  };

  const encoded = btoa(encodeURIComponent(JSON.stringify(payload)));
  const url = new URL('/trip', window.location.origin);
  url.searchParams.set('data', encoded);
  return url.toString();
}

export interface ParsedShareData {
  config: Omit<SharePayload, 'v' | 'route'>;
  route: Route;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const VALID_PRESETS = ['beach', 'hiking', 'sightseeing'];

/** Minimal shape check so a hand-edited or truncated link yields null instead
 *  of a half-built route that crashes the itinerary panel. */
function isValidPayload(p: unknown): p is SharePayload {
  if (!p || typeof p !== 'object') return false;
  const o = p as Record<string, unknown>;
  if (!isStr(o.startDate) || !isStr(o.endDate) || !isStr(o.preset)) return false;
  // Unknown presets would index PRESETS/PRESET_ICONS with e.g. "constructor".
  if (!VALID_PRESETS.includes(o.preset)) return false;
  if (!isNum(o.totalDays) || !isNum(o.maxStay)) return false;
  const r = o.route as Record<string, unknown> | undefined;
  if (!r || !Array.isArray(r.stops) || r.stops.length === 0) return false;
  if (!isNum(r.totalDistanceKm) || !isNum(r.totalDays) || !isNum(r.avgScore)) return false;
  return r.stops.every((s: unknown) => {
    if (!s || typeof s !== 'object') return false;
    const st = s as Record<string, unknown>;
    const b = st.breakdown as Record<string, unknown> | undefined;
    return (
      isStr(st.name) && isNum(st.lat) && isNum(st.lng) && isNum(st.nights) && isNum(st.composite) &&
      isStr(st.arrivalDate) && !Number.isNaN(new Date(st.arrivalDate).getTime()) &&
      !!b && isNum(b.sunshine) && isNum(b.precipitation) && isNum(b.temperature) && isNum(b.wind)
    );
  });
}

export function parseShareUrl(search: string): ParsedShareData | null {
  try {
    const params = new URLSearchParams(search);
    const data = params.get('data');
    if (!data) return null;

    const payload: unknown = JSON.parse(decodeURIComponent(atob(data)));
    if (!isValidPayload(payload) || payload.v !== 1) return null;

    const route: Route = {
      stops: payload.route.stops.map((s) => ({
        town: { id: `${s.lat}-${s.lng}`, name: s.name, lat: s.lat, lng: s.lng },
        arrivalDate: new Date(s.arrivalDate),
        nights: s.nights,
        score: {
          composite: s.composite,
          breakdown: s.breakdown,
        },
        distanceToNextKm: s.distanceToNextKm,
      })),
      totalDistanceKm: payload.route.totalDistanceKm,
      totalDays: payload.route.totalDays,
      avgScore: payload.route.avgScore,
    };

    return {
      config: {
        startDate: payload.startDate,
        endDate: payload.endDate,
        totalDays: payload.totalDays,
        maxStay: payload.maxStay,
        preset: payload.preset,
        regionName: payload.regionName,
      },
      route,
    };
  } catch {
    return null;
  }
}
