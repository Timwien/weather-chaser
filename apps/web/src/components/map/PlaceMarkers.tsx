import { useState } from 'react';
import { Marker, Popup } from '@vis.gl/react-maplibre';
import { useTranslation } from 'react-i18next';
import { useAppStore, isLocatedPlace } from '../../stores/appStore.ts';

/**
 * Pins for the places the user has added to the search (autocomplete, nearby
 * chips, map tap, favorites). Rendered in entry modes only — in results the
 * route/finder markers take over. Tap a pin → popup with the name and a
 * remove action, so places can be managed directly on the map.
 */
export function PlaceMarkers() {
  const { t } = useTranslation('common');
  const searchAreas = useAppStore((s) => s.searchAreas);
  const removeSearchArea = useAppStore((s) => s.removeSearchArea);
  const [popupId, setPopupId] = useState<string | null>(null);

  const places = searchAreas.filter(isLocatedPlace);

  return (
    <>
      {places.map((place) => (
        <Marker
          key={place.id}
          longitude={place.lng}
          latitude={place.lat}
          anchor="bottom"
          onClick={(e) => {
            // Don't let the map's tap-to-add handler also fire for this tap.
            e.originalEvent?.stopPropagation();
            setPopupId((cur) => (cur === place.id ? null : place.id));
          }}
        >
          <div className="place-marker" role="button" aria-label={place.name}>
            <svg width="28" height="34" viewBox="0 0 28 34" aria-hidden="true">
              <path
                d="M14 1C7 1 1.5 6.6 1.5 13.5 1.5 22.5 14 33 14 33s12.5-10.5 12.5-19.5C26.5 6.6 21 1 14 1z"
                fill="var(--color-primary, #0d8f9f)"
                stroke="#ffffff"
                strokeWidth="2"
              />
              <circle cx="14" cy="13" r="4.5" fill="#ffffff" />
            </svg>
          </div>
          {popupId === place.id && (
            <Popup
              longitude={place.lng}
              latitude={place.lat}
              anchor="bottom"
              onClose={() => setPopupId(null)}
              closeButton={false}
              offset={34}
            >
              <div className="map-tap-popup">
                <div className="map-tap-popup-name">{place.name}</div>
                <div className="map-tap-popup-actions">
                  <button
                    type="button"
                    className="place-marker-remove"
                    onClick={() => {
                      removeSearchArea(place.id);
                      setPopupId(null);
                    }}
                  >
                    {t('map.pin_remove')}
                  </button>
                  <button
                    type="button"
                    className="map-tap-popup-close"
                    onClick={() => setPopupId(null)}
                    aria-label={t('a11y.close')}
                  >
                    ×
                  </button>
                </div>
              </div>
            </Popup>
          )}
        </Marker>
      ))}
    </>
  );
}
