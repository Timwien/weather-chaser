import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { HourlyWeather } from '@weatherchaser/core';
import { scoreLocation, PRESETS, sliceHoursByDays } from '@weatherchaser/core';
import { useAppStore } from '../../stores/appStore.ts';
import { useAuthStore } from '../../stores/authStore.ts';
import { supabaseConfigured } from '../../lib/supabase.ts';
import { getFavorites, toggleFavorite } from '../../services/userdata.ts';
import { FinderResultRow } from './FinderResultRow.tsx';
import { FinderFilterBar } from './FinderFilterBar.tsx';
import { FinderEmptyState } from './FinderEmptyState.tsx';
import { InfoTip } from '../common/InfoTip.tsx';
import type { FinderResultData } from './FinderResultRow.tsx';
import type { Favorite } from '../../types/database.ts';
import { ScoreIcon, SunIcon, TempIcon, RainIcon, WindIcon } from './FinderIcons.tsx';
import { haversineKm } from '../../utils/geo.ts';
import { capture } from '../../lib/analytics.ts';
import './WeatherFinderPanel.css';

// Parse hour from ISO timestamp without new Date() to avoid timezone bugs.
// Open-Meteo returns timestamps like "2026-03-15T06:00" (no Z = local time).
// We parse the hour by slicing chars 11–12 directly.
function filterHoursByTimeOfDay(
  hourly: HourlyWeather,
  timeOfDay: 'morning' | 'evening' | 'full',
): HourlyWeather {
  if (timeOfDay === 'full') return hourly;
  const startHour = timeOfDay === 'morning' ? 6 : 17;
  const endHour   = timeOfDay === 'morning' ? 12 : 22;  // 17:00–21:59 inclusive

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
  { value: 'wind',          labelKey: 'finder.sort_wind',          default: 'Wind' },
] as const;

const SORT_ICONS = {
  score:         ScoreIcon,
  sunshine:      SunIcon,
  temperature:   TempIcon,
  precipitation: RainIcon,
  wind:          WindIcon,
} as const;

