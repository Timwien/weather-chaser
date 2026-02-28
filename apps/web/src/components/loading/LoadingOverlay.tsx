import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore.ts';
import './LoadingOverlay.css';

const STEPS = ['finding_towns', 'fetching_weather', 'optimizing_route'] as const;

export function LoadingOverlay() {
  const { t } = useTranslation('common');
  const { mode, loadingStep } = useAppStore();

  if (mode !== 'loading') return null;

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
      </div>
    </div>
  );
}
