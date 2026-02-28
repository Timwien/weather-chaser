import { useTranslation } from 'react-i18next';

interface ErrorMessageProps { error: string; }

export function ErrorMessage({ error }: ErrorMessageProps) {
  const { t } = useTranslation('common');
  const messageKey = error === 'no_towns' ? 'errors.no_towns' : 'errors.weather_unavailable';
  const hintKey = error === 'no_towns' ? 'errors.no_towns_hint' : null;
  return (
    <div style={{
      padding: 'var(--space-6)',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-3)',
    }}>
      <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--color-text)' }}>
        {t(messageKey)}
      </div>
      {hintKey && (
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
          {t(hintKey)}
        </div>
      )}
    </div>
  );
}
