import { getSupabase } from '../lib/supabase.ts';
import type { Route } from '@weatherchaser/core';
import type { SavedRoute, SavedFinderSearch, Favorite } from '../types/database.ts';

// ── Saved Routes ─────────────────────────────────────────────────────────────

/** Auto-generate route name from stop names: "München → Berchtesgaden → Salzburg" */
export function buildRouteName(route: Route): string {
  return route.stops.map((s) => s.town.name).join(' → ');
}

export async function saveRoute(
  route: Route,
  dateFrom: string | null,
  dateTo: string | null,
): Promise<SavedRoute> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('saved_routes') as any)
    .insert({
      user_id: user.id,
      name: buildRouteName(route),
      stops_json: route.stops,
      date_from: dateFrom,
      date_to: dateTo,
    })
    .select()
    .single();

  if (error) throw error;
  return data as SavedRoute;
}

export async function getSavedRoutes(): Promise<SavedRoute[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('saved_routes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SavedRoute[];
}

export async function deleteSavedRoute(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('saved_routes').delete().eq('id', id);
  if (error) throw error;
}

// ── Favorites ─────────────────────────────────────────────────────────────────

export async function toggleFavorite(
  placeName: string,
  lat: number,
  lng: number,
): Promise<{ added: boolean }> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Check if already favorited
  const { data: existing } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', user.id)
    .eq('lat', lat)
    .eq('lng', lng)
    .maybeSingle();

  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from('favorites').delete().eq('id', (existing as any).id);
    return { added: false };
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('favorites') as any)
      .insert({ user_id: user.id, place_name: placeName, lat, lng });
    return { added: true };
  }
}

export async function getFavorites(): Promise<Favorite[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('favorites')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Favorite[];
}

// ── Saved Finder Searches ─────────────────────────────────────────────────────

export async function saveFinderSearch(
  name: string,
  config: unknown,
): Promise<SavedFinderSearch> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('saved_finder_searches') as any)
    .insert({ user_id: user.id, name, config_json: config })
    .select()
    .single();

  if (error) throw error;
  return data as SavedFinderSearch;
}

export async function getSavedFinderSearches(): Promise<SavedFinderSearch[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('saved_finder_searches')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SavedFinderSearch[];
}
