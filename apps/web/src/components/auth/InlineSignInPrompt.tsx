import { useState, useEffect, useRef, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore.ts';
import './InlineSignInPrompt.css';

interface InlineSignInPromptProps {
  onClose: () => void;
}

export function InlineSignInPrompt({ onClose }: InlineSignInPromptProps) {
  const { t } = useTranslation();
  const { user, signInWithGoogle, signInWithApple, signInWithEmail, signUpWithEmail } = useAuthStore();
  const prevUserRef = useRef<typeof user>(null);

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailMode, setEmailMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Close after successful sign-in (user goes from null to truthy)
  useEffect(() => {
    if (prevUserRef.current === null && user !== null) {
      onClose();
    }
    prevUserRef.current = user;
  }, [user, onClose]);

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('account.google_error'));
      setLoading(false);
    }
  };

  const handleApple = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithApple();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('account.apple_error'));
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      if (emailMode === 'signin') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
        setSuccessMsg(t('account.confirm_email_sent'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('account.login_error_fallback'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inline-sign-in">
      {/* Header */}
      <div className="inline-sign-in-header">
        <span className="inline-sign-in-title">
          {t('account.inline_title')}
        </span>
        <button
          type="button"
          className="inline-sign-in-close"
          onClick={onClose}
          aria-label={t('account.close')}
        >
          ×
        </button>
      </div>

      {/* OAuth + Email button row */}
      <div className="inline-sign-in-buttons">
        <button
          type="button"
          className="inline-sign-in-btn inline-sign-in-btn--google"
          onClick={handleGoogle}
          disabled={loading}
          title={t('account.google_btn')}
        >
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M17.64 9.2a10.34 10.34 0 0 0-.164-1.84H9v3.48h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908C16.658 14.252 17.64 11.945 17.64 9.2z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A9.002 9.002 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A9.002 9.002 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A9.002 9.002 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Google
        </button>

        <button
          type="button"
          className="inline-sign-in-btn inline-sign-in-btn--apple"
          onClick={handleApple}
          disabled={loading}
          title={t('account.apple_btn')}
        >
          <svg width="13" height="16" viewBox="0 0 16 18" fill="currentColor" aria-hidden="true">
            <path d="M13.047 9.617c-.02-2.042 1.66-3.026 1.736-3.075-0.943-1.38-2.413-1.569-2.934-1.59-1.253-.127-2.45.74-3.083.74-.638 0-1.618-.724-2.663-.703-1.367.02-2.63.797-3.334 2.018-1.422 2.467-.364 6.126 1.02 8.13.677.979 1.483 2.076 2.541 2.036 1.019-.042 1.4-.658 2.63-.658 1.233 0 1.573.658 2.651.636 1.097-.018 1.787-.994 2.456-1.978.779-1.133 1.098-2.234 1.115-2.29-.024-.01-2.134-.82-2.155-3.266zM10.98 3.32C11.538 2.636 11.919 1.68 11.806.703c-.825.043-1.83.553-2.41 1.22-.528.605-.99 1.587-.866 2.52.916.072 1.855-.468 2.45-1.123z"/>
          </svg>
          Apple
        </button>

        <button
          type="button"
          className={`inline-sign-in-btn inline-sign-in-btn--email${showEmailForm ? ' inline-sign-in-btn--active' : ''}`}
          onClick={() => setShowEmailForm(!showEmailForm)}
          disabled={loading}
          title={t('account.inline_email_btn')}
        >
          <svg width="15" height="12" viewBox="0 0 15 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="1" y="1" width="13" height="10" rx="1.5"/>
            <path d="m1 1 6.5 5.5L14 1"/>
          </svg>
          {t('account.inline_email_btn')}
        </button>
      </div>

      {/* Inline email form — shown when E-Mail button clicked */}
      {showEmailForm && (
        <form className="inline-sign-in-form" onSubmit={handleEmailSubmit}>
          <input
            className="inline-sign-in-input"
            type="email"
            placeholder={t('account.email_placeholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            autoComplete="email"
          />
          <input
            className="inline-sign-in-input"
            type="password"
            placeholder={t('account.password_placeholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            autoComplete={emailMode === 'signin' ? 'current-password' : 'new-password'}
          />
          <div className="inline-sign-in-form-row">
            <button
              type="submit"
              className="inline-sign-in-submit"
              disabled={loading}
            >
              {loading ? (
                <span className="inline-sign-in-spinner" />
              ) : emailMode === 'signin' ? (
                t('account.signin')
              ) : (
                t('account.signup')
              )}
            </button>
            <button
              type="button"
              className="inline-sign-in-mode-toggle"
              onClick={() => {
                setEmailMode(emailMode === 'signin' ? 'signup' : 'signin');
                setError(null);
                setSuccessMsg(null);
              }}
            >
              {emailMode === 'signin' ? t('account.signup') : t('account.signin')}
            </button>
          </div>
        </form>
      )}

      {error && <p className="inline-sign-in-error">{error}</p>}
      {successMsg && <p className="inline-sign-in-success">{successMsg}</p>}
    </div>
  );
}
