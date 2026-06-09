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
  isFavorited?: boolean;
  onFavoriteToggle?: () => void;
  isGuest?: boolean;
}

/** Continuous hsl gradient: 0 (red) → 120 (green), matching StopMarkers and FinderMarkers */
function scoreColor(score: number): string {
  const hue = Math.round((Math.min(Math.max(score, 0), 100) / 100) * 120);
  return `hsl(${hue}, 65%, 45%)`;
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill={filled ? 'var(--color-primary)' : 'none'}
      stroke={filled ? 'var(--color-primary)' : 'currentColor'}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 13.7s-6-3.9-6-8a4 4 0 0 1 6-3.46A4 4 0 0 1 14 5.7c0 4.1-6 8-6 8z"/>
    </svg>
  );
}

export function FinderResultRow({ data, isSelected, onClick, isFavorited = false, onFavoriteToggle, isGuest = false }: FinderResultRowProps) {
  const { t } = useTranslation('common');
  const { rank, townName, score, sunshineHoursPerDay, tempC, precipMm, windAvgKmh, distanceKm } = data;

  function handleHeartClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (onFavoriteToggle) {
      onFavoriteToggle();
    }
  }

  return (
    <div
      onClick={onClick}
      className={`finder-result-row wc-fade-up${isSelected ? ' finder-result-row--selected' : ''}`}
      style={{ animationDelay: `${Math.min(rank - 1, 10) * 40}ms` }}
    >
      {/* Rank bubble — continuous gradient background; top-3 get a podium halo */}
      <div
        className={`finder-result-rank${rank <= 3 ? ' finder-result-rank--podium' : ''}`}
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

      {/* Heart / favorite button */}
      <button
        type="button"
        className={`finder-result-heart${isGuest ? ' finder-result-heart--guest' : ''}`}
        onClick={handleHeartClick}
        aria-label={isFavorited ? t('favorites.remove') : t('favorites.add')}
        title={isGuest ? t('favorites.sign_in') : undefined}
      >
        <HeartIcon filled={isFavorited} />
      </button>
    </div>
  );
}
