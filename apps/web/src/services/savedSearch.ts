// X2/X3: a saved/recent "search" captures the ENTRY state (not a result), so on
// load the user still picks best-weather vs. best-route. One versioned payload
// is shared by saved searches (saved_finder_searches) and history (search_history).

import type { WeatherPreset, ScoringWeights } from '@weatherchaser/core';
import { getSupabase, supabaseConfigured } from '../lib/supabase.ts';
import { useAppStore, type SearchAreaItem } from '../stores/appStore.ts';
import type { SearchGranularity } from './overpass.ts';
import { saveFinderSearch } from './userdata.ts';
import { formatRange } from '../utils/dateFormat.ts';
import type { SearchHistory } from '../types/database.ts';

export interface SavedSearchConfigV1 {
  v: 1;
  searchAreas: SearchAreaItem[];
  dateFrom: string | null;
  dateTo: string | null;
  radiusKm: number;
  granularity: SearchGranularity;
  weatherPrefs: { preset: WeatherPreset; customWeights: ScoringWeights | null };
}

/** Build a SavedSearchConfigV1 from the current store state. */
export function buildSearchConfigFromStore(): SavedSearchConfigV1 {
  const s = useAppStore.getState();
  return {
    v: 1,
    searchAreas: s.searchAreas,
    dateFrom: s.tripConfig.startDate,
    dateTo: s.tripConfig.endDate,
    radiusKm: s.searchRadiusKm,
    granularity: s.searchGranularity,
    weatherPrefs: { preset: s.weatherPrefs.preset, customWeights: s.weatherPrefs.customWeights },
  };
}

/** Human-friendly name, e.g. "Ahlbeck +2 · 03.07. – 04.07.2026". */
export function buildSearchName(config: SavedSearchConfigV1, lang = 'en'): string {
  const names = config.searchAreas
    .map((a) => ('name' in a && a.name ? a.name : a.type === 'polygon' ? '▱' : ''))
    .filter(Boolean);
  const first = names[0] ?? '—';
  const extra = names.length > 1 ? ` +${names.length - 1}` : '';
  const range = formatRange(config.dateFrom, config.dateTo, lang);
  return range ? `${first}${extra} · ${range}` : `${first}${extra}`;
}

/** X2: persist the current entry state as a saved search. */
export async function saveSearch(config: SavedSearchConfigV1, lang = 'en') {
  return saveFinderSearch(buildSearchName(config, lang), config);
}

/** X2: delete a saved search (was missing entirely). */
export async function deleteSavedSearch(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('saved_finder_searches').delete().eq('id', id);
  if (error) throw error;
}

/** Restore a saved/recent search into the store; user then picks a CTA. */
export function applySavedSearch(c: SavedSearchConfigV1): void {
  const s = useAppStore.getState();
  s.clearSearchAreas();
  c.searchAreas.forEach((a) => s.addSearchArea(a));
  s.setTripConfig({ startDate: c.dateFrom, endDate: c.dateTo });
  s.setSearchRadiusKm(c.radiusKm);
  s.setSearchGranularity(c.granularity);
  s.setWeatherPrefs(c.weatherPrefs);
  s.setMode('idle');
}

/**
 * X3: fire-and-forget record of a completed search. Non-critical — swallows all
 * errors (including "relation search_history does not exist" before the
 * migration is applied). Dedupes against the most recent identical config.
 */
export async function recordSearch(kind: 'finder' | 'route', config: SavedSearchConfigV1): Promise<void> {
  if (!supabaseConfigured) return;
  try {
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Dedupe: skip if the newest entry has an identical config.
    const { data: latest } = await supabase
      .from('search_history')
      .select('config_json')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const latestConfig = (latest as { config_json: unknown } | null)?.config_json;
    if (latestConfig && JSON.stringify(latestConfig) === JSON.stringify(config)) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('search_history') as any)
      .insert({ user_id: user.id, kind, config_json: config });

    // Prune to newest 15.
    const { data: overflow } = await supabase
      .from('search_history')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(15, 100);
    const overflowRows = (overflow as Array<{ id: string }> | null) ?? [];
    if (overflowRows.length) {
      await supabase.from('search_history').delete().in('id', overflowRows.map((r) => r.id));
    }
  } catch {
    /* non-critical — table may not exist yet, or user offline */
  }
}

/** X3: newest 15 searches for the current user; [] on any failure. */
export async function getSearchHistory(): Promise<SearchHistory[]> {
  if (!supabaseConfigured) return [];
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('search_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(15);
    if (error) throw error;
    return (data ?? []) as SearchHistory[];
  } catch {
    return [];
  }
}
