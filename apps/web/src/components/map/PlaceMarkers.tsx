import { useRef, useState } from 'react';
import { Marker, Popup } from '@vis.gl/react-maplibre';
import type { MarkerDragEvent } from '@vis.gl/react-maplibre';
import { useTranslation } from 'react-i18next';
import { useAppStore, isLocatedPlace } from '../../stores/appStore.ts';
import { useIsTouch } from '../../hooks/useIsTouch.ts';
import { reverseGeocode, settlementName } from '../../services/nominatim.ts';

/**
 * Pins for the places the user has added to the search (autocomplete, nearby
 * chips, map tap, favorites). Rendered in entry modes only — in results the
 * route/finder markers take over. Tap a pin → popup with the name and a
 * remove action, so places can be managed directly on the map.
 *
 * On desktop (non-touch) the pins can be dragged to a new spot: the place's
 * coordinates update immediately and its name follows via reverse geocoding
 * (same fallback as the tap-to-add flow). Touch devices keep fixed pins —
 * dragging would fight map panning there.
 */
export function PlaceMarkers() {
  const { t, i18n } = useTranslation('common');
  const isTouch = useIsTouch();
  const isDrawingArea = useAppStore((s) => s.isDrawingArea);
  const searchAreas = useAppStore((s) => s.searchAreas);
  const removeSearchArea = useAppStore((s) => s.removeSearchArea);
  const updatePlaceArea = useAppStore((s) => s.updatePlaceArea);
  const [popupId, setPopupId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // A drag ends with a click on the pin — it must not open the popup or reach the map.
  const justDraggedRef = useRef(false);
  // Latest drag per pin wins when reverse-geocode answers arrive out of order.
  const dragSeqRef = useRef<Record<string, number>>({});

  const draggable = !isTouch && !isDrawingArea;

  async function handleDragEnd(id: string, e: MarkerDragEvent) {
    const { lat, lng } = e.lngLat;
    setDraggingId(null);
    setPopupId(null);
    updatePlaceArea(id, { lat, lng });
    const seq = (dragSeqRef.current[id] ?? 0) + 1;
    dragSeqRef.current[id] = seq;
    const fallback = `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
    let result: Awaited<ReturnType<typeof reverseGeocode>> = null;
    try {
      result = await reverseGeocode(lat, lng, i18n.language);
    } catch { /* fall through to coordinate name */ }
    if (dragSeqRef.current[id] !== seq) return; // superseded by a newer drag
    const name = (result && settlementName(result)) || fallback;
    updatePlaceArea(id, { name, fullName: result?.display_name ?? name });
  }

  const places = searchAreas.filter(isLocatedPlace);

  return (
    <>
      {places.map((place) => (
        <Marker
          key={place.id}
          longitude={place.lng}
          latitude={place.lat}
          anchor="bottom"
          draggable={draggable}
          onDragStart={() => { justDraggedRef.current = true; setDraggingId(place.id); setPopupId(null); }}
          onDragEnd={(e) => {
            void handleDragEnd(place.id, e);
            // the click that closes a drag arrives right after mouseup
            setTimeout(() => { justDraggedRef.current = false; }, 250);
          }}
          onClick={(e) => {
            // Don't let the map's tap-to-add handler also fire for this tap.
            e.originalEvent?.stopPropagation();
            if (justDraggedRef.current) return;
            setPopupId((cur) => (cur === place.id ? null : place.id));
          }}
        >
          <div
            className={`place-marker${draggable ? ' place-marker--draggable' : ''}${draggingId === place.id ? ' place-marker--dragging' : ''}`}
            role="button"
            aria-label={place.name}
            title={draggable ? t('map.pin_drag_hint') : undefined}
          >
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
