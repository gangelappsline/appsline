import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslations from './locales/en.json';
import esTranslations from './locales/es.json';

i18n
  .use(LanguageDetector) // Detecta idioma del navegador
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: enTranslations,
      },
      es: {
        translation: esTranslations,
      },
    },
    fallbackLng: 'es', // Idioma por defecto
    debug: false, // Cambia a true para debugging

    interpolation: {
      escapeValue: false, // React ya escapa valores
    },
  });

export default i18n;