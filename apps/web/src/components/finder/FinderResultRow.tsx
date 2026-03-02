import { useTranslation } from 'react-i18next';
import type { WeatherScore } from '@weatherchaser/core';

export interface FinderResultData {
  rank: number;
  townName: string;
  townId: string;
  lat: number;
  lng: number;
  score: WeatherScore;
  sunshineHoursPerDay: number;
  tempC: number;
  precipMm: number;
  distanceKm: number;
}

interface FinderResultRowProps {
  data: FinderResultData;
  isSelected: boolean;
  onClick: () => void;
}

function finderMarkerColor(score: number): string {
  if (score >= 70) return 'var(--score-good)';
  if (score >= 40) return 'var(--score-fair)';
  return 'var(--score-poor)';
}

function scoreColor(value: number): string {
  const hue = Math.round((Math.min(Math.max(value, 0), 100) / 100) * 120);
  return `hsl(${hue}, 65%, 45%)`;
}

export function FinderResultRow({ data, isSelected, onClick }: FinderResultRowProps) {
  const { t } = useTranslation('common');
  const { rank, townName, score, sunshineHoursPerDay, tempC, precipMm, distanceKm } = data;
  const bandColor = finderMarkerColor(score.composite);

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        gap: 'var(--space-3)',
        padding: 'var(--space-3) var(--space-4)',
        borderRadius: 'var(--radius-md)',
        border: isSelected ? '2px solid var(--color-accent)' : '2px solid transparent',
        background: isSelected ? 'var(--color-accent-light)' : 'var(--color-bg)',
        cursor: 'pointer',
        alignItems: 'center',
        transition: 'border-color 0.15s',
      }}
    >
      {/* Rank bubble */}
      <div style={{
        flexShrink: 0,
        width: '36px',
        height: '36px',
        borderRadius: 'var(--radius-full)',
        background: bandColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontWeight: 700,
        fontSize: '14px',
      }}>
        {rank}
      </div>

      {/* Town info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 'var(--font-size-base)',
          fontWeight: 600,
          color: 'var(--color-text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {townName}
        </div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          {t('finder.distance_label', '{{km}} km Luftlinie', { km: Math.round(distanceKm) })}
        </div>
      </div>

      {/* Score + metrics */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{
          fontSize: 'var(--font-size-2xl)',
          fontWeight: 700,
          color: scoreColor(score.composite),
          lineHeight: 1,
          marginBottom: '2px',
        }}>
          {Math.round(score.composite)}
        </div>
        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            ☀ {sunshineHoursPerDay.toFixed(1)}h
          </span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            {Math.round(tempC)}°C
          </span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            {precipMm.toFixed(1)}mm
          </span>
        </div>
      </div>
    </div>
  );
}
