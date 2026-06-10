// Minimal i18n bootstrap for the mobile scaffold (EN/DE parity, per project
// rule 4). TODO Phase 5: move the full locale JSONs from apps/web into a
// shared packages/locales so web + mobile consume identical translations.
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    common: {
      app: { title: 'WeatherChaser', tagline: 'Chase perfect weather' },
      mobile_scaffold: {
        core_check: 'Shared core check',
        core_ok: 'packages/core wired — demo route: {{stops}} stops, {{km}} km',
        coming_soon: 'Native app under construction',
      },
    },
  },
  de: {
    common: {
      app: { title: 'WeatherChaser', tagline: 'Jage das perfekte Wetter' },
      mobile_scaffold: {
        core_check: 'Shared-Core-Check',
        core_ok: 'packages/core verbunden — Demo-Route: {{stops}} Stopps, {{km}} km',
        coming_soon: 'Native App im Aufbau',
      },
    },
  },
};

void i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

export default i18n;
