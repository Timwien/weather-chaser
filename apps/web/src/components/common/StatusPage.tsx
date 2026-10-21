import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.ts';
import './StatusPage.css';

interface StatusPageProps {
  titleKey: string;
  textKey: string;
}

/** Full-screen notice (404, invalid share link) in the app's card style with a
 *  way back to the app. Distinct from AppErrorBoundary (render crashes). */
export function StatusPage({ titleKey, textKey }: StatusPageProps) {
  const { t } = useTranslation('common');
  useDocumentTitle(t(titleKey));

  return (
    <div className="status-page">
      <div className="status-page-card" role="status">
        <h1 className="status-page-title">{t(titleKey)}</h1>
        <p className="status-page-text">{t(textKey)}</p>
        <a href="/" className="status-page-btn">{t('legal.back_to_app')}</a>
      </div>
    </div>
  );
}
