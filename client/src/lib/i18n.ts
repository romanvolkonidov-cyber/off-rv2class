import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'ru',
    supportedLngs: ['ru', 'en'],
    debug: process.env.NODE_ENV === 'development',
    interpolation: {
      escapeValue: false, // React already safes from XSS
    },
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    defaultNS: 'common',
    react: {
      useSuspense: false, // Prevents Next.js static generation from hanging during Vercel builds
    },
  });

export default i18n;