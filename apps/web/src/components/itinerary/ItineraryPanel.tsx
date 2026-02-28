import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore.ts';
import { SummaryBar } from './SummaryBar.tsx';
import { StopCard } from './StopCard.tsx';
import { ErrorMessage } from '../common/ErrorMessage.tsx';
import './ItineraryPanel.css';

interface ItineraryPanelProps {
  selectedStopIndex: number | null;
  onStopSelect: (index: number) => void;
}

export function ItineraryPanel({ selectedStopIndex, onStopSelect }: ItineraryPanelProps) {
  const { t } = useTranslation('common');
  const { route, error, mode } = useAppStore();
  const stopRefs = useRef<Array<HTMLDivElement | null>>([]);

  // Scroll to the selected stop when selectedStopIndex changes
  if (selectedStopIndex !== null && stopRefs.current[selectedStopIndex]) {
    stopRefs.current[selectedStopIndex]!.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  if (mode === 'idle' || mode === 'route-config') return null;

  if (error) {
    return (
      <div className="itinerary-panel">
        <ErrorMessage error={error} />
      </div>
    );
  }

  if (!route) return null;

  let cumulativeDay = 1;

  return (
    <div className="itinerary-panel">
      <h2 className="itinerary-title">{t('itinerary.title')}</h2>
      <SummaryBar route={route} />
      <div className="itinerary-list">
        {route.stops.map((stop, idx) => {
          const stopDay = cumulativeDay;
          cumulativeDay += stop.nights;
          return (
            <div key={stop.town.id} ref={(el) => { stopRefs.current[idx] = el; }}>
              <StopCard
                stop={stop}
                stopNumber={stopDay}
                isSelected={selectedStopIndex === idx}
                onClick={() => onStopSelect(idx)}
              />
              {idx < route.stops.length - 1 && stop.distanceToNextKm !== undefined && (
                <div className="itinerary-distance-connector">
                  {Math.round(stop.distanceToNextKm)} km
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
