import { useMemo, useState } from 'react';
import { Marker, Popup } from '@vis.gl/react-maplibre';
import { useTranslation } from 'react-i18next';
import type { FinderResultData } from '../finder/FinderResultRow.tsx';
import { TrophyIcon } from '../finder/FinderIcons.tsx';
import { useAppStore, isLocatedPlace, isRadiusArea } from '../../stores/appStore.ts';
import { getFinderMode } from '../../utils/finderMode.ts';

interface FinderMarkersProps {
  results: FinderResultData[];
  selectedIndex: number | null;
  onMarkerClick: (index: number) => void;
}

/** Continuous hsl gradient: 0 (red) → 120 (green), matching StopMarkers */
function scoreColor(score: number): string {
  const hue = Math.round((Math.min(Math.max(score, 0), 100) / 100) * 120);
  return `hsl(${hue}, 65%, 45%)`;
}

export function FinderMarkers({ results, selectedIndex, onMarkerClick }: FinderMarkersProps) {
  const { t } = useTranslation('common');
  const [popupIndex, setPopupIndex] = useState<number | null>(null);
  const searchAreas = useAppStore((st) => st.searchAreas);

  // Origin only exists for single-place / radius searches (same rule as the result list)
  const origin = useMemo(() => {
    const first = searchAreas[0];
    if (getFinderMode(searchAreas) !== 'around' || !first) return null;
    if (isLocatedPlace(first)) return { lat: first.lat, lng: first.lng, name: first.name };
    if (isRadiusArea(first)) return { lat: first.centerLat, lng: first.centerLng, name: undefined };
    return null;
  }, [searchAreas]);

  return (
    <>
      {origin && (
        <Marker longitude={origin.lng} latitude={origin.lat} anchor="center" style={{ zIndex: 1 }}>
          <div
            role="img"
            aria-label={t('finder.origin_marker', 'Startort')}
            title={origin.name ? `${t('finder.origin_marker', 'Startort')}: ${origin.name}` : t('finder.origin_marker', 'Startort')}
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: 'var(--color-text, #0d2426)',
              border: '3px solid white',
              boxShadow: '0 0 0 2px var(--color-text, #0d2426), var(--shadow-md)',
              pointerEvents: 'none',
            }}
          />
        </Marker>
      )}
      {results.map((result, idx) => {
        const color = scoreColor(result.score.composite);
        const isSelected = selectedIndex === idx;
        // Top 3 are large; lower ranks are smaller so overlapping clusters stay readable
        const isMinor = result.rank > 3;
        const size = isSelected ? 40 : isMinor ? 26 : 34;

        return (
          <Marker
            key={result.townId}
            longitude={result.lng}
            latitude={result.lat}
            anchor="center"
            // Better rank sits on top; the selected marker always wins. Stay below map controls (z 10), panels (z 20) and the mobile sheet (z 40).
            style={{ zIndex: isSelected ? 9 : 8 - Math.min(result.rank - 1, 7) }}
            onClick={() => {
              onMarkerClick(idx);
              setPopupIndex(idx);
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
              {/* Trophy above rank #1 */}
              {result.rank === 1 && (
                <div style={{
                  position: 'absolute',
                  top: isSelected ? '-22px' : '-20px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  pointerEvents: 'none',
                  filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))',
                }}>
                  <TrophyIcon size={16} />
                </div>
              )}
              <div
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  borderRadius: '50%',
                  background: color,
                  border: isSelected ? '3px solid white' : isMinor ? '1.5px solid white' : '2px solid white',
                  boxShadow: 'var(--shadow-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'width 0.15s, height 0.15s',
                  userSelect: 'none',
                  padding: isMinor ? '0' : '2px',
                }}
              >
                <span style={{ fontSize: isMinor ? '8px' : '9px', fontWeight: 400, opacity: 0.85, lineHeight: 1 }}>
                  {t('finder.rank_label', '#{{rank}}', { rank: result.rank })}
                </span>
                <span style={{ fontSize: isMinor ? '11px' : '13px', fontWeight: 700, lineHeight: 1 }}>
                  {Math.round(result.score.composite)}
                </span>
              </div>
            </div>
            {popupIndex === idx && (
              <Popup
                longitude={result.lng}
                latitude={result.lat}
                anchor="bottom"
                onClose={() => setPopupIndex(null)}
                closeButton={false}
              >
                <div style={{ padding: 'var(--space-2)', minWidth: '130px' }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', marginBottom: '2px' }}>
                    {result.townName}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color }}>
                    {t('finder.popup_score', 'Score: {{score}}', { score: Math.round(result.score.composite) })}
                    {result.distanceKm !== null && Math.round(result.distanceKm) > 0 && (
                      <> &middot; {Math.round(result.distanceKm)} km</>
                    )}
                  </div>
                </div>
              </Popup>
            )}
          </Marker>
        );
      })}
    </>
  );
}
