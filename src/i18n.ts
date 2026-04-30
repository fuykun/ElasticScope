import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import tr from './locales/tr.json';

const resources = {
    en: { translation: en },
    tr: { translation: tr }
};

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

// Update HTML lang attribute when language changes
const updateHtmlLang = (lng: string) => {
    if (!isBrowser) return;
    document.documentElement.lang = lng;
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'en',
        defaultNS: 'translation',
        interpolation: {
            escapeValue: false
        },
        detection: {
            order: isBrowser ? ['localStorage', 'navigator', 'htmlTag'] : [],
            caches: isBrowser ? ['localStorage'] : [],
            lookupLocalStorage: 'elasticscope-language'
        }
    });

// Set initial lang and listen for changes
updateHtmlLang(i18n.language);
i18n.on('languageChanged', updateHtmlLang);

export default i18n;
