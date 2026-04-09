import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import pl from '@/locales/pl.json'
import en from '@/locales/en.json'

// Resolve language based on user's explicit setting or browser detection
function resolveLanguage(): string {
  const setting = localStorage.getItem('app-language-setting')
  if (setting === 'en') return 'en'
  // 'auto' or no setting — detect from browser
  return navigator.language.startsWith('pl') ? 'pl' : 'en'
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      pl: { translation: pl },
      en: { translation: en },
    },
    lng: resolveLanguage(),
    fallbackLng: 'pl',
    supportedLngs: ['pl', 'en'],
    interpolation: { escapeValue: false },
  })

export default i18n
