import type { Town } from '@weatherchaser/core';

/**
 * Spatial deduplication: keeps only the most populous town per grid cell.
 *
 * Rationale: Open-Meteo's forecast model has ~11 km grid resolution, so two
 * places inside the same ~12 km cell have effectively identical weather.
 * Fetching both wastes a weather call, bloats the distance matrix, and makes
 * the optimizer choose between weather-identical neighbors. One representative
 * per cell (the biggest place) carries all the information.
 *
 * Deterministic: ties broken by name, then id.
 */
export function dedupeByWeatherCell(towns: Town[], cellKm = 12): Town[] {
  const cellDegLat = cellKm / 111;
  const byCell = new Map<string, Town>();

  for (const town of towns) {
    const cellDegLng = cellKm / (111 * Math.max(0.2, Math.cos((town.lat * Math.PI) / 180)));
    const key = `${Math.floor(town.lat / cellDegLat)}:${Math.floor(town.lng / cellDegLng)}`;
    const existing = byCell.get(key);
    if (!existing || isBigger(town, existing)) byCell.set(key, town);
  }

  return [...byCell.values()];
}

function isBigger(a: Town, b: Town): boolean {
  const pa = a.population ?? 0;
  const pb = b.population ?? 0;
  if (pa !== pb) return pa > pb;
  const byName = a.name.localeCompare(b.name);
  if (byName !== 0) return byName < 0;
  return a.id < b.id;
}
