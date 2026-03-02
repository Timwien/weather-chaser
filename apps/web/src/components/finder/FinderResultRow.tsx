import { useTranslation } from 'react-i18next';
import type { WeatherScore } from '@weatherchaser/core';
import { SunIcon, TempIcon, RainIcon, WindIcon } from './FinderIcons.tsx';
import './FinderResultRow.css';

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
      className={`finder-result-row${isSelected ? ' finder-result-row--selected' : ''}`}
    >
      {/* Rank bubble — continuous gradient background */}
      <div
        className="finder-result-rank"
        style={{ background: scoreColor(score.composite) }}
      >
        {rank}
      </div>

      {/* Town name + KPI meta row */}
      <div className="finder-result-body">
        <div className="finder-result-name">{townName}</div>
        <div className="finder-result-meta">
          <span className="finder-result-dist">
            {t('finder.distance_label', '{{km}} km', { km: Math.round(distanceKm) })}
          </span>
          <span className="finder-result-sep">·</span>
          <span className="finder-result-kpis">
            <span className="finder-result-kpi" aria-label={t('finder.kpi.sun', 'Sonne')}>
              <SunIcon size={11} /> {sunshineHoursPerDay.toFixed(1)}h
            </span>
            <span className="finder-result-kpi" aria-label={t('finder.kpi.temp', 'Temperatur')}>
              <TempIcon size={11} /> {Math.round(tempC)}°
            </span>
            <span className="finder-result-kpi" aria-label={t('finder.kpi.precip', 'Niederschlag')}>
              <RainIcon size={11} /> {precipMm.toFixed(1)}mm
            </span>
            <span className="finder-result-kpi" aria-label={t('finder.kpi.wind', 'Wind')}>
              <WindIcon size={11} /> {Math.round(windAvgKmh)}km/h
            </span>
          </span>
        </div>
      </div>

      {/* Score number — right side, colored by score */}
      <div
        className="finder-result-score"
        style={{ color: scoreColor(score.composite) }}
      >
        {Math.round(score.composite)}
      </div>
    </div>
  );
}
