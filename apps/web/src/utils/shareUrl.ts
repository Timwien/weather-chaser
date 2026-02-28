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

export function parseShareUrl(search: string): ParsedShareData | null {
  try {
    const params = new URLSearchParams(search);
    const data = params.get('data');
    if (!data) return null;

    const payload: SharePayload = JSON.parse(decodeURIComponent(atob(data)));
    if (payload.v !== 1) return null;

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
