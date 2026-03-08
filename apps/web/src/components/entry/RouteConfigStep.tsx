import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore.ts';
import { useLocationSearch } from '../../hooks/useLocationSearch.ts';
import type { NominatimResult } from '../../services/nominatim.ts';
import type { WeatherPreset } from '@weatherchaser/core';
import { BeachIcon, HikingIcon, SightseeingIcon } from '../finder/FinderIcons.tsx';

// Inline remove icon — no emoji per design decision
function RemoveIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const PRESETS: WeatherPreset[] = ['beach', 'hiking', 'sightseeing'];

const PRESET_ICONS: Record<WeatherPreset, React.ComponentType<{ size?: number }>> = {
  beach: BeachIcon,
  hiking: HikingIcon,
  sightseeing: SightseeingIcon,
};

/** Simplified location search for start location — writes to tripConfig, not searchArea */
function StartLocationSearch() {
  const { t } = useTranslation('common');
  const { setTripConfig, searchAreas, tripConfig } = useAppStore();
  const { search, results, loading } = useLocationSearch();

  // Pre-populate from the first named place in searchAreas if no start set
  const firstPlace = searchAreas.find((a) => a.type === 'place');
  const defaultValue = tripConfig.startLocation || (firstPlace && 'name' in firstPlace ? firstPlace.name : '');

  const [inputValue, setInputValue] = useState(defaultValue);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Auto-set start coords from first place area if not yet set
  useEffect(() => {
    if (tripConfig.startLat === null && firstPlace && 'lat' in firstPlace && firstPlace.lat !== undefined) {
      setTripConfig({
        startLocation: firstPlace.name,
        startLat: firstPlace.lat,
        startLng: (firstPlace as { lat: number; lng?: number }).lng ?? null,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setInputValue(value);
    setDropdownOpen(true);
    search(value);
    // If user clears the field, clear store values too
    if (!value.trim()) {
      setTripConfig({ startLocation: '', startLat: null, startLng: null });
    }
  }

  function selectResult(result: NominatimResult) {
    const shortName = result.display_name.split(',')[0].trim();
    setInputValue(shortName);
    setDropdownOpen(false);
    setTripConfig({
      startLocation: shortName,
      startLat: Number(result.lat),
      startLng: Number(result.lon),
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') setDropdownOpen(false);
    if (e.key === 'Enter' && results.length > 0) selectResult(results[0]);
  }

  const showDropdown = dropdownOpen && results.length > 0;

  return (
    <div className="location-input-wrapper">
      <div className="location-input-container">
        <input
          type="text"
          className="text-input"
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={t('route_config.start_location')}
          autoComplete="off"
        />
        {loading && <div className="loading-bar" aria-hidden="true" />}
      </div>
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
    </div>
  );
}

export function RouteConfigStep({ onGenerate, onBack }: { onGenerate: () => void; onBack: () => void }) {
  const { t } = useTranslation('common');
  const { tripConfig, setTripConfig, searchAreas } = useAppStore();
  const [mustVisitInput, setMustVisitInput] = useState('');

  // Quick-add: place names from searchAreas not yet in mustVisitNames
  const mustVisitSuggestions = searchAreas
    .filter((a) => a.type === 'place' && 'name' in a)
    .map((a) => (a as { name: string }).name)
    .filter((name) => !tripConfig.mustVisitNames.includes(name));

  function addMustVisit() {
    const name = mustVisitInput.trim();
    if (!name) return;
    if (!tripConfig.mustVisitNames.includes(name)) {
      setTripConfig({ mustVisitNames: [...tripConfig.mustVisitNames, name] });
    }
    setMustVisitInput('');
  }

  function removeMustVisit(name: string) {
    setTripConfig({
      mustVisitNames: tripConfig.mustVisitNames.filter((n) => n !== name),
    });
  }

  function handleMustVisitKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') addMustVisit();
  }

  function decrementMaxStay() {
    setTripConfig({ maxStay: Math.max(1, tripConfig.maxStay - 1) });
  }

  function incrementMaxStay() {
    setTripConfig({ maxStay: Math.min(tripConfig.totalDays, tripConfig.maxStay + 1) });
  }

  const hasDates = Boolean(tripConfig.startDate && tripConfig.endDate);

  return (
    <div className="route-config-step">
      <div className="route-config-divider" />

      {/* Back button */}
      <button type="button" className="route-config-back-btn" onClick={onBack}>
        ← {t('itinerary.back', 'Zurück')}
      </button>

      {/* Start location */}
      <div className="route-config-field">
        <label className="input-label">{t('route_config.start_location')}</label>
        <StartLocationSearch />
      </div>

      {/* Trip duration */}
      <div className="route-config-field">
        <label className="input-label">{t('route_config.trip_duration')}</label>
        {hasDates ? (
          <div className="route-config-duration-display">
            {tripConfig.totalDays} {t('route_config.days_suffix')}
          </div>
        ) : (
          <div className="stepper-row">
            <input
              type="number"
              className="text-input"
              min={1}
              max={14}
              value={tripConfig.totalDays}
              onChange={(e) => setTripConfig({ totalDays: Math.max(1, Math.min(14, Number(e.target.value))) })}
              style={{ width: '80px' }}
            />
            <span className="input-suffix">{t('route_config.days_suffix')}</span>
          </div>
        )}
      </div>

      {/* Max nights per stop */}
      <div className="route-config-field">
        <label className="input-label">{t('route_config.max_stay')}</label>
        <div className="stepper-row">
          <button
            type="button"
            className="stepper-btn"
            onClick={decrementMaxStay}
            disabled={tripConfig.maxStay <= 1}
            aria-label="Decrease max stay"
          >
            –
          </button>
          <span className="stepper-value">{tripConfig.maxStay}</span>
          <button
            type="button"
            className="stepper-btn"
            onClick={incrementMaxStay}
            disabled={tripConfig.maxStay >= tripConfig.totalDays}
            aria-label="Increase max stay"
          >
            +
          </button>
          <span className="input-suffix">{t('route_config.nights_suffix')}</span>
        </div>
      </div>

      {/* Weather preset */}
      <div className="route-config-field">
        <label className="input-label">{t('preset.label')}</label>
        <div className="preset-buttons">
          {PRESETS.map((preset) => {
            const Icon = PRESET_ICONS[preset];
            return (
              <button
                key={preset}
                type="button"
                className={`preset-btn${tripConfig.preset === preset ? ' preset-btn--active' : ''}`}
                onClick={() => setTripConfig({ preset })}
              >
                <Icon size={20} />
                <span>{t(`preset.${preset}`)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Must-visit stops */}
      <div className="route-config-field">
        <label className="input-label">{t('route_config.must_visit')}</label>
        {mustVisitSuggestions.length > 0 && (
          <div className="must-visit-suggestions">
            {mustVisitSuggestions.map((name) => (
              <button
                key={name}
                type="button"
                className="suggestion-pill"
                onClick={() => setTripConfig({ mustVisitNames: [...tripConfig.mustVisitNames, name] })}
              >
                + {name}
              </button>
            ))}
          </div>
        )}
        <div className="must-visit-input-row">
          <input
            type="text"
            className="text-input must-visit-input"
            value={mustVisitInput}
            onChange={(e) => setMustVisitInput(e.target.value)}
            onKeyDown={handleMustVisitKeyDown}
            placeholder={t('route_config.add_must_visit')}
          />
          <button
            type="button"
            className="add-btn"
            onClick={addMustVisit}
            disabled={!mustVisitInput.trim()}
          >
            {t('route_config.add')}
          </button>
        </div>
        {tripConfig.mustVisitNames.length > 0 && (
          <ul className="must-visit-list">
            {tripConfig.mustVisitNames.map((name) => (
              <li key={name} className="must-visit-item">
                <span className="must-visit-name">{name}</span>
                <button
                  type="button"
                  className="must-visit-remove"
                  onClick={() => removeMustVisit(name)}
                  aria-label={`Remove ${name}`}
                >
                  <RemoveIcon />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Generate Route CTA */}
      <button
        type="button"
        className="cta-btn cta-btn--primary"
        onClick={onGenerate}
      >
        {t('route_config.generate')}
      </button>
    </div>
  );
}
