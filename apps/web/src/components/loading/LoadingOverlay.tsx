import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore.ts';
import './LoadingOverlay.css';

const STEPS = ['finding_towns', 'fetching_weather', 'optimizing_route'] as const;

// F1: after this long a load is almost certainly wedged — offer a way out.
const STUCK_AFTER_MS = 30_000;

export function LoadingOverlay() {
  const { t } = useTranslation('common');
  const { mode, loadingStep } = useAppStore();
  const [tookTooLong, setTookTooLong] = useState(false);

  const isLoading = mode === 'loading';

  // Reset + arm the "taking too long" timer whenever a load starts.
  useEffect(() => {
    if (!isLoading) {
      setTookTooLong(false);
      return;
    }
    const id = window.setTimeout(() => setTookTooLong(true), STUCK_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [isLoading]);

  if (!isLoading) return null;

  const currentIdx = STEPS.indexOf(loadingStep ?? 'finding_towns');

  return (
    <div className="loading-overlay">
      <div className="loading-card">
        <div className="loading-spinner" aria-hidden="true" />
        <div className="loading-steps">
          {STEPS.map((step, stepIdx) => {
            const isDone = stepIdx < currentIdx;
            const isCurrent = step === loadingStep;
            return (
              <div
                key={step}
                className={`loading-step${isDone ? ' done' : ''}${isCurrent ? ' current' : ''}`}
              >
                <span className="loading-step-indicator" aria-hidden="true">
                  {isDone ? '✓' : isCurrent ? '›' : '·'}
                </span>
                <span>{t(`loading.${step}`)}</span>
              </div>
            );
          })}
        </div>

        {tookTooLong && (
          <div className="loading-stuck" role="status">
            <span className="loading-stuck-text">{t('loading.taking_long')}</span>
            <button
              type="button"
              className="loading-stuck-btn"
              onClick={() => window.location.reload()}
            >
              {t('common.reload')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
