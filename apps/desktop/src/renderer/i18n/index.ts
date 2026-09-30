import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import uk from './locales/uk.json';
import ru from './locales/ru.json';

export const SUPPORTED_LANGUAGES = ['en', 'uk', 'ru'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Each language named in itself, so a pilot can find theirs whatever the UI is showing. */
export const LANGUAGE_NATIVE_NAMES: Record<AppLanguage, string> = {
  en: 'English',
  uk: 'Українська',
  ru: 'Русский',
};

// The settings store loads asynchronously over IPC, so the last choice is mirrored here
// to render the very first frame in the right language instead of flashing English.
const STORAGE_KEY = 'ardudeck.language';

export function isAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

// Store tests import this module under plain Node, where there is no DOM.
const hasDom = typeof window !== 'undefined' && typeof document !== 'undefined';

function readStoredLanguage(): AppLanguage | null {
  if (!hasDom) return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isAppLanguage(stored) ? stored : null;
  } catch {
    return null;
  }
}

/** First run: follow the OS language when we have it, English otherwise. */
function detectSystemLanguage(): AppLanguage {
  const langs = hasDom ? navigator.languages ?? [navigator.language] : [];
  for (const tag of langs) {
    const base = tag?.toLowerCase().split('-')[0];
    if (isAppLanguage(base)) return base;
  }
  return 'en';
}

export function getInitialLanguage(): AppLanguage {
  return readStoredLanguage() ?? detectSystemLanguage();
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    uk: { translation: uk },
    ru: { translation: ru },
  },
  lng: getInitialLanguage(),
  // Anything not translated yet falls back to English rather than showing a raw key.
  fallbackLng: 'en',
  supportedLngs: SUPPORTED_LANGUAGES,
  interpolation: { escapeValue: false }, // React already escapes
  returnNull: false,
});

if (hasDom) document.documentElement.lang = i18n.language;

export function applyLanguage(language: AppLanguage): void {
  if (i18n.language !== language) void i18n.changeLanguage(language);
  if (!hasDom) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Storage can be unavailable; the settings store still persists the choice.
  }
  document.documentElement.lang = language;
}

export default i18n;
