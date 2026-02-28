/**
 * Date utility helpers for the route optimizer.
 */

/**
 * Adds `days` calendar days to the given Date, returning a new Date.
 * Uses milliseconds arithmetic for correctness across DST boundaries
 * (we treat each day as exactly 24h for route-planning purposes).
 */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
