import { useTranslation } from 'react-i18next';
import { useAppStore, isLocatedPlace } from '../../stores/appStore.ts';
import { PlaceAutocomplete, type SelectedPlace } from '../common/PlaceAutocomplete.tsx';

// Inline remove icon — no emoji per design decision
function RemoveIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function RouteConfigStep({ onGenerate, onBack }: { onGenerate: () => void; onBack: () => void }) {
  const { t } = useTranslation('common');
  const { tripConfig, setTripConfig, searchAreas } = useAppStore();

  // Names already chosen as must-visit stops (dedupe suggestions + autocomplete).
  const mustVisitNames = new Set(tripConfig.mustVisitCoords.map((c) => c.name));

  // Quick-add: located places from searchAreas not yet added as a must-visit.
  const mustVisitSuggestions = searchAreas
    .filter(isLocatedPlace)
    .filter((a) => !mustVisitNames.has(a.name));

  // B4: adding a stop always carries coordinates → the optimizer actually sees it.
  function addMustVisitCoord(name: string, lat: number, lng: number) {
    if (mustVisitNames.has(name)) return;
    setTripConfig({ mustVisitCoords: [...tripConfig.mustVisitCoords, { name, lat, lng }] });
  }

  function handleStopSelect(place: SelectedPlace) {
    addMustVisitCoord(place.name, place.lat, place.lng);
  }

  function removeMustVisit(name: string) {
    setTripConfig({
      mustVisitCoords: tripConfig.mustVisitCoords.filter((c) => c.name !== name),
    });
  }

  function decrementMaxStay() {
    setTripConfig({ maxStay: Math.max(1, tripConfig.maxStay - 1) });
  }

  function incrementMaxStay() {
    setTripConfig({ maxStay: Math.min(tripConfig.totalDays, tripConfig.maxStay + 1) });
  }

  const hasDates = Boolean(tripConfig.startDate && tripConfig.endDate);

  // Pre-fill start field from an explicit start or the first located place.
  const firstPlace = searchAreas.find(isLocatedPlace);
  const startInitial = tripConfig.startLocation || firstPlace?.name || '';

  function handleStartSelect(place: SelectedPlace) {
    setTripConfig({ startLocation: place.name, startLat: place.lat, startLng: place.lng });
  }

  return (
    <div className="route-config-step">
      <div className="route-config-divider" />

      {/* Back button */}
      <button type="button" className="route-config-back-btn" onClick={onBack}>
        ← {t('itinerary.back')}
      </button>

      {/* Start location */}
      <div className="route-config-field">
        <label className="input-label">{t('route_config.start_location')}</label>
        <PlaceAutocomplete
          onSelect={handleStartSelect}
          placeholder={t('route_config.start_location')}
          initialValue={startInitial}
          showFavorites
        />
      </div>

      {/* U3: Trip duration is redundant when a date range is set (the date picker
          already shows the "N Tage" badge). Only show the manual stepper as a
          fallback when no end date has been picked. */}
      {!hasDates && (
        <div className="route-config-field">
          <label className="input-label">{t('route_config.trip_duration')}</label>
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
        </div>
      )}

      {/* Max nights per stop */}
      <div className="route-config-field">
        <label className="input-label">{t('route_config.max_stay')}</label>
        <div className="stepper-row">
          <button
            type="button"
            className="stepper-btn"
            onClick={decrementMaxStay}
            disabled={tripConfig.maxStay <= 1}
            aria-label={t('a11y.decrease_max_stay')}
          >
            –
          </button>
          <span className="stepper-value">{tripConfig.maxStay}</span>
          <button
            type="button"
            className="stepper-btn"
            onClick={incrementMaxStay}
            disabled={tripConfig.maxStay >= tripConfig.totalDays}
            aria-label={t('a11y.increase_max_stay')}
          >
            +
          </button>
          <span className="input-suffix">{t('route_config.nights_suffix')}</span>
        </div>
      </div>

      {/* U2: weather preset + custom weights now live in the shared
          "Wetter-Präferenz" section of the entry panel (visible for both
          scenarios) — no longer duplicated here. */}

      {/* Must-visit stops */}
      <div className="route-config-field">
        <label className="input-label">{t('route_config.must_visit')}</label>
        {mustVisitSuggestions.length > 0 && (
          <div className="must-visit-suggestions">
            {mustVisitSuggestions.map((a) => (
              <button
                key={a.id}
                type="button"
                className="suggestion-pill"
                onClick={() => addMustVisitCoord(a.name, a.lat, a.lng)}
              >
                + {a.name}
              </button>
            ))}
          </div>
        )}
        <div className="must-visit-input-row">
          <PlaceAutocomplete
            onSelect={handleStopSelect}
            placeholder={t('route_config.add_must_visit')}
            excludeNames={mustVisitNames}
            clearOnSelect
            showFavorites
          />
        </div>
        {tripConfig.mustVisitCoords.length > 0 && (
          <ul className="must-visit-list">
            {tripConfig.mustVisitCoords.map((c) => (
              <li key={c.name} className="must-visit-item">
                <span className="must-visit-name">{c.name}</span>
                <button
                  type="button"
                  className="must-visit-remove"
                  onClick={() => removeMustVisit(c.name)}
                  aria-label={t('a11y.remove_named', { name: c.name })}
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
