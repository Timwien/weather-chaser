import { useTranslation } from 'react-i18next';
import { useFeedbackStore } from '../../stores/feedbackStore.ts';
import { FeedbackForm } from './FeedbackForm.tsx';
import './FeedbackModal.css';

/**
 * Global feedback modal — mounted ONCE in routes/__root.tsx so it can be
 * opened from anywhere (proactive prompt, entry footer, account tab is a
 * separate inline form). UpgradeModal backdrop pattern.
 */
export function FeedbackModal() {
  const { t } = useTranslation('common');
  const { modalOpen, modalSource, closeModal } = useFeedbackStore();

  if (!modalOpen) return null;

  return (
    <div className="feedback-modal-backdrop" onClick={closeModal}>
      <div
        className="feedback-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t('feedback.title')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="feedback-modal-header">
          <h2 className="feedback-modal-title">{t('feedback.title')}</h2>
          <button
            type="button"
            className="feedback-modal-close"
            onClick={closeModal}
            aria-label={t('a11y.close')}
          >
            ×
          </button>
        </div>
        <FeedbackForm
          source={modalSource}
          onSubmitted={() => setTimeout(closeModal, 1500)}
        />
      </div>
    </div>
  );
}
