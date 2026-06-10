import { useTranslation } from 'react-i18next';
import type { Stop } from '@weatherchaser/core';
import { ScoreBar } from './ScoreBar.tsx';
import './StopCard.css';

interface StopCardProps {
  stop: Stop;
  stopNumber: number;
  isSelected: boolean;
  onClick: () => void;
  /** Position in the list — drives the entrance animation stagger */
  index?: number;
}

function scoreColor(value: number): string {
  const hue = Math.round((Math.min(Math.max(value, 0), 100) / 100) * 120);
  return `hsl(${hue}, 65%, 45%)`;
}

/** Circular progress ring: composite 0–100 mapped to stroke sweep. */
function ScoreRing({ value }: { value: number }) {
  const r = 20;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.min(Math.max(value, 0), 100);
  const color = scoreColor(clamped);
  return (
    <div className="stop-card-score-ring">
      <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
        <circle className="stop-card-score-track" cx="24" cy="24" r={r} fill="none" strokeWidth="4" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * circumference} ${circumference}`}
        />
      </svg>
      <span className="stop-card-score-value" style={{ color }}>
        {Math.round(clamped)}
      </span>
    </div>
  );
}

export function StopCard({ stop, stopNumber, isSelected, onClick, index = 0 }: StopCardProps) {
  const { t, i18n } = useTranslation('common');
  const { town, arrivalDate, nights, score, weatherAvg } = stop;

  // Locale-aware arrival date, e.g. "Mon 10 Jul" / "Mo., 10. Juli"
  const locale = i18n.language.startsWith('de') ? 'de-DE' : 'en-GB';
  const dateStr = arrivalDate.toLocaleDateString(locale, {
    weekday: 'short', day: 'numeric', month: 'short',
  });

  return (
    <div
      onClick={onClick}
      className={`stop-card wc-fade-up${isSelected ? ' stop-card--selected' : ''}`}
      style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}
    >
      <div className="stop-card-day">
        <span className="stop-card-day-label">
          {t('itinerary.day_label', { count: stopNumber })}
        </span>
        <span className="stop-card-day-number">{stopNumber}</span>
      </div>

      <div className="stop-card-body">
        <div className="stop-card-town">{town.name}</div>
        <div className="stop-card-date">
          {dateStr} &middot; {t('itinerary.nights_count', { count: nights })}
        </div>
        <ScoreBar score={score} weatherAvg={weatherAvg} showComposite={false} />
      </div>

      <div className="stop-card-score">
        <ScoreRing value={score.composite} />
        <span className="stop-card-score-label">{t('itinerary.score')}</span>
      </div>
    </div>
  );
}
