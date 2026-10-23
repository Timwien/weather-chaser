import { Fragment, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.ts';
import { parseBlocks, type Block, type Inline } from './legalMarkup.ts';
import './LegalPage.css';

export type LegalDoc = 'privacy' | 'tos' | 'imprint';

interface LegalSection {
  /** Anchor id (stable, used by the table of contents). */
  id: string;
  h: string;
  /** Body in the small markup of legalMarkup.ts. */
  b: string;
  /** 'highlight' renders the section as a visually separated box (e.g. Art. 21 GDPR). */
  box?: 'highlight';
}

interface LegalSummary {
  h: string;
  b: string;
}

interface LegalPageProps {
  doc: LegalDoc;
}

/** Show a table of contents only for the longer documents. */
const TOC_MIN_SECTIONS = 6;

function renderInline(parts: Inline[]) {
  return parts.map((p, i) => {
    if (p.type === 'strong') return <strong key={i}>{p.text}</strong>;
    if (p.type === 'code') return <code key={i} className="legal-code">{p.text}</code>;
    if (p.type === 'link') {
      const external = /^https?:\/\//i.test(p.href);
      return (
        <a
          key={i}
          href={p.href}
          className="legal-link"
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {p.text}
        </a>
      );
    }
    return <Fragment key={i}>{p.text}</Fragment>;
  });
}

function renderBlocks(blocks: Block[]) {
  return blocks.map((block, i) =>
    block.type === 'ul' ? (
      <ul key={i} className="legal-list">
        {block.items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
      </ul>
    ) : (
      <p key={i} className="legal-paragraph">
        {block.lines.map((line, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {renderInline(line)}
          </Fragment>
        ))}
      </p>
    ),
  );
}

/**
 * Static legal page (/privacy, /tos, /impressum). All content lives in the
 * `legal` i18n namespace (rule 4); German is the binding version.
 */
export function LegalPage({ doc }: LegalPageProps) {
  const { t, i18n } = useTranslation('legal');
  useDocumentTitle(t(`${doc}.title`));

  const sections = t(`${doc}.sections`, { returnObjects: true }) as unknown as LegalSection[];
  const summary = i18n.exists(`${doc}.summary`, { ns: 'legal' })
    ? (t(`${doc}.summary`, { returnObjects: true }) as unknown as LegalSummary)
    : null;
  const list = Array.isArray(sections) ? sections : [];

  // The page is its own scroll container — scroll there instead of letting the
  // router handle a hash navigation.
  const jumpTo = (id: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="legal-page">
      <div className="legal-page-inner">
        <a href="/" className="legal-back-link">← {t('common.back_to_app')}</a>
        <h1 className="legal-title">{t(`${doc}.title`)}</h1>
        <p className="legal-updated">{t('common.updated')}</p>
        <div className="legal-intro">{renderBlocks(parseBlocks(t(`${doc}.intro`)))}</div>

        {summary && (
          <aside className="legal-box legal-box--summary" aria-label={summary.h}>
            <h2 className="legal-box-heading">{summary.h}</h2>
            <div className="legal-section-body">{renderBlocks(parseBlocks(summary.b))}</div>
          </aside>
        )}

        {list.length >= TOC_MIN_SECTIONS && (
          <nav className="legal-toc" aria-label={t('common.toc')}>
            <h2 className="legal-toc-heading">{t('common.toc')}</h2>
            <ol className="legal-toc-list">
              {list.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} onClick={jumpTo(s.id)} className="legal-link">{s.h}</a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        {list.map((s) => (
          <section
            key={s.id}
            id={s.id}
            className={`legal-section${s.box === 'highlight' ? ' legal-box legal-box--highlight' : ''}`}
          >
            <h2 className="legal-section-heading">{s.h}</h2>
            <div className="legal-section-body">{renderBlocks(parseBlocks(s.b))}</div>
          </section>
        ))}
      </div>
    </div>
  );
}
