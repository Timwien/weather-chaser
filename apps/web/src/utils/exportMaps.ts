import type { Stop } from '@weatherchaser/core';

const GOOGLE_MAX_WAYPOINTS = 9;

// Source: https://developers.google.com/maps/documentation/urls/get-started
// Google Maps supports a maximum of 9 intermediate waypoints.
// We cap total stops at GOOGLE_MAX_WAYPOINTS + 2 (origin + destination + 9 waypoints = 11).
export function buildGoogleMapsUrl(stops: Stop[]): { url: string; truncated: boolean } {
  const truncated = stops.length > GOOGLE_MAX_WAYPOINTS + 2;
  // Take origin + destination + up to 9 intermediate waypoints = 11 stops max
  const limited = stops.slice(0, GOOGLE_MAX_WAYPOINTS + 2);

  const origin = `${limited[0].town.lat},${limited[0].town.lng}`;
  const destination = `${limited[limited.length - 1].town.lat},${limited[limited.length - 1].town.lng}`;
  const intermediates = limited.slice(1, -1);
  const waypoints = intermediates.map((s) => `${s.town.lat},${s.town.lng}`).join('|');

  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  url.searchParams.set('origin', origin);
  url.searchParams.set('destination', destination);
  if (waypoints) url.searchParams.set('waypoints', waypoints);
  url.searchParams.set('travelmode', 'driving');

  return { url: url.toString(), truncated };
}

// Apple Maps: supports saddr (start) + daddr (end) — no intermediate waypoints in URL scheme
// For multi-stop routes, link to start → end only; this is a known limitation
export function buildAppleMapsUrl(stops: Stop[]): string {
  const first = stops[0];
  const last = stops[stops.length - 1];
  const url = new URL('https://maps.apple.com/');
  url.searchParams.set('saddr', `${first.town.lat},${first.town.lng}`);
  url.searchParams.set('daddr', `${last.town.lat},${last.town.lng}`);
  url.searchParams.set('dirflg', 'd'); // driving
  return url.toString();
}
