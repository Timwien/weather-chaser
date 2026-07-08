import { useTranslation } from 'react-i18next';
import './LegalPage.css';

interface LegalSection {
  /** i18n key of the section heading */
  h: string;
  /** i18n key of the section body (plain text, newlines allowed) */
  b: string;
}

interface LegalPageProps {
  titleKey: string;
  updatedKey: string;
  introKey: string;
  sections: LegalSection[];
}

/**
 * Simple static legal page (/privacy, /tos). All content lives in the locale
 * files (rule 4) so DE/EN stay in lockstep with the rest of the app.
 */
export function LegalPage({ titleKey, updatedKey, introKey, sections }: LegalPageProps) {
  const { t } = useTranslation('common');

  return (
    <div className="legal-page">
      <div className="legal-page-inner">
        <a href="/" className="legal-back-link">← {t('legal.back_to_app')}</a>
        <h1 className="legal-title">{t(titleKey)}</h1>
        <p className="legal-updated">{t(updatedKey)}</p>
        <p className="legal-intro">{t(introKey)}</p>
        {sections.map(({ h, b }) => (
          <section key={h} className="legal-section">
            <h2 className="legal-section-heading">{t(h)}</h2>
            <p className="legal-section-body">{t(b)}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
