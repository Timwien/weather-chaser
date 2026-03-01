import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore.ts';
import { SummaryBar } from './SummaryBar.tsx';
import { StopCard } from './StopCard.tsx';
import { ShareBar } from '../share/ShareBar.tsx';
import { ErrorMessage } from '../common/ErrorMessage.tsx';
import './ItineraryPanel.css';

interface ItineraryPanelProps {
  selectedStopIndex: number | null;
  onStopSelect: (index: number) => void;
}

function BackArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <polyline points="9,2 4,7 9,12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function ItineraryPanel({ selectedStopIndex, onStopSelect }: ItineraryPanelProps) {
  const { t } = useTranslation('common');
  const { route, error, mode, reset } = useAppStore();
  const stopRefs = useRef<Array<HTMLDivElement | null>>([]);

  // Scroll to the selected stop when selectedStopIndex changes
  if (selectedStopIndex !== null && stopRefs.current[selectedStopIndex]) {
    stopRefs.current[selectedStopIndex]!.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  if (mode === 'idle' || mode === 'route-config') return null;

  if (error) {
    return (
      <div className="itinerary-panel">
        <button className="itinerary-back-btn" onClick={reset}>
          <BackArrowIcon /> {t('itinerary.back')}
        </button>
        <ErrorMessage error={error} />
      </div>
    );
  }

  if (!route) return null;

  let cumulativeDay = 1;

  return (
    <div className="itinerary-panel">
      {/* Header row: back button + title */}
      <div className="itinerary-header">
        <button className="itinerary-back-btn" onClick={reset}>
          <BackArrowIcon /> {t('itinerary.back')}
        </button>
        <h2 className="itinerary-title">{t('itinerary.title')}</h2>
      </div>

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

      <ShareBar />
    </div>
  );
}
