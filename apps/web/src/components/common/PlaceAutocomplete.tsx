import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore.ts';
import { supabaseConfigured } from '../../lib/supabase.ts';
import { getFavorites } from '../../services/userdata.ts';
import { useLocationSearch } from '../../hooks/useLocationSearch.ts';
import { parseBbox, type NominatimResult } from '../../services/nominatim.ts';
import type { Favorite } from '../../types/database.ts';

export interface SelectedPlace {
  name: string;
  fullName: string;
  lat: number;
  lng: number;
  bbox?: [number, number, number, number];
  placeId: string;
}

interface PlaceAutocompleteProps {
  onSelect: (place: SelectedPlace) => void;
  placeholder: string;
  /** Pre-fill the input (e.g. an already-chosen start location). */
  initialValue?: string;
  /** Show the user's favorites at the top of the dropdown. */
  showFavorites?: boolean;
  /** Hide places already chosen elsewhere (by name). */
  excludeNames?: Set<string>;
  /** Clear the input after a selection (multi-add fields). */
  clearOnSelect?: boolean;
  /** Disable input entirely (e.g. a drawn polygon is active). */
  disabled?: boolean;
  /** Render the dropdown in-flow (mobile scroll containers) instead of absolute. */
  inline?: boolean;
}

/* ── Heart icon (favorite marker in dropdown) ───────────── */
function HeartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="var(--color-primary, #0E7490)" aria-hidden="true">
      <path d="M8 13.7s-6-3.9-6-8a4 4 0 0 1 6-3.46A4 4 0 0 1 14 5.7c0 4.1-6 8-6 8z" />
    </svg>
  );
}

type Option =
  | { kind: 'favorite'; fav: Favorite }
  | { kind: 'result'; result: NominatimResult };

/**
 * R1: single, correct autocomplete used by every place-entry field.
 * Bakes in the fixes that were previously missing or divergent across the three
 * ad-hoc implementations:
 *  - B2: dropdown anchored inside the input's own relative container.
 *  - B3: dismiss on outside-pointerdown / Escape / blur / selection; options use
 *    onPointerDown+preventDefault so a tap doesn't blur-then-lose the selection;
 *    results cleared on select so a programmatic refocus can't reopen a stale list.
 *  - B4: a selection always carries coordinates → no ungeocoded state possible.
 */
export function PlaceAutocomplete({
  onSelect,
  placeholder,
  initialValue = '',
  showFavorites = false,
  excludeNames,
  clearOnSelect = false,
  disabled = false,
  inline = false,
}: PlaceAutocompleteProps) {
  const { t } = useTranslation('common');
  const { user } = useAuthStore();
  const { search, clear, results, loading } = useLocationSearch();

  const [inputValue, setInputValue] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Suppress the dropdown reopening when we programmatically refocus after a select.
  const suppressReopen = useRef(false);
  const listboxId = useId();

  // Load favorites once when needed.
  useEffect(() => {
    if (!showFavorites || !user || !supabaseConfigured) {
      setFavorites([]);
      return;
    }
    getFavorites()
      .then(setFavorites)
      .catch(() => { /* non-critical */ });
  }, [showFavorites, user]);

  // Outside dismiss — pointerdown covers both mouse and touch.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const matchedFavorites = showFavorites
    ? favorites.filter(
        (f) =>
          !excludeNames?.has(f.place_name) &&
          (inputValue.trim() === '' || f.place_name.toLowerCase().includes(inputValue.toLowerCase())),
      )
    : [];

  const filteredResults = excludeNames
    ? results.filter((r) => !excludeNames.has(r.display_name.split(',')[0].trim()))
    : results;

  const options: Option[] = [
    ...matchedFavorites.slice(0, 5).map((fav) => ({ kind: 'favorite' as const, fav })),
    ...filteredResults.slice(0, 5).map((result) => ({ kind: 'result' as const, result })),
  ];

  const showDropdown = open && !disabled && options.length > 0;

  function handleSelect(opt: Option) {
    const place: SelectedPlace =
      opt.kind === 'favorite'
        ? {
            name: opt.fav.place_name,
            fullName: opt.fav.place_name,
            lat: opt.fav.lat,
            lng: opt.fav.lng,
            placeId: `fav-${opt.fav.id}`,
          }
        : (() => {
            const bbox = parseBbox(opt.result);
            const shortName = opt.result.display_name.split(',')[0].trim();
            return {
              name: shortName,
              fullName: opt.result.display_name,
              lat: Number(opt.result.lat),
              lng: Number(opt.result.lon),
              bbox: [bbox.west, bbox.south, bbox.east, bbox.north] as [number, number, number, number],
              placeId: String(opt.result.place_id),
            };
          })();

    onSelect(place);
    clear();            // drop stale results so a refocus can't resurface them
    setOpen(false);
    setActiveIdx(-1);
    if (clearOnSelect) {
      setInputValue('');
      suppressReopen.current = true;
      inputRef.current?.focus();
    } else {
      setInputValue(place.name);
      inputRef.current?.blur();
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setInputValue(value);
    setOpen(true);
    setActiveIdx(-1);
    search(value);
    if (!value.trim()) clear();
  }

  function handleFocus() {
    if (suppressReopen.current) {
      suppressReopen.current = false;
      return;
    }
    setOpen(true);
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    // Don't close if focus moved to an option inside our container.
    if (containerRef.current?.contains(e.relatedTarget as Node)) return;
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false);
      setActiveIdx(-1);
      return;
    }
    if (!showDropdown) {
      if (e.key === 'Enter' && options.length > 0) handleSelect(options[0]);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelect(options[activeIdx >= 0 ? activeIdx : 0]);
    }
  }

  return (
    <div className="location-input-container" ref={containerRef} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        className="text-input"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeIdx >= 0 ? `${listboxId}-opt-${activeIdx}` : undefined}
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
      />
      {loading && <div className="loading-bar" aria-hidden="true" />}

      {showDropdown && (
        <ul
          id={listboxId}
          className={`autocomplete-dropdown${inline ? ' autocomplete-dropdown--inline' : ''}`}
          role="listbox"
        >
          {options.map((opt, idx) => {
            const isFav = opt.kind === 'favorite';
            const label = isFav ? opt.fav.place_name : opt.result.display_name;
            const key = isFav ? `fav-${opt.fav.id}` : `res-${opt.result.place_id}`;
            return (
              <li
                key={key}
                id={`${listboxId}-opt-${idx}`}
                role="option"
                aria-selected={idx === activeIdx}
                className={`autocomplete-option${isFav ? ' autocomplete-option--favorite' : ''}${idx === activeIdx ? ' autocomplete-option--active' : ''}`}
                onPointerDown={(e) => {
                  e.preventDefault(); // keep input focus; select on pointer down
                  handleSelect(opt);
                }}
              >
                {isFav && <HeartIcon />}
                <span>{label}</span>
              </li>
            );
          })}
        </ul>
      )}

      {/* a11y live-region for loading (screen readers) */}
      {loading && <span className="sr-only">{t('a11y.loading')}</span>}
    </div>
  );
}
