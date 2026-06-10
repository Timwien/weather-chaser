import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore.ts';
import { useAuthStore } from '../../stores/authStore.ts';
import { supabaseConfigured } from '../../lib/supabase.ts';
import { getFavorites, toggleFavorite } from '../../services/userdata.ts';
import { useLocationSearch } from '../../hooks/useLocationSearch.ts';
import { parseBbox } from '../../services/nominatim.ts';
import type { NominatimResult } from '../../services/nominatim.ts';
import type { SearchAreaItem } from '../../stores/appStore.ts';
import type { Favorite } from '../../types/database.ts';

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
  const idx = STEPS.findIndex((v) => v >= searchRadiusKm) ?? STEPS.length - 1;

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

/* ── Main LocationInput component ───────────────────────── */

export function LocationInput() {
  const { t } = useTranslation('common');
  const { searchAreas, addSearchArea, removeSearchArea, searchRadiusKm, pickingLocation, setPickingLocation } = useAppStore();
  const { user } = useAuthStore();
  const { search, results, loading } = useLocationSearch();

  const [inputValue, setInputValue] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Favorites state for logged-in users
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  // favoritedNames: set of place names the user has favorited (for tag heart state)
  const [favoritedNames, setFavoritedNames] = useState<Set<string>>(new Set());

  // Load favorites when user changes
  useEffect(() => {
    if (!user || !supabaseConfigured) {
      setFavorites([]);
      setFavoritedNames(new Set());
      return;
    }
    getFavorites()
      .then((favs) => {
        setFavorites(favs);
        setFavoritedNames(new Set(favs.map((f) => f.place_name)));
      })
      .catch(() => { /* non-critical */ });
  }, [user]);

  async function handleTagFavorite(area: SearchAreaItem) {
    if (area.type !== 'place' || !('lat' in area) || area.lat === undefined) return;
    const name = 'name' in area ? area.name : '';
    if (!name) return;
    if (!user || !supabaseConfigured) return; // requires auth
    try {
      const { added } = await toggleFavorite(name, area.lat, area.lng ?? 0);
      setFavoritedNames((prev) => {
        const next = new Set(prev);
        if (added) next.add(name); else next.delete(name);
        return next;
      });
    } catch { /* non-critical */ }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  // Cancel picking mode on Escape
  useEffect(() => {
    if (!pickingLocation) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setPickingLocation(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [pickingLocation, setPickingLocation]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setInputValue(value);
    setDropdownOpen(true);
    search(value);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setDropdownOpen(false);
    } else if (e.key === 'Enter' && results.length > 0) {
      selectResult(results[0]);
    }
  }

  function handleFocus() {
    setDropdownOpen(true);
  }

  function selectResult(result: NominatimResult) {
    const bbox = parseBbox(result);
    const shortName = result.display_name.split(',')[0].trim();

    const area: SearchAreaItem = {
      type: 'place',
      id: String(result.place_id),
      name: shortName,
      fullName: result.display_name,
      bbox: [bbox.west, bbox.south, bbox.east, bbox.north],
      lat: Number(result.lat),
      lng: Number(result.lon),
    };

    addSearchArea(area);
    setInputValue('');
    setDropdownOpen(false);
    inputRef.current?.focus();
  }

  function selectFavorite(fav: Favorite) {
    const area: SearchAreaItem = {
      type: 'place',
      id: `fav-${fav.id}`,
      name: fav.place_name,
      fullName: fav.place_name,
      lat: fav.lat,
      lng: fav.lng,
    };
    addSearchArea(area);
    setInputValue('');
    setDropdownOpen(false);
    inputRef.current?.focus();
  }

  const hasDrawnPolygon = searchAreas.some((a) => a.type === 'polygon');
  const showRadius = searchAreas.filter((a) => a.type === 'place').length === 1 && searchAreas.length === 1;

  // Names of places already added — exclude from favorites dropdown
  const selectedNames = new Set(
    searchAreas.filter((a) => a.type === 'place').map((a) => ('name' in a ? a.name : ''))
  );

  // Filter favorites by current input and exclude already-selected places
  const matchedFavorites = favorites.filter((f) =>
    !selectedNames.has(f.place_name) &&
    (inputValue.trim() === '' || f.place_name.toLowerCase().includes(inputValue.toLowerCase()))
  );

  // Show dropdown if open and (has Nominatim results OR has favorites)
  const showDropdown = dropdownOpen && !hasDrawnPolygon && (results.length > 0 || matchedFavorites.length > 0);

  return (
    <div className="location-input-wrapper" ref={containerRef}>
      <label className="input-label">{t('entry.location')}</label>

      {/* Tag list of selected places / drawn areas */}
      {searchAreas.length > 0 && (
        <div className="loc-tags">
          {searchAreas.map((area) => {
            const tagName = area.type === 'polygon'
              ? t('entry.drawn_area', 'Gezeichnetes Gebiet')
              : ('name' in area ? area.name : '');
            const isPlace = area.type === 'place' && 'lat' in area && area.lat !== undefined;
            const isFavorited = isPlace && 'name' in area && favoritedNames.has(area.name);
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
        <div className="location-input-container">
          <input
            ref={inputRef}
            type="text"
            className="text-input"
            value={inputValue}
            onChange={hasDrawnPolygon ? undefined : handleChange}
            onKeyDown={hasDrawnPolygon ? undefined : handleKeyDown}
            onFocus={hasDrawnPolygon ? undefined : handleFocus}
            placeholder={hasDrawnPolygon ? t('entry.polygon_active_placeholder', 'Gebiet gezeichnet') : t('entry.location_placeholder')}
            autoComplete="off"
            disabled={hasDrawnPolygon}
          />
          {loading && <div className="loading-bar" aria-hidden="true" />}
        </div>
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

      {/* Autocomplete dropdown — favorites first, then Nominatim results */}
      {showDropdown && (
        <ul className="autocomplete-dropdown" role="listbox">
          {matchedFavorites.slice(0, 5).map((fav) => (
            <li
              key={`fav-${fav.id}`}
              role="option"
              className="autocomplete-option autocomplete-option--favorite"
              onMouseDown={() => selectFavorite(fav)}
            >
              <HeartIcon filled={true} />
              <span>{fav.place_name}</span>
            </li>
          ))}
          {results.slice(0, 5).map((result) => (
            <li
              key={result.place_id}
              role="option"
              className="autocomplete-option"
              onMouseDown={() => selectResult(result)}
            >
              {result.display_name}
            </li>
          ))}
        </ul>
      )}

      {/* Radius selector — only when exactly one place */}
      {showRadius && <RadiusSlider />}

      {/* Place granularity — relevant when Overpass is queried (radius or drawn area) */}
      {(showRadius || hasDrawnPolygon) && <GranularityToggle />}
    </div>
  );
}
