import { Marker, Popup } from '@vis.gl/react-maplibre';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Route } from '@weatherchaser/core';

interface StopMarkersProps {
  route: Route;
  selectedStopIndex: number | null;
  onStopClick: (index: number) => void;
}

function scoreColor(value: number): string {
  const hue = Math.round((Math.min(Math.max(value, 0), 100) / 100) * 120);
  return `hsl(${hue}, 65%, 45%)`;
}

export function StopMarkers({ route, selectedStopIndex, onStopClick }: StopMarkersProps) {
  const { t } = useTranslation('common');
  const [popupIndex, setPopupIndex] = useState<number | null>(null);

  let cumulativeDay = 1;

  return (
    <>
      {route.stops.map((stop, idx) => {
        const stopDay = cumulativeDay;
        cumulativeDay += stop.nights;
        const color = scoreColor(stop.score.composite);
        const isSelected = selectedStopIndex === idx;

        return (
          <Marker
            key={stop.town.id}
            longitude={stop.town.lng}
            latitude={stop.town.lat}
            anchor="center"
            onClick={() => {
              onStopClick(idx);
              setPopupIndex(idx);
            }}
          >
            <div
              style={{
                width: isSelected ? '36px' : '32px',
                height: isSelected ? '36px' : '32px',
                borderRadius: '50%',
                background: color,
                border: isSelected ? '3px solid white' : '2px solid white',
                boxShadow: 'var(--shadow-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'width 0.15s, height 0.15s',
                userSelect: 'none',
              }}
            >
              {stopDay}
            </div>
            {popupIndex === idx && (
              <Popup
                longitude={stop.town.lng}
                latitude={stop.town.lat}
                anchor="bottom"
                onClose={() => setPopupIndex(null)}
                closeButton={false}
              >
                <div style={{ padding: 'var(--space-2)', minWidth: '120px' }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', marginBottom: '2px' }}>
                    {stop.town.name}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: color }}>
                    {t('map.stop_popup', { score: Math.round(stop.score.composite) })}
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