export function WeatherFinderPanel({ selectedFinderIndex, onResultSelect, onBack, onResultsComputed }: WeatherFinderPanelProps) {
  const { t } = useTranslation('common');
  const { finderTowns, finderHourlyCache, finderConfig, finderError, tripConfig, weatherPrefs, searchAreas, searchRadiusKm, setFinderConfig } = useAppStore();
  const { user } = useAuthStore();
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);

  // Favorites state
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  // Load favorites when user is logged in
  useEffect(() => {
    if (!user || !supabaseConfigured) {
      setFavorites([]);
      return;
    }
    getFavorites()
      .then(setFavorites)
      .catch(() => { /* favorites load failure is non-critical */ });
  }, [user]);

  // Scroll to selected row
  if (selectedFinderIndex !== null && rowRefs.current[selectedFinderIndex]) {
    rowRefs.current[selectedFinderIndex]!.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  const finderResults = useMemo<FinderResultData[]>(() => {
    if (!finderTowns || Object.keys(finderHourlyCache).length === 0) return [];
    if (!tripConfig.startDate || !tripConfig.endDate) return [];

    const startDate = new Date(tripConfig.startDate + 'T00:00:00Z');
    const endDate   = new Date(tripConfig.endDate   + 'T00:00:00Z');
    const fullDayCount = Math.max(1, Math.round(
      (endDate.getTime() - startDate.getTime()) / 86_400_000
    ) + 1);

    // Determine whether to show a single day or the full range
    const isSingleDay = finderConfig.selectedDay !== 'all' && finderConfig.selectedDay !== undefined;
    const sliceStart  = isSingleDay ? new Date(finderConfig.selectedDay + 'T00:00:00Z') : startDate;
    const sliceDays   = isSingleDay ? 1 : fullDayCount;

    // Origin from the first named place in "Wo?" (same source useFinder uses)
    const firstPlace = searchAreas.find(
      (a): a is Extract<typeof searchAreas[number], { type: 'place' }> =>
        a.type === 'place' && typeof (a as { lat?: number }).lat === 'number',
    ) as { lat?: number; lng?: number } | undefined;
    const startLat = firstPlace?.lat ?? null;
    const startLng = firstPlace?.lng ?? null;

    // In multi-place mode (>1 searchArea) there is no "origin" to filter by distance.
    // We show all finder towns regardless of distance.
    const isMultiPlace = searchAreas.length > 1;

    if (!isMultiPlace && (startLat === null || startLng === null)) return [];

    const avg = (arr: number[]) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

    const scored = finderTowns
      .map((town) => {
        const hourly = finderHourlyCache[town.id];
        if (!hourly) return null;

        // null = no single origin (multi-place mode) — the row hides the distance then
        let distanceKm: number | null = null;
        if (!isMultiPlace && startLat !== null && startLng !== null) {
          distanceKm = haversineKm(startLat, startLng, town.lat, town.lng);
          // Filter by current radius from store (uses "Wo?" radius slider — no re-fetch)
          if (distanceKm > searchRadiusKm) return null;
        }

        const sliced   = sliceHoursByDays(hourly, sliceStart, sliceDays);
        const filtered = filterHoursByTimeOfDay(sliced, finderConfig.timeOfDay);
        // U2: shared weather preference — custom weights override the preset when set.
        const weights  = weatherPrefs.customWeights ?? PRESETS[weatherPrefs.preset];
        const score    = scoreLocation(filtered, sliceStart, sliceDays, weights);

        // sunshine_duration is in seconds per hour — sum then divide by 3600 for total hours,
        // then divide by day count for per-day average.
        const totalSunSeconds = filtered.sunshine_duration.reduce((s, v) => s + v, 0);
        const sunshineHoursPerDay = (totalSunSeconds / 3600) / sliceDays;
        const tempC               = avg(filtered.temperature_2m);
        const precipMm            = filtered.precipitation.reduce((s, v) => s + v, 0);
        const windAvgKmh          = avg(filtered.wind_speed_10m);

        return { town, score, distanceKm, sunshineHoursPerDay, tempC, precipMm, windAvgKmh };
      })
      .filter(Boolean) as Array<{
        town: typeof finderTowns[0];
        score: ReturnType<typeof scoreLocation>;
        distanceKm: number | null;
        sunshineHoursPerDay: number;
        tempC: number;
        precipMm: number;
        windAvgKmh: number;
      }>;

    // Sort
    const { sortBy } = finderConfig;
    scored.sort((a, b) => {
      if (sortBy === 'score')         return b.score.composite - a.score.composite;
      if (sortBy === 'sunshine')      return b.sunshineHoursPerDay - a.sunshineHoursPerDay;
      if (sortBy === 'temperature')   return b.tempC - a.tempC;
      if (sortBy === 'precipitation') return a.precipMm - b.precipMm;    // lower is better
      if (sortBy === 'wind')          return a.windAvgKmh - b.windAvgKmh; // lower is better
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
      windAvgKmh: r.windAvgKmh,
      distanceKm: r.distanceKm,
    }));
  }, [finderTowns, finderHourlyCache, finderConfig, weatherPrefs, tripConfig.startDate, tripConfig.endDate, searchAreas, searchRadiusKm]);

  // Share computed results upward so MapContainer can display matching markers
  useEffect(() => {
    onResultsComputed(finderResults);
  }, [finderResults, onResultsComputed]);

  // Check if a town is favorited
  function isTownFavorited(townName: string, lat: number, lng: number): boolean {
    return favorites.some(
      (f) => f.place_name === townName && Math.abs(f.lat - lat) < 0.001 && Math.abs(f.lng - lng) < 0.001
    );
  }

  // Toggle favorite for a town
  async function handleFavoriteToggle(result: FinderResultData) {
    if (!user || !supabaseConfigured) return;
    try {
      const { added } = await toggleFavorite(result.townName, result.lat, result.lng);
      if (added) {
        capture('favorite_added');
        // Optimistically add to local favorites state
        const newFav: Favorite = {
          id: `optimistic-${Date.now()}`,
          user_id: '',
          place_name: result.townName,
          lat: result.lat,
          lng: result.lng,
          created_at: new Date().toISOString(),
        };
        setFavorites((prev) => [newFav, ...prev]);
      } else {
        // Remove from local state
        setFavorites((prev) =>
          prev.filter(
            (f) => !(f.place_name === result.townName && Math.abs(f.lat - result.lat) < 0.001 && Math.abs(f.lng - result.lng) < 0.001)
          )
        );
      }
    } catch {
      // Non-critical — ignore toggle failure
    }
  }

  return (
    <div className="weather-finder-panel">
      {/* Header */}
      <div className="finder-panel-header">
        <button className="itinerary-back-btn" onClick={onBack}>
          ← {t('itinerary.back', 'Zurück')}
        </button>
        <h2 className="finder-panel-title">{t('finder.results_title', 'Beste Orte')}</h2>
        <InfoTip text={t('info.score')} />
      </div>

      {/* Sort buttons */}
      <div className="finder-sort-bar">
        {SORT_OPTIONS.map(({ value, labelKey, default: def }) => {
          const Icon = SORT_ICONS[value];
          return (
            <button
              key={value}
              type="button"
              className={`finder-sort-btn${finderConfig.sortBy === value ? ' finder-sort-btn--active' : ''}`}
              onClick={() => setFinderConfig({ sortBy: value })}
            >
              <Icon size={12} />
              {t(labelKey, def)}
            </button>
          );
        })}
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
                sortBy={finderConfig.sortBy}
                isFavorited={isTownFavorited(result.townName, result.lat, result.lng)}
                onFavoriteToggle={() => handleFavoriteToggle(result)}
                isGuest={!user}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
