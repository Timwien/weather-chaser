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
  windAvgKmh: number;
  distanceKm: number;
}

interface FinderResultRowProps {
  data: FinderResultData;
  isSelected: boolean;
  onClick: () => void;
}

/** Continuous hsl gradient: 0 (red) → 120 (green), matching StopMarkers and FinderMarkers */
function scoreColor(score: number): string {
  const hue = Math.round((Math.min(Math.max(score, 0), 100) / 100) * 120);
  return `hsl(${hue}, 65%, 45%)`;
}

export function FinderResultRow({ data, isSelected, onClick }: FinderResultRowProps) {
  const { t } = useTranslation('common');
  const { rank, townName, score, sunshineHoursPerDay, tempC, precipMm, windAvgKmh, distanceKm } = data;

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
      {/* Rank bubble — continuous gradient */}
      <div style={{
        flexShrink: 0,
        width: '36px',
        height: '36px',
        borderRadius: 'var(--radius-full)',
        background: scoreColor(score.composite),
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

      {/* Score + KPI chips */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{
          fontSize: 'var(--font-size-2xl)',
          fontWeight: 700,
          color: scoreColor(score.composite),
          lineHeight: 1,
          marginBottom: '4px',
        }}>
          {Math.round(score.composite)}
        </div>
        {/* 4 KPI chips: sun, temp, precip, wind */}
        <div style={{
          display: 'flex',
          gap: '3px',
          justifyContent: 'flex-end',
          flexWrap: 'wrap',
          maxWidth: '120px',
        }}>
          <span
            style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}
            aria-label={t('finder.kpi.sun', 'Sonne')}
          >
            ☀ {sunshineHoursPerDay.toFixed(1)}h
          </span>
          <span
            style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}
            aria-label={t('finder.kpi.temp', 'Temperatur')}
          >
            🌡 {Math.round(tempC)}°C
          </span>
          <span
            style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}
            aria-label={t('finder.kpi.precip', 'Niederschlag')}
          >
            💧 {precipMm.toFixed(1)}mm
          </span>
          <span
            style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}
            aria-label={t('finder.kpi.wind', 'Wind')}
          >
            💨 {Math.round(windAvgKmh)}km/h
          </span>
        </div>
      </div>
    </div>
  );
}
