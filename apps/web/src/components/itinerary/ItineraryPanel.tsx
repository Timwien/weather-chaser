import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore.ts';
import { ShareBar } from '../share/ShareBar.tsx';
import './ItineraryPanel.css';

interface ItineraryPanelProps {
  selectedStopIndex: number | null;
  onStopSelect: (index: number | null) => void;
}

export function ItineraryPanel({ selectedStopIndex, onStopSelect }: ItineraryPanelProps) {
  const { t } = useTranslation('common');
  const { route, mode } = useAppStore();

  if (mode !== 'results' || !route) return null;

  return (
    <div className="itinerary-panel">
      <div className="itinerary-header">
        <h2 className="itinerary-title">{t('itinerary.title')}</h2>
        <div className="itinerary-summary">
          <span>{route.stops.length} {t('itinerary.stops')}</span>
          <span>{route.totalDistanceKm} km</span>
          <span>{t('itinerary.avg_score')}: {Math.round(route.avgScore)}</span>
        </div>
      </div>

      <div className="itinerary-stops">
        {route.stops.map((stop, index) => (
          <div
            key={`${stop.town.id}-${index}`}
            className={`itinerary-stop ${selectedStopIndex === index ? 'itinerary-stop--selected' : ''}`}
            onClick={() => onStopSelect(selectedStopIndex === index ? null : index)}
          >
            <div className="stop-index">{index + 1}</div>
            <div className="stop-info">
              <div className="stop-name">{stop.town.name}</div>
              <div className="stop-meta">
                <span>{stop.nights} {t('itinerary.nights')}</span>
                {stop.distanceToNextKm !== undefined && index < route.stops.length - 1 && (
                  <span>{Math.round(stop.distanceToNextKm)} km</span>
                )}
              </div>
            </div>
            <div className="stop-score">{Math.round(stop.score.composite)}</div>
          </div>
        ))}
      </div>

      <ShareBar />
    </div>
  );
}
