import { Component, type ErrorInfo, type ReactNode } from 'react';
import i18n from '../../i18n/index.ts';
import { logError } from '../../lib/logger.ts';
import './AppErrorBoundary.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * F1: Global render crash guard. In the installed PWA there is no browser reload
 * chrome, so an unhandled render error would otherwise leave a dead/white screen
 * with no way out. This catches such crashes and offers an explicit reload.
 *
 * Class component (React error boundaries must be classes) → cannot use the
 * useTranslation hook, so it reads from the i18n singleton directly.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Console + PostHog error tracking; non-fatal beyond logging.
    logError('react_boundary', error, { componentStack: info.componentStack });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const t = i18n.t.bind(i18n);
    return (
      <div className="app-error-boundary" role="alert">
        <div className="app-error-boundary-card">
          <h1 className="app-error-boundary-title">{t('errors.boundary_title')}</h1>
          <p className="app-error-boundary-text">{t('errors.boundary_text')}</p>
          <button
            type="button"
            className="app-error-boundary-btn"
            onClick={() => window.location.reload()}
          >
            {t('common.reload')}
          </button>
        </div>
      </div>
    );
  }
}
