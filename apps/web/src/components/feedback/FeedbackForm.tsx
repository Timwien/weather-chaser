import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { submitFeedback } from '../../services/feedback.ts';
import type { FeedbackSource } from '../../stores/feedbackStore.ts';
import './FeedbackForm.css';

const RATINGS = [
  { value: 1, emoji: '😞' },
  { value: 2, emoji: '😕' },
  { value: 3, emoji: '😐' },
  { value: 4, emoji: '🙂' },
  { value: 5, emoji: '😍' },
] as const;

interface FeedbackFormProps {
  source: FeedbackSource;
  /** Called after a successful submit (e.g. modal auto-close). */
  onSubmitted?: () => void;
}

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

/**
 * Shared feedback form (modal + account tab): 5-step emoji rating +
 * optional message. Status feedback uses the app's inline-text idiom
 * (no toast primitive exists).
 */
export function FeedbackForm({ source, onSubmitted }: FeedbackFormProps) {
  const { t } = useTranslation('common');
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [state, setState] = useState<SubmitState>('idle');
  const [showRatingHint, setShowRatingHint] = useState(false);

  async function handleSubmit() {
    if (rating === null) {
      setShowRatingHint(true);
      return;
    }
    setState('submitting');
    const ok = await submitFeedback(rating, message, source);
    if (ok) {
      setState('success');
      onSubmitted?.();
    } else {
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  }

  if (state === 'success') {
    return (
      <div className="feedback-form">
        <p className="feedback-success" role="status">{t('feedback.success')}</p>
      </div>
    );
  }

  return (
    <div className="feedback-form">
      <span className="input-label" id={`feedback-rating-label-${source}`}>
        {t('feedback.rating_label')}
      </span>
      <div
        className="feedback-rating-row"
        role="radiogroup"
        aria-labelledby={`feedback-rating-label-${source}`}
      >
        {RATINGS.map(({ value, emoji }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={rating === value}
            aria-label={t(`feedback.rating_${value}`)}
            className={`feedback-rating-btn${rating === value ? ' feedback-rating-btn--active' : ''}`}
            onClick={() => { setRating(value); setShowRatingHint(false); }}
          >
            <span aria-hidden="true">{emoji}</span>
          </button>
        ))}
      </div>
      {showRatingHint && rating === null && (
        <p className="feedback-hint" role="status">{t('feedback.rating_required')}</p>
      )}

      <label className="input-label" htmlFor={`feedback-message-${source}`}>
        {t('feedback.message_label')}
      </label>
      <textarea
        id={`feedback-message-${source}`}
        className="feedback-textarea"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={t('feedback.message_placeholder')}
        maxLength={2000}
        rows={4}
      />

      {state === 'error' && (
        <p className="feedback-hint feedback-hint--error" role="alert">{t('feedback.error')}</p>
      )}

      <button
        type="button"
        className="cta-btn cta-btn--primary feedback-submit"
        onClick={handleSubmit}
        disabled={state === 'submitting'}
      >
        {state === 'submitting' ? t('feedback.submitting') : t('feedback.submit')}
      </button>
    </div>
  );
}
