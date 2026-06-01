import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore.ts';
import { useAppStore } from '../../stores/appStore.ts';
import { supabaseConfigured } from '../../lib/supabase.ts';
import {
  getSavedRoutes,
  getSavedFinderSearches,
  getFavorites,
  deleteSavedRoute,
} from '../../services/userdata.ts';
import type { SavedRoute, SavedFinderSearch, Favorite } from '../../types/database.ts';
import type { Route } from '@weatherchaser/core';

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="2,4 14,4"/>
      <path d="M5 4V2.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5V4"/>
      <rect x="3" y="4" width="10" height="10" rx="1"/>
      <line x1="6" y1="7" x2="6" y2="11"/>
      <line x1="10" y1="7" x2="10" y2="11"/>
    </svg>
  );
}

function HeartFilledIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="#0E7490" aria-hidden="true">
      <path d="M8 13.7s-6-3.9-6-8a4 4 0 0 1 6-3.46A4 4 0 0 1 14 5.7c0 4.1-6 8-6 8z"/>
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 2h10a1 1 0 0 1 1 1v11l-6-3-6 3V3a1 1 0 0 1 1-1z"/>
    </svg>
  );
}

function formatDateRange(from: string | null, to: string | null): string {
  if (!from && !to) return '';
  if (from && to) {
    const f = new Date(from).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    const t = new Date(to).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${f} – ${t}`;
  }
  if (from) return new Date(from).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return '';
}

interface SavedTabProps {
  onClose: () => void;
}

export function SavedTab({ onClose }: SavedTabProps) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const setRoute = useAppStore((s) => s.setRoute);
  const setMode = useAppStore((s) => s.setMode);
  const addSearchArea = useAppStore((s) => s.addSearchArea);

  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [searches, setSearches] = useState<SavedFinderSearch[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !supabaseConfigured) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([getSavedRoutes(), getSavedFinderSearches(), getFavorites()])
      .then(([r, s, f]) => {
        if (cancelled) return;
        setRoutes(r);
        setSearches(s);
        setFavorites(f);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : t('account.error_fallback'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [user, t]);

  if (!user) {
    return (
      <div className="saved-tab">
        <div className="saved-tab-empty">
          <svg
            className="saved-tab-icon"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
          <h3 className="saved-tab-empty-heading">{t('account.saved_empty_heading')}</h3>
          <p className="saved-tab-empty-text">{t('account.saved_not_logged_in')}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="saved-tab">
        <div className="saved-tab-loading">
          <div className="saved-tab-spinner" aria-label="Laden..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="saved-tab">
        <p className="saved-tab-error">{error}</p>
      </div>
    );
  }

  function reviveDates(stops: Route['stops']): Route['stops'] {
    return stops.map((s) => ({
      ...s,
      arrivalDate: s.arrivalDate instanceof Date ? s.arrivalDate : new Date(s.arrivalDate as unknown as string),
    }));
  }

  function handleLoadRoute(saved: SavedRoute) {
    const raw = saved.stops_json as unknown;
    let route: Route;
    if (Array.isArray(raw)) {
      // Legacy format: only stops array stored
      const stops = reviveDates(raw as Route['stops']);
      route = {
        stops,
        totalDistanceKm: stops.reduce((sum, s) => sum + (s.distanceToNextKm ?? 0), 0),
        totalDays: stops.reduce((sum, s) => sum + s.nights, 0),
        avgScore: stops.length > 0 ? stops.reduce((sum, s) => sum + s.score.composite, 0) / stops.length : 0,
      };
    } else {
      const r = raw as Route;
      route = { ...r, stops: reviveDates(r.stops) };
    }
    setRoute(route);
    setMode('results');
    onClose();
  }

  function handleLoadFavorite(fav: Favorite) {
    addSearchArea({
      type: 'place',
      id: `fav-${fav.id}`,
      name: fav.place_name,
      fullName: fav.place_name,
      lat: fav.lat,
      lng: fav.lng,
    });
    onClose();
  }

  async function handleDeleteRoute(id: string) {
    setDeletingId(id);
    try {
      await deleteSavedRoute(id);
      setRoutes((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('account.error_fallback'));
    } finally {
      setDeletingId(null);
    }
  }

  const hasAny = routes.length > 0 || searches.length > 0 || favorites.length > 0;

  if (!hasAny) {
    return (
      <div className="saved-tab">
        <div className="saved-tab-empty">
          <svg
            className="saved-tab-icon"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
          <h3 className="saved-tab-empty-heading">{t('account.saved_empty_heading')}</h3>
          <p className="saved-tab-empty-text">{t('account.saved_empty_text')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="saved-tab saved-tab--loaded">
      {/* Saved Routes */}
      <section className="saved-section">
        <h3 className="saved-section-title">{t('account.saved_routes_title')}</h3>
        {routes.length === 0 ? (
          <p className="saved-section-empty">{t('account.saved_routes_empty')}</p>
        ) : (
          <ul className="saved-list">
            {routes.map((route) => (
              <li
                key={route.id}
                className="saved-card saved-card--clickable"
                onClick={() => handleLoadRoute(route)}
                title={t('a11y.show_route_on_map')}
              >
                <div className="saved-card-icon">
                  <BookmarkIcon />
                </div>
                <div className="saved-card-body">
                  <div className="saved-card-name">{route.name}</div>
                  {(route.date_from || route.date_to) && (
                    <div className="saved-card-meta">
                      {formatDateRange(route.date_from, route.date_to)}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="saved-card-delete"
                  onClick={(e) => { e.stopPropagation(); handleDeleteRoute(route.id); }}
                  disabled={deletingId === route.id}
                  aria-label={t('a11y.delete_route')}
                >
                  <TrashIcon />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Saved Finder Searches */}
      <section className="saved-section">
        <h3 className="saved-section-title">{t('account.saved_searches_title')}</h3>
        {searches.length === 0 ? (
          <p className="saved-section-empty">{t('account.saved_searches_empty')}</p>
        ) : (
          <ul className="saved-list">
            {searches.map((search) => (
              <li key={search.id} className="saved-card">
                <div className="saved-card-icon">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="6.5" cy="6.5" r="4.5"/>
                    <line x1="10" y1="10" x2="14" y2="14"/>
                  </svg>
                </div>
                <div className="saved-card-body">
                  <div className="saved-card-name">{search.name}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Favorites */}
      <section className="saved-section">
        <h3 className="saved-section-title">{t('account.saved_favorites_title')}</h3>
        {favorites.length === 0 ? (
          <p className="saved-section-empty">{t('account.saved_favorites_empty')}</p>
        ) : (
          <ul className="saved-list">
            {favorites.map((fav) => (
              <li
                key={fav.id}
                className="saved-card saved-card--clickable"
                onClick={() => handleLoadFavorite(fav)}
                title={t('a11y.add_as_start')}
              >
                <div className="saved-card-icon saved-card-icon--heart">
                  <HeartFilledIcon />
                </div>
                <div className="saved-card-body">
                  <div className="saved-card-name">{fav.place_name}</div>
                  <div className="saved-card-meta">
                    {fav.lat.toFixed(3)}, {fav.lng.toFixed(3)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
