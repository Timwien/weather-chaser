import { useState } from 'react';
import { Marker, Popup } from '@vis.gl/react-maplibre';
import { useTranslation } from 'react-i18next';
import type { FinderResultData } from '../finder/FinderResultRow.tsx';

interface FinderMarkersProps {
  results: FinderResultData[];
  selectedIndex: number | null;
  onMarkerClick: (index: number) => void;
}

function finderMarkerColor(score: number): string {
  if (score >= 70) return 'var(--score-good)';
  if (score >= 40) return 'var(--score-fair)';
  return 'var(--score-poor)';
}

export function FinderMarkers({ results, selectedIndex, onMarkerClick }: FinderMarkersProps) {
  const { t } = useTranslation('common');
  const [popupIndex, setPopupIndex] = useState<number | null>(null);

  return (
    <>
      {results.map((result, idx) => {
        const color = finderMarkerColor(result.score.composite);
        const isSelected = selectedIndex === idx;

        return (
          <Marker
            key={result.townId}
            longitude={result.lng}
            latitude={result.lat}
            anchor="center"
            onClick={() => {
              onMarkerClick(idx);
              setPopupIndex(idx);
            }}
          >
            <div
              style={{
                width: isSelected ? '40px' : '34px',
                height: isSelected ? '40px' : '34px',
                borderRadius: '50%',
                background: color,
                border: isSelected ? '3px solid white' : '2px solid white',
                boxShadow: 'var(--shadow-md)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'width 0.15s, height 0.15s',
                userSelect: 'none',
              }}
            >
              <span style={{ fontSize: '9px', fontWeight: 400, opacity: 0.85 }}>
                {t('finder.rank_label', '#{{rank}}', { rank: result.rank })}
              </span>
              <span style={{ fontSize: '11px', lineHeight: 1 }}>
                {Math.round(result.score.composite)}
              </span>
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
                    Score: {Math.round(result.score.composite)} &middot; {Math.round(result.distanceKm)} km
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
