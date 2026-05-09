import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import tl from './tl.json';

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, tl: { translation: tl } },
  lng: localStorage.getItem('librams-lang') ?? 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export { i18n };
