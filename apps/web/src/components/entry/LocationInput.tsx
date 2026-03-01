import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore.ts';
import { useLocationSearch } from '../../hooks/useLocationSearch.ts';
import { parseBbox } from '../../services/nominatim.ts';
import type { NominatimResult } from '../../services/nominatim.ts';
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

/* ── Main LocationInput component ───────────────────────── */

export function LocationInput() {
  const { t } = useTranslation('common');
  const { searchAreas, addSearchArea, removeSearchArea, searchRadiusKm } = useAppStore();
  const { search, results, loading } = useLocationSearch();

  const [inputValue, setInputValue] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const hasDrawnPolygon = searchAreas.some((a) => a.type === 'polygon');
  const showDropdown = dropdownOpen && results.length > 0 && !hasDrawnPolygon;
  const showRadius = searchAreas.filter((a) => a.type === 'place').length === 1 && searchAreas.length === 1;

  return (
    <div className="location-input-wrapper" ref={containerRef}>
      <label className="input-label">{t('entry.location')}</label>

      {/* Tag list of selected places / drawn areas */}
      {searchAreas.length > 0 && (
        <div className="loc-tags">
          {searchAreas.map((area) => (
            <span
              key={area.id}
              className={`loc-tag${area.type === 'polygon' ? ' loc-tag--polygon' : ''}`}
            >
              <span className="loc-tag-name">
                {area.type === 'polygon' ? t('entry.drawn_area', 'Gezeichnetes Gebiet') : ('name' in area ? area.name : '')}
              </span>
              <button
                type="button"
                className="loc-tag-remove"
                onClick={() => removeSearchArea(area.id)}
                aria-label={`Remove ${area.type === 'polygon' ? 'drawn area' : ('name' in area ? area.name : 'area')}`}
              >
                <RemoveIcon />
              </button>
            </span>
          ))}
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
            placeholder={hasDrawnPolygon ? t('entry.polygon_active_placeholder', 'Gebiet gezeichnet') : t('entry.location_placeholder')}
            autoComplete="off"
            disabled={hasDrawnPolygon}
          />
          {loading && <div className="loading-bar" aria-hidden="true" />}
        </div>
        <button
          type="button"
          className="loc-pick-map-btn"
          title={t('entry.location_pick_map')}
          aria-label={t('entry.location_pick_map')}
        >
          <MapPinIcon />
        </button>
      </div>

      {/* Autocomplete dropdown */}
      {showDropdown && (
        <ul className="autocomplete-dropdown" role="listbox">
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
    </div>
  );
}
