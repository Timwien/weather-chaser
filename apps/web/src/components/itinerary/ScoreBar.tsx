import { useTranslation } from 'react-i18next';
import type { WeatherScore } from '@weatherchaser/core';

interface ScoreBarProps { score: WeatherScore; }

function scoreToHue(value: number): number {
  // 0 → hue 0 (red), 100 → hue 120 (green)
  return Math.round((Math.min(Math.max(value, 0), 100) / 100) * 120);
}

function scoreColor(value: number): string {
  return `hsl(${scoreToHue(value)}, 65%, 45%)`;
}

export function ScoreBar({ score }: ScoreBarProps) {
  const { t } = useTranslation('common');
  const { composite, breakdown } = score;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {/* Gradient bar */}
      <div style={{
        height: '6px',
        borderRadius: 'var(--radius-full)',
        background: `linear-gradient(to right, ${scoreColor(composite * 0.3)}, ${scoreColor(composite)})`,
        width: '100%',
      }} />
      {/* Composite score label */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          {t('itinerary.score')}
        </span>
        <span style={{
          fontSize: 'var(--font-size-sm)',
          fontWeight: 600,
          color: scoreColor(composite),
        }}>
          {Math.round(composite)}
        </span>
      </div>
      {/* Per-dimension breakdown row */}
      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        {([
          ['sunshine', breakdown.sunshine, '\u2600'],
          ['precipitation', breakdown.precipitation, '~'],
          ['temperature', breakdown.temperature, '\u00b0'],
          ['wind', breakdown.wind, '\u2248'],
        ] as const).map(([key, val, icon]) => (
          <div key={key} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-muted)',
          }}>
            <span style={{ color: scoreColor(val) }}>{icon}</span>
            <span>{Math.round(val)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
