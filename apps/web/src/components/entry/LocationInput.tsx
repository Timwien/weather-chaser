import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore, isLocatedPlace } from '../../stores/appStore.ts';
import { useAuthStore } from '../../stores/authStore.ts';
import { useIsMobile } from '../../hooks/useIsMobile.ts';
import { supabaseConfigured } from '../../lib/supabase.ts';
import { getFavorites, toggleFavorite } from '../../services/userdata.ts';
import { PlaceAutocomplete, type SelectedPlace } from '../common/PlaceAutocomplete.tsx';
import { suggestNearby, type NearbySuggestion } from '../../services/nearbyPlaces.ts';
import type { SearchAreaItem } from '../../stores/appStore.ts';

/* ── Remove icon ────────────────────────────────────────── */
function RemoveIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/* ── Heart icon ─────────────────────────────────────────── */
function HeartIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="#0E7490" aria-hidden="true">
      <path d="M8 13.7s-6-3.9-6-8a4 4 0 0 1 6-3.46A4 4 0 0 1 14 5.7c0 4.1-6 8-6 8z" />
    </svg>
  ) : (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 13.7s-6-3.9-6-8a4 4 0 0 1 6-3.46A4 4 0 0 1 14 5.7c0 4.1-6 8-6 8z" />
    </svg>
  );
}

/* ── Map pin icon (for "Pick on map" button) ────────────── */
function MapPinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 16" fill="none" aria-hidden="true">
      <path d="M7 1C4.24 1 2 3.24 2 6C2 9.5 7 15 7 15C7 15 12 9.5 12 6C12 3.24 9.76 1 7 1Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="7" cy="6" r="1.8" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  );
}

/* ── Radius slider ──────────────────────────────────────── */

function RadiusSlider() {
  const { t } = useTranslation('common');
  const { searchRadiusKm, setSearchRadiusKm } = useAppStore();

  const STEPS = [10, 25, 50, 100, 150, 200, 300, 500];

  function handleSlider(e: React.ChangeEvent<HTMLInputElement>) {
    const i = Number(e.target.value);
    setSearchRadiusKm(STEPS[i] ?? 50);
  }

  return (
    <div className="loc-radius-wrapper">
      <div className="loc-radius-header">
        <span className="loc-radius-label">{t('entry.location_radius_label')}</span>
        <span className="loc-radius-value">{searchRadiusKm} km</span>
      </div>
      <input
        type="range"
        className="loc-radius-slider"
        min={0}
        max={STEPS.length - 1}
        step={1}
        value={Math.max(0, STEPS.indexOf(searchRadiusKm))}
        onChange={handleSlider}
        aria-label={t('entry.location_radius_label')}
      />
      <div className="loc-radius-ticks">
        <span>10 km</span>
        <span>500 km</span>
      </div>
    </div>
  );
}

/* ── Granularity toggle (Auto / cities / all places) ────── */

const GRANULARITIES = ['auto', 'cities', 'all'] as const;

