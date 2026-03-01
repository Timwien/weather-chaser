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
      {/* tube + bulb */}
      <path d="M7 7.2V2.5a1 1 0 0 0-2 0v4.7A2 2 0 1 0 7 7.2z"/>
      {/* tick marks */}
      <line x1="7" y1="4" x2="8.5" y2="4"/>
      <line x1="7" y1="5.5" x2="8" y2="5.5"/>
    </svg>
  );
}

function RainIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 12 12" fill="none"
      stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
      {/* cloud */}
      <path d="M9.5 5.5A2 2 0 0 0 7.8 3.5 3 3 0 0 0 2 5.5 1.5 1.5 0 0 0 3 8.5h6A1.5 1.5 0 0 0 9.5 5.5z"/>
      {/* drops */}
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

// ── Metric chip ─────────────────────────────────────────────────────────────

interface MetricProps {
  icon: React.ReactNode;
  label: string;
}

function Metric({ icon, label }: MetricProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '3px',
      fontSize: 'var(--font-size-xs)',
      color: 'var(--color-text-secondary)',
    }}>
      {icon}
      <span>{label}</span>
    </div>
  );
}

// ── ScoreBar ────────────────────────────────────────────────────────────────

export function ScoreBar({ score, weatherAvg }: ScoreBarProps) {
  const { t } = useTranslation('common');
  const { composite } = score;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {/* Composite score — plain colored number, no gradient bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          {t('itinerary.score')}
        </span>
        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: scoreColor(composite) }}>
          {Math.round(composite)}
        </span>
      </div>

      {/* Weather dimension metrics with real values + units */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        {weatherAvg ? (
          <>
            <Metric icon={<SunIcon />}         label={`${weatherAvg.sunshineHoursPerDay.toFixed(1)} h`} />
            <Metric icon={<ThermometerIcon />}  label={`${Math.round(weatherAvg.tempMaxC)}°C`} />
            <Metric icon={<RainIcon />}         label={`${weatherAvg.precipitationMmPerDay.toFixed(1)} mm`} />
            <Metric icon={<WindIcon />}         label={`${Math.round(weatherAvg.windKmh)} km/h`} />
          </>
        ) : (
          // Fallback: score breakdown with icons (no raw weather data yet)
          <>
            <Metric icon={<SunIcon />}         label={String(Math.round(score.breakdown.sunshine))} />
            <Metric icon={<ThermometerIcon />}  label={String(Math.round(score.breakdown.temperature))} />
            <Metric icon={<RainIcon />}         label={String(Math.round(score.breakdown.precipitation))} />
            <Metric icon={<WindIcon />}         label={String(Math.round(score.breakdown.wind))} />
          </>
        )}
      </div>
    </div>
  );
}
