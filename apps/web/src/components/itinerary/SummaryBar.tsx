import { useTranslation } from 'react-i18next';
import type { Route } from '@weatherchaser/core';

interface SummaryBarProps { route: Route; }

export function SummaryBar({ route }: SummaryBarProps) {
  const { t } = useTranslation('common');
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-around',
      padding: 'var(--space-3) var(--space-4)',
      background: 'var(--color-surface)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--color-border)',
      marginBottom: 'var(--space-4)',
    }}>
      {[
        { label: t('itinerary.total_distance'), value: `${Math.round(route.totalDistanceKm)} km` },
        { label: t('itinerary.stops'), value: String(route.stops.length) },
        { label: t('itinerary.avg_score'), value: String(Math.round(route.avgScore)) },
      ].map(({ label, value }) => (
        <div key={label} style={{ textAlign: 'center' }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--font-size-xl)',
            fontWeight: 700,
            letterSpacing: 'var(--tracking-tight)',
            color: 'var(--color-text)',
          }}>
            {value}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}
