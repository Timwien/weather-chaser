import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useFeedbackStore } from '../../stores/feedbackStore.ts';
import { capture } from '../../lib/analytics.ts';
import { FeedbackForm } from './FeedbackForm.tsx';
import './FeedbackModal.css';

/**
 * Global feedback modal — mounted ONCE in routes/__root.tsx so it can be
 * opened from anywhere. Opens proactively (source 'prompt') once after the
 * 2nd successful search, and on demand from the entry footer.
 */
export function FeedbackModal() {
  const { t } = useTranslation('common');
  const { modalOpen, modalSource, closeModal } = useFeedbackStore();
  const submittedRef = useRef(false);

  if (!modalOpen) return null;

  function handleClose() {
    // Closing the proactive popup without submitting counts as a dismissal.
    if (modalSource === 'prompt' && !submittedRef.current) {
      capture('feedback_prompt_dismissed');
    }
    submittedRef.current = false;
    closeModal();
  }

  return (
    <div className="feedback-modal-backdrop" onClick={handleClose}>
      <div
        className="feedback-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t('feedback.title')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="feedback-modal-header">
          <h2 className="feedback-modal-title">
            {modalSource === 'prompt' ? t('feedback.prompt_title') : t('feedback.title')}
          </h2>
          <button
            type="button"
            className="feedback-modal-close"
            onClick={handleClose}
            aria-label={t('a11y.close')}
          >
            ×
          </button>
        </div>
        <FeedbackForm
          source={modalSource}
          onSubmitted={() => {
            submittedRef.current = true;
            setTimeout(() => {
              submittedRef.current = false;
              closeModal();
            }, 1500);
          }}
        />
      </div>
    </div>
  );
}
