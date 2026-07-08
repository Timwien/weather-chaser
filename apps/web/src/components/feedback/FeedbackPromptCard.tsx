import { useTranslation } from 'react-i18next';
import { useFeedbackStore } from '../../stores/feedbackStore.ts';
import './FeedbackPromptCard.css';

/**
 * Proactive one-time feedback nudge — appears in the results panels after the
 * user's 2nd successful search (see feedbackStore.recordSearchSuccess).
 * Rendered in ItineraryPanel AND WeatherFinderPanel so it shows inside the
 * mobile bottom sheet as well as the desktop overlay.
 */
export function FeedbackPromptCard() {
  const { t } = useTranslation('common');
  const { promptVisible, dismissPrompt, openModal } = useFeedbackStore();

  if (!promptVisible) return null;

  return (
    <div className="feedback-prompt-card" role="status">
      <span className="feedback-prompt-text">{t('feedback.prompt_title')}</span>
      <button
        type="button"
        className="feedback-prompt-cta"
        onClick={() => openModal('prompt')}
      >
        {t('feedback.prompt_cta')}
      </button>
      <button
        type="button"
        className="feedback-prompt-dismiss"
        onClick={dismissPrompt}
        aria-label={t('a11y.close')}
      >
        ×
      </button>
    </div>
  );
}
