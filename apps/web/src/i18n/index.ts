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

export default i18n;
