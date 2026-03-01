import { useTranslation } from 'react-i18next';
import type { WeatherScore, StopWeatherAvg } from '@weatherchaser/core';

interface ScoreBarProps {
  score: WeatherScore;
  weatherAvg?: StopWeatherAvg;
}

function scoreColor(value: number): string {
  const hue = Math.round((Math.min(Math.max(value, 0), 100) / 100) * 120);
  return `hsl(${hue}, 65%, 45%)`;
}

// ── Inline SVG icons ────────────────────────────────────────────────────────

function SunIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 12 12" fill="none"
      stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
      <circle cx="6" cy="6" r="2.2"/>
      <line x1="6" y1="0.5" x2="6" y2="2"/>
      <line x1="6" y1="10" x2="6" y2="11.5"/>
      <line x1="0.5" y1="6" x2="2" y2="6"/>
      <line x1="10" y1="6" x2="11.5" y2="6"/>
      <line x1="1.9" y1="1.9" x2="3" y2="3"/>
      <line x1="9" y1="9" x2="10.1" y2="10.1"/>
      <line x1="10.1" y1="1.9" x2="9" y2="3"/>
      <line x1="3" y1="9" x2="1.9" y2="10.1"/>
    </svg>
  );
}

function ThermometerIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 12 12" fill="none"
      stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
      <path d="M7 7.2V2.5a1 1 0 0 0-2 0v4.7A2 2 0 1 0 7 7.2z"/>
      <line x1="7" y1="4" x2="8.5" y2="4"/>
      <line x1="7" y1="5.5" x2="8" y2="5.5"/>
    </svg>
  );
}

function RainIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 12 12" fill="none"
      stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
      <path d="M9.5 5.5A2 2 0 0 0 7.8 3.5 3 3 0 0 0 2 5.5 1.5 1.5 0 0 0 3 8.5h6A1.5 1.5 0 0 0 9.5 5.5z"/>
      <line x1="3.5" y1="9.5" x2="3" y2="11"/>
      <line x1="6" y1="9.5" x2="5.5" y2="11"/>
      <line x1="8.5" y1="9.5" x2="8" y2="11"/>
    </svg>
  );
}

function WindIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 12 12" fill="none"
      stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
      <path d="M1 3.5h7c.9 0 1.5-.6 1.5-1.5S8.9.5 8 .5"/>
      <line x1="1" y1="6" x2="9.5" y2="6"/>
      <path d="M1 8.5h5c.9 0 1.5.6 1.5 1.5s-.6 1.5-1.5 1.5"/>
    </svg>
  );
}

// ── Metric chip — colored by its dimension score ────────────────────────────

interface MetricProps {
  icon: React.ReactNode;
  label: string;
  dimScore: number; // 0–100 score for this dimension
}

function Metric({ icon, label, dimScore }: MetricProps) {
  const color = scoreColor(dimScore);
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '3px',
      fontSize: 'var(--font-size-xs)',
      color,
      background: `${color}1a`, // ~10% opacity tint
      borderRadius: 'var(--radius-sm)',
      padding: '2px 6px',
    }}>
      {icon}
      <span>{label}</span>
    </div>
  );
}

// ── ScoreBar ────────────────────────────────────────────────────────────────

export function ScoreBar({ score, weatherAvg }: ScoreBarProps) {
  const { t } = useTranslation('common');
  const { composite, breakdown } = score;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {/* Composite score — big, colored, no gradient bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-2)' }}>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          {t('itinerary.score')}
        </span>
        <span style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, lineHeight: 1, color: scoreColor(composite) }}>
          {Math.round(composite)}
        </span>
      </div>

      {/* Weather dimension metrics — each colored by its score */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        {weatherAvg ? (
          <>
            <Metric icon={<SunIcon />}        label={`${weatherAvg.sunshineHoursPerDay.toFixed(1)} h`} dimScore={breakdown.sunshine} />
            <Metric icon={<ThermometerIcon />} label={`${Math.round(weatherAvg.tempMaxC)}°C`}           dimScore={breakdown.temperature} />
            <Metric icon={<RainIcon />}        label={`${weatherAvg.precipitationMmPerDay.toFixed(1)} mm`} dimScore={breakdown.precipitation} />
            <Metric icon={<WindIcon />}        label={`${Math.round(weatherAvg.windKmh)} km/h`}          dimScore={breakdown.wind} />
          </>
        ) : (
          // Fallback: show scores if no raw weather data
          <>
            <Metric icon={<SunIcon />}        label={String(Math.round(breakdown.sunshine))}      dimScore={breakdown.sunshine} />
            <Metric icon={<ThermometerIcon />} label={String(Math.round(breakdown.temperature))}   dimScore={breakdown.temperature} />
            <Metric icon={<RainIcon />}        label={String(Math.round(breakdown.precipitation))} dimScore={breakdown.precipitation} />
            <Metric icon={<WindIcon />}        label={String(Math.round(breakdown.wind))}          dimScore={breakdown.wind} />
          </>
        )}
      </div>
    </div>
  );
}
