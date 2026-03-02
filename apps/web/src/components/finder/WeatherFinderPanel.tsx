import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { HourlyWeather } from '@weatherchaser/core';
import { scoreLocation, PRESETS, sliceHoursByDays } from '@weatherchaser/core';
import { useAppStore } from '../../stores/appStore.ts';
import { FinderResultRow } from './FinderResultRow.tsx';
import { FinderFilterBar } from './FinderFilterBar.tsx';
import { FinderEmptyState } from './FinderEmptyState.tsx';
import type { FinderResultData } from './FinderResultRow.tsx';
import './WeatherFinderPanel.css';

// Parse hour from ISO timestamp without new Date() to avoid timezone bugs.
// Open-Meteo returns timestamps like "2026-03-15T06:00" (no Z = local time).
// We parse the hour by slicing chars 11–12 directly.
function filterHoursByTimeOfDay(
  hourly: HourlyWeather,
  timeOfDay: 'morning' | 'afternoon' | 'full',
): HourlyWeather {
  if (timeOfDay === 'full') return hourly;
  const startHour = timeOfDay === 'morning' ? 6 : 12;
  const endHour   = timeOfDay === 'morning' ? 12 : 18;

  const indices = hourly.time
    .map((t, i) => ({ i, hour: parseInt(t.slice(11, 13), 10) }))
    .filter(({ hour }) => hour >= startHour && hour < endHour)
    .map(({ i }) => i);

  return {
    time:              indices.map(i => hourly.time[i]),
    temperature_2m:    indices.map(i => hourly.temperature_2m[i]),
    precipitation:     indices.map(i => hourly.precipitation[i]),
    sunshine_duration: indices.map(i => hourly.sunshine_duration[i]),
    wind_speed_10m:    indices.map(i => hourly.wind_speed_10m[i]),
  };
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface WeatherFinderPanelProps {
  selectedFinderIndex: number | null;
  onResultSelect: (index: number) => void;
  onBack: () => void;
  onResultsComputed: (results: FinderResultData[]) => void;
}

const SORT_OPTIONS = [
  { value: 'score',         labelKey: 'finder.sort_score',         default: 'Score' },
  { value: 'sunshine',      labelKey: 'finder.sort_sunshine',      default: 'Sonne' },
  { value: 'temperature',   labelKey: 'finder.sort_temperature',   default: 'Temp' },
  { value: 'precipitation', labelKey: 'finder.sort_precipitation', default: 'Regen' },
] as const;

export function WeatherFinderPanel({ selectedFinderIndex, onResultSelect, onBack, onResultsComputed }: WeatherFinderPanelProps) {
  const { t } = useTranslation('common');
  const { finderTowns, finderHourlyCache, finderConfig, finderError, tripConfig, searchAreas, searchRadiusKm, setFinderConfig } = useAppStore();
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);

  // Scroll to selected row
  if (selectedFinderIndex !== null && rowRefs.current[selectedFinderIndex]) {
    rowRefs.current[selectedFinderIndex]!.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  const finderResults = useMemo<FinderResultData[]>(() => {
    if (!finderTowns || Object.keys(finderHourlyCache).length === 0) return [];
    if (!tripConfig.startDate || !tripConfig.endDate) return [];

    const startDate = new Date(tripConfig.startDate + 'T00:00:00Z');
    const dayCount = Math.max(1, Math.round(
      (new Date(tripConfig.endDate + 'T00:00:00Z').getTime() - startDate.getTime()) / 86_400_000
    ) + 1);

    // Origin from the first named place in "Wo?" (same source useFinder uses)
    const firstPlace = searchAreas.find(
      (a): a is Extract<typeof searchAreas[number], { type: 'place' }> =>
        a.type === 'place' && typeof (a as { lat?: number }).lat === 'number',
    ) as { lat?: number; lng?: number } | undefined;
    const startLat = firstPlace?.lat ?? null;
    const startLng = firstPlace?.lng ?? null;
    if (startLat === null || startLng === null) return [];

    const scored = finderTowns
      .map((town) => {
        const hourly = finderHourlyCache[town.id];
        if (!hourly) return null;

        const distanceKm = haversineKm(startLat, startLng, town.lat, town.lng);
        // Filter by current radius from store (uses "Wo?" radius slider — no re-fetch)
        if (distanceKm > searchRadiusKm) return null;

        const sliced   = sliceHoursByDays(hourly, startDate, dayCount);
        const filtered = filterHoursByTimeOfDay(sliced, finderConfig.timeOfDay);
        const score    = scoreLocation(filtered, startDate, dayCount, PRESETS[finderConfig.preset]);

        const avg = (arr: number[]) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
        const sunshineHoursPerDay = avg(filtered.sunshine_duration) / 3600;
        const tempC               = avg(filtered.temperature_2m);
        const precipMm            = filtered.precipitation.reduce((s, v) => s + v, 0);

        return { town, score, distanceKm, sunshineHoursPerDay, tempC, precipMm };
      })
      .filter(Boolean) as Array<{
        town: typeof finderTowns[0];
        score: ReturnType<typeof scoreLocation>;
        distanceKm: number;
        sunshineHoursPerDay: number;
        tempC: number;
        precipMm: number;
      }>;

    // Sort
    const { sortBy } = finderConfig;
    scored.sort((a, b) => {
      if (sortBy === 'score')         return b.score.composite - a.score.composite;
      if (sortBy === 'sunshine')      return b.sunshineHoursPerDay - a.sunshineHoursPerDay;
      if (sortBy === 'temperature')   return b.tempC - a.tempC;
      if (sortBy === 'precipitation') return a.precipMm - b.precipMm; // lower is better
      return b.score.composite - a.score.composite;
    });

    return scored.slice(0, 10).map((r, i): FinderResultData => ({
      rank: i + 1,
      townName: r.town.name,
      townId: r.town.id,
      lat: r.town.lat,
      lng: r.town.lng,
      score: r.score,
      sunshineHoursPerDay: r.sunshineHoursPerDay,
      tempC: r.tempC,
      precipMm: r.precipMm,
      distanceKm: r.distanceKm,
    }));
  }, [finderTowns, finderHourlyCache, finderConfig, tripConfig.startDate, tripConfig.endDate, searchAreas, searchRadiusKm]);

  // Share computed results upward so MapContainer can display matching markers
  useEffect(() => {
    onResultsComputed(finderResults);
  }, [finderResults, onResultsComputed]);

  return (
    <div className="weather-finder-panel">
      {/* Header */}
      <div className="finder-panel-header">
        <button className="itinerary-back-btn" onClick={onBack}>
          ← {t('itinerary.back', 'Zurück')}
        </button>
        <h2 className="finder-panel-title">{t('finder.results_title', 'Beste Orte')}</h2>
      </div>

      {/* Sort buttons */}
      <div className="finder-sort-bar">
        {SORT_OPTIONS.map(({ value, labelKey, default: def }) => (
          <button
            key={value}
            type="button"
            className={`finder-sort-btn${finderConfig.sortBy === value ? ' finder-sort-btn--active' : ''}`}
            onClick={() => setFinderConfig({ sortBy: value })}
          >
            {t(labelKey, def)}
          </button>
        ))}
      </div>

      {/* Pinned filter bar */}
      <FinderFilterBar />

      {/* Results list or empty state */}
      {finderError === 'no_towns' ? (
        <FinderEmptyState reason="no_towns" />
      ) : finderResults.length === 0 && finderTowns !== null ? (
        <FinderEmptyState reason="no_results" />
      ) : (
        <div className="finder-results-list">
          {finderResults.map((result, idx) => (
            <div key={result.townId} ref={(el) => { rowRefs.current[idx] = el; }}>
              <FinderResultRow
                data={result}
                isSelected={selectedFinderIndex === idx}
                onClick={() => onResultSelect(idx)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