function GranularityToggle() {
  const { t } = useTranslation('common');
  const { searchGranularity, setSearchGranularity } = useAppStore();

  return (
    <div className="loc-granularity-wrapper">
      <span className="loc-radius-label">{t('entry.granularity_label')}</span>
      <div className="loc-granularity-chips" role="radiogroup" aria-label={t('entry.granularity_label')}>
        {GRANULARITIES.map((g) => (
          <button
            key={g}
            type="button"
            role="radio"
            aria-checked={searchGranularity === g}
            className={`loc-granularity-chip${searchGranularity === g ? ' loc-granularity-chip--active' : ''}`}
            onClick={() => setSearchGranularity(g)}
          >
            {t(`entry.granularity.${g}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Nearby suggestions (F2) ────────────────────────────── */

interface NearbySuggestionsProps {
  anchors: Array<{ lat: number; lng: number }>;
  excludeNames: Set<string>;
  onAdd: (s: NearbySuggestion) => void;
}

function NearbySuggestions({ anchors, excludeNames, onAdd }: NearbySuggestionsProps) {
  const { t } = useTranslation('common');
  const [suggestions, setSuggestions] = useState<NearbySuggestion[]>([]);

  // Recompute whenever the anchor set or exclusion set changes.
  const anchorKey = anchors.map((a) => `${a.lat.toFixed(3)},${a.lng.toFixed(3)}`).join('|');
  const excludeKey = [...excludeNames].sort().join('|');

  useEffect(() => {
    let cancelled = false;
    if (anchors.length === 0) {
      setSuggestions([]);
      return;
    }
    suggestNearby(anchors, { exclude: excludeNames, limit: 6 })
      .then((s) => { if (!cancelled) setSuggestions(s); })
      .catch(() => { if (!cancelled) setSuggestions([]); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorKey, excludeKey]);

  if (suggestions.length === 0) return null;

  return (
    <div className="loc-nearby">
      <span className="loc-nearby-label">{t('entry.nearby_label')}</span>
      <div className="loc-nearby-chips">
        {suggestions.map((s) => (
          <button
            key={`${s.name}-${s.lat.toFixed(3)}`}
            type="button"
            className="suggestion-pill"
            onClick={() => onAdd(s)}
            aria-label={t('a11y.add_nearby', { name: s.name })}
          >
            + {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Main LocationInput component ───────────────────────── */

export function LocationInput() {
  const { t } = useTranslation('common');
  const { searchAreas, addSearchArea, removeSearchArea, pickingLocation, setPickingLocation } = useAppStore();
  const { user } = useAuthStore();
  const isMobile = useIsMobile();

  // favoritedNames: place names the user has favorited (drives the tag heart state).
  const [favoritedNames, setFavoritedNames] = useState<Set<string>>(new Set());

  // Load favorites when user changes
  useEffect(() => {
    if (!user || !supabaseConfigured) {
      setFavoritedNames(new Set());
      return;
    }
    getFavorites()
      .then((favs) => setFavoritedNames(new Set(favs.map((f) => f.place_name))))
      .catch(() => { /* non-critical */ });
  }, [user]);

  async function handleTagFavorite(area: SearchAreaItem) {
    if (!isLocatedPlace(area)) return;
    const name = area.name;
    if (!name) return;
    if (!user || !supabaseConfigured) return; // requires auth
    try {
      const { added } = await toggleFavorite(name, area.lat, area.lng);
      setFavoritedNames((prev) => {
        const next = new Set(prev);
        if (added) next.add(name); else next.delete(name);
        return next;
      });
    } catch { /* non-critical */ }
  }

  // Cancel picking mode on Escape
  useEffect(() => {
    if (!pickingLocation) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setPickingLocation(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [pickingLocation, setPickingLocation]);

  function handleSelect(place: SelectedPlace) {
    const area: SearchAreaItem = {
      type: 'place',
      id: place.placeId,
      name: place.name,
      fullName: place.fullName,
      bbox: place.bbox,
      lat: place.lat,
      lng: place.lng,
    };
    addSearchArea(area);
  }

  const hasDrawnPolygon = searchAreas.some((a) => a.type === 'polygon');

  const placeCount = searchAreas.filter((a) => a.type === 'place').length;
  const showRadius = placeCount === 1 && searchAreas.length === 1;

  // Names of places already added — exclude from favorites dropdown / suggestions
  const selectedNames = new Set(
    searchAreas.filter((a) => a.type === 'place').map((a) => ('name' in a ? a.name : ''))
  );

  // F2: anchors for "nearby" = located places + polygon centroids.
  const nearbyAnchors: Array<{ lat: number; lng: number }> = [];
  for (const a of searchAreas) {
    if (isLocatedPlace(a)) {
      nearbyAnchors.push({ lat: a.lat, lng: a.lng });
    } else if (a.type === 'polygon' && a.polygon.length > 0) {
      const n = a.polygon.length;
      const lng = a.polygon.reduce((s, p) => s + p[0], 0) / n;
      const lat = a.polygon.reduce((s, p) => s + p[1], 0) / n;
      nearbyAnchors.push({ lat, lng });
    }
  }
  const showNearby = nearbyAnchors.length > 0 && searchAreas.length < 8;

  function addNearby(s: NearbySuggestion) {
    addSearchArea({
      type: 'place',
      id: `nearby-${s.name}-${s.lat.toFixed(3)}`,
      name: s.name,
      fullName: s.name,
      lat: s.lat,
      lng: s.lng,
    });
  }

  return (
    <div className="location-input-wrapper">
      <label className="input-label">{t('entry.location')}</label>

      {/* Tag list of selected places / drawn areas */}
      {searchAreas.length > 0 && (
        <div className="loc-tags">
          {searchAreas.map((area) => {
            const tagName = area.type === 'polygon'
              ? t('entry.drawn_area')
              : ('name' in area ? area.name : '');
            const isPlace = isLocatedPlace(area);
            const isFavorited = isPlace && favoritedNames.has(area.name);
            return (
              <span
                key={area.id}
                className={`loc-tag${area.type === 'polygon' ? ' loc-tag--polygon' : ''}`}
              >
                <span className="loc-tag-name">{tagName}</span>
                {isPlace && user && supabaseConfigured && (
                  <button
                    type="button"
                    className={`loc-tag-heart${isFavorited ? ' loc-tag-heart--active' : ''}`}
                    onClick={() => handleTagFavorite(area)}
                    aria-label={isFavorited ? t('favorites.remove') : t('favorites.add')}
                  >
                    <HeartIcon filled={isFavorited} />
                  </button>
                )}
                <button
                  type="button"
                  className="loc-tag-remove"
                  onClick={() => removeSearchArea(area.id)}
                  aria-label={t('a11y.remove_named', { name: tagName })}
                >
                  <RemoveIcon />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Search input row — dimmed when a drawn polygon is active */}
      <div className={`loc-input-row${hasDrawnPolygon ? ' loc-input-row--disabled' : ''}`}>
        <PlaceAutocomplete
          onSelect={handleSelect}
          placeholder={hasDrawnPolygon ? t('entry.polygon_active_placeholder') : t('entry.location_placeholder')}
          showFavorites
          excludeNames={selectedNames}
          clearOnSelect
          disabled={hasDrawnPolygon}
          inline={isMobile}
        />
        <button
          type="button"
          className={`loc-pick-map-btn${pickingLocation ? ' loc-pick-map-btn--active' : ''}`}
          title={t('entry.location_pick_map')}
          aria-label={t('entry.location_pick_map')}
          onClick={() => setPickingLocation(!pickingLocation)}
        >
          <MapPinIcon />
        </button>
      </div>

      {/* Nearby suggestions (F2) — larger towns near the chosen places */}
      {showNearby && (
        <NearbySuggestions
          anchors={nearbyAnchors}
          excludeNames={selectedNames}
          onAdd={addNearby}
        />
      )}

      {/* Radius selector — only when exactly one place */}
      {showRadius && <RadiusSlider />}

      {/* Place granularity — relevant when Overpass is queried (radius or drawn area) */}
      {(showRadius || hasDrawnPolygon) && <GranularityToggle />}
    </div>
  );
}
