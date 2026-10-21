import { useCallback, useEffect, useMemo, useState } from 'react';
import { Marker, Popup, useMap } from '@vis.gl/react-maplibre';
import { useTranslation } from 'react-i18next';
import type { FinderResultData } from '../finder/FinderResultRow.tsx';
import { TrophyIcon } from '../finder/FinderIcons.tsx';
import { useAppStore, isLocatedPlace, isRadiusArea } from '../../stores/appStore.ts';
import { getFinderMode } from '../../utils/finderMode.ts';
import { computeDotIndices } from '../../utils/markerDeclutter.ts';

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

// Full-size marker diameters (px). Rank labels stay >= 11px (M14).
const SIZE_MAJOR = 36;
const SIZE_MINOR = 30;
const SIZE_SELECTED = 42;
const DOT_SIZE = 12;

export function FinderMarkers({ results, selectedIndex, onMarkerClick }: FinderMarkersProps) {
  const { t } = useTranslation('common');
  const [popupIndex, setPopupIndex] = useState<number | null>(null);
  const searchAreas = useAppStore((st) => st.searchAreas);
  const { current: map } = useMap();
  const [dots, setDots] = useState<Set<number>>(() => new Set());

  // Declutter in screen space after every pan/zoom: markers that would sit on top of a
  // better-ranked (or the selected) marker collapse to a tappable dot.
  const declutter = useCallback(() => {
    if (!map) return;
    const nativeMap = map.getMap();
    const items = results.map((r, i) => {
      const p = nativeMap.project([r.lng, r.lat]);
      const selected = selectedIndex === i;
      return { x: p.x, y: p.y, rank: r.rank, selected, size: selected ? SIZE_SELECTED : r.rank > 3 ? SIZE_MINOR : SIZE_MAJOR };
    });
    const next = computeDotIndices(items);
    setDots((prev) => (prev.size === next.size && [...next].every((i) => prev.has(i)) ? prev : next));
  }, [map, results, selectedIndex]);

  useEffect(() => {
    if (!map) return;
    const nativeMap = map.getMap();
    declutter();
    nativeMap.on('moveend', declutter);
    nativeMap.on('zoomend', declutter);
    return () => {
      nativeMap.off('moveend', declutter);
      nativeMap.off('zoomend', declutter);
    };
  }, [map, declutter]);

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
        const isDot = dots.has(idx) && !isSelected;
        const size = isSelected ? SIZE_SELECTED : isMinor ? SIZE_MINOR : SIZE_MAJOR;

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
            {isDot ? (
              // Compact dot: still tappable (padded hit area), still selectable from the list
              <div
                role="img"
                data-marker-dot=""
                aria-label={`${result.townName}, ${t('finder.rank_label', '#{{rank}}', { rank: result.rank })}`}
                style={{ padding: '8px', cursor: 'pointer', touchAction: 'manipulation' }}
              >
                <div
                  style={{
                    width: `${DOT_SIZE}px`,
                    height: `${DOT_SIZE}px`,
                    borderRadius: '50%',
                    background: color,
                    border: '2px solid white',
                    boxShadow: 'var(--shadow-md)',
                    boxSizing: 'content-box',
                  }}
                />
              </div>
            ) : (
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
                  padding: '0',
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 500, opacity: 0.9, lineHeight: 1 }}>
                  {t('finder.rank_label', '#{{rank}}', { rank: result.rank })}
                </span>
                <span style={{ fontSize: isMinor ? '11px' : '13px', fontWeight: 700, lineHeight: 1 }}>
                  {Math.round(result.score.composite)}
                </span>
              </div>
            </div>
            )}
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
