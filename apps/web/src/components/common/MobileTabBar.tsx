import { useTranslation } from 'react-i18next';

interface MobileTabBarProps {
  activeView: 'itinerary' | 'map';
  onSwitch: (view: 'itinerary' | 'map') => void;
  panelLabel?: string;
}

export function MobileTabBar({ activeView, onSwitch, panelLabel }: MobileTabBarProps) {
  const { t } = useTranslation('common');
  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '48px',
        background: 'var(--color-bg)',
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        zIndex: 30,
      }}
    >
      <button
        onClick={() => onSwitch('itinerary')}
        style={{
          flex: 1,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 'var(--font-size-sm)',
          fontWeight: activeView === 'itinerary' ? 700 : 400,
          color: activeView === 'itinerary' ? 'var(--color-accent)' : 'var(--color-text-muted)',
          borderTop: activeView === 'itinerary' ? '2px solid var(--color-accent)' : '2px solid transparent',
        }}
      >
        {panelLabel ?? t('nav.itinerary', 'Itinerary')}
      </button>
      <button
        onClick={() => onSwitch('map')}
        style={{
          flex: 1,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 'var(--font-size-sm)',
          fontWeight: activeView === 'map' ? 700 : 400,
          color: activeView === 'map' ? 'var(--color-accent)' : 'var(--color-text-muted)',
          borderTop: activeView === 'map' ? '2px solid var(--color-accent)' : '2px solid transparent',
        }}
      >
        {t('nav.map', 'Map')}
      </button>
    </nav>
  );
}
