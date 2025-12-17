module.exports = {
  i18n: {
    defaultLocale: 'ru',
    locales: ['ru', 'en'],
    localeDetection: true,
  },
  fallbackLng: 'ru',
  ns: ['common', 'auth', 'chat', 'admin', 'errors'],
  defaultNS: 'common',
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
  backend: {
    loadPath: '/locales/{{lng}}/{{ns}}.json',
  },
  detection: {
    order: ['localStorage', 'cookie', 'navigator', 'htmlTag'],
    caches: ['localStorage', 'cookie'],
  },
};