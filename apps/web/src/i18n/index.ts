import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en/common.json';
import de from './locales/de/common.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: en },
      de: { common: de },
    },
    defaultNS: 'common',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

// Keep <html lang> in sync with the active language (screen readers, hyphenation).
const syncHtmlLang = (lng: string) => {
  document.documentElement.lang = (lng || 'en').split('-')[0];
};
i18n.on('languageChanged', syncHtmlLang);
syncHtmlLang(i18n.language);

let legalLoad: Promise<void> | null = null;

/**
 * The `legal` namespace (privacy policy, terms, imprint + the short legal notes
 * at sign-up and feedback; German is binding) is ~20 kB gzip and rarely needed,
 * so it is loaded on demand instead of being bundled with `common`.
 * Resolves once both languages are registered; a failed load can be retried.
 */
export function loadLegalNamespace(): Promise<void> {
  legalLoad ??= Promise.all([
    import('./locales/de/legal.json'),
    import('./locales/en/legal.json'),
  ])
    .then(([deLegal, enLegal]) => {
      i18n.addResourceBundle('de', 'legal', deLegal.default, true, true);
      i18n.addResourceBundle('en', 'legal', enLegal.default, true, true);
    })
    .catch((e: unknown) => {
      legalLoad = null;
      throw e;
    });
  return legalLoad;
}

export default i18n;
