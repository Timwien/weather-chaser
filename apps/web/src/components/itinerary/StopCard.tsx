import { useTranslation } from 'react-i18next';
import type { Stop } from '@weatherchaser/core';
import { ScoreBar } from './ScoreBar.tsx';

interface StopCardProps {
  stop: Stop;
  stopNumber: number;
  isSelected: boolean;
  onClick: () => void;
}

function scoreColor(value: number): string {
  const hue = Math.round((Math.min(Math.max(value, 0), 100) / 100) * 120);
  return `hsl(${hue}, 65%, 45%)`;
}

export function StopCard({ stop, stopNumber, isSelected, onClick }: StopCardProps) {
  const { t } = useTranslation('common');
  const { town, arrivalDate, nights, score, weatherAvg } = stop;

  // Format arrival date as "Mon 10 Jul"
  const dateStr = arrivalDate.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  });

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        gap: 'var(--space-4)',
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius-md)',
        border: isSelected ? `2px solid var(--color-accent)` : '2px solid transparent',
        background: isSelected ? 'var(--color-accent-light)' : 'var(--color-bg)',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
    >
      {/* Day bubble */}
      <div style={{
        flexShrink: 0,
        width: '40px',
        height: '40px',
        borderRadius: 'var(--radius-full)',
        background: scoreColor(score.composite),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        lineHeight: 1,
        gap: '1px',
      }}>
        <span style={{ fontSize: '8px', fontWeight: 400, opacity: 0.9, letterSpacing: '0.02em' }}>
          {t('itinerary.day_label', { count: stopNumber })}
        </span>
        <span style={{ fontSize: '15px', fontWeight: 700 }}>{stopNumber}</span>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 'var(--font-size-lg)',
          fontWeight: 600,
          color: 'var(--color-text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {town.name}
        </div>
        <div style={{
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-muted)',
          marginBottom: 'var(--space-2)',
        }}>
          {dateStr} &middot; {nights} {t('itinerary.nights')}
        </div>
        <ScoreBar score={score} weatherAvg={weatherAvg} />
      </div>
    </div>
  );
}
